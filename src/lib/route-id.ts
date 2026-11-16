// 관리자 엔드포인트 경로 값(:id) → 문서 ID — SPEC-ADMIN-001 REQ-ADMIN-008·010.
// 요청 사항 삭제(clear-requests.ts)와 참가자 CSV(participants-csv-endpoint.ts)가 같은 규칙을 쓴다.

// PostgreSQL integer 열의 최댓값. 이보다 큰 ID는 질의 전에 "없음"으로 끝낸다
const MAX_ID = 2147483647

/** 앞자리 0·부호·소수점·공백 없는 1~2147483647 정수만 받는다. 아니면 null(호출한 쪽이 NOT_FOUND로 끝낸다). */
export function parseRouteId(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''
  if (!/^[1-9]\d{0,9}$/.test(text)) return null
  const id = Number(text)
  return id <= MAX_ID ? id : null
}
