// 개발용 시드 진입점 — `pnpm seed`(= payload run scripts/seed.ts). SPEC-TOUR-001 REQ-TOUR-015, plan.md §B.9.
// 핸드오프의 가상 투어 3개를 공개 상태로, 실행일 기준 예정 회차와 함께 넣는다. 이미지는 넣지 않는다(가정 A5).
// 빌드·개발 서버·테스트·설치 어디에서도 부르지 않는다(저장소 규칙 테스트로 확인).
//
// 최상위 await로 끝까지 기다린다. `payload run`은 import가 끝나면 무조건 process.exit(0)이므로, 기다리지 않는 호출은
// 작업 도중에 끊긴다. 거부는 예외로 끝내 종료 코드 1을 만든다(plan.md R17 실측).
import { getPayload } from 'payload'

import { assertSeedAllowed, formatSeedSummary, runSeed, type SeedTour } from '../src/lib/seed'

const tours: SeedTour[] = [
  {
    title: '한라산 영실 트레킹',
    slug: 'hallasan-yeongsil',
    summary: '영실 탐방로를 따라 병풍바위와 윗세오름까지 오르는 반나절 산행입니다.',
    description:
      '영실 탐방 안내소에서 출발해 병풍바위와 오백나한을 지나 윗세오름 대피소까지 걷습니다.\n\n' +
      '가파른 구간이 있어 등산화와 방풍 겉옷이 필요합니다. 기상 상황에 따라 탐방로가 통제되면 일정이 바뀔 수 있습니다.',
    durationMinutes: 270,
    meetingPoint: '영실 탐방 안내소 앞',
    priceNote: '45,000원 · 현장 결제',
    sessions: [
      { dayOffset: 3, hour: 9, capacity: 15 },
      { dayOffset: 5, hour: 9, capacity: 15, status: 'closed' },
      { dayOffset: 10, hour: 9, capacity: 15 },
    ],
  },
  {
    title: '우도 자전거 일주',
    slug: 'udo-bike',
    summary: '해안 도로를 따라 우도 한 바퀴를 자전거로 도는 가벼운 일주입니다.',
    description:
      '천진항에서 자전거를 받아 서빈백사와 하고수동 해변을 거쳐 섬을 한 바퀴 돕니다.\n\n' +
      '오르막이 짧아 처음 타는 분도 따라올 수 있습니다. 왕복 배편은 각자 준비합니다.',
    durationMinutes: 180,
    meetingPoint: '우도 천진항 대합실 앞',
    priceNote: '38,000원 · 현장 결제',
    sessions: [
      { dayOffset: 3, hour: 9, capacity: 12 },
      { dayOffset: 10, hour: 9, capacity: 12 },
    ],
  },
  {
    title: '해녀 물질 체험',
    slug: 'haenyeo-experience',
    summary: '해녀와 함께 얕은 바다에 들어가 물질을 배워 보는 체험입니다.',
    description:
      '해녀 학교에서 안전 교육과 장비 착용법을 배운 뒤 얕은 바다에서 물질을 따라 해 봅니다.\n\n' +
      '잠수복과 장비는 현장에서 빌려 드립니다. 수영을 못해도 참여할 수 있습니다.',
    durationMinutes: 120,
    meetingPoint: '해녀 학교 교육장 앞',
    priceNote: '55,000원 · 현장 결제',
    sessions: [
      { dayOffset: 3, hour: 9, capacity: 10 },
      { dayOffset: 10, hour: 9, capacity: 10 },
    ],
  },
]

// 거부 판정은 설정을 불러오거나 DB에 연결하기 전에 한다
assertSeedAllowed(process.env)

const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
try {
  console.log(formatSeedSummary(await runSeed(payload, tours)))
} finally {
  await payload.destroy()
}
