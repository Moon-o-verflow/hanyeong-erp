# 용어 사전 (glossary.md)

㈜한결물산 사내 ERP 웹시스템

---

## 0. 이 문서의 사용법

### 0.1 단일 진실 원천 범위

이 문서는 **한국어 도메인 용어 ↔ 영문 식별자 매핑**의 유일한 원천입니다.
테이블명, 컬럼명, 클래스명, 변수명, Enum 값, API 경로는 모두 이 문서의 표기를 따릅니다.

업무 규칙은 `business-rules.md`, 스키마 정의는 `data-model.md`, 상태 전이는 `state-machine.md`가 담당합니다. 이 문서는 **이름만** 다룹니다.

### 0.2 에이전트 준수 사항

1. 이 표에 있는 개념은 반드시 지정된 식별자를 사용한다. 동의어를 새로 만들지 않는다.
2. 이 표에 없는 개념이 필요하면 **임의로 이름을 짓지 말고 보고한다.**
3. 4장의 금지 식별자를 사용하지 않는다.
4. 한국어 UI 문구는 이 표의 한국어 용어를 그대로 쓴다. 임의로 바꾸어 쓰지 않는다.

### 0.3 표기 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 테이블명 | snake_case, 복수형 | `internal_orders` |
| 컬럼명 | snake_case | `approved_qty` |
| 클래스·타입명 | PascalCase, 단수형 | `InternalOrder` |
| 변수·함수·JSON 키 | camelCase | `approvedQty` |
| Enum 값 | SCREAMING_SNAKE_CASE | `PARTIALLY_APPROVED` |
| API 경로 | kebab-case, 복수형 | `/api/internal-orders` |

**접미사 규칙**

| 접미사 | 의미 | 타입 |
|---|---|---|
| `_qty` | 수량. 항상 박스 단위 정수 | integer |
| `_price` | 단가. 원 단위 정수 | integer |
| `_date` | 날짜 | date |
| `_at` | 일시 | timestamp |
| `_id` | 외래 키 | 참조 테이블 PK |
| `is_` (접두) | 불리언 | boolean |

기본 키는 모든 테이블에서 `id`입니다. 외래 키는 `{참조 테이블 단수형}_id` 형태입니다.

---

## 1. 핵심 엔티티

| 한국어 | 클래스 | 테이블 | 비고 |
|---|---|---|---|
| 품목 | `Item` | `items` | 상품 마스터 |
| 재고 원장 | `InventoryLedger` | `inventory_ledger` | append-only. 단수형 테이블명 예외 |
| 재고 조정 | `StockAdjustment` | `stock_adjustments` | 조정 요청 단위 |
| 조정 사유 | `AdjustmentReason` | `adjustment_reasons` | 코드 테이블 |
| 사내 발주 | `InternalOrder` | `internal_orders` | 지점 → 본사 |
| 사내 발주 승인 | `InternalOrderApproval` | `internal_order_approvals` | 한 발주에 여러 건 발생 |
| 외부 발주 | `PurchaseOrder` | `purchase_orders` | 본사 → 공급사 |
| 외부 발주 품목행 | `PurchaseOrderLine` | `purchase_order_lines` | |
| 입고 | `Receipt` | `receipts` | |
| 출고 | `Shipment` | `shipments` | |
| 거래처(공급사) | `Supplier` | `suppliers` | |
| 지점 | `Branch` | `branches` | |
| 지점 재고 | `BranchStock` | `branch_stocks` | 수기 입력 |
| 사용자 | `User` | `users` | |

**사내 발주는 품목행 테이블을 두지 않습니다.** 한 발주 건이 한 품목을 다루며, 승인이 여러 번 발생하는 구조입니다(BR-IOR-006). 품목행을 도입하면 부분 승인과 미결 계산이 행 단위로 흩어져 잔여 수량 계산식(BR-IOR-005)이 성립하지 않습니다.

---

## 2. 필드 용어

### 2.1 품목 (`items`)

| 한국어 | 컬럼 | 타입 | 필수 |
|---|---|---|---|
| 자체 품목코드 | `item_code` | varchar | O |
| 바코드 번호 | `barcode` | varchar | |
| 상품명 | `item_name` | varchar | O |
| 카테고리 대분류 | `category_major` | varchar | |
| 카테고리 소분류 | `category_minor` | varchar | |
| 낱개 규격 | `unit_spec` | varchar | |
| 낱개 단위 | `unit_name` | varchar | |
| 입수 | `pack_qty` | integer | O (기본 1) |
| 포장 단위 | `pack_unit` | varchar | O |
| 매입단가 | `purchase_price` | integer | O |
| 지점 공급단가 | `supply_price` | integer | O |
| 최소 재고 수량 | `min_stock_qty` | integer | |
| 비고 | `remarks` | text | |
| 사용 여부 | `is_active` | boolean | O |

`500ml 12입/박스` → `unit_spec='500ml'`, `unit_name='개'`, `pack_qty=12`, `pack_unit='박스'`
`30롤/팩` → `unit_spec=null`, `unit_name='롤'`, `pack_qty=30`, `pack_unit='팩'`

### 2.2 재고 수량 3종

세 값은 서로 다른 개념입니다. 절대 혼용하지 마십시오.

| 한국어 | 식별자 | 정의 |
|---|---|---|
| 실재고 | `onHandQty` / `on_hand_qty` | 창고에 물리적으로 존재하는 수량 |
| 할당 | `allocatedQty` / `allocated_qty` | 승인되었으나 미출고 상태인 수량 |
| 가용 재고 | `availableQty` / `available_qty` | `onHandQty - allocatedQty` |

세 값 모두 원장 합계로 산출됩니다(BR-INV-001). 저장된 컬럼이 있더라도 캐시이며, 원장이 우선입니다.

### 2.3 재고 원장 (`inventory_ledger`)

| 한국어 | 컬럼 |
|---|---|
| 트랜잭션 유형 | `ledger_type` |
| 실재고 증감 | `on_hand_delta` |
| 할당 증감 | `allocated_delta` |
| 참조 유형 | `ref_type` |
| 참조 ID | `ref_id` |
| 발생 일시 | `created_at` |
| 처리자 | `created_by` |

### 2.4 사내 발주 (`internal_orders`)

| 한국어 | 컬럼 |
|---|---|
| 요청 수량 | `requested_qty` |
| 납기 요망일 | `requested_due_date` |
| 누적 승인 수량 | `approved_qty` |
| 누적 취소 수량 | `canceled_qty` |
| 잔여(미결) 수량 | `outstanding_qty` |
| 반려 사유 | `reject_reason` |
| 원본 발주 (반려 후 재기안) | `origin_order_id` |

승인 건(`internal_order_approvals`)은 승인 수량 `approved_qty`와 출고 예정일 `planned_ship_date`를 갖습니다.

### 2.5 외부 발주 (`purchase_orders`)

| 한국어 | 컬럼 |
|---|---|
| 발주서 번호 | `po_number` |
| 발주일 | `ordered_date` |
| 납기 요망일 | `requested_due_date` |
| 요청 수량 | `requested_qty` |
| 매입단가 (발주 시점) | `purchase_price` |

`po_number` 형식은 `PO-YYYYMM-NNNN`입니다(BR-EOR-004).

### 2.6 지점 재고 (`branch_stocks`)

| 한국어 | 컬럼 |
|---|---|
| 지점 재고 수량 | `stock_qty` |
| 최종 입력 일시 | `updated_at` |
| 최종 입력자 | `updated_by` |

---

## 3. Enum 값

### 3.1 권한 `Role`

| 한국어 | 값 |
|---|---|
| 관리자 | `ADMIN` |
| 구매 | `PURCHASER` |
| 창고 | `WAREHOUSE` |
| 지점 | `BRANCH` |

### 3.2 원장 유형 `LedgerType`

| 한국어 | 값 | 실재고 | 할당 |
|---|---|---|---|
| 입고 | `INBOUND` | + | — |
| 할당 | `ALLOCATE` | — | + |
| 출고 | `OUTBOUND` | − | − |
| 할당 해제 | `RELEASE` | — | − |
| 조정 | `ADJUST` | ± | — |
| 초기 이관 | `OPENING` | + | — |

### 3.3 사내 발주 상태 `InternalOrderStatus`

| 한국어 | 값 |
|---|---|
| 승인 대기 | `PENDING` |
| 일부 승인 (미결 잔여) | `PARTIALLY_APPROVED` |
| 종결 | `COMPLETED` |
| 반려 | `REJECTED` |
| 취소 | `CANCELED` |

### 3.4 승인 건 상태 `ApprovalStatus`

| 한국어 | 값 |
|---|---|
| 출고 대기 | `ALLOCATED` |
| 출고 완료 | `SHIPPED` |
| 승인 취소 | `CANCELED` |

### 3.5 외부 발주 상태 `PurchaseOrderStatus`

| 한국어 | 값 |
|---|---|
| 발행 | `ISSUED` |
| 입고 완료 | `RECEIVED` |
| 취소 | `CANCELED` |

### 3.6 조정 사유 `AdjustmentReason`

| 한국어 | 코드 |
|---|---|
| 파손 | `DAMAGE` |
| 분실 | `LOSS` |
| 실사 차이 | `STOCKTAKE` |
| 기타 | `OTHER` |

코드 테이블로 관리하며 애플리케이션 상수로 하드코딩하지 않습니다(BR-INV-017).

각 상태의 전이 조건과 부작용은 `state-machine.md`가 정의합니다. 이 문서는 이름만 고정합니다.

---

## 4. 금지 식별자

다음 표현은 코드·스키마·API 어디에도 사용하지 마십시오.

| 금지 | 이유 | 대신 사용 |
|---|---|---|
| `Order`, `orders`, `orderId`, `orderStatus` | 사내 발주와 외부 발주 중 무엇인지 판별 불가 | `InternalOrder` 또는 `PurchaseOrder`. 접두어를 반드시 붙임 |
| `stock`, `stockQty`, `quantity`, `qty` (단독) | 실재고·할당·가용 중 무엇인지 판별 불가 | `onHandQty` / `allocatedQty` / `availableQty` |
| `price` (단독) | 매입단가와 공급단가 구분 불가 | `purchasePrice` / `supplyPrice` |
| `unit` (단독) | 낱개 단위와 포장 단위 구분 불가 | `unitName` / `packUnit` |
| `Product`, `Goods`, `SKU` | `Item`과 중복 개념 | `Item` |
| `Requisition`, `BranchOrder`, `OrderRequest` | 사내 발주의 별칭 | `InternalOrder` |
| `Vendor`, `Partner`, `Company` | 거래처의 별칭 | `Supplier` |
| `Warehouse`, `warehouses` | 창고 엔티티가 존재하지 않음. 본사 창고 단일 | 사용하지 않음 |
| `Store`, `Shop` | 지점의 별칭 | `Branch` |
| `Inbound`/`Outbound`를 엔티티명으로 사용 | 원장 유형 값과 충돌 | `Receipt` / `Shipment` |
| `pending`, `waiting` 등 소문자 상태 값 | Enum 표기 위반 | SCREAMING_SNAKE |

`Warehouse`를 금지한 이유는 다중 창고 관리가 명시적 범위 제외 항목이기 때문입니다. 창고 엔티티를 만드는 순간 에이전트가 창고 간 이동 로직을 추론해 생성하기 시작합니다.

---

## 5. 혼동 주의 용어

### 5.1 "발주"

한국어로는 하나지만 시스템에서는 완전히 다른 두 개체입니다.

| 구분 | 사내 발주 | 외부 발주 |
|---|---|---|
| 방향 | 지점 → 본사 | 본사 → 공급사 |
| 식별자 | `InternalOrder` | `PurchaseOrder` |
| 승인 | 2단계 (관리자 승인) | 없음, 즉시 발행 |
| 재고 영향 | 승인 시 할당, 출고 시 차감 | 입고 완료 시 증가 |
| 요청자 | 지점 담당자 | 관리자 또는 구매 |
| 미결 개념 | 있음 | 없음 |

두 개체는 공통 부모 클래스나 공유 테이블을 갖지 않습니다. 코드 재사용을 위해 통합하지 마십시오.

### 5.2 "수량"

| 맥락 | 식별자 |
|---|---|
| 지점이 요청한 수량 | `requestedQty` |
| 본사가 승인한 수량 | `approvedQty` |
| 아직 처리되지 않은 수량 | `outstandingQty` |
| 지점이 취소한 수량 | `canceledQty` |
| 창고에 있는 수량 | `onHandQty` |
| 묶여 있는 수량 | `allocatedQty` |
| 새로 발주 가능한 수량 | `availableQty` |
| 한 박스에 들어가는 낱개 수 | `packQty` |

### 5.3 "승인"

사내 발주에만 존재합니다. 외부 발주에는 승인 개념이 없습니다(BR-EOR-001). 외부 발주에 `approve` 관련 필드나 API를 만들지 마십시오.

### 5.4 "재고"

본사 창고 재고(`inventory_ledger` 기반)와 지점 재고(`branch_stocks`)는 별개 체계입니다. 지점 재고는 원장에 기록되지 않으며 실재고·할당·가용 구분도 갖지 않습니다. 단순 수량 하나입니다.

### 5.5 "단위"

- `unitName`: 낱개를 세는 말. 개, 롤, 병
- `packUnit`: 포장을 세는 말. 박스, 팩
- **모든 수량은 `packUnit` 기준입니다.** `unitName`과 `packQty`는 화면 표시용 참고 정보이며 어떤 계산에도 쓰이지 않습니다(BR-ITM-006).

---

## 6. UI 표기 고정

화면에 노출되는 한국어는 아래 표기를 사용합니다. 임의로 바꾸지 마십시오.

| 개념 | UI 표기 |
|---|---|
| `availableQty` | 가용 재고 |
| `onHandQty` | 실재고 |
| `allocatedQty` | 출고 대기 |
| `outstandingQty` | 미결 수량 |
| `InternalOrder` | 사내 발주 |
| `PurchaseOrder` | 외부 발주 |
| `Supplier` | 거래처 |
| `Receipt` | 입고 |
| `Shipment` | 출고 |
| `StockAdjustment` | 재고 조정 |
| `PARTIALLY_APPROVED` | 일부 승인 |

지점 담당자 화면에서는 `실재고`와 `출고 대기`를 표시하지 않습니다(BR-INV-012). 지점 화면의 "재고"는 항상 가용 재고를 뜻합니다.

---

## 7. 신규 용어 추가 절차

이 문서에 없는 개념이 필요해지면 다음을 따릅니다.

1. 코드를 먼저 쓰지 않습니다. 이 문서에 항목을 추가합니다.
2. 4장 금지 식별자와 충돌하지 않는지 확인합니다.
3. 기존 용어의 별칭이 아닌지 확인합니다. 별칭이면 추가하지 않고 기존 용어를 씁니다.
4. 업무 규칙이 함께 필요하면 `business-rules.md`에 규칙을 먼저 등록하고 ID를 참조합니다.
