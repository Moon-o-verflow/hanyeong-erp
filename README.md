# 한결물산 ERP

생활용품 도매유통사의 본사 재고와 지점 사내 발주를 관리하는 Next.js 기반 내부 ERP입니다. 재고의 정확한 추적을 최우선으로 하며, 품목·거래처 관리와 초기 재고 엑셀 이관, 사내 발주의 승인·출고 흐름을 제공합니다.

## 기술 구성

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table
- Neon PostgreSQL + Drizzle ORM/Kit
- Auth.js v5 Credentials 인증, Zod 요청 검증
- Vitest, SheetJS(xlsx)

## 실행 방법

### 1. 요구 환경

- Node.js 20 이상
- pnpm 10 이상
- Neon PostgreSQL 데이터베이스 (애플리케이션 pooled URL과 마이그레이션 direct URL 모두 필요)

### 2. 설치와 환경 변수

```bash
pnpm install
Copy-Item .env.example .env.local
```

`.env.local`에 다음 값을 채웁니다. 실제 비밀 값은 저장소에 커밋하지 않습니다.

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | 애플리케이션의 Neon pooled 연결 문자열 |
| `DATABASE_URL_UNPOOLED` | Drizzle 마이그레이션·시드용 direct 연결 문자열 |
| `AUTH_SECRET` | Auth.js 세션 서명 비밀 값 |
| `AUTH_TRUST_HOST` | 로컬에서는 `true` |
| `NEXTAUTH_URL` | 로컬 주소 (`http://localhost:3000`) |
| `INITIAL_ACCOUNT_PASSWORD` | 초기 시드 계정 공통 비밀번호 |

### 3. DB 준비 및 실행

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

브라우저에서 `http://localhost:3000/items` 또는 `http://localhost:3000/internal-orders`로 접근합니다. 시드 계정의 로그인 ID는 `admin1`, `wh1`, `gn1` 등이며, 비밀번호는 `INITIAL_ACCOUNT_PASSWORD` 값입니다.

### 주요 명령

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## 핵심 의사결정

### 원장 기반 재고

품목 테이블에 재고 수량을 저장하지 않습니다. 재고는 `inventory_ledger`의 append-only 기록을 `v_item_stock` 뷰로 합산하여 조회합니다. 재고 변경은 `INBOUND`, `ALLOCATE`, `OUTBOUND`, `RELEASE`, `ADJUST`, `OPENING`의 여섯 원장 유형으로만 일어납니다.

### 동시성 제어

동일 품목의 승인·출고·조정은 Neon pooled 환경에서 트랜잭션 단위 advisory lock(`pg_advisory_xact_lock`)으로 직렬화합니다. 처리 중에는 항상 현재 `v_item_stock`을 다시 조회하므로 화면에 표시된 오래된 재고 값으로 처리하지 않습니다.

### 사내 발주와 재고의 분리

지점의 요청 생성은 재고를 차감하지 않습니다. 관리자의 승인 시 `ALLOCATE`로 할당만 증가하고, 창고의 출고 완료 시 `OUTBOUND`로 실재고와 할당이 함께 감소합니다. 미결 수량은 생성 컬럼으로 계산되어 직접 변경할 수 없습니다.

### 권한과 데이터 노출

권한 검증과 지점 범위 제한은 Route Handler의 서버 측 공통 계층에서 수행합니다. 지점 응답에는 실재고·할당·매입단가를 포함하지 않으며, 클라이언트에서 숨기는 방식에 의존하지 않습니다.

### 초기 재고 이관

엑셀 업로드는 모든 행을 검증한 뒤 하나의 트랜잭션에서 반영합니다. 한 행이라도 오류가 있으면 아무 품목도 생성하지 않습니다. 초기 재고는 조정이 아닌 `OPENING` 원장 기록으로 남기며, 규격 파싱 실패는 원문과 실패 플래그를 보존해 수기 보정할 수 있게 합니다.

## 현재 구현 범위

- 기반 설정, DB 스키마·마이그레이션·시드, 인증·권한·공통 응답
- 품목 및 거래처 CRUD, 품목 엑셀 일괄 이관, 재고 조회·원장 이력
- 사내 발주 생성·조회·승인·반려·잔여 취소·승인 취소·출고
- 품목 및 사내 발주 역할별 화면

상세 업무 규칙과 API 계약은 [docs](docs) 디렉터리를 기준으로 합니다.
