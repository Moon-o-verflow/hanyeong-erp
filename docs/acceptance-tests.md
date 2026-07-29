# 인수 테스트 (acceptance-tests.md)

㈜한결물산 사내 ERP 웹시스템

---

## 0. 이 문서의 사용법

### 0.1 목적

`business-rules.md`의 규칙이 실제로 동작하는지 검증하는 시나리오입니다. 각 시나리오는 하나 이상의 BR-ID에 대응합니다.

**이 테스트가 실패하면 구현이 잘못된 것입니다. 테스트를 고쳐 통과시키지 마십시오.**

### 0.2 ID 체계

```
AT-{DOMAIN}-{NNN}
```

DOMAIN은 `business-rules.md`와 동일합니다 (`ITM`, `INV`, `IOR`, `EOR`, `RCV`, `SHP`, `BRS`, `AUT`, `RPT`, `MIG`).

### 0.3 표기

- `[필수]` 회귀 테스트로 유지합니다. 삭제·수정 금지
- `[일반]` 구현 편의에 따라 조정 가능

각 시나리오는 Given-When-Then으로 기술하며, 재고가 관련된 경우 실재고/할당/가용을 `100/0/100` 형식으로 표기합니다.

### 0.4 공통 전제

별도 명시가 없으면 다음을 가정합니다.

- 지점: 강남, 수원, 성남, 인천, 대전
- 품목 A: `itemCode=1001`, 세탁세제, 박스 단위
- 관리자 계정 `admin1`, 창고 계정 `wh1`, 강남 지점 계정 `gn1`, 수원 지점 계정 `sw1`

---

## 1. ITM — 품목 마스터

### AT-ITM-001 `[필수]` 필수 항목 누락 시 등록 거부
> BR-ITM-001

- **Given** 관리자로 로그인한 상태
- **When** `supplyPrice`를 비운 채 품목을 등록한다
- **Then** `REQUIRED_FIELD_MISSING`(400)이 반환되고 품목이 생성되지 않는다

`itemName`, `purchasePrice`, `supplyPrice` 각각에 대해 반복합니다. `itemCode`는 시스템 채번이므로 대상에서 제외합니다.

### AT-ITM-002 `[필수]` 신규 등록 시 자동 채번
> BR-ITM-002, BR-ITM-003

- **Given** 기존 품목코드가 `1001`, `1002`, `1003`인 상태
- **When** 관리자가 `itemCode` 없이 품목을 등록한다
- **Then** 생성된 품목의 `itemCode`가 `1004`다

### AT-ITM-003 `[일반]` 요청에 담긴 품목코드는 무시된다
> BR-ITM-002

- **Given** 기존 최대 품목코드가 `1003`인 상태
- **When** 관리자가 `itemCode: "9999"`를 포함해 등록한다
- **Then** 생성된 품목의 `itemCode`가 `1004`다. `9999`가 아니다

### AT-ITM-004 `[필수]` 품목코드 수정 불가
> BR-ITM-004

- **Given** 품목 A가 존재하는 상태
- **When** 관리자가 `itemCode`를 변경하는 수정 요청을 보낸다
- **Then** `ITEM_CODE_IMMUTABLE`(400)이 반환되고 값이 유지된다

### AT-ITM-005 `[일반]` 정수 변환 불가 코드는 채번 계산에서 제외
> BR-ITM-003

- **Given** 품목코드가 `1001`, `1002`, `A-500`인 상태
- **When** 신규 등록한다
- **Then** `1003`이 부여된다

### AT-ITM-006 `[필수]` 비활성 품목은 발주할 수 없다
> BR-ITM-004 관련

- **Given** 품목 A가 비활성 상태
- **When** 지점이 품목 A로 사내 발주를 요청한다
- **Then** `ITEM_INACTIVE`(400)가 반환된다

---

## 2. INV — 재고

### AT-INV-001 `[필수]` 재고는 원장 합계와 항상 일치한다
> BR-INV-001, BR-INV-002

- **Given** 품목 A에 입고 100, 승인 30, 출고 30, 조정 −10이 순서대로 발생한 상태
- **When** `GET /inventory`로 품목 A를 조회한다
- **Then** 실재고 60, 할당 0, 가용 60이다
- **And** `SELECT SUM(on_hand_delta), SUM(allocated_delta)`의 결과와 일치한다

### AT-INV-002 `[필수]` 원장 이중 기록 차단
> BR-INV-003, `data-model.md` 3.1

- **Given** 승인 건 301에 대해 출고 완료가 처리된 상태
- **When** 동일 승인 건에 출고 완료를 다시 요청한다
- **Then** 처리가 거부되고 원장에 `OUTBOUND` 행이 추가되지 않는다
- **And** `(ref_type, ref_id, ledger_type)` UNIQUE 제약이 위반되지 않는다

### AT-INV-003 `[필수]` 지점 응답에서 실재고·할당이 제거된다
> BR-INV-012

- **Given** 품목 A가 `100/30/70`인 상태
- **When** 지점 계정으로 `GET /items`를 호출한다
- **Then** 응답에 `availableQty: 70`이 있다
- **And** `onHandQty`, `allocatedQty` **키가 존재하지 않는다**. `null`도 아니다

### AT-INV-004 `[필수]` 지점 응답에서 매입단가가 제거된다
> BR-AUT-003

- **Given** 품목 A의 매입단가 10000, 공급단가 12000
- **When** 지점 계정으로 품목을 조회한다
- **Then** `supplyPrice: 12000`이 있고 `purchasePrice` 키가 없다

### AT-INV-005 `[필수]` 조정 하한 차단
> BR-INV-016

- **Given** 품목 A가 `100/80/20`인 상태
- **When** 관리자가 `deltaQty: -60`으로 조정한다 (결과 실재고 40 < 할당 80)
- **Then** `ADJUSTMENT_BELOW_ALLOCATED`(409)가 반환된다
- **And** `details.blockingApprovals`에 할당을 점유한 승인 건 목록이 포함된다
- **And** 원장에 `ADJUST` 행이 추가되지 않는다

### AT-INV-006 `[필수]` 승인 취소 후 조정 성공
> BR-INV-016, BR-IOR-012

- **Given** AT-INV-005 직후 상태
- **When** 관리자가 승인 건 40박스를 취소한 뒤 `deltaQty: -60`으로 다시 조정한다
- **Then** 조정이 성공하고 품목 A가 `40/40/0`이 된다

### AT-INV-007 `[일반]` 기타 사유 선택 시 텍스트 필수
> BR-INV-017

- **Given** 관리자로 로그인한 상태
- **When** `reasonCode: "OTHER"`, `reasonText: null`로 조정한다
- **Then** `ADJUSTMENT_REASON_TEXT_REQUIRED`(400)가 반환된다

### AT-INV-008 `[일반]` 조정 사유는 코드 테이블에서 조회된다
> BR-INV-017

- **Given** `adjustment_reasons`에 5번째 사유를 추가한 상태
- **When** `GET /adjustment-reasons`를 호출한다
- **Then** 5건이 반환된다. 코드 변경이나 재배포가 필요 없다

---

## 3. IOR — 사내 발주

### AT-IOR-001 `[필수]` 부분 승인 → 미결 → 2차 승인 전체 흐름
> BR-IOR-004, BR-IOR-005, BR-IOR-006, BR-INV-013, BR-SHP-001
> `state-machine.md` 7.1 트레이스

품목 A 초기 `100/0/100`

| 단계 | 행위자 | 동작 | 기대 재고 | 기대 상태 | 기대 잔여 |
|---|---|---|---|---|---|
| 1 | 강남 | 100 요청 | `100/0/100` | `PENDING` | 100 |
| 2 | 관리자 | 50 승인 | `100/50/50` | `PARTIALLY_APPROVED` | 50 |
| 3 | 창고 | 승인 건 출고 완료 | `50/0/50` | `PARTIALLY_APPROVED` | 50 |
| 4 | 창고 | 외부 발주 30 입고 완료 | `80/0/80` | `PARTIALLY_APPROVED` | 50 |
| 5 | 관리자 | 미결 30 승인 | `80/30/50` | `PARTIALLY_APPROVED` | 20 |
| 6 | 강남 | 잔여 20 취소 | `80/30/50` | `COMPLETED` | 0 |
| 7 | 창고 | 2차 승인 건 출고 완료 | `50/0/50` | `COMPLETED` | 0 |

**검증 포인트**
- 2단계에서 실재고가 변하지 않을 것 (승인은 할당만 발생)
- 3단계에서 실재고와 할당이 동시에 감소할 것
- 6단계에서 잔여가 0이 되어 발주가 `COMPLETED`가 되지만, 5단계 승인 건은 여전히 `ALLOCATED`일 것
- 7단계 완료 후 원장 행 수가 정확히 6건일 것 (`OPENING` 1, `ALLOCATE` 2, `OUTBOUND` 2, `INBOUND` 1)

### AT-IOR-002 `[필수]` 승인 경합
> BR-INV-011, BR-INV-014
> `state-machine.md` 7.2 트레이스

- **Given** 품목 A가 `20/0/20`, 수원 건과 성남 건이 각각 20 요청으로 `PENDING`
- **When** 관리자 甲이 수원 건을 20 승인한다
- **Then** 성공하고 `20/20/0`이 된다
- **When** 관리자 乙이 성남 건을 20 승인한다
- **Then** `INSUFFICIENT_AVAILABLE_STOCK`(409)가 반환되고 `details.availableQty`가 0이다
- **And** 성남 건은 `PENDING`을 유지한다
- **And** **시스템이 0박스 부분 승인을 자동 생성하지 않는다**

### AT-IOR-003 `[필수]` 동시 승인 요청의 직렬화
> BR-INV-011

- **Given** 품목 A가 `20/0/20`, 서로 다른 두 발주가 각각 20 요청
- **When** 두 승인 요청을 동시에 전송한다
- **Then** 정확히 하나만 성공한다
- **And** 실패한 쪽은 `INSUFFICIENT_AVAILABLE_STOCK` 또는 `CONCURRENCY_CONFLICT`를 받는다
- **And** 최종 할당이 20이다. 40이 되지 않는다

### AT-IOR-004 `[필수]` 승인 수량이 잔여를 초과할 수 없다
> BR-IOR-005

- **Given** 요청 100, 승인 50, 잔여 50인 발주
- **When** 관리자가 60을 추가 승인한다
- **Then** `QTY_EXCEEDS_OUTSTANDING`(400)이 반환된다

### AT-IOR-005 `[필수]` 잔여 수량은 직접 조작할 수 없다
> BR-IOR-005, `data-model.md` 4.1

- **Given** 요청 100인 발주
- **When** `outstanding_qty`를 임의 값으로 UPDATE하는 쿼리를 실행한다
- **Then** DB가 거부한다 (생성 컬럼)

### AT-IOR-006 `[필수]` 재고 부족 시 자동 반려하지 않는다
> BR-IOR-008

- **Given** 품목 A가 `0/0/0`인 상태
- **When** 지점이 50 요청을 생성한다
- **Then** 요청이 성공하고 `PENDING` 상태가 된다
- **And** 자동 반려되지 않는다

### AT-IOR-007 `[필수]` 반려 사유 필수
> BR-IOR-009

- **Given** `PENDING` 상태 발주
- **When** 관리자가 사유 없이 반려한다
- **Then** `REJECT_REASON_REQUIRED`(400)가 반환된다

### AT-IOR-008 `[필수]` 반려 건은 수정·재개할 수 없다
> BR-IOR-009, BR-IOR-010

- **Given** `REJECTED` 상태 발주
- **When** 승인, 수정, 취소 중 어느 것이든 요청한다
- **Then** `REJECTED_ORDER_IMMUTABLE`(409)가 반환된다

### AT-IOR-009 `[일반]` 반려 후 재기안은 새 건을 만든다
> BR-IOR-010

- **Given** 반려된 발주 88이 존재
- **When** 지점이 `originOrderId: 88`로 새 발주를 생성한다
- **Then** 새 발주가 생성되고 `originOrderId`가 88로 기록된다
- **And** 발주 88의 상태는 `REJECTED`로 유지된다

### AT-IOR-010 `[필수]` 지점은 승인된 수량을 취소할 수 없다
> BR-IOR-007

- **Given** 요청 100, 승인 50, 잔여 50인 발주
- **When** 지점이 `cancelQty: 80`으로 취소를 요청한다
- **Then** `QTY_EXCEEDS_OUTSTANDING`(400)이 반환된다
- **And** `cancelQty: 50`은 성공한다

### AT-IOR-011 `[필수]` 승인 취소 시 상태가 되돌아간다
> BR-IOR-012, `state-machine.md` 1.2 전이 10

- **Given** 요청 100, 전량 승인되어 `COMPLETED`인 발주, 품목 `100/100/0`
- **When** 관리자가 승인을 취소한다
- **Then** 발주가 `PENDING`이 되고 잔여가 100이 된다
- **And** 품목이 `100/0/100`이 된다
- **And** 원장에 `RELEASE` 행이 기록된다

### AT-IOR-012 `[필수]` 출고 완료된 승인은 취소할 수 없다
> BR-IOR-012

- **Given** `SHIPPED` 상태 승인 건
- **When** 관리자가 승인 취소를 요청한다
- **Then** `APPROVAL_ALREADY_SHIPPED`(409)가 반환된다

### AT-IOR-013 `[필수]` 지점 사용자는 승인할 수 없다
> `permissions.md` 2.3

- **Given** 지점 계정으로 로그인
- **When** 승인 엔드포인트를 호출한다
- **Then** `FORBIDDEN`(403)이 반환된다

### AT-IOR-014 `[필수]` 지점은 타 지점 발주를 조회할 수 없다
> BR-BRS-002, `permissions.md` 4장

- **Given** 강남 계정으로 로그인, 수원 지점 발주 99가 존재
- **When** `GET /internal-orders/99`를 호출한다
- **Then** `BRANCH_SCOPE_VIOLATION`(403) 또는 `NOT_FOUND`(404)가 반환된다
- **When** `GET /internal-orders?branchId=<수원>`를 호출한다
- **Then** 강남 지점 건만 반환된다. 파라미터가 무시된다

### AT-IOR-015 `[필수]` 관리자는 사내 발주를 생성할 수 없다
> `permissions.md` 2.3

- **Given** 관리자 계정으로 로그인
- **When** `POST /internal-orders`를 호출한다
- **Then** `FORBIDDEN`(403)이 반환된다

---

## 4. SHP — 출고

### AT-SHP-001 `[필수]` 실재고 부족 시 출고 차단
> BR-INV-010
> `state-machine.md` 2.2 전이 2

- **Given** 승인 50이 존재하나 실재고가 30으로 조정된 상태
- **When** 창고가 출고 완료를 요청한다
- **Then** `INSUFFICIENT_ON_HAND_STOCK`(409)가 반환된다
- **And** 승인 건이 `ALLOCATED`를 유지한다
- **And** **30박스만 부분 출고되지 않는다**

### AT-SHP-002 `[필수]` 실재고는 음수가 될 수 없다
> BR-INV-010

- **Given** 어떤 상태든
- **When** 출고·조정을 통해 실재고를 음수로 만들려 시도한다
- **Then** 모두 거부되고, 어떤 시점에도 `v_item_stock.on_hand_qty < 0`인 품목이 존재하지 않는다

### AT-SHP-003 `[필수]` 출고 수량은 승인 수량과 같다
> BR-SHP-002

- **Given** 승인 50인 건
- **When** 출고 완료를 요청한다
- **Then** 원장 `OUTBOUND`의 절댓값이 50이다
- **And** API가 출고 수량 파라미터를 받지 않는다

### AT-SHP-004 `[필수]` 창고 외 권한은 출고할 수 없다
> `permissions.md` 2.3

- **Given** 관리자 계정으로 로그인
- **When** 출고 완료를 요청한다
- **Then** `FORBIDDEN`(403)이 반환된다

---

## 5. EOR / RCV — 외부 발주 및 입고

### AT-EOR-001 `[필수]` 외부 발주는 승인 없이 발행된다
> BR-EOR-001

- **Given** 관리자로 로그인
- **When** 외부 발주를 생성한다
- **Then** 즉시 `ISSUED` 상태가 된다
- **And** 승인 관련 엔드포인트가 존재하지 않는다

### AT-EOR-002 `[필수]` 외부 발주 생성은 재고에 영향이 없다
> BR-EOR-006

- **Given** 품목 A가 `100/0/100`
- **When** 품목 A로 50 외부 발주를 생성한다
- **Then** 품목 A가 `100/0/100`을 유지한다
- **And** 원장에 행이 추가되지 않는다

### AT-EOR-003 `[일반]` 매입단가 수정은 마스터에 반영되지 않는다
> BR-EOR-003

- **Given** 품목 A의 마스터 매입단가가 10000
- **When** 외부 발주에서 `purchasePrice: 9500`으로 발행한다
- **Then** 발주행에 9500이 저장된다
- **And** 마스터 매입단가는 10000으로 유지된다

### AT-EOR-004 `[일반]` 발주서 번호 형식과 월별 초기화
> BR-EOR-004

- **Given** 2026년 7월에 발주 3건이 생성된 상태
- **When** 2026년 8월에 발주를 생성한다
- **Then** `PO-202608-0001`이 부여된다

### AT-EOR-005 `[필수]` 지점은 외부 발주에 접근할 수 없다
> `permissions.md` 2.4

- **Given** 지점 계정으로 로그인
- **When** 외부 발주 목록·단건·생성 중 어느 것이든 호출한다
- **Then** 모두 `FORBIDDEN`(403)이 반환된다

### AT-RCV-001 `[필수]` 입고 완료 시 실재고 증가
> BR-RCV-001

- **Given** 품목 A가 `50/0/50`, 외부 발주행 30이 `ISSUED`
- **When** 창고가 입고 완료를 처리한다
- **Then** 품목 A가 `80/0/80`이 된다
- **And** 원장에 `INBOUND +30`이 기록된다

### AT-RCV-002 `[필수]` 모든 품목행 입고 시 발주가 종결된다
> `state-machine.md` 3.1 전이 2

- **Given** 품목행 2건인 외부 발주
- **When** 첫 번째 행만 입고 처리한다
- **Then** 발주가 `ISSUED`를 유지한다
- **When** 두 번째 행을 입고 처리한다
- **Then** 발주가 `RECEIVED`가 된다

### AT-RCV-003 `[필수]` 중복 입고 차단
> BR-RCV-002

- **Given** 입고 완료된 품목행
- **When** 같은 행에 입고를 다시 요청한다
- **Then** `ALREADY_RECEIVED`(409)가 반환된다
- **And** 원장에 `INBOUND`가 추가되지 않는다

### AT-RCV-004 `[필수]` 부분 입고 API가 존재하지 않는다
> BR-RCV-002 (미정)

- **When** 입고 엔드포인트에 수량 파라미터를 전달한다
- **Then** 파라미터가 무시되고 요청 수량 전량이 입고된다

---

## 6. BRS — 지점 재고

### AT-BRS-001 `[필수]` 지점 재고는 원장과 무관하다
> BR-BRS-001, BR-INV-004

- **Given** 강남 지점이 품목 A 재고를 40으로 입력
- **When** 본사 재고를 조회한다
- **Then** 본사 재고에 변화가 없다
- **And** 원장에 행이 추가되지 않는다

### AT-BRS-002 `[필수]` 출고가 지점 재고를 증가시키지 않는다
> BR-BRS-001

- **Given** 강남 지점 재고 40, 승인 50이 출고 대기
- **When** 창고가 출고 완료를 처리한다
- **Then** 강남 지점 재고가 40으로 유지된다

### AT-BRS-003 `[필수]` 타 지점 재고 접근 차단
> BR-BRS-002

- **Given** 강남 계정으로 로그인
- **When** 수원 지점 재고를 조회하거나 입력한다
- **Then** `BRANCH_SCOPE_VIOLATION`(403)이 반환된다

### AT-BRS-004 `[필수]` 관리자는 지점 재고를 입력할 수 없다
> `permissions.md` 2.5

- **Given** 관리자 계정으로 로그인
- **When** `PUT /branch-stocks`를 호출한다
- **Then** `FORBIDDEN`(403)이 반환된다
- **And** 조회는 성공한다

### AT-BRS-005 `[일반]` 같은 지점 담당자는 동일 데이터를 본다
> BR-BRS-003

- **Given** 강남 지점 담당자 2명
- **When** 한 명이 재고를 입력하고 다른 한 명이 조회한다
- **Then** 입력값이 그대로 보인다

---

## 7. MIG — 데이터 이관

### AT-MIG-001 `[필수]` 검증 실패 시 전건 미반영
> BR-MIG-002

- **Given** 500행 중 3행에 오류가 있는 엑셀
- **When** 관리자가 업로드한다
- **Then** `UPLOAD_VALIDATION_FAILED`(400)가 반환된다
- **And** 오류 3건의 행 번호와 사유가 포함된다
- **And** **품목 테이블에 한 건도 추가되지 않는다**

### AT-MIG-002 `[필수]` 규격 파싱
> BR-MIG-003, BR-ITM-005

| 입력 | `unitSpec` | `unitName` | `packQty` | `packUnit` |
|---|---|---|---|---|
| `500ml 12입/박스` | `500ml` | `개` | 12 | `박스` |
| `1L 6입/박스` | `1L` | `개` | 6 | `박스` |
| `30롤/팩` | (없음) | `롤` | 30 | `팩` |

### AT-MIG-003 `[필수]` 파싱 실패는 업로드를 중단시키지 않는다
> BR-MIG-003

- **Given** 규격이 `대용량특가`인 행이 포함된 엑셀
- **When** 업로드한다
- **Then** 업로드가 성공한다
- **And** 해당 품목의 `spec_raw`에 원문이 보존되고 `is_spec_parse_failed`가 true다
- **And** 응답의 `specParseFailedCount`에 집계된다

### AT-MIG-004 `[필수]` 초기 재고는 OPENING으로 기록된다
> BR-MIG-004

- **Given** 초기 재고 100이 포함된 엑셀
- **When** 업로드한다
- **Then** 원장에 `ledger_type = 'OPENING'`, `ref_type = 'MIGRATION'` 행이 생성된다
- **And** `ADJUST` 행이 생성되지 않는다

### AT-MIG-005 `[일반]` 이관 품목코드는 원본을 유지한다
> BR-ITM-002

- **Given** 엑셀의 품목코드가 `1001`~`1500`
- **When** 업로드한다
- **Then** 모든 품목의 `itemCode`가 엑셀 값과 동일하다

---

## 8. RPT — 조회 및 리포트

### AT-RPT-001 `[일반]` 8종 필터 동작
> BR-RPT-001

각 필터를 단독 적용하고 결과를 검증합니다. 날짜 기간, 지점명, 발주 상태, 품목명, 거래처명, 발주 번호, 담당자명, 규격.

### AT-RPT-002 `[일반]` 복수 필터는 AND로 결합된다
> BR-RPT-001

- **When** 지점=강남, 상태=`PENDING`을 동시에 적용한다
- **Then** 두 조건을 모두 만족하는 건만 반환된다

### AT-RPT-003 `[필수]` 다운로드 파일에도 마스킹이 적용된다
> BR-INV-012, BR-AUT-003, `permissions.md` 2.7

- **Given** 지점 계정으로 로그인
- **When** 재고 현황 엑셀을 다운로드한다
- **Then** 파일에 매입단가·실재고·할당 열이 존재하지 않는다
- **When** 발주 현황 엑셀을 다운로드한다
- **Then** 자기 지점 행만 포함된다

### AT-RPT-004 `[일반]` 최소 재고 미달 표시
> BR-ITM-007

- **Given** 품목 A의 최소 재고 20, 실재고 15
- **When** 관리자가 재고 현황을 조회한다
- **Then** `isBelowMinStock`이 true다
- **And** 알림이 발송되지 않고 발주가 차단되지 않는다

---

## 9. 범위 제외 검증

구현되지 않아야 할 것을 확인합니다. 이 시나리오들은 **기능이 없음을 검증**합니다.

### AT-SCP-001 `[필수]` 미구현 엔드포인트 부재
> `api-spec.md` 5장

다음 경로가 존재하지 않을 것 (404 또는 라우트 미등록)

- 출고 완료 취소
- 부분 수량 입고
- 계정 생성·삭제
- 외부 발주 자동 발송
- 창고 간 재고 이동
- 박스↔낱개 환산

### AT-SCP-002 `[필수]` 금지 식별자 부재
> `glossary.md` 4장

정적 검사로 확인합니다.

- 스키마에 `warehouse`를 포함한 테이블·컬럼이 없을 것
- `items` 테이블에 재고 수량 컬럼이 없을 것
- 코드에 단독 `qty`, `price`, `stock` 식별자가 없을 것

### AT-SCP-003 `[필수]` 원장 불변성
> BR-INV-001

- 코드베이스에 `inventory_ledger`에 대한 UPDATE·DELETE 구문이 없을 것
- DB 권한 수준에서 애플리케이션 계정의 해당 권한을 회수하는 것을 권장

---

## 10. 회귀 테스트 최소 집합

시간이 부족할 때 우선 구현할 시나리오입니다. 이 8개는 **반드시** 자동화하십시오.

| ID | 검증 내용 |
|---|---|
| AT-IOR-001 | 부분 승인 전체 흐름 (7단계 트레이스) |
| AT-IOR-002 | 승인 경합 |
| AT-IOR-003 | 동시 승인 직렬화 |
| AT-SHP-001 | 실재고 부족 시 출고 차단 |
| AT-INV-005 | 조정 하한 차단 |
| AT-INV-003 | 지점 응답 필드 마스킹 |
| AT-IOR-014 | 지점 행 범위 제한 |
| AT-MIG-001 | 업로드 전건 미반영 |

앞의 5개가 재고 정합성의 핵심이고, 뒤의 3개가 권한과 데이터 무결성의 핵심입니다.
