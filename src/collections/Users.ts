import type { CollectionConfig } from 'payload'

// 관리자 화면 사용자 컬렉션(REQ-INFRA-011). auth: true가 이메일·비밀번호 인증을 켜고,
// email·비밀번호 해시 필드는 Payload가 자동으로 추가한다.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [],
}
