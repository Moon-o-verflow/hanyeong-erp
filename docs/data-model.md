# 데이터 모델 (data-model.md)

㈜한결물산 사내 ERP 웹시스템

---

## 0. 이 문서의 사용법

### 0.1 단일 진실 원천 범위

테이블, 컬럼, 타입, 제약, 인덱스, 뷰의 유일한 원천입니다.
이름 표기는 `glossary.md`, 업무 규칙은 `business-rules.md`, 상태 전이는 `state-machine.md`를 따릅니다.

### 0.2 공통 규칙

- 모든 테이블의 PK는 `id` (bigint, auto increment)
- 금액은 `integer` 원 단위. 소수·통화 타입을 쓰지 않는다
- 수량은 `integer` 박스 단위. 소수를 쓰지 않는다 (BR-ITM-006)
- 타임스탬프는 `timestamptz`
- 물리 삭제를 하지 않는다. 마스터는 `is_active`, 트랜잭션은 상태 값으로 무효화한다
- DBMS는 **Neon (PostgreSQL)** 이다. 스키마 정의는 Drizzle ORM(`src/db/schema.ts`)으로 작성하고 마이그레이션은 Drizzle Kit으로 생성한다

### 0.3 에이전트 준수 사항

1. 이 문서에 없는 테이블·컬럼을 추가하지 않는다.
2. `Warehouse`, `Order` 등 `glossary.md` 4장의 금지 식별자를 스키마에 쓰지 않는다.
3. 재고 수량을 저장하는 컬럼을 `items`에 추가하지 않는다. 재고는 원장 집계로만 얻는다 (BR-INV-001).
4. 제약(CHECK, UNIQUE, FK)을 애플리케이션 검증으로 대체하지 않는다. 둘 다 둔다.

---

## 1. ERD 개요

```
branches ──< users
                │
                ├──< internal_orders >── items
                │         │
                │         └──< internal_order_approvals ──< shipments
                │
suppliers ──< purchase_orders ──< purchase_order_lines >── items
                                        │
                                        └──< receipts

items ──< inventory_ledger
items ──< stock_adjustments >── adjustment_reasons
items ──< branch_stocks >── branches
```

---

## 2. 마스터 테이블

### 2.1 `branches` — 지점

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `branch_name` | varchar(50) | NOT NULL, UNIQUE | 강남지점 등 |
| `is_active` | boolean | NOT NULL, DEFAULT true | |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

초기 데이터 5건: 강남지점, 수원지점, 성남지점, 인천지점, 대전지점 (BR-BRS-003)

### 2.2 `users` — 사용자

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `login_id` | varchar(50) | NOT NULL, UNIQUE | |
| `password_hash` | varchar(255) | NOT NULL | |
| `user_name` | varchar(50) | NOT NULL | 조회 필터 대상 |
| `role` | varchar(20) | NOT NULL | `ADMIN` / `PURCHASER` / `WAREHOUSE` / `BRANCH` |
| `branch_id` | bigint | FK → branches | `BRANCH`일 때만 값 존재 |
| `is_active` | boolean | NOT NULL, DEFAULT true | |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

**CHECK**: `(role = 'BRANCH' AND branch_id IS NOT NULL) OR (role <> 'BRANCH' AND branch_id IS NULL)`

계정 발급·회수 절차는 BR-AUT-005로 미정입니다. 스키마만 두고 관리 화면을 만들지 마십시오.

### 2.3 `items` — 품목

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `item_code` | varchar(50) | NOT NULL, UNIQUE | 등록 후 수정 불가 (BR-ITM-004) |
| `barcode` | varchar(50) | | |
| `item_name` | varchar(200) | NOT NULL | |
| `category_major` | varchar(50) | | |
| `category_minor` | varchar(50) | | |
| `unit_spec` | varchar(50) | | 500ml |
| `unit_name` | varchar(20) | | 개, 롤 |
| `pack_qty` | integer | NOT NULL, DEFAULT 1, CHECK > 0 | 입수 |
| `pack_unit` | varchar(20) | NOT NULL | 박스, 팩 |
| `purchase_price` | integer | NOT NULL, CHECK >= 0 | 매입단가 |
| `supply_price` | integer | NOT NULL, CHECK >= 0 | 지점 공급단가 |
| `min_stock_qty` | integer | CHECK >= 0 | |
| `remarks` | text | | |
| `spec_raw` | varchar(200) | | 이관 원문 보존 (BR-MIG-003) |
| `is_spec_parse_failed` | boolean | NOT NULL, DEFAULT false | 수기 보정 대상 표시 |
| `is_active` | boolean | NOT NULL, DEFAULT true | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

**인덱스**: `item_name` (부분 일치 검색), `barcode`, `(category_major, category_minor)`

`item_code` 채번은 `MAX(item_code::bigint) + 1`이며 정수 변환 불가 값은 제외합니다. UNIQUE 위반 시 재시도합니다 (BR-ITM-003).

### 2.4 `suppliers` — 거래처

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `supplier_name` | varchar(100) | NOT NULL |
| `contact` | varchar(50) | |
| `manager_name` | varchar(50) | |
| `remarks` | text | |
| `is_active` | boolean | NOT NULL, DEFAULT true |

**인덱스**: `supplier_name`

### 2.5 `adjustment_reasons` — 조정 사유 코드

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `code` | varchar(20) | PK |
| `label` | varchar(50) | NOT NULL |
| `requires_text` | boolean | NOT NULL, DEFAULT false |
| `sort_order` | integer | NOT NULL |
| `is_active` | boolean | NOT NULL, DEFAULT true |

초기 데이터: `DAMAGE`/파손, `LOSS`/분실, `STOCKTAKE`/실사 차이, `OTHER`/기타(`requires_text=true`) (BR-INV-017)

---

## 3. 재고

### 3.1 `inventory_ledger` — 재고 원장

**append-only입니다. UPDATE와 DELETE를 수행하는 코드를 작성하지 마십시오.**

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `item_id` | bigint | NOT NULL, FK → items | |
| `ledger_type` | varchar(20) | NOT NULL | 6종 (BR-INV-003) |
| `on_hand_delta` | integer | NOT NULL, DEFAULT 0 | 실재고 증감 |
| `allocated_delta` | integer | NOT NULL, DEFAULT 0 | 할당 증감 |
| `ref_type` | varchar(30) | NOT NULL | `RECEIPT` / `APPROVAL` / `SHIPMENT` / `ADJUSTMENT` / `MIGRATION` |
| `ref_id` | bigint | NOT NULL | 참조 레코드 PK |
| `memo` | text | | |
| `created_by` | bigint | NOT NULL, FK → users | |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

**UNIQUE**: `(ref_type, ref_id, ledger_type)` — 동일 이벤트의 이중 기록 방지
**인덱스**: `(item_id, id)` — 집계용

**유형별 델타 고정값**

| `ledger_type` | `on_hand_delta` | `allocated_delta` |
|---|---|---|
| `INBOUND` | +N | 0 |
| `ALLOCATE` | 0 | +N |
| `OUTBOUND` | −N | −N |
| `RELEASE` | 0 | −N |
| `ADJUST` | ±N | 0 |
| `OPENING` | +N | 0 |

**CHECK**: 유형별 부호가 위 표와 일치할 것

### 3.2 `v_item_stock` — 재고 집계 뷰

```sql
CREATE VIEW v_item_stock AS
SELECT
  i.id AS item_id,
  COALESCE(SUM(l.on_hand_delta), 0)    AS on_hand_qty,
  COALESCE(SUM(l.allocated_delta), 0)  AS allocated_qty,
  COALESCE(SUM(l.on_hand_delta), 0)
    - COALESCE(SUM(l.allocated_delta), 0) AS available_qty
FROM items i
LEFT JOIN inventory_ledger l ON l.item_id = i.id
GROUP BY i.id;
```

품목 500건·연 1,800건 규모이므로 캐시 컬럼 없이 뷰로 충분합니다. 성능 문제가 확인되기 전에 비정규화하지 마십시오.

### 3.3 `stock_adjustments` — 재고 조정

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `item_id` | bigint | NOT NULL, FK → items |
| `delta_qty` | integer | NOT NULL, CHECK <> 0 |
| `reason_code` | varchar(20) | NOT NULL, FK → adjustment_reasons |
| `reason_text` | text | |
| `adjusted_by` | bigint | NOT NULL, FK → users |
| `adjusted_at` | timestamptz | NOT NULL, DEFAULT now() |

`reason_code`가 `requires_text=true`이면 `reason_text` 필수 (애플리케이션 검증)

### 3.4 `branch_stocks` — 지점 재고

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `branch_id` | bigint | NOT NULL, FK → branches |
| `item_id` | bigint | NOT NULL, FK → items |
| `stock_qty` | integer | NOT NULL, DEFAULT 0, CHECK >= 0 |
| `updated_by` | bigint | FK → users |
| `updated_at` | timestamptz | |

**UNIQUE**: `(branch_id, item_id)`

원장과 무관합니다. 수기 입력값을 그대로 덮어씁니다 (BR-BRS-001).

---

## 4. 사내 발주

### 4.1 `internal_orders`

한 건이 한 품목을 다룹니다. 품목행 테이블을 두지 않습니다.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | bigint | PK | |
| `order_no` | varchar(20) | NOT NULL, UNIQUE | `IO-YYYYMM-NNNN` |
| `branch_id` | bigint | NOT NULL, FK → branches | |
| `item_id` | bigint | NOT NULL, FK → items | |
| `requested_qty` | integer | NOT NULL, CHECK > 0 | |
| `requested_due_date` | date | NOT NULL | 납기 요망일 |
| `remarks` | text | | |
| `status` | varchar(20) | NOT NULL | 5종 |
| `approved_qty` | integer | NOT NULL, DEFAULT 0, CHECK >= 0 | 누적 승인 |
| `canceled_qty` | integer | NOT NULL, DEFAULT 0, CHECK >= 0 | 누적 취소 |
| `outstanding_qty` | integer | GENERATED ALWAYS AS (`requested_qty - approved_qty - canceled_qty`) STORED | 잔여 |
| `reject_reason` | text | | 반려 시 필수 |
| `origin_order_id` | bigint | FK → internal_orders | 반려 후 재기안 원본 |
| `created_by` | bigint | NOT NULL, FK → users | |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

**CHECK**: `approved_qty + canceled_qty <= requested_qty` (BR-IOR-005)
**CHECK**: `status <> 'REJECTED' OR reject_reason IS NOT NULL` (BR-IOR-009)
**인덱스**: `(branch_id, created_at)`, `(item_id)`, `(status)`, `order_no`

`outstanding_qty`를 생성 컬럼으로 둔 것은 애플리케이션이 잔여 수량을 직접 계산해 저장하다 어긋나는 것을 막기 위함입니다. 이 컬럼에 INSERT/UPDATE하는 코드를 작성하지 마십시오.

### 4.2 `internal_order_approvals`

한 발주에 여러 건 발생합니다 (BR-IOR-006).

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `internal_order_id` | bigint | NOT NULL, FK → internal_orders |
| `approved_qty` | integer | NOT NULL, CHECK > 0 |
| `planned_ship_date` | date | NOT NULL |
| `status` | varchar(20) | NOT NULL — `ALLOCATED` / `SHIPPED` / `CANCELED` |
| `approved_by` | bigint | NOT NULL, FK → users |
| `approved_at` | timestamptz | NOT NULL, DEFAULT now() |
| `canceled_by` | bigint | FK → users |
| `canceled_at` | timestamptz | |

**인덱스**: `(internal_order_id)`, `(status)`

### 4.3 `shipments` — 출고

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `approval_id` | bigint | NOT NULL, UNIQUE, FK → internal_order_approvals |
| `shipped_qty` | integer | NOT NULL, CHECK > 0 |
| `shipped_by` | bigint | NOT NULL, FK → users |
| `shipped_at` | timestamptz | NOT NULL, DEFAULT now() |

`approval_id`가 UNIQUE인 것은 승인 건 단위 출고를 강제하기 위함입니다 (BR-SHP-002). `shipped_qty`는 항상 승인 수량과 같습니다.

---

## 5. 외부 발주

### 5.1 `purchase_orders`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `po_number` | varchar(20) | NOT NULL, UNIQUE — `PO-YYYYMM-NNNN` |
| `supplier_id` | bigint | NOT NULL, FK → suppliers |
| `ordered_date` | date | NOT NULL |
| `requested_due_date` | date | NOT NULL |
| `remarks` | text | |
| `status` | varchar(20) | NOT NULL — `ISSUED` / `RECEIVED` / `CANCELED` |
| `created_by` | bigint | NOT NULL, FK → users |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() |

승인 관련 컬럼을 두지 않습니다 (BR-EOR-001).
**인덱스**: `(supplier_id)`, `(ordered_date)`, `(status)`, `po_number`

### 5.2 `purchase_order_lines`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `purchase_order_id` | bigint | NOT NULL, FK → purchase_orders |
| `item_id` | bigint | NOT NULL, FK → items |
| `requested_qty` | integer | NOT NULL, CHECK > 0 |
| `purchase_price` | integer | NOT NULL, CHECK >= 0 | 발주 시점 단가 스냅샷 |
| `remarks` | text | |

**UNIQUE**: `(purchase_order_id, item_id)`

`purchase_price`는 마스터에서 복사한 스냅샷입니다. 수정해도 마스터에 반영하지 않습니다 (BR-EOR-003).

### 5.3 `receipts` — 입고

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `id` | bigint | PK |
| `purchase_order_line_id` | bigint | NOT NULL, UNIQUE, FK → purchase_order_lines |
| `received_qty` | integer | NOT NULL, CHECK > 0 |
| `received_by` | bigint | NOT NULL, FK → users |
| `received_at` | timestamptz | NOT NULL, DEFAULT now() |

`purchase_order_line_id`의 UNIQUE 제약은 분할 입고 미정(BR-RCV-002)에 따른 잠정 조치입니다. 1행 1입고만 허용합니다. **분할 입고 로직을 구현하지 마십시오.**

---

## 6. 채번

`order_no`와 `po_number`는 `{접두어}-YYYYMM-NNNN` 형식이며 월 단위로 일련번호가 초기화됩니다.

구현은 해당 월 최대값 조회 후 +1이며, UNIQUE 제약 위반 시 재시도합니다. 별도 시퀀스 테이블을 만들지 마십시오.

---

## 7. 조회 필터와 인덱스 대응

BR-RPT-001의 8종 필터 대응입니다.

| 필터 | 대상 컬럼 |
|---|---|
| 날짜 기간 | `internal_orders.created_at`, `purchase_orders.ordered_date` |
| 지점명 | `internal_orders.branch_id` |
| 발주 진행 상태 | `internal_orders.status`, `purchase_orders.status` |
| 품목명 | `items.item_name` |
| 거래처명 | `suppliers.supplier_name` |
| 발주 번호 | `internal_orders.order_no`, `purchase_orders.po_number` |
| 담당자명 | `users.user_name` (조인) |
| 규격 | `items.unit_spec`, `items.pack_unit` |

지점 권한 사용자의 질의에는 `branch_id = 세션 지점` 조건이 서버에서 강제 주입됩니다 (BR-BRS-002).

---

## 8. Neon 환경 주의사항

### 8.1 연결

| 환경 변수 | 용도 | 형태 |
|---|---|---|
| `DATABASE_URL` | 애플리케이션 | pooled |
| `DATABASE_URL_UNPOOLED` | 마이그레이션, 시드 | direct |

애플리케이션은 `@neondatabase/serverless`의 `Pool`(WebSocket)만 사용합니다. HTTP 드라이버 `neon()`은 대화형 트랜잭션을 지원하지 않으므로 재고 관련 경로에서 사용할 수 없습니다.

PgBouncer transaction 모드와 충돌하므로 prepared statement를 비활성화합니다.

### 8.2 잠금

`SELECT ... FOR UPDATE`를 사용하지 않습니다. 풀러 환경에서 세션 단위 락은 신뢰할 수 없습니다.

품목 단위 직렬화가 필요한 처리는 트랜잭션 단위 advisory lock을 사용합니다.

```sql
SELECT pg_advisory_xact_lock(1001, item_id);
```

첫 번째 인자 `1001`은 품목 잠금 네임스페이스입니다. 다른 용도의 advisory lock을 추가할 경우 네임스페이스를 분리하고 이 문서에 등록하십시오.

락은 커밋 또는 롤백 시 자동 해제됩니다. 명시적 해제 코드를 작성하지 마십시오.

### 8.3 생성 컬럼

`internal_orders.outstanding_qty`는 `GENERATED ALWAYS AS ... STORED`입니다. Drizzle 스키마에서 이 컬럼을 일반 컬럼으로 정의하면 INSERT 시 오류가 발생합니다. 생성 컬럼으로 선언하고 애플리케이션 코드에서 값을 넣지 마십시오.

### 8.4 테스트 DB

통합 테스트는 실제 Postgres에서 실행합니다. 생성 컬럼, advisory lock, 원장 UNIQUE 제약이 모두 검증 대상이므로 인메모리 DB로 대체할 수 없습니다.

CI는 Neon 브랜치를 생성해 마이그레이션을 적용하고, 테스트 종료 후 삭제하는 방식을 사용합니다.

---

## 9. 이관 시 주의

- 초기 재고는 `ledger_type = 'OPENING'`, `ref_type = 'MIGRATION'`으로 기록합니다 (BR-MIG-004)
- `ADJUST`를 이관에 사용하지 마십시오
- 규격 파싱 실패 행은 `spec_raw` 보존 + `is_spec_parse_failed = true`로 적재합니다 (BR-MIG-003)
- 이관된 품목의 `item_code`는 엑셀 원본 값을 그대로 씁니다 (BR-ITM-002)
