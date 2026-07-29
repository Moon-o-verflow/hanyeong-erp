import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  like,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/src/db/client";
import { withItemLock } from "@/src/db/lock";
import {
  branches,
  internalOrderApprovals,
  internalOrders,
  items,
  shipments,
  users,
  vItemStock,
} from "@/src/db/schema";
import {
  recordAllocateLedger,
  recordOutboundLedger,
  recordReleaseLedger,
} from "@/src/domain/inventory-ledger";
import { AppError } from "@/src/lib/errors";
import { paginationOffset } from "@/src/lib/schemas/common";
import type {
  InternalOrderApproveInput,
  InternalOrderCancelInput,
  InternalOrderCreateInput,
  InternalOrderListInput,
  InternalOrderRejectInput,
} from "@/src/lib/schemas/internal-orders";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const shipmentUsers = alias(users, "shipment_users");

function kstYearMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}${month}`;
}

function isUniqueViolation(failure: unknown) {
  if (!failure || typeof failure !== "object") {
    return false;
  }

  const errorLike = failure as { code?: unknown; cause?: { code?: unknown } };
  return errorLike.code === "23505" || errorLike.cause?.code === "23505";
}

function nextInternalOrderStatus(requestedQty: number, approvedQty: number, canceledQty: number) {
  const outstandingQty = requestedQty - approvedQty - canceledQty;
  if (outstandingQty === 0) {
    return approvedQty === 0 ? "CANCELED" : "COMPLETED";
  }

  return approvedQty > 0 ? "PARTIALLY_APPROVED" : "PENDING";
}

async function getItemIdForInternalOrder(internalOrderId: number) {
  const [internalOrder] = await db
    .select({ itemId: internalOrders.itemId })
    .from(internalOrders)
    .where(eq(internalOrders.id, internalOrderId))
    .limit(1);
  if (!internalOrder) {
    throw new AppError("NOT_FOUND");
  }

  return internalOrder.itemId;
}

async function getItemIdForApproval(approvalId: number) {
  const [approval] = await db
    .select({ itemId: internalOrders.itemId })
    .from(internalOrderApprovals)
    .innerJoin(internalOrders, eq(internalOrderApprovals.internalOrderId, internalOrders.id))
    .where(eq(internalOrderApprovals.id, approvalId))
    .limit(1);
  if (!approval) {
    throw new AppError("NOT_FOUND");
  }

  return approval.itemId;
}

async function loadInternalOrderForChange(transaction: DatabaseTransaction, internalOrderId: number) {
  const [internalOrder] = await transaction
    .select({
      id: internalOrders.id,
      branchId: internalOrders.branchId,
      itemId: internalOrders.itemId,
      requestedQty: internalOrders.requestedQty,
      approvedQty: internalOrders.approvedQty,
      canceledQty: internalOrders.canceledQty,
      outstandingQty: sql<number>`coalesce(${internalOrders.outstandingQty}, 0)`,
      status: internalOrders.status,
    })
    .from(internalOrders)
    .where(eq(internalOrders.id, internalOrderId))
    .limit(1);
  if (!internalOrder) {
    throw new AppError("NOT_FOUND");
  }

  return internalOrder;
}

async function loadCurrentInventory(transaction: DatabaseTransaction, itemId: number) {
  const [currentInventory] = await transaction
    .select({
      onHandQty: vItemStock.onHandQty,
      allocatedQty: vItemStock.allocatedQty,
      availableQty: vItemStock.availableQty,
    })
    .from(vItemStock)
    .where(eq(vItemStock.itemId, itemId))
    .limit(1);
  if (!currentInventory) {
    throw new AppError("NOT_FOUND");
  }

  return currentInventory;
}

function assertMutableInternalOrder(status: string) {
  if (status === "REJECTED") {
    // BR-IOR-009, BR-IOR-010: rejected orders never transition again.
    throw new AppError("REJECTED_ORDER_IMMUTABLE");
  }
}

function toListEntry(internalOrder: {
  id: number;
  orderNo: string;
  branchId: number;
  branchName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  packUnit: string;
  requestedQty: number;
  approvedQty: number;
  canceledQty: number;
  outstandingQty: number;
  requestedDueDate: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: internalOrder.id,
    orderNo: internalOrder.orderNo,
    branchId: internalOrder.branchId,
    branchName: internalOrder.branchName,
    item: {
      id: internalOrder.itemId,
      itemCode: internalOrder.itemCode,
      itemName: internalOrder.itemName,
      packUnit: internalOrder.packUnit,
    },
    requestedQty: internalOrder.requestedQty,
    approvedQty: internalOrder.approvedQty,
    canceledQty: internalOrder.canceledQty,
    outstandingQty: internalOrder.outstandingQty,
    requestedDueDate: internalOrder.requestedDueDate,
    status: internalOrder.status,
    createdAt: internalOrder.createdAt,
  };
}

export async function listInternalOrders(
  values: InternalOrderListInput,
  branchScope?: number,
  outstandingOnly = false,
) {
  const conditions = [
    ...(branchScope ? [eq(internalOrders.branchId, branchScope)] : values.branchId ? [eq(internalOrders.branchId, values.branchId)] : []),
    ...(values.status ? [eq(internalOrders.status, values.status)] : []),
    ...(values.itemKeyword ? [ilike(items.itemName, `%${values.itemKeyword}%`)] : []),
    ...(values.orderNo ? [eq(internalOrders.orderNo, values.orderNo)] : []),
    ...(outstandingOnly ? [gt(internalOrders.outstandingQty, 0), or(eq(internalOrders.status, "PENDING"), eq(internalOrders.status, "PARTIALLY_APPROVED"))] : []),
  ];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const listQuery = db
    .select({
      id: internalOrders.id,
      orderNo: internalOrders.orderNo,
      branchId: internalOrders.branchId,
      branchName: branches.branchName,
      itemId: items.id,
      itemCode: items.itemCode,
      itemName: items.itemName,
      packUnit: items.packUnit,
      requestedQty: internalOrders.requestedQty,
      approvedQty: internalOrders.approvedQty,
      canceledQty: internalOrders.canceledQty,
      outstandingQty: sql<number>`coalesce(${internalOrders.outstandingQty}, 0)`,
      requestedDueDate: internalOrders.requestedDueDate,
      status: internalOrders.status,
      createdAt: internalOrders.createdAt,
    })
    .from(internalOrders)
    .innerJoin(branches, eq(internalOrders.branchId, branches.id))
    .innerJoin(items, eq(internalOrders.itemId, items.id))
    .where(where)
    .orderBy(desc(internalOrders.createdAt), desc(internalOrders.id))
    .limit(values.size)
    .offset(paginationOffset(values));
  const countQuery = db
    .select({ totalElements: count() })
    .from(internalOrders)
    .innerJoin(items, eq(internalOrders.itemId, items.id))
    .where(where);
  const [records, totalResult] = await Promise.all([listQuery, countQuery]);

  return { data: records.map(toListEntry), totalElements: totalResult[0]?.totalElements ?? 0 };
}

export async function getInternalOrder(internalOrderId: number, branchScope?: number) {
  const [internalOrder] = await db
    .select({
      id: internalOrders.id,
      orderNo: internalOrders.orderNo,
      branchId: internalOrders.branchId,
      branchName: branches.branchName,
      itemId: items.id,
      itemCode: items.itemCode,
      itemName: items.itemName,
      packUnit: items.packUnit,
      requestedQty: internalOrders.requestedQty,
      approvedQty: internalOrders.approvedQty,
      canceledQty: internalOrders.canceledQty,
      outstandingQty: sql<number>`coalesce(${internalOrders.outstandingQty}, 0)`,
      requestedDueDate: internalOrders.requestedDueDate,
      remarks: internalOrders.remarks,
      status: internalOrders.status,
      rejectReason: internalOrders.rejectReason,
      originOrderId: internalOrders.originOrderId,
      createdBy: users.userName,
      createdAt: internalOrders.createdAt,
    })
    .from(internalOrders)
    .innerJoin(branches, eq(internalOrders.branchId, branches.id))
    .innerJoin(items, eq(internalOrders.itemId, items.id))
    .innerJoin(users, eq(internalOrders.createdBy, users.id))
    .where(eq(internalOrders.id, internalOrderId))
    .limit(1);
  if (!internalOrder) {
    throw new AppError("NOT_FOUND");
  }
  if (branchScope && internalOrder.branchId !== branchScope) {
    throw new AppError("BRANCH_SCOPE_VIOLATION");
  }

  const approvals = await db
    .select({
      id: internalOrderApprovals.id,
      approvedQty: internalOrderApprovals.approvedQty,
      plannedShipDate: internalOrderApprovals.plannedShipDate,
      status: internalOrderApprovals.status,
      approvedBy: users.userName,
      approvedAt: internalOrderApprovals.approvedAt,
      shippedBy: shipmentUsers.userName,
      shippedAt: shipments.shippedAt,
    })
    .from(internalOrderApprovals)
    .innerJoin(users, eq(internalOrderApprovals.approvedBy, users.id))
    .leftJoin(shipments, eq(shipments.approvalId, internalOrderApprovals.id))
    .leftJoin(shipmentUsers, eq(shipments.shippedBy, shipmentUsers.id))
    .where(eq(internalOrderApprovals.internalOrderId, internalOrderId))
    .orderBy(asc(internalOrderApprovals.id));

  return {
    ...toListEntry(internalOrder),
    remarks: internalOrder.remarks,
    rejectReason: internalOrder.rejectReason,
    originOrderId: internalOrder.originOrderId,
    createdBy: internalOrder.createdBy,
    approvals,
  };
}

export async function createInternalOrder(
  values: InternalOrderCreateInput,
  branchId: number,
  createdBy: number,
) {
  const yearMonth = kstYearMonth();
  const prefix = `IO-${yearMonth}-`;
  for (let retryNumber = 0; retryNumber < 3; retryNumber += 1) {
    try {
      return await db.transaction(async (transaction) => {
        const [item] = await transaction
          .select({ id: items.id, isActive: items.isActive })
          .from(items)
          .where(eq(items.id, values.itemId))
          .limit(1);
        if (!item) {
          throw new AppError("NOT_FOUND");
        }
        if (!item.isActive) {
          throw new AppError("ITEM_INACTIVE");
        }

        if (values.originOrderId) {
          const [originInternalOrder] = await transaction
            .select({ branchId: internalOrders.branchId, status: internalOrders.status })
            .from(internalOrders)
            .where(eq(internalOrders.id, values.originOrderId))
            .limit(1);
          if (!originInternalOrder) {
            throw new AppError("NOT_FOUND");
          }
          if (originInternalOrder.branchId !== branchId) {
            throw new AppError("BRANCH_SCOPE_VIOLATION");
          }
          if (originInternalOrder.status !== "REJECTED") {
            throw new AppError("VALIDATION_ERROR");
          }
        }

        const [latestInternalOrder] = await transaction
          .select({ orderNo: internalOrders.orderNo })
          .from(internalOrders)
          .where(like(internalOrders.orderNo, `${prefix}%`))
          .orderBy(desc(internalOrders.orderNo))
          .limit(1);
        const nextSequence = latestInternalOrder ? Number(latestInternalOrder.orderNo.slice(-4)) + 1 : 1;
        const orderNo = `${prefix}${String(nextSequence).padStart(4, "0")}`;
        const [createdInternalOrder] = await transaction
          .insert(internalOrders)
          .values({
            orderNo,
            branchId,
            itemId: values.itemId,
            requestedQty: values.requestedQty,
            requestedDueDate: values.requestedDueDate,
            remarks: values.remarks,
            status: "PENDING",
            originOrderId: values.originOrderId ?? null,
            createdBy,
          })
          .returning({ id: internalOrders.id });
        if (!createdInternalOrder) {
          throw new AppError("CONCURRENCY_CONFLICT");
        }

        return createdInternalOrder.id;
      });
    } catch (failure) {
      if (!isUniqueViolation(failure)) {
        throw failure;
      }
      if (retryNumber === 2) {
        throw new AppError("CONCURRENCY_CONFLICT");
      }
    }
  }

  throw new AppError("CONCURRENCY_CONFLICT");
}

export async function approveInternalOrder(
  internalOrderId: number,
  values: InternalOrderApproveInput,
  approvedBy: number,
) {
  const itemId = await getItemIdForInternalOrder(internalOrderId);
  return withItemLock(itemId, async (transaction) => {
    const internalOrder = await loadInternalOrderForChange(transaction, internalOrderId);
    assertMutableInternalOrder(internalOrder.status);
    if (internalOrder.status !== "PENDING" && internalOrder.status !== "PARTIALLY_APPROVED") {
      throw new AppError("INVALID_STATUS_TRANSITION");
    }
    if (values.approvedQty > internalOrder.outstandingQty) {
      throw new AppError("QTY_EXCEEDS_OUTSTANDING", {
        outstandingQty: internalOrder.outstandingQty,
        approvedQty: values.approvedQty,
      });
    }

    const currentInventory = await loadCurrentInventory(transaction, internalOrder.itemId);
    if (currentInventory.availableQty < values.approvedQty) {
      // BR-INV-014: do not create an automatic partial approval.
      throw new AppError("INSUFFICIENT_AVAILABLE_STOCK", {
        itemId: internalOrder.itemId,
        availableQty: currentInventory.availableQty,
        requestedQty: values.approvedQty,
      });
    }

    const [approval] = await transaction
      .insert(internalOrderApprovals)
      .values({
        internalOrderId,
        approvedQty: values.approvedQty,
        plannedShipDate: values.plannedShipDate,
        status: "ALLOCATED",
        approvedBy,
      })
      .returning({ id: internalOrderApprovals.id });
    if (!approval) {
      throw new AppError("CONCURRENCY_CONFLICT");
    }

    await recordAllocateLedger(transaction, {
      itemId: internalOrder.itemId,
      refType: "APPROVAL",
      refId: approval.id,
      approvedQty: values.approvedQty,
      createdBy: approvedBy,
    });
    const approvedQty = internalOrder.approvedQty + values.approvedQty;
    await transaction
      .update(internalOrders)
      .set({
        approvedQty,
        status: nextInternalOrderStatus(
          internalOrder.requestedQty,
          approvedQty,
          internalOrder.canceledQty,
        ),
        updatedAt: new Date(),
      })
      .where(eq(internalOrders.id, internalOrderId));

    return approval.id;
  });
}

export async function rejectInternalOrder(
  internalOrderId: number,
  values: InternalOrderRejectInput,
) {
  if (!values.rejectReason) {
    throw new AppError("REJECT_REASON_REQUIRED");
  }

  const itemId = await getItemIdForInternalOrder(internalOrderId);
  await withItemLock(itemId, async (transaction) => {
    const internalOrder = await loadInternalOrderForChange(transaction, internalOrderId);
    assertMutableInternalOrder(internalOrder.status);
    if (internalOrder.status !== "PENDING") {
      throw new AppError("INVALID_STATUS_TRANSITION");
    }

    await transaction
      .update(internalOrders)
      .set({ status: "REJECTED", rejectReason: values.rejectReason, updatedAt: new Date() })
      .where(eq(internalOrders.id, internalOrderId));
  });
}

export async function cancelInternalOrderOutstanding(
  internalOrderId: number,
  values: InternalOrderCancelInput,
  branchId: number,
) {
  const itemId = await getItemIdForInternalOrder(internalOrderId);
  await withItemLock(itemId, async (transaction) => {
    const internalOrder = await loadInternalOrderForChange(transaction, internalOrderId);
    if (internalOrder.branchId !== branchId) {
      throw new AppError("BRANCH_SCOPE_VIOLATION");
    }
    assertMutableInternalOrder(internalOrder.status);
    if (internalOrder.status !== "PENDING" && internalOrder.status !== "PARTIALLY_APPROVED") {
      throw new AppError("INVALID_STATUS_TRANSITION");
    }
    if (values.cancelQty > internalOrder.outstandingQty) {
      throw new AppError("QTY_EXCEEDS_OUTSTANDING", {
        outstandingQty: internalOrder.outstandingQty,
        cancelQty: values.cancelQty,
      });
    }

    const canceledQty = internalOrder.canceledQty + values.cancelQty;
    await transaction
      .update(internalOrders)
      .set({
        canceledQty,
        status: nextInternalOrderStatus(
          internalOrder.requestedQty,
          internalOrder.approvedQty,
          canceledQty,
        ),
        updatedAt: new Date(),
      })
      .where(eq(internalOrders.id, internalOrderId));
  });
}

export async function cancelInternalOrderApproval(approvalId: number, canceledBy: number) {
  const itemId = await getItemIdForApproval(approvalId);
  await withItemLock(itemId, async (transaction) => {
    const [approval] = await transaction
      .select({
        id: internalOrderApprovals.id,
        internalOrderId: internalOrderApprovals.internalOrderId,
        approvedQty: internalOrderApprovals.approvedQty,
        status: internalOrderApprovals.status,
        itemId: internalOrders.itemId,
      })
      .from(internalOrderApprovals)
      .innerJoin(internalOrders, eq(internalOrderApprovals.internalOrderId, internalOrders.id))
      .where(eq(internalOrderApprovals.id, approvalId))
      .limit(1);
    if (!approval) {
      throw new AppError("NOT_FOUND");
    }
    if (approval.status === "SHIPPED") {
      throw new AppError("APPROVAL_ALREADY_SHIPPED");
    }
    if (approval.status !== "ALLOCATED") {
      throw new AppError("INVALID_STATUS_TRANSITION");
    }

    const internalOrder = await loadInternalOrderForChange(transaction, approval.internalOrderId);
    await recordReleaseLedger(transaction, {
      itemId: approval.itemId,
      refType: "APPROVAL",
      refId: approval.id,
      approvedQty: approval.approvedQty,
      createdBy: canceledBy,
    });
    await transaction
      .update(internalOrderApprovals)
      .set({ status: "CANCELED", canceledBy, canceledAt: new Date() })
      .where(eq(internalOrderApprovals.id, approvalId));

    const approvedQty = internalOrder.approvedQty - approval.approvedQty;
    await transaction
      .update(internalOrders)
      .set({
        approvedQty,
        status: nextInternalOrderStatus(
          internalOrder.requestedQty,
          approvedQty,
          internalOrder.canceledQty,
        ),
        updatedAt: new Date(),
      })
      .where(eq(internalOrders.id, internalOrder.id));
  });
}

export async function shipInternalOrderApproval(approvalId: number, shippedBy: number) {
  const itemId = await getItemIdForApproval(approvalId);
  await withItemLock(itemId, async (transaction) => {
    const [approval] = await transaction
      .select({
        id: internalOrderApprovals.id,
        approvedQty: internalOrderApprovals.approvedQty,
        status: internalOrderApprovals.status,
        itemId: internalOrders.itemId,
      })
      .from(internalOrderApprovals)
      .innerJoin(internalOrders, eq(internalOrderApprovals.internalOrderId, internalOrders.id))
      .where(eq(internalOrderApprovals.id, approvalId))
      .limit(1);
    if (!approval) {
      throw new AppError("NOT_FOUND");
    }
    if (approval.status !== "ALLOCATED") {
      throw new AppError("INVALID_STATUS_TRANSITION");
    }

    const currentInventory = await loadCurrentInventory(transaction, approval.itemId);
    if (currentInventory.onHandQty < approval.approvedQty) {
      // BR-INV-010: partial shipment is not permitted.
      throw new AppError("INSUFFICIENT_ON_HAND_STOCK", {
        itemId: approval.itemId,
        onHandQty: currentInventory.onHandQty,
        requiredQty: approval.approvedQty,
      });
    }

    const [shipment] = await transaction
      .insert(shipments)
      .values({ approvalId: approval.id, shippedQty: approval.approvedQty, shippedBy })
      .returning({ id: shipments.id });
    if (!shipment) {
      throw new AppError("CONCURRENCY_CONFLICT");
    }
    await recordOutboundLedger(transaction, {
      itemId: approval.itemId,
      refType: "SHIPMENT",
      refId: shipment.id,
      shippedQty: approval.approvedQty,
      createdBy: shippedBy,
    });
    await transaction
      .update(internalOrderApprovals)
      .set({ status: "SHIPPED" })
      .where(eq(internalOrderApprovals.id, approval.id));
  });
}
