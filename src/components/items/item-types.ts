export type ItemRecord = {
  id: number;
  itemCode: string;
  barcode: string | null;
  itemName: string;
  categoryMajor: string | null;
  categoryMinor: string | null;
  unitSpec: string | null;
  unitName: string | null;
  packQty: number;
  packUnit: string;
  purchasePrice?: number;
  supplyPrice: number;
  minStockQty?: number | null;
  remarks: string | null;
  isActive: boolean;
  onHandQty?: number;
  allocatedQty?: number;
  availableQty: number;
  isBelowMinStock?: boolean;
};

export type ItemListPayload = {
  data: ItemRecord[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
};

export type CurrentUserPayload = {
  role: "ADMIN" | "PURCHASER" | "WAREHOUSE" | "BRANCH";
};

export function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
