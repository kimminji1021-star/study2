// 공통 바닥글 — 한 줄에 `© 숨비투어`와 `개인정보 처리방침(준비 중)`을 둔다(SPEC-LANDING-001 REQ-LANDING-010, plan.md §B.6).
// 처리방침 문서가 생기기 전까지는 링크가 아닌 글자로 둔다. href="#" 같은 죽은 링크나 빈 처리방침 페이지는
// "처리방침이 있다"는 잘못된 인상을 준다. 배포 SPEC이 처리방침 문서를 만들 때 이 글자를 링크로 바꾼다(출시 전 점검 이월).
export function SiteFooter() {
  return (
    <footer className="border-t border-(--color-divider) bg-(--surface-parchment) text-(length:--text-small) text-(--color-text-2)">
      <div className="mx-auto w-full max-w-(--content-max) px-(--page-x) py-(--space-8)">
        <p>
          <span>© 숨비투어</span>
          <span aria-hidden="true"> · </span>
          <span>개인정보 처리방침(준비 중)</span>
        </p>
      </div>
    </footer>
  )
}
