import { AppError } from "@/src/lib/errors";

export const roles = ["ADMIN", "PURCHASER", "WAREHOUSE", "BRANCH"] as const;
export type Role = (typeof roles)[number];

export type AuthenticatedUser = {
  userId: number;
  userName: string;
  role: Role;
  branchId: number | null;
  branchName: string | null;
};

export const actionRoles = {
  "item.read": roles,
  "item.write": ["ADMIN"],
  "item.deactivate": ["ADMIN"],
  "item.bulkUpload": ["ADMIN"],
  "inventory.read": roles,
  "inventory.ledger.read": ["ADMIN", "PURCHASER", "WAREHOUSE"],
  "inventory.adjust": ["ADMIN"],
  "inventory.adjustment.read": ["ADMIN", "PURCHASER"],
  "internalOrder.create": ["BRANCH"],
  "internalOrder.read": roles,
  "internalOrder.approve": ["ADMIN"],
  "internalOrder.reject": ["ADMIN"],
  "internalOrder.cancel": ["BRANCH"],
  "internalOrder.approval.cancel": ["ADMIN"],
  "internalOrder.outstanding.read": ["ADMIN", "PURCHASER", "BRANCH"],
  "internalOrder.ship": ["WAREHOUSE"],
  "purchaseOrder.read": ["ADMIN", "PURCHASER", "WAREHOUSE"],
  "purchaseOrder.write": ["ADMIN", "PURCHASER"],
  "purchaseOrder.cancel": ["ADMIN"],
  "purchaseOrder.receive": ["WAREHOUSE"],
  "branchStock.read": ["ADMIN", "PURCHASER", "BRANCH"],
  "branchStock.write": ["BRANCH"],
  "supplier.read": ["ADMIN", "PURCHASER", "WAREHOUSE"],
  "supplier.write": ["ADMIN", "PURCHASER"],
  "supplier.deactivate": ["ADMIN"],
  "report.read": roles,
  "report.export": roles,
  "branch.read": roles,
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof actionRoles;

export function requireAction(user: AuthenticatedUser, action: Action) {
  const permittedRoles: readonly Role[] = actionRoles[action];

  if (!permittedRoles.includes(user.role)) {
    throw new AppError("FORBIDDEN");
  }
}

export function resolveBranchScope(user: AuthenticatedUser, requestedBranchId?: number) {
  if (user.role !== "BRANCH") {
    return requestedBranchId;
  }

  if (!user.branchId) {
    throw new AppError("UNAUTHENTICATED");
  }

  if (requestedBranchId && requestedBranchId !== user.branchId) {
    throw new AppError("BRANCH_SCOPE_VIOLATION");
  }

  return user.branchId;
}

export function maskItemFields<T extends Record<string, unknown>>(
  user: AuthenticatedUser,
  item: T,
) {
  const maskedItem = { ...item } as Record<string, unknown>;

  if (user.role === "WAREHOUSE" || user.role === "BRANCH") {
    delete maskedItem.purchasePrice;
  }

  if (user.role === "BRANCH") {
    delete maskedItem.onHandQty;
    delete maskedItem.allocatedQty;
    delete maskedItem.minStockQty;
    delete maskedItem.isBelowMinStock;
  }

  return maskedItem as Omit<T, "purchasePrice" | "onHandQty" | "allocatedQty" | "minStockQty">;
}
