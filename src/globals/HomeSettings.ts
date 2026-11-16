// 홈 화면 설정 — SPEC-LANDING-001 REQ-LANDING-001·002, plan.md §B.1.
// 문서가 하나뿐인 설정이므로 Payload 전역 설정(Global)으로 둔다. 관리자 메뉴에 "홈 화면 설정"으로 나타난다.
// - 읽기는 누구나(홈 화면이 익명으로 읽는다). 정하지 않으면 Payload 기본값 "로그인한 사용자면 허용"이 들어간다
// - 수정은 관리자만(adminOnly). 다른 인증 컬렉션이 생겨도 수정 권한이 새지 않는다
// - 기본 문구는 필드 defaultValue가 아니라 코드(src/lib/home-page.ts)에서 적용한다. 관리자가 비우고 저장한 경우도 덮기 위해서다
// - 길이 제한 40·120자는 히어로 줄바꿈이 무너지지 않게 하는 값이다(interview.md 초안 작성자 결정)
import type { GlobalConfig } from 'payload'

import { adminOnly } from '../lib/access'

export const HOME_SETTINGS_SLUG = 'home-settings'

export const HomeSettings: GlobalConfig = {
  slug: HOME_SETTINGS_SLUG,
  label: '홈 화면 설정',
  access: {
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'heroImage',
      label: '대표 사진',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          '가로 2000px·1MB 안팎의 JPEG를 권합니다. 고른 사진은 누구나 볼 수 있습니다. 비워 두면 짙은 배경이 보입니다.',
      },
    },
    {
      name: 'headline',
      label: '큰 제목',
      type: 'text',
      maxLength: 40,
      admin: {
        description: "비워 두면 '제주를 가장 가까이, 숨비투어'가 보입니다.",
      },
    },
    {
      name: 'intro',
      label: '한 줄 소개',
      type: 'text',
      maxLength: 120,
      admin: {
        description: "비워 두면 '제주의 소규모 투어와 다가오는 회차를 한눈에 확인하세요.'가 보입니다.",
      },
    },
  ],
}
