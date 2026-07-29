import { inArray } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db } from "@/src/db/client";
import { items } from "@/src/db/schema";
import { recordOpeningLedger } from "@/src/domain/inventory-ledger";
import { AppError } from "@/src/lib/errors";

type UploadError = {
  row: number;
  field: string;
  reason: string;
};

type ParsedSpecification = {
  unitSpec: string | null;
  unitName: string | null;
  packQty: number;
  packUnit: string;
  isSpecParseFailed: boolean;
};

type ItemMigrationRow = {
  rowNumber: number;
  itemCode: string;
  itemName: string;
  barcode: string | null;
  categoryMajor: string | null;
  categoryMinor: string | null;
  purchasePrice: number;
  supplyPrice: number;
  minStockQty: number | null;
  remarks: string | null;
  specRaw: string | null;
  specification: ParsedSpecification;
  openingQty: number;
};

const columnAliases = {
  itemCode: ["itemcode", "자체품목코드", "품목코드"],
  itemName: ["itemname", "상품명"],
  barcode: ["barcode", "바코드번호", "바코드"],
  categoryMajor: ["categorymajor", "카테고리대분류"],
  categoryMinor: ["categoryminor", "카테고리소분류"],
  specRaw: ["specraw", "규격"],
  purchasePrice: ["purchaseprice", "매입단가"],
  supplyPrice: ["supplyprice", "지점공급단가"],
  minStockQty: ["minstockqty", "최소재고수량"],
  remarks: ["remarks", "비고"],
  openingQty: ["openingqty", "초기재고"],
} as const;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();
}

function valueAt(row: unknown[], columnIndexes: Map<string, number>, aliases: readonly string[]) {
  const index = aliases.map((alias) => columnIndexes.get(alias)).find((value) => value !== undefined);
  return index === undefined ? undefined : row[index];
}

function textValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function nonnegativeInteger(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { empty: true, valid: false, value: null };
  }

  const numberValue = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    return { empty: false, valid: false, value: null };
  }

  return { empty: false, valid: true, value: numberValue };
}

export function parseItemSpecification(specRaw: string | null): ParsedSpecification {
  if (!specRaw) {
    return { unitSpec: null, unitName: null, packQty: 1, packUnit: "", isSpecParseFailed: true };
  }

  const separatorIndex = specRaw.lastIndexOf("/");
  if (separatorIndex <= 0 || separatorIndex === specRaw.length - 1) {
    return { unitSpec: null, unitName: null, packQty: 1, packUnit: "", isSpecParseFailed: true };
  }

  const beforePackUnit = specRaw.slice(0, separatorIndex).trim();
  const packUnit = specRaw.slice(separatorIndex + 1).trim();
  if (!beforePackUnit || !packUnit) {
    return { unitSpec: null, unitName: null, packQty: 1, packUnit: "", isSpecParseFailed: true };
  }

  const packMatch = beforePackUnit.match(/^(.*?)(\d+)\s*입$/);
  if (packMatch) {
    const unitSpec = packMatch[1]?.trim() || null;
    const packQty = Number(packMatch[2]);
    if (unitSpec && Number.isInteger(packQty) && packQty > 0) {
      // BR-MIG-003: the '입' notation uses the default individual unit '개'.
      return { unitSpec, unitName: "개", packQty, packUnit, isSpecParseFailed: false };
    }
  }

  const compactMatch = beforePackUnit.match(/^(\d+)\s*([^\d\s]+)$/);
  if (compactMatch) {
    const packQty = Number(compactMatch[1]);
    const unitName = compactMatch[2]?.trim() || null;
    if (unitName && Number.isInteger(packQty) && packQty > 0) {
      return { unitSpec: null, unitName, packQty, packUnit, isSpecParseFailed: false };
    }
  }

  // The database requires a positive packQty and non-null packUnit. Empty values mark a failed parse.
  return { unitSpec: null, unitName: null, packQty: 1, packUnit: "", isSpecParseFailed: true };
}

function uploadValidationError(errors: UploadError[]) {
  throw new AppError(
    "UPLOAD_VALIDATION_FAILED",
    { errors },
    `${errors.length}개 행에서 오류가 발견되어 반영하지 않았습니다.`,
  );
}

function parseWorkbookRows(workbook: XLSX.WorkBook) {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    uploadValidationError([{ row: 1, field: "file", reason: "업로드할 시트가 없습니다." }]);
  }

  const worksheet = workbook.Sheets[firstSheetName!];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  const headerRow = rows[0];
  if (!headerRow) {
    uploadValidationError([{ row: 1, field: "file", reason: "열 제목이 없습니다." }]);
  }

  const columnIndexes = new Map<string, number>();
  headerRow!.forEach((header, index) => columnIndexes.set(normalizeHeader(header), index));
  const errors: UploadError[] = [];
  const parsedRows: ItemMigrationRow[] = [];
  const seenItemCodes = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowNumber = index + 1;
    const itemCode = textValue(valueAt(row, columnIndexes, columnAliases.itemCode));
    const itemName = textValue(valueAt(row, columnIndexes, columnAliases.itemName));
    const purchasePrice = nonnegativeInteger(valueAt(row, columnIndexes, columnAliases.purchasePrice));
    const supplyPrice = nonnegativeInteger(valueAt(row, columnIndexes, columnAliases.supplyPrice));
    const minStockQty = nonnegativeInteger(valueAt(row, columnIndexes, columnAliases.minStockQty));
    const openingQty = nonnegativeInteger(valueAt(row, columnIndexes, columnAliases.openingQty));

    if (!itemCode) {
      errors.push({ row: rowNumber, field: "itemCode", reason: "필수 항목이 비어 있습니다." });
    } else if (seenItemCodes.has(itemCode)) {
      errors.push({ row: rowNumber, field: "itemCode", reason: "중복된 품목코드입니다." });
    } else {
      seenItemCodes.add(itemCode);
    }
    if (!itemName) {
      errors.push({ row: rowNumber, field: "itemName", reason: "필수 항목이 비어 있습니다." });
    }
    if (!purchasePrice.valid) {
      errors.push({
        row: rowNumber,
        field: "purchasePrice",
        reason: purchasePrice.empty ? "필수 항목이 비어 있습니다." : "숫자가 아닙니다.",
      });
    }
    if (!supplyPrice.valid) {
      errors.push({
        row: rowNumber,
        field: "supplyPrice",
        reason: supplyPrice.empty ? "필수 항목이 비어 있습니다." : "숫자가 아닙니다.",
      });
    }
    if (!minStockQty.empty && !minStockQty.valid) {
      errors.push({ row: rowNumber, field: "minStockQty", reason: "숫자가 아닙니다." });
    }
    if (!openingQty.empty && !openingQty.valid) {
      errors.push({ row: rowNumber, field: "openingQty", reason: "숫자가 아닙니다." });
    }

    if (!itemCode || !itemName || !purchasePrice.valid || !supplyPrice.valid || errors.some((error) => error.row === rowNumber)) {
      continue;
    }

    const specRaw = textValue(valueAt(row, columnIndexes, columnAliases.specRaw));
    parsedRows.push({
      rowNumber,
      itemCode,
      itemName,
      barcode: textValue(valueAt(row, columnIndexes, columnAliases.barcode)),
      categoryMajor: textValue(valueAt(row, columnIndexes, columnAliases.categoryMajor)),
      categoryMinor: textValue(valueAt(row, columnIndexes, columnAliases.categoryMinor)),
      purchasePrice: purchasePrice.value!,
      supplyPrice: supplyPrice.value!,
      minStockQty: minStockQty.empty ? null : minStockQty.value,
      remarks: textValue(valueAt(row, columnIndexes, columnAliases.remarks)),
      specRaw,
      specification: parseItemSpecification(specRaw),
      openingQty: openingQty.empty ? 0 : openingQty.value!,
    });
  }

  if (rows.length < 2) {
    errors.push({ row: 2, field: "file", reason: "등록할 품목이 없습니다." });
  }

  return { errors, parsedRows };
}

export async function importItemWorkbook(file: File, createdBy: number) {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    uploadValidationError([{ row: 1, field: "file", reason: "엑셀 파일을 읽을 수 없습니다." }]);
  }

  const { errors, parsedRows } = parseWorkbookRows(workbook!);
  const itemCodes = parsedRows.map((row) => row.itemCode);
  if (itemCodes.length > 0) {
    const existingItems = await db
      .select({ itemCode: items.itemCode })
      .from(items)
      .where(inArray(items.itemCode, itemCodes));
    const existingItemCodes = new Set(existingItems.map((item) => item.itemCode));
    for (const row of parsedRows) {
      if (existingItemCodes.has(row.itemCode)) {
        errors.push({ row: row.rowNumber, field: "itemCode", reason: "중복된 품목코드입니다." });
      }
    }
  }

  if (errors.length > 0) {
    // BR-MIG-002: no insert begins before every uploaded row is validated.
    uploadValidationError(errors);
  }

  await db.transaction(async (transaction) => {
    for (const row of parsedRows) {
      const [createdItem] = await transaction
        .insert(items)
        .values({
          // BR-ITM-002: the migration preserves the source item code.
          itemCode: row.itemCode,
          itemName: row.itemName,
          barcode: row.barcode,
          categoryMajor: row.categoryMajor,
          categoryMinor: row.categoryMinor,
          unitSpec: row.specification.unitSpec,
          unitName: row.specification.unitName,
          packQty: row.specification.packQty,
          packUnit: row.specification.packUnit,
          purchasePrice: row.purchasePrice,
          supplyPrice: row.supplyPrice,
          minStockQty: row.minStockQty,
          remarks: row.remarks,
          specRaw: row.specification.isSpecParseFailed ? row.specRaw : null,
          isSpecParseFailed: row.specification.isSpecParseFailed,
        })
        .returning({ id: items.id });

      if (row.openingQty > 0 && createdItem) {
        await recordOpeningLedger(transaction, {
          itemId: createdItem.id,
          refType: "MIGRATION",
          refId: createdItem.id,
          openingQty: row.openingQty,
          createdBy,
        });
      }
    }
  });

  return {
    insertedCount: parsedRows.length,
    specParseFailedCount: parsedRows.filter((row) => row.specification.isSpecParseFailed).length,
  };
}
