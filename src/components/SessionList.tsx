// 회차 선택 목록(라디오 그룹) — 디자인 핸드오프 §2 "회차 카드".
// - 기본 라디오 입력을 써서 한 번에 하나만 선택되고, 화살표 키 이동·비활성 항목 건너뛰기를 브라우저가 처리한다(AC-TOUR-011).
// - 선택 가능 여부와 남은 자리는 조회 계층이 계산한 값(availability)만 쓴다. 여기서 다시 계산하지 않는다(plan.md 안티 패턴).
// - 라벨 전체가 선택 영역이며 최소 44px(--touch-min)이다(AC-TOUR-014).
// @MX:NOTE: [AUTO] 신청 SPEC(SPEC-APPLY-001 M5)에서 확장 완료 — 투어 상세가 이 목록을 GET 양식(action="/apply")으로 감싸
//   선택 값(name="session", value=회차 ID)만 질의 문자열로 보낸다. required이면 회차를 고르지 않은 제출을 브라우저가 막는다(AC-APPLY-006)
import type { CatalogSession } from '../lib/catalog'
import { formatSeats, formatSessionDateTime } from '../lib/format'
import { sessionStatusBadge } from '../lib/status-badge'
import { StatusBadge } from './StatusBadge'

export function SessionList({ sessions, required = false }: { sessions: CatalogSession[]; required?: boolean }) {
  if (sessions.length === 0) {
    return <p className="text-(--color-text-2)">예정된 회차가 없습니다. 새 일정이 열리면 이곳에 표시됩니다.</p>
  }

  return (
    <fieldset>
      <legend className="mb-(--space-3) text-(length:--text-small) text-(--color-text-2)">
        참여할 회차를 고르세요
      </legend>
      <ul className="flex flex-col gap-(--space-3)">
        {sessions.map((session) => {
          const { availability } = session
          const disabled = !availability.selectable
          return (
            <li key={session.id}>
              <label
                className={`flex min-h-(--touch-min) items-center gap-(--space-3) rounded-(--radius-sm) border border-(--color-input-border) px-(--space-4) py-(--space-3) has-checked:border-(--color-accent) has-checked:bg-(--color-accent-tint) ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="session"
                  value={session.id}
                  disabled={disabled}
                  required={required}
                  className="size-5 shrink-0 accent-(--color-accent)"
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-(--space-3) gap-y-1">
                  <span className="font-semibold">{formatSessionDateTime(session.startsAt)}</span>
                  <span className="text-(length:--text-small) text-(--color-text-2)">
                    {formatSeats(availability.remainingSeats, availability.capacity)}
                  </span>
                </span>
                <StatusBadge badge={sessionStatusBadge(availability)} />
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
