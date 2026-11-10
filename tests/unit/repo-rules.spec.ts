// 저장소 규칙 테스트 — package.json과 설치된 의존성이 SPEC-INFRA-001의 버전 정책을 지키는지 확인한다.
// 셸 검색 대신 Node에서 직접 파일을 읽어 PowerShell 인용 차이를 피한다.
// 각 검사는 대상이 1건 이상 있음을 먼저 단언해, 대상이 비어서 통과하는 경우를 막는다.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import semver from 'semver'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

type PackageJson = {
  version?: string
  packageManager?: string
  engines?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function readJson(filePath: string): PackageJson {
  return JSON.parse(readFileSync(filePath, 'utf8')) as PackageJson
}

function readRootPackage(): PackageJson {
  return readJson(path.join(repoRoot, 'package.json'))
}

// node_modules/<패키지>/package.json에서 실제로 설치된 버전을 읽는다.
function readInstalledPackage(name: string): PackageJson {
  return readJson(path.join(repoRoot, 'node_modules', ...name.split('/'), 'package.json'))
}

function directDependencies(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies }
}

function isPayloadFamily(name: string): boolean {
  return name === 'payload' || name.startsWith('@payloadcms/')
}

// spec.md §2.4·plan.md §B.3: Payload ∩ Vitest 교집합. engines.node는 이 범위와 같거나 더 좁아야 한다.
const SUPPORTED_NODE_RANGE = '^22.23.4 || ^24.22.1 || >=26.0.0'

describe('AC-INFRA-002 설치 재현과 Node.js 버전 범위', () => {
  it('packageManager는 pnpm@<정확한 정식 버전> 형식이다', () => {
    const { packageManager } = readRootPackage()

    expect(packageManager, 'package.json에 packageManager가 있어야 한다').toBeTypeOf('string')
    // Corepack이 덧붙이는 무결성 해시(+sha512.…)는 허용한다.
    const match = /^pnpm@([^+]+)(\+sha(224|256|384|512)\.[0-9a-f]+)?$/.exec(packageManager ?? '')
    expect(match, `형식 불일치: ${packageManager}`).not.toBeNull()

    const version = match?.[1] ?? ''
    expect(semver.valid(version), `정확한 버전이 아님: ${version}`).toBe(version)
    expect(semver.prerelease(version), `사전 배포 버전: ${version}`).toBeNull()
  })

  it('engines.node는 지원 범위(Payload ∩ Vitest)와 같거나 더 좁다', () => {
    const range = readRootPackage().engines?.node

    expect(range, 'package.json에 engines.node가 있어야 한다').toBeTypeOf('string')
    expect(semver.validRange(range ?? ''), `유효한 범위가 아님: ${range}`).not.toBeNull()
    expect(semver.subset(range ?? '', SUPPORTED_NODE_RANGE)).toBe(true)
  })

  // 경계 버전 6개를 직접 대입해 판정한다(acceptance.md AC-INFRA-002).
  it.each([
    ['22.23.4', true],
    ['24.22.1', true],
    ['26.0.0', true],
    ['22.23.3', false],
    ['24.22.0', false],
    ['25.0.0', false],
  ])('engines.node는 Node.js %s를 허용=%s', (nodeVersion, expected) => {
    const range = readRootPackage().engines?.node

    expect(range, 'package.json에 engines.node가 있어야 한다').toBeTypeOf('string')
    expect(semver.satisfies(nodeVersion, range ?? '')).toBe(expected)
  })
})

describe('AC-INFRA-005 의존성 버전 정책', () => {
  it('직접 의존성의 설치 버전은 모두 정식 안정 버전(사전 배포 없음, 메이저 1 이상)이다', () => {
    const names = Object.keys(directDependencies(readRootPackage()))
    expect(names.length).toBeGreaterThanOrEqual(1)

    const violations = names
      .map((name) => ({ name, version: readInstalledPackage(name).version ?? '' }))
      .filter(
        ({ version }) =>
          semver.valid(version) === null || semver.prerelease(version) !== null || semver.major(version) < 1,
      )

    expect(violations).toEqual([])
  })

  it('payload와 @payloadcms/*는 범위 기호 없이 하나의 같은 버전으로 고정되어 있다', () => {
    const deps = directDependencies(readRootPackage())
    const payloadFamily = Object.keys(deps).filter(isPayloadFamily)

    expect(payloadFamily, 'payload가 직접 의존성에 있어야 한다').toContain('payload')
    expect(payloadFamily.length).toBeGreaterThanOrEqual(2)

    // package.json에 적힌 값이 정확한 버전(^, ~, 범위 없음)인지 확인한다.
    const rangedSpecs = payloadFamily.filter((name) => semver.valid(deps[name]) !== deps[name])
    expect(rangedSpecs).toEqual([])

    const declared = new Set(payloadFamily.map((name) => deps[name]))
    const installed = new Set(payloadFamily.map((name) => readInstalledPackage(name).version))
    expect([...declared]).toHaveLength(1)
    expect([...installed]).toEqual([...declared])
  })

  it('설치된 next는 @payloadcms/next의 peerDependencies.next 범위를 만족한다', () => {
    const deps = directDependencies(readRootPackage())
    expect(Object.keys(deps)).toEqual(expect.arrayContaining(['next', '@payloadcms/next']))

    const nextVersion = readInstalledPackage('next').version ?? ''
    const peerRange = readInstalledPackage('@payloadcms/next').peerDependencies?.next ?? ''

    expect(peerRange, '@payloadcms/next에 next peer 범위가 있어야 한다').not.toBe('')
    expect(semver.satisfies(nextVersion, peerRange), `${nextVersion} ∉ ${peerRange}`).toBe(true)
  })
})

// docker-compose.yml을 해석 전(원문 YAML) 상태로 읽는다.
// `docker compose config`는 ${...} 치환을 끝낸 값을 보여 주므로, 포트 치환 형태를 확인하려면 원문이 필요하다.
type ComposeService = {
  image?: string
  environment?: Record<string, string> | string[]
  ports?: Array<string | { published?: string | number; target?: number }>
  volumes?: Array<string | { type?: string; source?: string; target?: string }>
  healthcheck?: { test?: string | string[] }
}

type ComposeFile = {
  services?: Record<string, ComposeService>
  volumes?: Record<string, unknown>
}

function readCompose(): ComposeFile {
  return parseYaml(readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8')) as ComposeFile
}

function readPostgresService(): ComposeService {
  const services = readCompose().services ?? {}
  expect(Object.keys(services).length, 'services가 1개 이상 있어야 한다').toBeGreaterThanOrEqual(1)
  expect(services.postgres, 'postgres 서비스가 있어야 한다').toBeDefined()
  return services.postgres ?? {}
}

// environment는 맵과 `KEY=value` 목록 두 형식을 모두 허용한다.
function environmentValue(service: ComposeService, name: string): string | undefined {
  const env = service.environment
  if (Array.isArray(env)) {
    const entry = env.find((line) => line.split('=')[0] === name)
    return entry === undefined ? undefined : entry.slice(name.length + 1)
  }
  return env?.[name]
}

const POSTGRES_DATA_DIR = '/var/lib/postgresql/data'

describe('AC-INFRA-001 로컬 PostgreSQL Compose 설정', () => {
  it('서비스는 postgres 하나뿐이다', () => {
    const services = readCompose().services ?? {}

    expect(Object.keys(services).length).toBeGreaterThanOrEqual(1)
    expect(Object.keys(services)).toEqual(['postgres'])
  })

  it('PostgreSQL 이미지 태그에 메이저 버전이 있고 latest가 아니다', () => {
    const image = readPostgresService().image ?? ''

    expect(image, 'image가 있어야 한다').not.toBe('')
    const match = /^postgres:(\d+)(\.\d+)*(-[a-z0-9.]+)?$/.exec(image)
    expect(match, `메이저 버전이 고정된 태그가 아님: ${image}`).not.toBeNull()
    expect(image).not.toContain('latest')
  })

  it('이름 있는 볼륨이 PostgreSQL 데이터 디렉터리에 연결되어 있다', () => {
    const service = readPostgresService()
    const namedVolumes = Object.keys(readCompose().volumes ?? {})
    const mounts = (service.volumes ?? []).map((mount) => {
      if (typeof mount === 'string') {
        const [source, target] = mount.split(':')
        return { source, target }
      }
      return { source: mount.source, target: mount.target }
    })

    expect(namedVolumes.length, '최상위 volumes에 이름 있는 볼륨이 있어야 한다').toBeGreaterThanOrEqual(1)
    expect(mounts.length, 'postgres 서비스에 볼륨 연결이 있어야 한다').toBeGreaterThanOrEqual(1)

    const dataMount = mounts.find((mount) => mount.target === POSTGRES_DATA_DIR)
    expect(dataMount, `${POSTGRES_DATA_DIR}에 연결된 볼륨이 있어야 한다`).toBeDefined()
    // 바인드 마운트(경로)가 아니라 최상위에 선언된 이름 있는 볼륨이어야 한다.
    expect(namedVolumes).toContain(dataMount?.source)
  })

  it('pg_isready를 쓰는 healthcheck가 있다', () => {
    const test = readPostgresService().healthcheck?.test

    expect(test, 'healthcheck.test가 있어야 한다').toBeDefined()
    const command = Array.isArray(test) ? test.join(' ') : (test ?? '')
    expect(command).toContain('pg_isready')
  })

  it('비밀번호 인증을 쓴다(trust 아님, 비밀번호는 .env에서 치환)', () => {
    const service = readPostgresService()
    const authMethod = environmentValue(service, 'POSTGRES_HOST_AUTH_METHOD')

    expect(authMethod?.toLowerCase()).not.toBe('trust')
    // 비밀번호 값은 파일에 적지 않고 환경 변수 치환으로 받는다.
    expect(environmentValue(service, 'POSTGRES_PASSWORD')).toMatch(/^\$\{POSTGRES_PASSWORD(:?[?-].*)?\}$/)
  })

  it('호스트 포트는 기본값 5432를 가진 환경 변수 치환이다', () => {
    const ports = readPostgresService().ports ?? []

    expect(ports.length, 'postgres 서비스에 포트 공개가 있어야 한다').toBeGreaterThanOrEqual(1)
    // 형식: [호스트 IP:]${변수:-5432}:5432
    const pattern = /^(\d{1,3}(\.\d{1,3}){3}:)?\$\{[A-Z][A-Z0-9_]*:-5432\}:5432$/
    const violations = ports.filter((port) => typeof port !== 'string' || !pattern.test(port))
    expect(violations).toEqual([])
  })
})

// .env.example은 이름만 담는다(값 없음). 주석(#)과 빈 줄은 검사 대상이 아니다.
function readEnvExampleEntries(): string[] {
  return readFileSync(path.join(repoRoot, '.env.example'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
}

describe('AC-INFRA-011 환경 변수 예시 파일', () => {
  it('주석이 아닌 줄은 1개 이상이고 모두 값 없는 NAME= 형식이다', () => {
    const entries = readEnvExampleEntries()

    expect(entries.length).toBeGreaterThanOrEqual(1)
    const withValues = entries.filter((line) => !/^[A-Z][A-Z0-9_]*=$/.test(line))
    expect(withValues).toEqual([])
  })

  it('앱 변수와 Compose용 PostgreSQL 변수 이름이 모두 있다', () => {
    const names = readEnvExampleEntries().map((line) => line.slice(0, line.indexOf('=')))

    expect(names.length).toBeGreaterThanOrEqual(1)
    expect(names).toEqual(
      expect.arrayContaining([
        'DATABASE_URL',
        'PAYLOAD_SECRET',
        'NEXT_PUBLIC_SERVER_URL',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
        'POSTGRES_PORT',
      ]),
    )
  })
})

// 디렉터리 아래 파일을 재귀로 모은다. 경로는 저장소 루트 기준, 구분자는 '/'로 통일한다(Windows 역슬래시 대비).
function listFiles(relativeDir: string): string[] {
  return readdirSync(path.join(repoRoot, relativeDir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(repoRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort()
}

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const APP_DIR = 'src/app'
const FRONTEND_DIR = `${APP_DIR}/(frontend)/`
const PAYLOAD_DIR = `${APP_DIR}/(payload)/`
const TAILWIND_IMPORT = '@import "tailwindcss"'

// Tailwind 진입 스타일시트(고정 문자열 `@import "tailwindcss"`를 담은 파일)
function findTailwindStylesheets(): string[] {
  return listFiles('src').filter((file) => readRepoFile(file).includes(TAILWIND_IMPORT))
}

// import 문(`import './globals.css'`, `import x from "../globals.css"` 등)에서 모듈 경로만 꺼낸다.
const IMPORT_SPECIFIER = /\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? '')
}

function tailwindStylesheetNames(): string[] {
  const names = findTailwindStylesheets().map((file) => path.posix.basename(file))
  expect(names.length, `${TAILWIND_IMPORT}를 담은 파일이 있어야 한다`).toBeGreaterThanOrEqual(1)
  return names
}

describe('AC-INFRA-009 Tailwind 적용 범위', () => {
  it('@import "tailwindcss"를 담은 파일이 1개 이상 있고 모두 (frontend) 아래에 있다', () => {
    const stylesheets = findTailwindStylesheets()

    expect(stylesheets.length, `${TAILWIND_IMPORT}를 담은 파일이 있어야 한다`).toBeGreaterThanOrEqual(1)
    expect(stylesheets.filter((file) => !file.startsWith(FRONTEND_DIR))).toEqual([])
  })

  it('그 스타일시트를 import하는 파일이 1개 이상 있고 모두 (frontend) 아래에 있다', () => {
    const names = tailwindStylesheetNames()

    const importers = listFiles('src').filter((file) =>
      importSpecifiers(readRepoFile(file)).some((specifier) => names.includes(path.posix.basename(specifier))),
    )

    expect(importers.length, '스타일시트를 import하는 파일이 있어야 한다').toBeGreaterThanOrEqual(1)
    expect(importers.filter((file) => !file.startsWith(FRONTEND_DIR))).toEqual([])
  })

  it('(payload) 아래 파일은 그 스타일시트 파일명이나 tailwindcss를 참조하지 않는다', () => {
    const names = tailwindStylesheetNames()
    const payloadFiles = listFiles(PAYLOAD_DIR)
    expect(payloadFiles.length, '(payload) 아래에 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    const offenders = payloadFiles.filter((file) => {
      const source = readRepoFile(file)
      return source.includes('tailwindcss') || names.some((name) => source.includes(name))
    })
    expect(offenders).toEqual([])
  })
})

// 라우트 그룹 안 경로를 구간으로 나눈다. 예: 'src/app/(payload)/admin/x/page.tsx' → ['admin', 'x', 'page.tsx']
function segmentsUnder(groupDir: string, file: string): string[] {
  return file.slice(groupDir.length).split('/')
}

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/

describe('AC-INFRA-004 단일 앱 라우트 구조', () => {
  it('(frontend) 아래에 페이지 파일이 1개 이상 있고 admin·api 경로 구간이 없다', () => {
    const files = listFiles(FRONTEND_DIR)
    expect(files.length, '(frontend) 아래에 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    const pages = files.filter((file) => PAGE_FILE.test(path.posix.basename(file)))
    expect(pages.length, '(frontend) 아래에 page 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    // 마지막 구간(파일 이름)을 뺀 디렉터리 구간만 본다
    const reserved = files.filter((file) =>
      segmentsUnder(FRONTEND_DIR, file)
        .slice(0, -1)
        .some((segment) => segment === 'admin' || segment === 'api'),
    )
    expect(reserved).toEqual([])
  })

  it('(payload) 아래에 admin 경로와 api 경로가 각각 1개 이상 있다', () => {
    const files = listFiles(PAYLOAD_DIR)
    expect(files.length, '(payload) 아래에 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    const firstSegments = files.map((file) => segmentsUnder(PAYLOAD_DIR, file)[0])
    expect(firstSegments.filter((segment) => segment === 'admin').length).toBeGreaterThanOrEqual(1)
    expect(firstSegments.filter((segment) => segment === 'api').length).toBeGreaterThanOrEqual(1)
  })

  it('src/app 바로 아래 디렉터리는 (frontend)와 (payload) 두 라우트 그룹뿐이다', () => {
    const directories = readdirSync(path.join(repoRoot, APP_DIR), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    expect(directories.length).toBeGreaterThanOrEqual(1)
    expect(directories).toEqual(['(frontend)', '(payload)'])
  })
})

// vitest.config.mts를 실제로 불러와 커버리지 설정을 읽는다(문자열 검색이 아니라 Vitest가 쓰는 값 그대로).
type CoverageSettings = {
  enabled?: boolean
  provider?: string
  include?: string[]
  thresholds?: { lines?: number }
}

async function readCoverageSettings(): Promise<CoverageSettings> {
  const configUrl = pathToFileURL(path.join(repoRoot, 'vitest.config.mts')).href
  const loaded = (await import(configUrl)) as { default: { test?: { coverage?: CoverageSettings } } }
  return loaded.default.test?.coverage ?? {}
}

describe('AC-INFRA-006 커버리지 설정', () => {
  it('@vitest/coverage-v8는 범위 기호 없이 고정되어 있고 설치된 vitest와 같은 버전이다', () => {
    const declared = directDependencies(readRootPackage())['@vitest/coverage-v8']

    expect(declared, '@vitest/coverage-v8가 직접 의존성에 있어야 한다').toBeTypeOf('string')
    expect(semver.valid(declared ?? ''), `정확한 버전이 아님: ${declared}`).toBe(declared)
    expect(readInstalledPackage('@vitest/coverage-v8').version).toBe(readInstalledPackage('vitest').version)
  })

  it('pnpm test는 v8 커버리지를 켜고 src/lib/ 합산 라인 85% 미만이면 실패한다', async () => {
    const coverage = await readCoverageSettings()

    expect(coverage.enabled).toBe(true)
    expect(coverage.provider).toBe('v8')
    expect(coverage.include).toEqual(['src/lib/**'])
    expect(coverage.thresholds?.lines).toBe(85)
  })
})

// AC-INFRA-003: Windows PowerShell에서도 같은 결과를 내도록 POSIX 셸 전용 구문을 쓰지 않는다.
const REQUIRED_SCRIPTS = ['dev', 'build', 'start', 'test', 'e2e', 'lint', 'format', 'format:check', 'typecheck']
// 명령 앞 인라인 환경 변수 대입(예: `NODE_ENV=test next build`). `cross-env NODE_ENV=test …`는 앞에 cross-env가 있어 걸리지 않는다.
const INLINE_ENV_ASSIGNMENT = /(^|&&|;)\s*[A-Z][A-Z0-9_]*=\S*\s/

function readScripts(): Record<string, string> {
  const pkg = JSON.parse(readRepoFile('package.json')) as { scripts?: Record<string, string> }
  return pkg.scripts ?? {}
}

describe('AC-INFRA-003 스크립트 제공과 Windows 호환', () => {
  it('scripts에 필수 키 9개가 모두 있다', () => {
    const scripts = readScripts()
    const present = REQUIRED_SCRIPTS.filter((name) => typeof scripts[name] === 'string' && scripts[name] !== '')

    expect(REQUIRED_SCRIPTS).toHaveLength(9)
    expect(present).toEqual(REQUIRED_SCRIPTS)
  })

  it('어떤 스크립트에도 rm -rf가 없다', () => {
    const entries = Object.entries(readScripts())
    expect(entries.length).toBeGreaterThanOrEqual(9)

    expect(entries.filter(([, command]) => command.includes('rm -rf'))).toEqual([])
  })

  it('어떤 스크립트에도 명령 앞 인라인 환경 변수 대입이 없다(cross-env 사용)', () => {
    const entries = Object.entries(readScripts())
    expect(entries.length).toBeGreaterThanOrEqual(9)

    // 정규식이 실제로 대입을 잡아내는지 대조 확인한다.
    expect(INLINE_ENV_ASSIGNMENT.test('NODE_ENV=test next build')).toBe(true)
    expect(INLINE_ENV_ASSIGNMENT.test('node a.mjs && NODE_OPTIONS=--x next dev')).toBe(true)
    expect(INLINE_ENV_ASSIGNMENT.test('cross-env NODE_OPTIONS=--no-deprecation next dev')).toBe(false)

    expect(entries.filter(([, command]) => INLINE_ENV_ASSIGNMENT.test(command))).toEqual([])
  })
})

// spec.md §2.5 검사 제외 목록 — 이 테스트 안에서 한 번만 정의하고 .prettierignore와 ESLint globalIgnores 양쪽에 대조한다.
// 표기는 Prettier(.gitignore 문법) 기준이다. ESLint의 `dir/**`, `**/*.md`는 비교 전에 이 표기로 바꾼다.
const CHECK_EXCLUSIONS = [
  // MoAI 소유 경로
  '.claude/',
  '.moai/',
  '.github/',
  '.git_hooks/',
  'CLAUDE.md',
  '.mcp.json',
  '.claudeignore',
  '.worktreeinclude',
  // 문서
  '*.md',
  // 생성 파일
  'src/payload-types.ts',
  'src/app/(payload)/admin/importMap.js',
  'next-env.d.ts',
  'pnpm-lock.yaml',
  // 산출물 디렉터리
  '.next/',
  'out/',
  'build/',
  'coverage/',
  'playwright-report/',
  'test-results/',
]

// eslint.config.mjs를 처음 불러올 때(새로 설치한 직후 캐시가 없을 때) 기본 제한 시간 5초를 넘긴 적이 있어 넉넉하게 둔다.
const ESLINT_CONFIG_LOAD_TIMEOUT_MS = 30_000

// ESLint 설정 안에서 검사 제외 목록을 담는 globalIgnores 항목의 이름
const ESLINT_EXCLUSIONS_NAME = 'sumbi-tour/check-exclusions'

// 두 도구의 글롭 표기를 한 가지로 맞춘다: 앞의 `/`·`**/` 제거, 끝의 `/**`는 `/`로.
function normalizeIgnorePattern(pattern: string): string {
  return pattern
    .trim()
    .replace(/^\//, '')
    .replace(/^\*\*\//, '')
    .replace(/\/\*\*$/, '/')
}

function readPrettierIgnoreEntries(): string[] {
  return readRepoFile('.prettierignore')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

type FlatConfigEntry = { name?: string; ignores?: string[]; rules?: Record<string, unknown> }

async function readEslintConfig(): Promise<FlatConfigEntry[]> {
  const configUrl = pathToFileURL(path.join(repoRoot, 'eslint.config.mjs')).href
  const loaded = (await import(configUrl)) as { default: FlatConfigEntry | FlatConfigEntry[] }
  return [loaded.default].flat()
}

describe('AC-INFRA-010 린트·포맷 범위와 줄바꿈', () => {
  it('.prettierignore는 검사 제외 목록과 정확히 같다', () => {
    const entries = readPrettierIgnoreEntries()
    expect(entries.length).toBeGreaterThanOrEqual(1)

    expect(entries.map(normalizeIgnorePattern).sort()).toEqual([...CHECK_EXCLUSIONS].sort())
  })

  it(
    'ESLint globalIgnores는 검사 제외 목록과 정확히 같다',
    async () => {
      const config = await readEslintConfig()
      const exclusions = config.filter((entry) => entry.name === ESLINT_EXCLUSIONS_NAME)

      expect(exclusions, `이름이 ${ESLINT_EXCLUSIONS_NAME}인 항목이 하나 있어야 한다`).toHaveLength(1)
      const entry = exclusions[0] ?? {}
      // ignores 외의 키가 없어야 전역 무시(globalIgnores)로 동작한다.
      expect(Object.keys(entry).sort()).toEqual(['ignores', 'name'])
      const ignores = entry.ignores ?? []
      expect(ignores.length).toBeGreaterThanOrEqual(1)

      expect(ignores.map(normalizeIgnorePattern).sort()).toEqual([...CHECK_EXCLUSIONS].sort())
    },
    ESLINT_CONFIG_LOAD_TIMEOUT_MS,
  )

  it(
    'ESLint 설정에 eslint-config-prettier가 들어 있고 규칙을 가진 마지막 항목이다',
    async () => {
      const config = await readEslintConfig()
      const prettierFlat = ((await import('eslint-config-prettier/flat')) as { default: FlatConfigEntry }).default

      const index = config.indexOf(prettierFlat)
      expect(index, 'eslint-config-prettier/flat이 설정 배열에 있어야 한다').toBeGreaterThanOrEqual(0)
      // 뒤에 오는 규칙이 포맷 관련 규칙을 다시 켜지 못하도록 규칙을 가진 마지막 항목이어야 한다.
      const lastWithRules = Math.max(...config.map((entry, i) => (entry.rules === undefined ? -1 : i)))
      expect(lastWithRules).toBe(index)
    },
    ESLINT_CONFIG_LOAD_TIMEOUT_MS,
  )

  it('lint 스크립트는 src·tests·scripts를 검사 대상으로 명시한다', () => {
    const targets = (readScripts().lint ?? '').split(/\s+/)

    expect(targets[0]).toBe('eslint')
    expect(targets).toEqual(expect.arrayContaining(['src', 'tests', 'scripts']))
  })

  it('Prettier 설정의 endOfLine은 lf다', async () => {
    const prettier = await import('prettier')
    const resolved = await prettier.resolveConfig(path.join(repoRoot, 'src', 'payload.config.ts'), {
      editorconfig: false,
    })

    expect(resolved, 'Prettier 설정 파일이 있어야 한다').not.toBeNull()
    expect(resolved?.endOfLine).toBe('lf')
  })

  it('.gitattributes는 텍스트 파일을 LF로 정규화한다', () => {
    const lines = readRepoFile('.gitattributes')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))

    expect(lines.length).toBeGreaterThanOrEqual(1)
    expect(lines).toContain('* text=auto eol=lf')
  })
})

// AC-INFRA-016: README 절은 이 순서대로 나와야 한다. 각 항목은 해당 `## ` 제목에 들어 있어야 하는 문자열이다.
const README_SECTION_ORDER = [
  '사전 준비',
  '환경 변수',
  'DB 실행',
  '의존성 설치',
  'Playwright 브라우저',
  '개발 서버',
  '관리자',
  '테스트',
  '문제 해결',
] as const

// 문제 해결 절이 다뤄야 하는 주제(acceptance.md AC-INFRA-016 + 이 PC에서 실제로 겪은 문제).
const README_TROUBLESHOOTING_TOPICS = [
  '5432',
  'POSTGRES_PORT',
  'E2E_PORT',
  'docker compose up -d',
  'OneDrive',
  'Corepack',
  'EPERM',
  'WSL',
  'CRLF',
  'pnpm format',
] as const

function readReadme(): string {
  return readRepoFile('README.md')
}

function readReadmeHeadings(): string[] {
  return readReadme()
    .split(/\r?\n/)
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim())
}

describe('AC-INFRA-016 README 개발 환경 안내', () => {
  it('README 제목은 기존 제목(study2)을 유지한다', () => {
    expect(readReadme().split(/\r?\n/)[0]).toBe('# study2')
  })

  it.each(['사전 준비', '환경 변수', '문제 해결'])('README에 "%s"가 있다', (keyword) => {
    expect(readReadme()).toContain(keyword)
  })

  it('README 절 제목이 요구 순서대로 나온다', () => {
    const headings = readReadmeHeadings()
    expect(headings.length).toBeGreaterThanOrEqual(README_SECTION_ORDER.length)

    const positions = README_SECTION_ORDER.map((keyword) => headings.findIndex((heading) => heading.includes(keyword)))
    for (const [i, keyword] of README_SECTION_ORDER.entries()) {
      expect(positions[i], `"${keyword}"이 들어간 ## 제목이 있어야 한다`).toBeGreaterThanOrEqual(0)
    }
    // 같은 제목을 두 항목이 함께 가리키지 않고, 위치가 오름차순이어야 한다.
    expect(new Set(positions).size).toBe(positions.length)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('README는 단계별 핵심 명령을 그 순서대로 안내한다', () => {
    const readme = readReadme()
    const commands = [
      'node -v',
      'pnpm -v',
      'docker info',
      'Copy-Item .env.example .env',
      'docker compose up -d',
      'pnpm install',
      'pnpm exec playwright install chromium',
      'pnpm dev',
      'http://localhost:3000/admin',
      'pnpm test',
      'pnpm e2e',
    ]
    const positions = commands.map((command) => readme.indexOf(command))
    for (const [i, command] of commands.entries()) {
      expect(positions[i], `README에 \`${command}\`가 있어야 한다`).toBeGreaterThanOrEqual(0)
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('문제 해결 절은 포트 충돌·DB 미실행·OneDrive·Corepack·WSL·CRLF를 다룬다', () => {
    const readme = readReadme()
    // 번호가 붙은 제목(예: `## 9. 문제 해결`)도 찾도록 줄 단위로 검색한다.
    const start = readme.search(/^## .*문제 해결/m)
    expect(start, '"문제 해결"이 들어간 ## 제목이 있어야 한다').toBeGreaterThanOrEqual(0)
    const troubleshooting = readme.slice(start)

    for (const topic of README_TROUBLESHOOTING_TOPICS) {
      expect(troubleshooting, `문제 해결 절에 "${topic}"이 있어야 한다`).toContain(topic)
    }
  })
})

// SPEC-TOUR-001 AC-TOUR-014 — 디자인 토큰은 사용자 화면((frontend))에서만 정의·로드한다(plan.md §B.10, R9).
// 검사 범위는 AC-INFRA-009와 같은 src/다(.moai/project/design/tokens.css와 SPEC 문서는 대상이 아니다).
const TOKEN_DEFINITION = '--color-accent:'

function findTokenStylesheets(): string[] {
  return listFiles('src').filter((file) => readRepoFile(file).includes(TOKEN_DEFINITION))
}

function tokenStylesheetNames(): string[] {
  const names = findTokenStylesheets().map((file) => path.posix.basename(file))
  expect(names.length, `${TOKEN_DEFINITION}를 담은 파일이 있어야 한다`).toBeGreaterThanOrEqual(1)
  return names
}

describe('AC-TOUR-014 디자인 토큰 적용 범위', () => {
  it('--color-accent:를 담은 파일이 1개 이상 있고 모두 (frontend) 아래에 있다', () => {
    const stylesheets = findTokenStylesheets()

    expect(stylesheets.length, `${TOKEN_DEFINITION}를 담은 파일이 있어야 한다`).toBeGreaterThanOrEqual(1)
    expect(stylesheets.filter((file) => !file.startsWith(FRONTEND_DIR))).toEqual([])
  })

  it('토큰 파일을 import·@import하는 파일이 1개 이상 있고 모두 (frontend) 아래에 있다', () => {
    const names = tokenStylesheetNames()

    // IMPORT_SPECIFIER는 CSS의 `@import "./tokens.css"`도 잡는다(`@` 뒤 `import`가 단어 경계에서 시작)
    const importers = listFiles('src').filter((file) =>
      importSpecifiers(readRepoFile(file)).some((specifier) => names.includes(path.posix.basename(specifier))),
    )

    expect(importers.length, '토큰 파일을 불러오는 파일이 있어야 한다').toBeGreaterThanOrEqual(1)
    expect(importers.filter((file) => !file.startsWith(FRONTEND_DIR))).toEqual([])
  })

  it('(payload) 아래 파일은 토큰 파일명을 참조하지 않는다', () => {
    const names = tokenStylesheetNames()
    const payloadFiles = listFiles(PAYLOAD_DIR)
    expect(payloadFiles.length, '(payload) 아래에 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    const offenders = payloadFiles.filter((file) => names.some((name) => readRepoFile(file).includes(name)))
    expect(offenders).toEqual([])
  })
})

// SPEC-TOUR-001 AC-TOUR-013 — 데이터를 읽는 두 페이지는 요청 시점에 렌더링한다(plan.md §B.3, R10).
// 상세 경로는 generateStaticParams가 없으면 사전 렌더링 목록에 원래 나타나지 않으므로, 판정은 이 규칙이 맡는다.
const DATA_PAGES = ['src/app/(frontend)/tours/page.tsx', 'src/app/(frontend)/tours/[slug]/page.tsx'] as const
const CONNECTION_IMPORT = /\bimport\s*\{[^}]*\bconnection\b[^}]*\}\s*from\s*['"]next\/server['"]/
const CONNECTION_CALL = /\bawait\s+connection\(\s*\)/

describe('AC-TOUR-013 요청 시점 렌더링', () => {
  it.each(DATA_PAGES)('%s는 next/server의 connection을 import하고 await로 호출한다', (file) => {
    const source = readRepoFile(file)

    expect(source).toMatch(CONNECTION_IMPORT)
    expect(source).toMatch(CONNECTION_CALL)
  })

  it.each(DATA_PAGES)('%s는 generateStaticParams를 내보내지 않는다', (file) => {
    // 설명 주석의 언급은 허용하고, export 선언(함수·변수·재내보내기)만 막는다
    expect(readRepoFile(file)).not.toMatch(
      /\bexport\s+(?:async\s+)?(?:function|const|let|var)\s+generateStaticParams\b|\bexport\s*\{[^}]*\bgenerateStaticParams\b/,
    )
  })

  // R21: tours/ 구간에 loading 파일(Suspense 경계)이 있으면 notFound()가 스트리밍 중에 호출되어 200으로 응답할 수 있다
  it('src/app/(frontend)/tours/ 아래에는 loading 파일이 없다', () => {
    const files = listFiles(`${FRONTEND_DIR}tours`)
    expect(files.length, 'tours/ 아래에 파일이 있어야 한다').toBeGreaterThanOrEqual(1)

    expect(files.filter((file) => /^loading\.(tsx|ts|jsx|js)$/.test(path.posix.basename(file)))).toEqual([])
  })
})
