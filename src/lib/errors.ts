export const errorDefinitions = {
  UNAUTHENTICATED: { status: 401, message: "인증이 필요합니다." },
  FORBIDDEN: { status: 403, message: "권한이 없습니다." },
  BRANCH_SCOPE_VIOLATION: { status: 403, message: "다른 지점의 데이터에 접근할 수 없습니다." },
  NOT_FOUND: { status: 404, message: "요청한 데이터를 찾을 수 없습니다." },
  VALIDATION_ERROR: { status: 400, message: "요청 형식이 올바르지 않습니다." },
  REQUIRED_FIELD_MISSING: { status: 400, message: "필수 입력 항목이 비어 있습니다." },
  ITEM_CODE_IMMUTABLE: { status: 400, message: "자체 품목코드는 수정할 수 없습니다." },
  ITEM_INACTIVE: { status: 400, message: "비활성 품목은 사내 발주할 수 없습니다." },
  SUPPLIER_INACTIVE: { status: 400, message: "비활성 거래처에는 외부 발주할 수 없습니다." },
  DUPLICATE_ITEM_IN_LINES: { status: 400, message: "외부 발주 품목행에 중복 품목이 있습니다." },
  INSUFFICIENT_AVAILABLE_STOCK: { status: 409, message: "가용 재고가 부족합니다." },
  INSUFFICIENT_ON_HAND_STOCK: { status: 409, message: "실재고가 부족하여 출고할 수 없습니다." },
  ADJUSTMENT_BELOW_ALLOCATED: { status: 409, message: "출고 대기 수량보다 적게 조정할 수 없습니다." },
  ADJUSTMENT_REASON_TEXT_REQUIRED: { status: 400, message: "기타 사유의 상세 내용은 필수입니다." },
  INVALID_STATUS_TRANSITION: { status: 409, message: "현재 상태에서는 처리할 수 없습니다." },
  QTY_EXCEEDS_OUTSTANDING: { status: 400, message: "미결 수량을 초과할 수 없습니다." },
  REJECT_REASON_REQUIRED: { status: 400, message: "반려 사유는 필수입니다." },
  REJECTED_ORDER_IMMUTABLE: { status: 409, message: "반려된 사내 발주는 변경할 수 없습니다." },
  APPROVAL_ALREADY_SHIPPED: { status: 409, message: "출고 완료된 승인은 취소할 수 없습니다." },
  ALREADY_RECEIVED: { status: 409, message: "이미 입고 완료된 품목행입니다." },
  UPLOAD_VALIDATION_FAILED: { status: 400, message: "업로드 검증에 실패했습니다." },
  CONCURRENCY_CONFLICT: { status: 409, message: "동시 처리 충돌이 발생했습니다. 다시 시도해 주세요." },
} as const;

export type ErrorCode = keyof typeof errorDefinitions;

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Record<string, unknown>,
    message?: string,
  ) {
    super(message ?? errorDefinitions[code].message);
    this.name = "AppError";
    this.status = errorDefinitions[code].status;
  }
}
