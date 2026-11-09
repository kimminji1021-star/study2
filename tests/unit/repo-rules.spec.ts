// 저장소 규칙 테스트 — package.json과 설치된 의존성이 SPEC-INFRA-001의 버전 정책을 지키는지 확인한다.
// 셸 검색 대신 Node에서 직접 파일을 읽어 PowerShell 인용 차이를 피한다.
// 각 검사는 대상이 1건 이상 있음을 먼저 단언해, 대상이 비어서 통과하는 경우를 막는다.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
          semver.valid(version) === null ||
          semver.prerelease(version) !== null ||
          semver.major(version) < 1,
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
