// Prettier 설정 (SPEC-INFRA-001 M6). 검사 범위는 .prettierignore(spec.md §2.5 검사 제외 목록)로 정한다.
// endOfLine: Windows 체크아웃에서도 LF로 맞춘다(.gitattributes와 짝, R12).
// semi·singleQuote·printWidth: M1~M5에서 쓴 기존 코드 스타일(세미콜론 없음, 작은따옴표, 한 줄 120자 안쪽)에 맞춘다.
/** @type {import('prettier').Config} */
const config = {
  endOfLine: 'lf',
  semi: false,
  singleQuote: true,
  printWidth: 120,
  overrides: [
    {
      // CSS는 큰따옴표를 유지한다. AC-INFRA-009가 고정 문자열 `@import "tailwindcss"`로 진입 스타일시트를 찾는다.
      files: '*.css',
      options: { singleQuote: false },
    },
  ],
}

export default config
