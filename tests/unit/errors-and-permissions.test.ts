import { describe, expect, it } from "vitest";

import { AppError, errorDefinitions } from "@/src/lib/errors";
import {
  maskItemFields,
  requireAction,
  resolveBranchScope,
  type AuthenticatedUser,
} from "@/src/lib/permissions";

const branchUser: AuthenticatedUser = {
  userId: 1,
  userName: "김지점",
  role: "BRANCH",
  branchId: 1,
  branchName: "강남지점",
};

describe("common API errors", () => {
  it("defines only the 22 documented error codes", () => {
    expect(Object.keys(errorDefinitions)).toHaveLength(22);
    expect(errorDefinitions.FORBIDDEN.status).toBe(403);
    expect(errorDefinitions.INSUFFICIENT_AVAILABLE_STOCK.status).toBe(409);
  });
});

describe("server-side permissions", () => {
  it("rejects actions that are not permitted for a branch user", () => {
    try {
      requireAction(branchUser, "inventory.adjust");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("forces the branch scope from the authenticated session", () => {
    expect(resolveBranchScope(branchUser)).toBe(1);
    try {
      resolveBranchScope(branchUser, 2);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("BRANCH_SCOPE_VIOLATION");
    }
  });

  it("removes protected item fields before a branch response is created", () => {
    const result = maskItemFields(branchUser, {
      itemName: "세탁세제",
      purchasePrice: 10000,
      supplyPrice: 12000,
      onHandQty: 100,
      allocatedQty: 30,
      availableQty: 70,
      minStockQty: 20,
      isBelowMinStock: false,
    });

    expect(result).toEqual({
      itemName: "세탁세제",
      supplyPrice: 12000,
      availableQty: 70,
    });
  });
});
