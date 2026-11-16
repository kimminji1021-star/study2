# SPEC-ADMIN-001 진행 기록

## §E.1 Plan-phase Audit-Ready Signal

```yaml
plan_status: audit-ready
plan_complete_at: 2026-11-12
plan_revised_at: 2026-11-16   # plan-audit 2회차(FAIL 0.82) 결함 N1~N6 반영, 문서 버전 0.1.2
plan_audit_history:
  - iteration: 1
    verdict: FAIL
    score: 0.78
    report: .moai/reports/plan-audit/SPEC-ADMIN-001-review-1.md
    resolved: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11]
    d12_tier_decision: "Tier M 유지, 분할 없음 (plan.md §A.3 재추정: 제품 약 800~1,000줄, 파일 약 33개)"
  - iteration: 2
    verdict: FAIL
    score: 0.82
    report: .moai/reports/plan-audit/SPEC-ADMIN-001-review-2.md
    resolved: [N1, N2, N3, N4, N5, N6]
    n1_decision: "(a) 복원 자동 마감을 트랜잭션 연결의 원시 SQL로 — 행 잠금을 쥔 뒤 payload-locked-documents를 건드리지 않음. '순환 대기 없음'은 applications·tour_sessions 행 사이로 좁힘 (plan.md §B.2 9번·잠금 순서, R3, R26)"
    n2_decision: "(a) 회차 없는 신청의 모든 수정(상태 변경·복원·요청 사항 삭제)을 SESSION_MISSING(409)으로 거부 (plan.md §B.2 3·4번, R24, AC-ADMIN-005)"
    scope_note: "새 REQ·AC 없음 — 기존 REQ-ADMIN-005·006·008, AC-ADMIN-005·013·016만 수정"
tier: M
artifacts: [interview.md, spec.md, plan.md, acceptance.md, spec-compact.md]
req_count: 16
ac_count: 16
depends_on: [SPEC-APPLY-001]   # status: completed
base_head: a8cf60b   # 최초 계획 8a4cdd1, 사이 커밋 a8cf60b는 화면·디자인만 변경(plan.md §A.1)
author: manager-spec
needs_clarification: 0
user_confirmed_2026_11_16:   # 사용자가 기본값을 그대로 확인함(interview.md "추가 확인")
  - 취소 복원으로 정원이 꽉 차면 회차 자동 마감
  - CSV에 취소 신청 포함, 상태 열로 표시
  - 대시보드에 비공개 투어의 회차도 보이고 "비공개" 표시
  - 관리자 작업 기록 보관 2년
supersedes_clauses:
  - "SPEC-APPLY-001 REQ-APPLY-002 (등록 컬렉션 목록)"
  - "SPEC-APPLY-001 REQ-APPLY-003 중 applications 수정 거부(관리자 포함) 부분"
legal_review_required: true   # 작업 기록 보관 2년(사용자 결정) — 법정 기준 일치 여부 확인(plan.md §G R20)
pre_launch_carry_over:   # sync 단계에서 출시 전 점검 목록으로 옮김
  - "R20 작업 기록 보관 2년의 법정 접속 기록 기준 일치 확인, 2년 지난 기록 자동 삭제(배포 단계)"
  - "R23 Payload 기본 오류 기록(routeError → logError)의 질의 바인딩 값(개인정보) 처리 — 배포 SPEC(로드맵 8번)에서 로거 직렬화 또는 로그 접근 통제·보관 결정, 변호사 확인 목록과 연결"
carry_over_followups:   # 이 SPEC 범위 밖 — 후속 SPEC 후보
  - "F1 해결 때: 회차 없는 신청의 요청 사항(민감정보) 삭제 — 이 SPEC은 그 신청의 모든 수정을 SESSION_MISSING으로 거부만 함(session 필드 required 검증 때문에 저장 불가, plan.md §A.2·R24)"
  - "SPEC-APPLY-001 사이트 접수 자동 마감(submit-application.ts의 중첩 payload.update(tour-sessions))이 회차 행을 쥔 채 payload-locked-documents 행을 지움 → 관리자 화면의 회차 저장과 교착(40P01) 가능. 원시 SQL 마감으로 바꾸는 후속 작업 (plan.md §G R26 ②)"
```

## §E.2 Run-phase Evidence

_<pending run-phase>_

## §E.3 Run-phase Audit-Ready Signal

_<pending run-phase>_

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase>_

## plan-audit 3회차 결과 (2026-11-16)

PASS 0.99 (0.78 → 0.82 → 0.99). 반드시 고칠 항목 없음. 선택 지적 3건은 run 단계에서 반영한다.

- O1: REQ-ADMIN-002에 "회차 없는 신청은 REQ-ADMIN-005에 따라 거부" 교차 참조 한 구절 추가
- O2: AC-ADMIN-006 동시성 사례의 전제(K의 `payload_locked_documents` 행 없음)를 테스트가 단언
- O3: plan §B.2 3단계에 회차 `FOR UPDATE`가 0행이면 4단계 재조회에서 `SESSION_MISSING`으로 끝난다는 한 구절 추가
