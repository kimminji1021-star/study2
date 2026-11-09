// 저장소 규칙 테스트 — package.json과 설치된 의존성이 SPEC-INFRA-001의 버전 정책을 지키는지 확인한다.
// 셸 검색 대신 Node에서 직접 파일을 읽어 PowerShell 인용 차이를 피한다.
// 각 검사는 대상이 1건 이상 있음을 먼저 단언해, 대상이 비어서 통과하는 경우를 막는다.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import semver from 'semver'
import { describe, expect, it } from 'vitest'

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
