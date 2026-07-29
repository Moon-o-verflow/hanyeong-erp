# API 명세 (api-spec.md)

㈜한결물산 사내 ERP 웹시스템

---

## 0. 이 문서의 사용법

### 0.1 단일 진실 원천 범위

엔드포인트 경로, 요청·응답 스키마, 에러 코드의 유일한 원천입니다.

권한은 `permissions.md`, 상태 전이 조건은 `state-machine.md`, 업무 규칙은 `business-rules.md`가 담당합니다. 이 문서는 그것들을 **HTTP로 노출하는 방식**만 정의합니다.

### 0.2 에이전트 준수 사항

1. 이 문서에 없는 엔드포인트를 만들지 않는다.
2. 응답 필드는 `permissions.md` 3장의 마스킹을 거친 뒤 생성한다.
3. 에러는 3장의 코드 체계를 따른다. 새 코드를 임의로 만들지 않는다.
4. 상태를 바꾸는 요청은 모두 `POST`다. `PATCH`로 상태를 바꾸지 않는다.

---

## 1. 공통 규약

### 1.1 기본 사항

| 항목 | 값 |
|---|---|
| 기본 경로 | `/api/v1` |
| 형식 | JSON (UTF-8) |
| 필드 표기 | camelCase |
| 날짜 | `YYYY-MM-DD` |
| 일시 | ISO 8601 (`2026-07-29T10:30:00+09:00`) |
| 수량·금액 | 정수 |

### 1.2 Next.js 구현 규약

모든 엔드포인트는 App Router의 Route Handler로 구현합니다.

**경로 매핑**

| 명세 경로 | 파일 |
|---|---|
| `/api/v1/items` | `app/api/v1/items/route.ts` |
| `/api/v1/items/{id}` | `app/api/v1/items/[id]/route.ts` |
| `/api/v1/internal-orders/{id}/approve` | `app/api/v1/internal-orders/[id]/approve/route.ts` |
| `/api/v1/internal-order-approvals/{id}/ship` | `app/api/v1/internal-order-approvals/[id]/ship/route.ts` |

**런타임**

재고를 검증하거나 변경하는 모든 핸들러에 다음을 명시합니다.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

Edge runtime을 쓰지 마십시오. WebSocket 드라이버와 대화형 트랜잭션이 필요합니다.

**Server Actions**

재고를 변경하는 처리를 Server Action으로 구현하지 마십시오. 상태 변경은 반드시 이 문서에 정의된 Route Handler를 거칩니다. Server Action은 폼 편의와 조회에만 사용합니다.

**요청 검증**

요청 본문은 Zod 스키마로 검증한 뒤 유스케이스에 전달합니다. 스키마는 `src/lib/schemas/`에 두고 프런트엔드 폼과 공유합니다.

**핸들러 책임 범위**

Route Handler는 인증·권한 검증, 요청 파싱, 응답 직렬화, 마스킹만 담당합니다. DB 트랜잭션을 직접 열지 말고 `src/application`의 유스케이스를 호출하십시오.

### 1.3 응답 형식

**단건**
```json
{ "data": { ... } }
```

**목록**
```json
{
  "data": [ ... ],
  "page": { "number": 1, "size": 20, "totalElements": 137, "totalPages": 7 }
}
```

**오류**
```json
{
  "error": {
    "code": "INSUFFICIENT_AVAILABLE_STOCK",
    "message": "가용 재고가 부족합니다. 현재 가용 재고 0박스",
    "details": { "itemId": 12, "availableQty": 0, "requestedQty": 20 }
  }
}
```

`message`는 한국어이며 화면에 그대로 노출됩니다. `details`는 사용자가 다음 행동을 결정하는 데 필요한 값만 담습니다.

### 1.4 목록 공통 파라미터

| 파라미터 | 설명 |
|---|---|
| `page`, `size` | 페이지. 기본 1, 20 |
| `sort` | 정렬. 기본은 각 엔드포인트에 명시 |
| `dateFrom`, `dateTo` | 날짜 기간 필터 |
| `branchId` | 지점 필터. `BRANCH` 세션에서는 무시되고 세션 값으로 강제됨 |
| `status` | 상태 필터 |
| `itemKeyword` | 품목명 부분 일치 |
| `supplierKeyword` | 거래처명 부분 일치 |
| `orderNo` | 발주 번호 정확 일치 |
| `userKeyword` | 담당자명 부분 일치 |
| `specKeyword` | 규격 부분 일치 (`unitSpec`, `packUnit` 대상) |

8종 필터는 BR-RPT-001에 대응합니다. 복수 지정 시 AND로 결합합니다.

---

## 2. 엔드포인트

### 2.1 인증

| 메서드 | 경로 | 권한 |
|---|---|---|
| `POST` | `/auth/login` | 전체 |
| `POST` | `/auth/logout` | 인증됨 |
| `GET` | `/auth/me` | 인증됨 |
| `POST` | `/auth/password` | 인증됨 (본인) |

**`GET /auth/me` 응답**
```json
{
  "data": {
    "userId": 7,
    "userName": "김지점",
    "role": "BRANCH",
    "branchId": 1,
    "branchName": "강남지점"
  }
}
```

계정 생성·삭제 엔드포인트는 만들지 마십시오 (BR-AUT-005).

### 2.2 품목

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/items` | 전체 | 목록. 발주 시 품목 검색에도 사용 |
| `GET` | `/items/{id}` | 전체 | 단건 |
| `POST` | `/items` | ADMIN | 등록 |
| `PATCH` | `/items/{id}` | ADMIN | 수정 |
| `POST` | `/items/{id}/deactivate` | ADMIN | 비활성화 |
| `POST` | `/items/bulk-upload` | ADMIN | 엑셀 일괄 등록 |
| `GET` | `/items/parse-failed` | ADMIN | 규격 파싱 실패 목록 |

**`POST /items` 요청**
```json
{
  "itemName": "세탁세제",
  "barcode": "1234567890123",
  "categoryMajor": "생활용품",
  "categoryMinor": null,
  "unitSpec": "500ml",
  "unitName": "개",
  "packQty": 12,
  "packUnit": "박스",
  "purchasePrice": 10000,
  "supplyPrice": 12000,
  "minStockQty": 20,
  "remarks": null
}
```

`itemCode`를 요청에 포함하지 마십시오. 시스템이 채번합니다 (BR-ITM-002, BR-ITM-003). 포함되어 있으면 무시합니다.

**`GET /items` 응답 (ADMIN)**
```json
{
  "data": [{
    "id": 12,
    "itemCode": "1001",
    "itemName": "세탁세제",
    "unitSpec": "500ml",
    "unitName": "개",
    "packQty": 12,
    "packUnit": "박스",
    "purchasePrice": 10000,
    "supplyPrice": 12000,
    "minStockQty": 20,
    "onHandQty": 100,
    "allocatedQty": 30,
    "availableQty": 70,
    "isBelowMinStock": false
  }]
}
```

**동일 응답 (BRANCH)**
```json
{
  "data": [{
    "id": 12,
    "itemCode": "1001",
    "itemName": "세탁세제",
    "unitSpec": "500ml",
    "unitName": "개",
    "packQty": 12,
    "packUnit": "박스",
    "supplyPrice": 12000,
    "availableQty": 70
  }]
}
```

`purchasePrice`, `onHandQty`, `allocatedQty`, `minStockQty`, `isBelowMinStock`가 **키 자체로 제거**되었습니다. `null`로 채우지 마십시오 (`permissions.md` 3장).

**`POST /items/bulk-upload`**

`multipart/form-data`로 엑셀 파일을 받습니다. 전건 검증 후 일괄 반영하며, 한 행이라도 실패하면 아무것도 반영하지 않습니다 (BR-MIG-002).

실패 응답
```json
{
  "error": {
    "code": "UPLOAD_VALIDATION_FAILED",
    "message": "3개 행에서 오류가 발견되어 반영하지 않았습니다.",
    "details": {
      "errors": [
        { "row": 12, "field": "supplyPrice", "reason": "필수 항목이 비어 있습니다." },
        { "row": 45, "field": "itemCode", "reason": "중복된 품목코드입니다." },
        { "row": 88, "field": "purchasePrice", "reason": "숫자가 아닙니다." }
      ]
    }
  }
}
```

성공 응답에는 파싱 실패 건수를 포함합니다. 파싱 실패는 업로드를 중단시키지 않습니다 (BR-MIG-003).
```json
{ "data": { "insertedCount": 500, "specParseFailedCount": 7 } }
```

### 2.3 재고

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/inventory` | 전체 | 재고 현황. 지점은 가용 재고만 |
| `GET` | `/inventory/{itemId}/ledger` | ADMIN, PURCHASER, WAREHOUSE | 원장 이력 |
| `POST` | `/inventory/adjustments` | ADMIN | 재고 조정 |
| `GET` | `/inventory/adjustments` | ADMIN, PURCHASER | 조정 이력 |
| `GET` | `/adjustment-reasons` | ADMIN | 사유 코드 목록 |

**`POST /inventory/adjustments` 요청**
```json
{
  "itemId": 12,
  "deltaQty": -50,
  "reasonCode": "STOCKTAKE",
  "reasonText": null
}
```

`deltaQty`는 증감분입니다. 조정 후 목표 수량이 아닙니다. 혼동하지 마십시오.

**실패 응답 (BR-INV-016)**
```json
{
  "error": {
    "code": "ADJUSTMENT_BELOW_ALLOCATED",
    "message": "출고 대기 수량(80박스)보다 적게 조정할 수 없습니다. 해당 승인을 먼저 취소하십시오.",
    "details": {
      "itemId": 12,
      "onHandQty": 100,
      "allocatedQty": 80,
      "resultQty": 50,
      "blockingApprovals": [
        { "approvalId": 301, "orderNo": "IO-202607-0012", "branchName": "강남지점", "approvedQty": 50 },
        { "approvalId": 305, "orderNo": "IO-202607-0019", "branchName": "수원지점", "approvedQty": 30 }
      ]
    }
  }
}
```

`blockingApprovals`는 관리자가 바로 다음 행동을 취할 수 있도록 반드시 포함합니다. 이것이 없으면 관리자가 어떤 승인을 취소해야 할지 알 수 없습니다.

### 2.4 사내 발주

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/internal-orders` | 전체 | 목록 |
| `GET` | `/internal-orders/{id}` | 전체 | 단건. 승인 이력 포함 |
| `POST` | `/internal-orders` | BRANCH | 발주 요청 |
| `POST` | `/internal-orders/{id}/approve` | ADMIN | 승인 (전량·부분) |
| `POST` | `/internal-orders/{id}/reject` | ADMIN | 반려 |
| `POST` | `/internal-orders/{id}/cancel` | BRANCH | 잔여 취소 |
| `GET` | `/internal-orders/outstanding` | ADMIN, PURCHASER, BRANCH | 미결 발주 목록 |
| `POST` | `/internal-order-approvals/{id}/cancel` | ADMIN | 승인 취소 |
| `POST` | `/internal-order-approvals/{id}/ship` | WAREHOUSE | 출고 완료 |

**`POST /internal-orders` 요청**
```json
{
  "itemId": 12,
  "requestedQty": 100,
  "requestedDueDate": "2026-08-15",
  "remarks": "행사 대비",
  "originOrderId": null
}
```

`branchId`를 요청에 포함하지 마십시오. 세션에서 결정됩니다. `originOrderId`는 반려 건을 복사해 재기안할 때만 지정합니다 (BR-IOR-010).

**`POST /internal-orders/{id}/approve` 요청**
```json
{
  "approvedQty": 50,
  "plannedShipDate": "2026-08-05"
}
```

전량 승인과 부분 승인을 구분하는 별도 엔드포인트를 만들지 마십시오. `approvedQty`가 잔여 수량과 같으면 전량, 작으면 부분입니다.

**실패 응답 (BR-INV-014)**
```json
{
  "error": {
    "code": "INSUFFICIENT_AVAILABLE_STOCK",
    "message": "가용 재고가 부족합니다. 현재 가용 재고 30박스",
    "details": { "itemId": 12, "availableQty": 30, "requestedQty": 50 }
  }
}
```

**시스템이 자동으로 30박스를 부분 승인하지 않습니다.** 관리자가 수량을 조정해 다시 호출해야 합니다.

**`POST /internal-orders/{id}/cancel` 요청**
```json
{ "cancelQty": 20 }
```

취소 가능한 최대치는 잔여 수량입니다. 이미 승인된 수량은 지점이 취소할 수 없습니다 (BR-IOR-007).

**`GET /internal-orders/{id}` 응답**
```json
{
  "data": {
    "id": 88,
    "orderNo": "IO-202607-0012",
    "branchName": "강남지점",
    "item": { "id": 12, "itemCode": "1001", "itemName": "세탁세제", "packUnit": "박스" },
    "requestedQty": 100,
    "approvedQty": 80,
    "canceledQty": 20,
    "outstandingQty": 0,
    "requestedDueDate": "2026-08-15",
    "status": "COMPLETED",
    "rejectReason": null,
    "createdBy": "김지점",
    "createdAt": "2026-07-20T09:12:00+09:00",
    "approvals": [
      {
        "id": 301, "approvedQty": 50, "plannedShipDate": "2026-08-05",
        "status": "SHIPPED", "approvedBy": "이관리", "approvedAt": "2026-07-21T10:00:00+09:00",
        "shippedBy": "박창고", "shippedAt": "2026-08-05T14:20:00+09:00"
      },
      {
        "id": 340, "approvedQty": 30, "plannedShipDate": "2026-08-12",
        "status": "ALLOCATED", "approvedBy": "이관리", "approvedAt": "2026-08-10T11:00:00+09:00",
        "shippedBy": null, "shippedAt": null
      }
    ]
  }
}
```

발주 상태 `COMPLETED`와 승인 건 상태 `ALLOCATED`가 공존하는 것은 정상입니다. 잔여가 0이면 발주는 종결이고, 출고 여부는 승인 건이 관리합니다 (`state-machine.md` 1.2장).

**`POST /internal-order-approvals/{id}/ship`**

요청 본문이 없습니다. 출고 수량은 승인 수량과 항상 같습니다 (BR-SHP-002). `shippedQty`를 받는 파라미터를 만들지 마십시오.

실패 응답 (BR-INV-010)
```json
{
  "error": {
    "code": "INSUFFICIENT_ON_HAND_STOCK",
    "message": "실재고가 부족하여 출고할 수 없습니다. 실재고 30박스, 출고 수량 50박스",
    "details": { "itemId": 12, "onHandQty": 30, "requiredQty": 50 }
  }
}
```

### 2.5 외부 발주

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/purchase-orders` | ADMIN, PURCHASER, WAREHOUSE | 목록 |
| `GET` | `/purchase-orders/{id}` | ADMIN, PURCHASER, WAREHOUSE | 단건 |
| `POST` | `/purchase-orders` | ADMIN, PURCHASER | 생성·발행 |
| `PATCH` | `/purchase-orders/{id}` | ADMIN, PURCHASER | 수정 (입고 전) |
| `POST` | `/purchase-orders/{id}/cancel` | ADMIN | 취소 |
| `GET` | `/purchase-orders/{id}/export` | ADMIN, PURCHASER | 엑셀·PDF 다운로드 |
| `POST` | `/purchase-order-lines/{id}/receive` | WAREHOUSE | 입고 완료 |

승인·반려 엔드포인트가 없습니다. 만들지 마십시오 (BR-EOR-001).

**`POST /purchase-orders` 요청**
```json
{
  "supplierId": 3,
  "orderedDate": "2026-07-29",
  "requestedDueDate": "2026-08-10",
  "remarks": null,
  "lines": [
    { "itemId": 12, "requestedQty": 50, "purchasePrice": 10000, "remarks": null },
    { "itemId": 15, "requestedQty": 30, "purchasePrice": 15000, "remarks": null }
  ]
}
```

`poNumber`를 요청에 포함하지 마십시오. 시스템이 채번합니다 (BR-EOR-004).

`purchasePrice`는 화면에서 품목 마스터 값을 불러온 뒤 수정 가능한 값입니다. 서버는 전달받은 값을 그대로 저장하며 마스터에 반영하지 않습니다 (BR-EOR-003).

**`GET /purchase-orders/{id}/export`**

쿼리 파라미터 `format=xlsx` 또는 `format=pdf`. 파일을 반환합니다. 이메일·메신저 발송 엔드포인트를 만들지 마십시오 (BR-EOR-005).

**`POST /purchase-order-lines/{id}/receive`**

요청 본문이 없습니다. 입고 수량은 요청 수량 전량입니다. 부분 수량을 받는 파라미터를 만들지 마십시오 (BR-RCV-002, 미정).

모든 품목행이 입고되면 상위 발주가 `RECEIVED`로 전이됩니다.

### 2.6 지점 재고

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/branch-stocks` | ADMIN, PURCHASER, BRANCH | 목록 |
| `PUT` | `/branch-stocks` | BRANCH | 입력·수정 (upsert) |

**`PUT /branch-stocks` 요청**
```json
{ "items": [ { "itemId": 12, "stockQty": 40 }, { "itemId": 15, "stockQty": 12 } ] }
```

`branchId`는 세션에서 결정됩니다. 수기 입력값으로 덮어쓰며, 재고 원장에 기록하지 않습니다 (BR-BRS-001).

### 2.7 거래처

| 메서드 | 경로 | 권한 |
|---|---|---|
| `GET` | `/suppliers` | ADMIN, PURCHASER, WAREHOUSE |
| `POST` | `/suppliers` | ADMIN, PURCHASER |
| `PATCH` | `/suppliers/{id}` | ADMIN, PURCHASER |
| `POST` | `/suppliers/{id}/deactivate` | ADMIN |

### 2.8 리포트

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| `GET` | `/reports/inventory` | 전체 | 재고 현황 |
| `GET` | `/reports/orders` | 전체 | 발주 현황 |
| `GET` | `/reports/inventory/export` | 전체 | 엑셀 다운로드 |
| `GET` | `/reports/orders/export` | 전체 | 엑셀 다운로드 |

표 형태 데이터만 반환합니다. 집계·차트용 엔드포인트를 만들지 마십시오 (BR-RPT-002).

**다운로드 파일에도 필드 마스킹과 행 범위 제한이 적용됩니다.** 지점 사용자가 받은 엑셀에 매입단가나 타 지점 데이터가 들어가면 안 됩니다.

### 2.9 지점 목록

| 메서드 | 경로 | 권한 |
|---|---|---|
| `GET` | `/branches` | 전체 |

필터 드롭다운용입니다. `BRANCH` 세션에는 자기 지점만 반환합니다.

---

## 3. 에러 코드

| 코드 | HTTP | 근거 규칙 |
|---|---|---|
| `UNAUTHENTICATED` | 401 | — |
| `FORBIDDEN` | 403 | `permissions.md` 2장 |
| `BRANCH_SCOPE_VIOLATION` | 403 | BR-BRS-002 |
| `NOT_FOUND` | 404 | — |
| `VALIDATION_ERROR` | 400 | 형식·타입 오류 |
| `REQUIRED_FIELD_MISSING` | 400 | BR-ITM-001 |
| `ITEM_CODE_IMMUTABLE` | 400 | BR-ITM-004 |
| `ITEM_INACTIVE` | 400 | 비활성 품목 발주 시도 |
| `SUPPLIER_INACTIVE` | 400 | 비활성 거래처 발주 시도 |
| `DUPLICATE_ITEM_IN_LINES` | 400 | 외부 발주 품목행 중복 |
| `INSUFFICIENT_AVAILABLE_STOCK` | 409 | BR-INV-014 |
| `INSUFFICIENT_ON_HAND_STOCK` | 409 | BR-INV-010 |
| `ADJUSTMENT_BELOW_ALLOCATED` | 409 | BR-INV-016 |
| `ADJUSTMENT_REASON_TEXT_REQUIRED` | 400 | BR-INV-017 |
| `INVALID_STATUS_TRANSITION` | 409 | `state-machine.md` |
| `QTY_EXCEEDS_OUTSTANDING` | 400 | BR-IOR-005 |
| `REJECT_REASON_REQUIRED` | 400 | BR-IOR-009 |
| `REJECTED_ORDER_IMMUTABLE` | 409 | BR-IOR-009, BR-IOR-010 |
| `APPROVAL_ALREADY_SHIPPED` | 409 | BR-IOR-012 |
| `ALREADY_RECEIVED` | 409 | BR-RCV-002 |
| `UPLOAD_VALIDATION_FAILED` | 400 | BR-MIG-002 |
| `CONCURRENCY_CONFLICT` | 409 | BR-INV-011 |

**409를 쓰는 기준**: 요청 자체는 올바르나 현재 시스템 상태에서 수행할 수 없는 경우입니다. 재고 부족과 상태 전이 위반이 여기 해당합니다. 사용자가 재시도하면 성공할 수 있습니다.

**400과 409를 혼용하지 마십시오.** 화면에서 안내 문구와 재시도 여부가 달라집니다.

---

## 4. 동시성

재고를 검증하는 모든 요청은 트랜잭션 단위 advisory lock(`pg_advisory_xact_lock`) 획득 후 재조회합니다 (`state-machine.md` 6장). 아래 엔드포인트는 모두 Node.js 런타임으로 고정합니다.

대상 엔드포인트
- `POST /internal-orders/{id}/approve`
- `POST /internal-order-approvals/{id}/ship`
- `POST /internal-order-approvals/{id}/cancel`
- `POST /purchase-order-lines/{id}/receive`
- `POST /inventory/adjustments`

잠금 대기가 임계치를 넘으면 `CONCURRENCY_CONFLICT`를 반환하고 사용자에게 재시도를 안내합니다.

**요청 본문의 재고 값을 신뢰하지 마십시오.** 클라이언트가 보낸 `availableQty` 같은 값을 검증에 쓰는 구현은 위반입니다.

---

## 5. 미구현 엔드포인트

`business-rules.md`에서 `TODO(고객확인)`인 항목입니다. **만들지 마십시오.**

| 엔드포인트 | 관련 규칙 |
|---|---|
| 출고 완료 취소 | BR-SHP-003 |
| 부분 수량 입고 | BR-RCV-002 |
| 계정 생성·삭제·권한 변경 | BR-AUT-005 |
| 지점 재고 미입력 알림 | BR-BRS-004 |
