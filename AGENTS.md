# AGENTS.md

㈜한결물산 사내 ERP 웹시스템

> 이 파일은 리포지토리 루트에 위치하며 에이전트가 자동으로 읽습니다.
> **작업을 시작하기 전에 이 문서를 끝까지 읽으십시오.**

---

## 1. 프로젝트 요약

생활용품 도매유통사의 사내 ERP입니다. 본사 창고 재고를 박스 단위로 관리하고, 지점이 본사에 요청하는 **사내 발주**와 본사가 공급사에 요청하는 **외부 발주**를 분리 운영합니다. 사용자 17명, 품목 약 500건, 월 발주 약 150건 규모입니다.

**이 프로젝트의 본질은 재고 정합성입니다.** 화면 완성도보다 재고 수량이 어긋나지 않는 것이 우선입니다. 고객이 기존 엑셀 방식을 버리는 이유가 재고 불일치였습니다.

---

## 2. 문서 체계

명세 문서가 코드보다 우선합니다. 코드와 문서가 다르면 **코드를 고치십시오.**

| 문서 | 담당 범위 | 언제 읽는가 |
|---|---|---|
| `docs/glossary.md` | 한국어 용어 ↔ 영문 식별자, 금지 식별자 | 이름을 지을 때마다 |
| `docs/business-rules.md` | 업무 규칙, 계산식, 금지 조건 | 조건문을 쓸 때마다 |
| `docs/data-model.md` | 테이블·컬럼·제약·인덱스 | 스키마·쿼리 작성 시 |
| `docs/state-machine.md` | 상태 전이와 재고 원장 기록 시점 | 상태 변경·재고 관련 코드 작성 시 |
| `docs/permissions.md` | 권한 × 리소스 × 액션 | 엔드포인트·화면 작성 시 |
| `docs/api-spec.md` | 엔드포인트, 스키마, 에러 코드 | API 구현 시 |
| `docs/acceptance-tests.md` | 검증 시나리오 | 테스트 작성 시 |

**최초 진입 시 필수 통독**: `glossary.md` → `business-rules.md` → `data-model.md` → `state-machine.md`

---

## 3. 절대 금지 사항

아래를 위반하는 코드는 어떤 이유로도 작성하지 마십시오.

### 3.1 명세에 없는 규칙을 추론하지 않는다

업무 규칙이 필요한데 `business-rules.md`에 없으면, **추측해서 구현하지 말고 작업을 중단하고 보고하십시오.** "일반적인 ERP는 이렇게 동작한다"는 근거가 되지 않습니다.

### 3.2 `TODO(고객확인)` 항목을 구현하지 않는다

현재 미정 항목입니다. 해당 기능의 코드·UI·API를 만들지 마십시오.

| 규칙 | 항목 |
|---|---|
| BR-RCV-002 | 분할 입고 |
| BR-SHP-003 | 출고 완료 취소 |
| BR-BRS-004 | 지점 재고 입력 주기 강제 |
| BR-AUT-005 | 계정 발급·회수, 비밀번호 정책 |

### 3.3 재고를 직접 수정하지 않는다

`items` 테이블에 재고 수량 컬럼을 추가하지 마십시오. 재고 증감은 **`inventory_ledger` INSERT로만** 발생합니다 (BR-INV-001). 원장에 UPDATE·DELETE를 수행하는 코드를 작성하지 마십시오.

재고를 읽을 때는 `v_item_stock` 뷰를 사용합니다.

### 3.4 범위 밖 기능을 만들지 않는다

고객이 명시적으로 제외했거나 2차로 미룬 항목입니다. 요청받더라도 구현하지 마십시오.

- 다중 창고, 창고 간 이동
- 회계 등 외부 시스템 연동
- 박스↔낱개 환산, 낱개 단위 발주
- 외부 발주서 자동 발송 (이메일·메신저)
- 차트·그래프 대시보드
- 단가 변경 이력
- 반품·불량 처리 (재고 조정으로 대체)
- 최소 재고 미달 알림, 자동 발주

### 3.5 금지 식별자를 쓰지 않는다

`glossary.md` 4장의 전체 목록을 확인하십시오. 특히 다음은 절대 금지입니다.

| 금지 | 대신 |
|---|---|
| `Order`, `orders`, `orderId` | `InternalOrder` / `PurchaseOrder` |
| `qty`, `quantity`, `stock` (단독) | `onHandQty` / `allocatedQty` / `availableQty` / `requestedQty` / `approvedQty` |
| `price` (단독) | `purchasePrice` / `supplyPrice` |
| `Warehouse` | 사용하지 않음 (창고 엔티티 없음) |

### 3.6 권한 검증을 클라이언트에 두지 않는다

지점 사용자에게 실재고와 매입단가를 숨기는 것은 **API 응답 단계에서** 처리합니다 (BR-INV-012, BR-AUT-003). 값을 응답에 담고 화면에서 감추는 구현은 위반입니다.

---

## 4. 기술 스택

확정되었습니다. 임의로 교체하거나 대체 라이브러리를 도입하지 마십시오.

| 계층 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | |
| 배포 | Vercel | |
| DB | Neon (PostgreSQL) | 생성 컬럼과 advisory lock이 설계 전제 |
| 드라이버 | `@neondatabase/serverless`의 `Pool` (WebSocket) | **HTTP 드라이버 `neon()` 사용 금지** |
| ORM | Drizzle ORM + Drizzle Kit | raw SQL 혼용 가능 |
| API | Route Handlers (`app/api/**/route.ts`) | `api-spec.md` 경로와 1:1 |
| 런타임 | Node.js runtime | **Edge runtime 사용 금지** |
| 검증 | Zod | 요청 스키마와 폼 검증 공유 |
| 인증 | Auth.js v5 (Credentials) | |
| UI | Tailwind CSS + shadcn/ui + TanStack Table | |
| 엑셀 | SheetJS (xlsx) | 업로드 파싱, 다운로드 생성 |
| PDF | `@react-pdf/renderer` | Puppeteer 금지 |
| 테스트 | Vitest + 실제 Postgres | SQLite 등 인메모리 DB 대체 금지 |

### 4.1 서버리스 환경 제약

이 스택에서 반드시 지켜야 할 사항입니다. 위반하면 재고 정합성이 깨집니다.

**(1) HTTP 드라이버를 쓰지 않는다**

`neon()` HTTP 드라이버는 단발 쿼리 전용이며 대화형 트랜잭션을 지원하지 않습니다. 이 시스템의 모든 재고 변경은 `읽기 → 검증 → 쓰기`를 한 트랜잭션에서 수행해야 하므로 WebSocket `Pool`만 사용합니다.

```ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

**(2) 재고 검증 경로는 Node.js 런타임으로 고정한다**

해당 Route Handler에 다음을 명시합니다.

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

**(3) 잠금은 advisory lock을 쓴다**

Neon 풀러(PgBouncer transaction 모드)에서는 세션 단위 락을 신뢰할 수 없습니다. `SELECT ... FOR UPDATE` 대신 트랜잭션 단위 advisory lock을 사용합니다. 상세는 `state-machine.md` 6장입니다.

**(4) prepared statement를 비활성화한다**

PgBouncer transaction 모드와 충돌합니다. Drizzle 클라이언트 설정에서 끄십시오.

**(5) 연결 문자열을 구분한다**

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | 애플리케이션 (pooled) |
| `DATABASE_URL_UNPOOLED` | 마이그레이션, 시드 (direct) |

마이그레이션을 pooled 연결로 실행하지 마십시오.

### 4.2 시간대

- 저장: `timestamptz` (UTC)
- 표시: KST 고정. 사용자 로컬 시간대를 따르지 않는다
- 납기 요망일, 출고 예정일: `date` 타입. 시각을 붙이지 않는다

### 4.3 도입하지 않는 것

요청받더라도 추가하지 마십시오.

- 상태 관리 라이브러리 (Redux, Zustand 등) — 서버 컴포넌트와 Route Handler로 충분
- 캐싱 레이어 (Redis 등) — 품목 500건, 월 150건 규모
- 차트 라이브러리 — 범위 제외 항목
- Server Actions를 통한 재고 변경 — 재고를 바꾸는 처리는 반드시 Route Handler를 거친다. Server Actions는 조회·폼 편의용으로만 사용

---

## 5. 디렉터리 구조

```
/docs                     명세 문서. 코드보다 우선한다
/db
  /migrations             Drizzle Kit 생성 SQL. 반드시 커밋한다
  /seeds                  지점 5건, 조정 사유 4건, 초기 계정
/app
  /(dashboard)            화면. 권한별 레이아웃
  /api/**/route.ts        api-spec.md와 1:1 대응
/src
  /db
    schema.ts             Drizzle 스키마. data-model.md와 1:1
    client.ts             Pool + drizzle 인스턴스
    lock.ts               advisory lock 헬퍼
  /domain                 업무 규칙 구현. BR-ID 주석 필수
  /application            유스케이스. 트랜잭션 경계가 여기에 있다
  /lib
    auth.ts               Auth.js 설정
    permissions.ts        권한 검증 공통 계층
    schemas/              Zod 요청 스키마
  /components             UI
/tests
  /unit
  /integration            재고 정합성 검증. 실제 DB에 붙는다
```

**`/src/application`이 유일한 트랜잭션 경계입니다.** Route Handler는 검증과 직렬화만 담당하고, DB 트랜잭션을 직접 열지 않습니다. 컴포넌트에서 DB에 직접 접근하지 마십시오.

---

## 6. 코드 작성 규칙

### 6.1 규칙 ID 주석

업무 규칙이 반영된 코드에는 해당 BR-ID를 주석으로 남깁니다.

```python
# BR-INV-010: 실재고 부족 시 출고 차단
if stock.on_hand_qty < approval.approved_qty:
    raise InsufficientOnHandStock(...)
```

이 주석은 장식이 아닙니다. 규칙이 바뀔 때 영향 범위를 찾는 유일한 수단입니다.

### 6.2 트랜잭션 경계

상태 변경과 원장 기록은 **하나의 트랜잭션**에서 수행합니다. 순서를 지키십시오.

```
1. 트랜잭션 시작
2. 품목 잠금       SELECT pg_advisory_xact_lock(?, item_id)
3. 재고 재조회      v_item_stock
4. 사전 조건 검증   state-machine.md의 해당 전이
5. 원장 INSERT
6. 상태 UPDATE
7. 커밋 (락은 커밋 시 자동 해제)
```

`SELECT ... FOR UPDATE`를 쓰지 마십시오. Neon 풀러 환경에서 신뢰할 수 없습니다.

화면에서 넘어온 재고 값을 신뢰하고 2·3단계를 생략하지 마십시오. 표시된 값은 항상 낡은 값입니다 (BR-INV-011).

### 6.3 수량과 금액

- 수량은 정수. 소수·부동소수를 쓰지 않는다
- 금액은 원 단위 정수. `float`·`double`을 쓰지 않는다
- 모든 수량은 포장 단위(박스) 기준. `pack_qty`(입수)를 계산에 쓰지 않는다 (BR-ITM-006)

### 6.4 언어

- 코드·식별자·주석: 영문 (규칙 ID 주석의 설명은 한국어 허용)
- UI 문구·에러 메시지: 한국어. `glossary.md` 6장의 표기를 그대로 사용
- 커밋 메시지: 한국어 또는 영문. 아래 형식

```
feat(ior): 사내 발주 부분 승인 구현

BR-IOR-004, BR-IOR-005, BR-INV-013 적용
```

---

## 7. 작업 절차

1. **계획을 먼저 제시한다.** 변경할 파일과 적용할 BR-ID를 나열하고 동의를 받은 뒤 코드를 씁니다. 확인 없이 대량 생성하지 마십시오.
2. -**한 번에 한 티켓만 처리한다.** 요청 범위 밖의 리팩터링·개선을 임의로 수행하지 마십시오.-
위 원칙은 무시한다. 시간이 부족하기 때문에, 단계별 구현을 한번에 하도록 한다.
3. **명세를 먼저 확인한다.** 기억이나 관행이 아니라 `/docs`를 읽고 작성합니다.
4. **모순을 발견하면 보고한다.** 문서 간, 또는 문서와 코드 간 충돌을 임의로 해소하지 마십시오.
5. **작업 후 검증한다.** 8장의 명령을 실행하고 결과를 보고합니다.


---

## 8. 테스트 및 검증

```bash
# 전체 테스트
pnpm test

# 재고 정합성 통합 테스트 (재고 관련 변경 시 반드시 실행)
pnpm test tests/integration/inventory

# 타입 체크 + 린트
pnpm typecheck && pnpm lint

# 마이그레이션 생성 / 적용
pnpm db:generate
pnpm db:migrate      # DATABASE_URL_UNPOOLED 사용

# 시드
pnpm db:seed
```

통합 테스트는 실제 Postgres에 연결됩니다. 로컬은 Docker Postgres 또는 Neon 개발 브랜치를 사용하고, CI는 Neon 브랜치를 생성해 실행한 뒤 삭제합니다.

**인메모리 DB로 대체하지 마십시오.** 생성 컬럼(`outstanding_qty`), advisory lock, 원장 UNIQUE 제약이 검증 대상이며 이들은 Postgres 고유 기능입니다.

**재고 관련 코드를 건드렸다면 통합 테스트를 반드시 실행하십시오.** 단위 테스트 통과만으로는 원장 정합성이 검증되지 않습니다.

`acceptance-tests.md`의 수치 트레이스 3건은 회귀 테스트로 유지합니다. 이 테스트가 깨지면 구현이 잘못된 것이며, 테스트를 수정해 통과시키지 마십시오.

---

## 9. 보고가 필요한 상황

다음 중 하나라도 해당하면 **작업을 멈추고 보고하십시오.**

- 명세에 없는 업무 규칙이 필요해졌다
- `TODO(고객확인)` 영역을 건드려야 한다
- 문서 간 모순을 발견했다
- 3.4의 범위 제외 항목이 필요해 보인다
- `glossary.md`에 없는 새 개념의 이름을 지어야 한다
- 성능 문제로 재고 집계 방식(원장 → 캐시)을 바꿔야 한다고 판단했다
- 4장의 스택 구성요소를 교체하거나 추가해야 한다
- 재고를 다루는 경로를 Edge runtime이나 HTTP 드라이버로 바꿔야 한다고 판단했다

보고 형식은 자유이나, **무엇이 막혔고 어떤 선택지가 있으며 각각의 대가가 무엇인지**를 포함하십시오. 임의로 하나를 골라 진행하지 마십시오.
