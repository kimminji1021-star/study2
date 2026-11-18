# study2

숨비투어(Soombi Tours) 웹사이트 저장소다. Payload CMS와 Next.js로 만든 앱 하나에 소개 페이지와 관리자 화면이 함께 들어 있다.

이 문서는 Windows 11 PC에서 개발 환경을 처음부터 갖추는 순서를 설명한다. 위에서부터 차례대로 따라 하면 된다. 명령은 PowerShell 기준이며, 별도 표시가 없으면 저장소 루트 폴더에서 실행한다.

## 1. 사전 준비

### 1-1. Node.js LTS

[nodejs.org](https://nodejs.org)에서 **Node.js 24 LTS** Windows 설치 프로그램(.msi)을 받아 설치한다. 설치가 끝나면 PowerShell 창을 새로 열고 버전을 확인한다.

```powershell
node -v
```

`v24.22.1` 이상의 24.x가 나오면 된다. 이 프로젝트가 지원하는 범위는 `^22.23.4 || ^24.22.1`이고, Node.js 25와 26은 지원하지 않는다. 범위를 벗어난 버전에서는 4단계 의존성 설치가 실패한다. (운영 배포의 Vercel이 이 범위로 Node 버전을 고르고, Node.js 25부터는 Corepack이 빠져 pnpm 버전 고정이 보장되지 않아 26을 뺐다 — 10. 배포 참고)

`winget install OpenJS.NodeJS.LTS`로 설치하면 Node.js 26이 설치될 수 있다. 이 경우 설치가 거부되므로, nodejs.org에서 Node.js 24 설치 프로그램을 받아 다시 설치한다.

### 1-2. pnpm 활성화

**관리자 권한**으로 연 PowerShell에서 Corepack으로 pnpm을 활성화한다.

```powershell
corepack enable pnpm
```

일반 권한 창에서 실행하면 Node.js가 `Program Files` 아래에 설치되어 있어 `EPERM` 오류가 날 수 있다. 관리자 권한을 쓸 수 없거나 Corepack을 쓸 수 없는 경우에는 아래 명령으로 대신한다. 버전은 `package.json`의 `packageManager` 값과 같다.

```powershell
npm install -g pnpm@11.28.9
```

새 PowerShell 창(일반 권한)을 열어 저장소 폴더에서 확인한다.

```powershell
pnpm -v
```

`11.28.9`가 나오면 된다. `package.json`의 `packageManager` 필드가 pnpm 버전을 고정하므로, 전역에 다른 버전(예: 12)이 깔려 있어도 저장소 안에서는 이 버전으로 바뀌어 실행된다.

### 1-3. Docker Desktop

로컬 데이터베이스(PostgreSQL)는 Docker 컨테이너로 실행한다. Docker 공식 사이트에서 Docker Desktop을 내려받아 설치하고 실행한 뒤, 작업 표시줄 트레이에 고래 아이콘이 떠 있는지 확인한다. 데몬이 응답하는지는 다음 명령으로 점검한다.

```powershell
docker info
```

Docker Desktop은 WSL 2 위에서 동작한다. 시작할 때 WSL이 설치되어 있지 않다는 오류가 나면 [문제 해결](#9-문제-해결)의 WSL 항목을 따른다.

## 2. 환경 변수 설정

예시 파일을 복사해 `.env`를 만든다. `.env`는 Git에 올라가지 않는다(`.gitignore`에 들어 있다).

```powershell
Copy-Item .env.example .env
```

`.env`를 편집기로 열어 값을 채운다.

| 변수 | 뜻 | 값 |
|---|---|---|
| `POSTGRES_USER` | 로컬 DB 사용자 이름 | 영문 소문자 이름(예: `sumbi`) |
| `POSTGRES_PASSWORD` | 로컬 DB 비밀번호 | 아래 방법으로 만든 무작위 문자열 |
| `POSTGRES_DB` | 로컬 DB 이름 | 영문 소문자 이름(예: `sumbi_tour`) |
| `POSTGRES_PORT` | DB가 PC에서 쓰는 포트 | 비워 두면 `5432` |
| `DATABASE_URL` | 앱이 DB에 접속하는 주소 | `postgresql://사용자:비밀번호@127.0.0.1:5432/DB이름` 형식. 위 세 값과 포트를 그대로 넣는다 |
| `PAYLOAD_SECRET` | Payload가 암호화·서명에 쓰는 비밀 값 | 아래 방법으로 만든 무작위 문자열 |
| `NEXT_PUBLIC_SERVER_URL` | 사이트 주소 | `http://localhost:3000` |
| `E2E_PORT` | E2E 테스트 전용 포트(선택) | 비워 두면 `3100` |

`.env.example` 아래쪽의 운영(Vercel) 전용 변수(`CRON_SECRET`, `DATABASE_CA_CERT`, `DATABASE_POOL_MAX`, `S3_`로 시작하는 다섯 개)는 로컬에서 비워 둔다. 쓰임새는 [10. 배포](#10-배포)에 있다.

`POSTGRES_PASSWORD`와 `PAYLOAD_SECRET`에는 각각 따로 만든 무작위 문자열을 쓴다. 다음 명령을 실행할 때마다 새 값이 화면에 출력되므로, 출력된 값을 복사해 `.env`에 붙여 넣는다.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

16진수 문자열은 영문과 숫자만으로 이루어져 `DATABASE_URL`에 그대로 넣어도 된다. 다른 특수 문자를 섞은 비밀번호는 URL 인코딩이 필요하므로 피한다. 실제 값은 `.env`에만 두고, 문서·메신저·커밋 등 다른 곳에는 남기지 않는다.

## 3. DB 실행

Docker Desktop이 켜져 있는 상태에서 PostgreSQL 컨테이너를 백그라운드로 띄운다. `.env`가 먼저 있어야 한다. `POSTGRES_USER`·`POSTGRES_PASSWORD`·`POSTGRES_DB` 가운데 빈 값이 있으면 Compose가 컨테이너를 만들기 전에 실패하고 어떤 변수가 비었는지 알려 준다.

```powershell
docker compose up -d
```

준비가 끝났는지 확인한다.

```powershell
docker compose ps
```

`STATUS` 열에 `(healthy)`가 보이면 준비가 끝난 것이다. `(health: starting)`이면 잠시 뒤 다시 확인한다. DB 포트는 이 PC 안(`127.0.0.1`)에서만 열린다. 데이터는 이름을 붙인 Docker 볼륨(named volume)에 저장되므로 컨테이너를 멈추거나 다시 만들어도 남는다(`docker compose down -v`를 실행할 때만 지워진다).

## 4. 의존성 설치

```powershell
pnpm install
```

잠금 파일(`pnpm-lock.yaml`)에 고정된 버전 그대로 설치한다. 잠금 파일을 바꾸지 않고 설치만 확인하려면 `pnpm install --frozen-lockfile`을 쓴다.

## 5. Playwright 브라우저 설치

E2E 테스트에 쓸 Chromium을 내려받는다. 처음 한 번만 하면 된다.

```powershell
pnpm exec playwright install chromium
```

## 6. 개발 서버 실행

```powershell
pnpm dev
```

서버를 띄우기 전에 시작 전 점검(`[preflight]`)이 필수 환경 변수와 DB 접속을 확인한다. 점검을 통과하면 브라우저에서 http://localhost:3000 을 연다. 처음 여는 페이지는 컴파일하느라 시간이 조금 걸린다. 서버는 `Ctrl+C`로 멈춘다.

### 샘플 투어 넣기(선택)

투어 화면을 바로 확인하고 싶으면 DB가 실행 중인 상태에서 `pnpm seed`를 실행한다. 가상 투어 3개(한라산 영실·우도 자전거·해녀 체험)가 실행일 기준 예정 회차와 함께 공개 상태로 들어가고, http://localhost:3000/tours 에서 볼 수 있다. 같은 slug의 투어가 이미 있으면 건너뛰므로 여러 번 실행해도 안전하며, 관리자 화면에서 고친 내용도 덮어쓰지 않는다. `NODE_ENV`가 `production`이거나 `DATABASE_URL`이 로컬 주소가 아니면 DB에 연결하기 전에 거부한다.

## 7. 첫 관리자 계정 생성

개발 서버가 떠 있는 상태에서 http://localhost:3000/admin 을 연다. 사용자가 한 명도 없으면 첫 사용자 만들기 화면(`/admin/create-first-user`)으로 이동한다. 이메일과 비밀번호를 입력해 계정을 만들면 바로 관리자 화면에 로그인된다. 이 계정은 로컬 DB에만 저장된다.

## 8. 테스트 실행

테스트를 돌리기 전에 DB가 실행 중이어야 한다(3단계). E2E 테스트는 3100 포트에 개발 서버를 따로 띄우므로, 6단계에서 띄운 `pnpm dev`는 먼저 `Ctrl+C`로 멈춘다.

```powershell
pnpm test
pnpm e2e
```

- `pnpm test`: 단위·통합·저장소 규칙 테스트(Vitest)를 실행한다. `src/lib/`의 라인 커버리지가 85%에 못 미치면 실패한다.
- `pnpm e2e`: Playwright로 브라우저 테스트를 실행한다. `E2E_PORT`(기본 3100)에 개발 서버를 새로 띄우고, 테스트용 관리자 계정을 만들었다가 끝나면 지운다. 7단계에서 만든 계정은 건드리지 않는다.

커밋하기 전에는 아래 품질 검사도 함께 돌린다.

| 명령 | 검사 내용 |
|---|---|
| `pnpm typecheck` | TypeScript 타입 검사 |
| `pnpm lint` | ESLint 검사(`src`, `tests`, `scripts`, 루트 설정 파일) |
| `pnpm format:check` | Prettier 형식 검사. 고칠 때는 `pnpm format` |
| `pnpm build` | 운영용 빌드 |

## 9. 문제 해결

### 5432 포트 충돌

다른 PostgreSQL 등이 이미 5432 포트를 쓰고 있으면 `docker compose up -d`가 실패한다. `.env`에서 `POSTGRES_PORT`를 비어 있는 포트(예: `5433`)로 바꾸고, `DATABASE_URL`의 포트도 같은 값으로 고친 뒤 다시 실행한다. Compose가 새 포트로 컨테이너를 다시 만들며, 데이터 볼륨은 그대로 남는다.

```powershell
docker compose up -d
```

### E2E 포트 충돌

`pnpm e2e`가 `[preflight] E2E port 3100 is already in use by another process`처럼 포트 번호를 밝히며 멈추면, 그 포트를 쓰는 프로세스를 찾아 끝내거나 `.env`의 `E2E_PORT`를 비어 있는 포트로 바꾼다. 포트를 쓰는 프로세스는 다음 명령으로 찾는다.

```powershell
Get-NetTCPConnection -LocalPort 3100 -State Listen | Select-Object OwningProcess
Get-Process -Id <위에서 나온 번호>
```

### DB 미실행

`pnpm dev`나 `pnpm test`가 `[preflight] Database connection failed`와 함께 접속 대상(호스트·포트·DB 이름)을 출력하고 멈추면 DB가 꺼져 있는 것이다. Docker Desktop이 실행 중인지 확인하고 DB를 띄운다.

```powershell
docker compose up -d
```

포트를 바꿨다면 `DATABASE_URL`의 포트와 `POSTGRES_PORT`가 같은지도 확인한다.

### OneDrive 동기화

저장소가 OneDrive 동기화 폴더(예: `바탕 화면`, `문서`) 안에 있으면 `node_modules`, `.next`처럼 파일이 많은 폴더까지 동기화되면서 `EPERM`·`EBUSY` 같은 파일 잠금 오류가 나거나 설치·빌드가 눈에 띄게 느려질 수 있다. 개발하는 동안 작업 표시줄의 OneDrive 아이콘에서 동기화를 일시 중지하거나, 저장소를 OneDrive 밖(예: `C:\dev\study2`)으로 옮긴다. 옮길 때는 Git에 올라가지 않는 `.env`도 함께 옮긴다.

### Corepack 권한 오류

`corepack enable pnpm`이 `EPERM`으로 실패하면 PowerShell을 **관리자 권한**으로 다시 열어 실행한다. 관리자 권한을 쓸 수 없으면 `npm install -g pnpm@11.28.9`로 설치한다(1-2 참고).

### WSL 미설치

Docker Desktop이 WSL이 설치되어 있지 않다는 오류를 내며 시작하지 않으면, 관리자 권한 PowerShell에서 WSL을 설치하고 PC를 다시 시작한다.

```powershell
wsl --install
```

재시작한 뒤 Docker Desktop을 다시 실행하고 `docker info`로 확인한다.

### 줄바꿈(CRLF)으로 `pnpm format:check` 실패

이 저장소는 `.gitattributes`로 모든 텍스트 파일의 줄바꿈을 LF로 맞춘다. `.gitattributes`가 들어오기 전에 만든 체크아웃에서는 작업 폴더의 파일이 CRLF로 남아 있어 `pnpm format:check`가 여러 파일에 경고를 낼 수 있다. 이때는 한 번만 아래 명령을 실행한다.

```powershell
pnpm format
```

줄바꿈만 LF로 바뀌고 내용은 바뀌지 않는다. 이후 `git status`에 수정(`M`)으로 표시되는 파일이 남아도 `git diff`가 비어 있다면 실제 변경은 없는 것이다.

## 10. 배포

운영 배포는 Vercel(함수 리전 서울 `icn1`)과 Supabase(PostgreSQL·사진 저장소)를 쓴다. 설정은 저장소의 `vercel.json`에 있다. 지금 단계의 사이트는 Vercel 로그인으로 잠근 비공개 미리보기이고, 검색 엔진에도 노출하지 않는다(`robots.txt` 전체 차단, 모든 응답에 `X-Robots-Tag: noindex, nofollow`).

### 사용자가 직접 하는 단계

계정·키·보호 설정은 사용자가 직접 한다. 초보자용 단계별 안내는 `.moai/specs/SPEC-DEPLOY-001/plan.md` §I에 있으며, 순서는 다음과 같다.

1. Supabase(§I.1): 서울 리전 프로젝트 만들기, 트랜잭션 풀러 주소 복사, SSL 강제·인증서 받기, 비공개 `media` 버킷과 S3 키 만들기, **Data API 끄기**(첫 배포보다 먼저).
2. Vercel(§I.2): 환경 변수 없이 저장소 가져오기(첫 빌드는 일부러 실패한다) → Deployment Protection에서 Vercel Authentication을 켜고 범위를 All Deployments로 저장 → 아래 환경 변수 입력 → Node.js 버전·함수 리전 확인 → 다시 배포.
3. 첫 관리자 만들기(§I.3)와 확인 절차(§I.4). 예약 정리가 Vercel 보호에 막히면 아래 수동 정리(§I.5)를 한다.

비밀번호·키 같은 실제 값은 Vercel의 환경 변수 화면에만 넣고, 저장소·문서·채팅에는 남기지 않는다.

### 운영 환경 변수

Vercel 프로젝트의 **Settings → Environment Variables**에 넣는다. 환경은 **Production만** 고르고, 비밀값은 Type을 **Secret**(예전 이름 Sensitive — 저장 뒤 다시 볼 수 없음)으로 고른다. 이름 목록은 `.env.example`과 같고, 값은 로컬 `.env`와 따로 만든다. 운영 빌드(`VERCEL_ENV=production`)는 시작 전 점검에서 필수 변수가 빠졌거나 형식이 틀리면 이름만 출력하고 멈춘다(값은 출력하지 않는다).

| 변수 | 필수 | 값 |
|---|---|---|
| `DATABASE_URL` | 필수 | Supabase **Transaction pooler** 연결 주소(포트 `6543`). 끝에 `?sslmode=` 같은 SSL 인자를 붙이지 않는다 |
| `PAYLOAD_SECRET` | 필수 | 로컬 `.env`와 **다른** 긴 무작위 문자열(40자 이상 권장) |
| `NEXT_PUBLIC_SERVER_URL` | 필수 | `https://<프로젝트 이름>.vercel.app` — https 주소만, 끝의 `/`·경로 없이 |
| `CRON_SECRET` | 필수 | 영문·숫자만 16자 이상(권장 32자). 특수 문자·띄어쓰기 없이 |
| `DATABASE_CA_CERT` | 필수 | Supabase에서 받은 인증서 파일(PEM)의 글 전체 |
| `DATABASE_POOL_MAX` | 선택 | DB 연결 풀 크기, 3~20 정수. 비워 두면 5 |
| `S3_BUCKET` | 필수 | 사진 버킷 이름 `media` |
| `S3_ENDPOINT` | 필수 | Supabase Storage S3 연결 화면의 Endpoint |
| `S3_REGION` | 필수 | 같은 화면의 Region |
| `S3_ACCESS_KEY_ID` | 필수 | S3 access key ID |
| `S3_SECRET_ACCESS_KEY` | 필수 | S3 secret access key(만들 때 한 번만 보인다) |

S3 변수 다섯 개를 모두 넣으면 사진이 Supabase Storage에 저장되고, 모두 비우면 로컬 `media/` 폴더를 쓴다. 일부만 넣으면 오류로 멈춘다. 사진 주소는 어느 쪽이든 `/api/media/file/…`이고, 공개 범위 규칙은 같다. Vercel의 요청 본문 한도 때문에 실제 사이트에서는 4MB 이하 사진을 올린다.

### 빌드와 마이그레이션

- `vercel.json`의 `buildCommand`는 `node scripts/vercel-build.mjs`다. 운영 배포에서만 시작 전 점검 → `payload migrate`(마이그레이션 적용) → `pnpm build` 순서로 실행하고, 운영이 아니면 아무것도 하지 않고 실패한다. 로컬 `pnpm build`는 마이그레이션하지 않는다.
- `main` 가지만 자동 배포한다(`git.deploymentEnabled`). 미리보기 배포는 쓰지 않는다.
- pnpm 버전: 환경 변수 `ENABLE_EXPERIMENTAL_COREPACK`을 값 `1`로 넣으면 Vercel이 Corepack으로 `package.json`의 `packageManager`(pnpm 11.28.9)를 쓴다. 넣지 않으면 잠금 파일 형식만 보고 pnpm 9나 10을 고를 수 있다. 빌드 로그에서 실제 pnpm 버전을 확인한다.
- Node.js 버전: 프로젝트 설정 **Build and Deployment → Node.js Version**을 **24.x**로 둔다. Vercel 문서상 `package.json`의 `engines.node`가 프로젝트 설정보다 우선하는데, 이 저장소의 범위(`^22.23.4 || ^24.22.1`)에는 26.x가 없어 24.x(또는 22.x)만 고를 수 있다. 빌드 로그에서 실제 버전이 24.x인지 확인한다.
- 스키마를 바꾸면 `src/migrations/`에 마이그레이션 파일을 더하고 `pnpm migrate:check`가 통과하는지 본다. 개발 DB는 지금처럼 자동 반영(push)을 쓰며, 이 동작은 로컬 DB(`localhost`·`127.0.0.1`·`::1`)에서만 켜진다.
- 원격 DB 보호: `pnpm dev`·`pnpm test`·`pnpm e2e`·`pnpm seed`와 테스트 실행은 `DATABASE_URL`이 로컬 DB가 아니면 접속 전에 거부된다. 운영 DB에는 로컬에서 접속하지 않는다.

### 예약 정리

Vercel Cron이 매일 한 번(UTC 18시대 = 한국 시각 오전 3시대) `GET /api/cron/cleanup`을 부른다. 이 경로는 `Authorization: Bearer <CRON_SECRET>` 머리글이 맞을 때만 동작하며, 다음 두 가지를 지운다.

- 10분 지난 신청 시도 기록(접속 IP를 비밀키로 변환한 값, `application_attempts`)
- 2년 지난 관리자 작업 기록(`admin_audit_logs`)

응답은 지운 행 수 `{"attemptsDeleted": <수>, "auditLogsDeleted": <수>}`다. 여러 번 불러도 안전하다(지울 것이 없으면 두 값 모두 0).

### 수동 정리(Cron이 동작하지 않을 때)

자동 정리가 막히면 Supabase 대시보드의 **SQL Editor → New query**에 아래 SQL을 그대로 붙여 넣고 **Run**을 누른다. 결과 한 줄에 지운 행 수 두 개(`attempts_deleted`, `audit_logs_deleted`)만 나온다. 두 삭제를 한 문장으로 묶어, 편집기가 마지막 문장의 결과만 보여 주는 경우에도 두 값을 함께 볼 수 있게 했다.

```sql
with a as (
  delete from application_attempts where attempted_at < now() - interval '10 minutes' returning 1
), l as (
  delete from admin_audit_logs where occurred_at < now() - interval '2 years' returning 1
)
select (select count(*) from a) as attempts_deleted,
       (select count(*) from l) as audit_logs_deleted;
```

- 확인용 신청을 한 날마다 한 번(신청 뒤 10분 이상 지나서) 실행하면 동의 고지의 "늦어도 72시간 안에 삭제"가 지켜진다.
- 2월 29일에 실행하면 PostgreSQL의 `now() - interval '2 years'`는 2년 전 2월 28일이 기준이라, 정리 경로(3월 1일 기준)보다 하루치 덜 지운다(기록을 남기는 쪽이라 안전하다). 다른 날에는 기준이 같다.
- 테이블·열 이름은 정리 구현(`src/lib/scheduled-cleanup.ts`)과 같아야 하며, 저장소 규칙 테스트가 둘을 비교한다.
