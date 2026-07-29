import { inventoryLedger } from "@/src/db/schema";

type DatabaseTransaction = Parameters<Parameters<typeof import("@/src/db/client").db.transaction>[0]>[0];

type LedgerReference = {
  itemId: number;
  refType: "RECEIPT" | "APPROVAL" | "SHIPMENT" | "ADJUSTMENT" | "MIGRATION";
  refId: number;
  memo?: string | null;
  createdBy: number;
};

async function appendLedgerEntry(
  transaction: DatabaseTransaction,
  reference: LedgerReference,
  values: {
    ledgerType: "INBOUND" | "ALLOCATE" | "OUTBOUND" | "RELEASE" | "ADJUST" | "OPENING";
    onHandDelta: number;
    allocatedDelta: number;
  },
) {
  // BR-INV-001, BR-INV-003: the ledger is append-only and contains only six fixed types.
  await transaction.insert(inventoryLedger).values({ ...reference, ...values });
}

export function recordInboundLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { receivedQty: number },
) {
  const { receivedQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    ledgerType: "INBOUND",
    onHandDelta: receivedQty,
    allocatedDelta: 0,
  });
}

export function recordAllocateLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { approvedQty: number },
) {
  const { approvedQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    ledgerType: "ALLOCATE",
    onHandDelta: 0,
    allocatedDelta: approvedQty,
  });
}

export function recordOutboundLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { shippedQty: number },
) {
  const { shippedQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    ledgerType: "OUTBOUND",
    onHandDelta: -shippedQty,
    allocatedDelta: -shippedQty,
  });
}

export function recordReleaseLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { approvedQty: number },
) {
  const { approvedQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    ledgerType: "RELEASE",
    onHandDelta: 0,
    allocatedDelta: -approvedQty,
  });
}

export function recordAdjustLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { deltaQty: number },
) {
  const { deltaQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    ledgerType: "ADJUST",
    onHandDelta: deltaQty,
    allocatedDelta: 0,
  });
}

export function recordOpeningLedger(
  transaction: DatabaseTransaction,
  reference: LedgerReference & { openingQty: number },
) {
  const { openingQty, ...ledgerReference } = reference;
  return appendLedgerEntry(transaction, ledgerReference, {
    // BR-MIG-004: migration initial inventory uses OPENING, never ADJUST.
    ledgerType: "OPENING",
    onHandDelta: openingQty,
    allocatedDelta: 0,
  });
}
