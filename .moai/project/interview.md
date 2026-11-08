# Project Interview

## Stage A Round 1: Vision and Domain
Question: 어떤 서비스를 만들고, 누구를 위한 것인가요? (초기 요청에서 자발적으로 답변)
Answer: Next.js + Payload CMS + PostgreSQL 환경으로 랜딩페이지를 만든다. 여행지에서 투어 프로그램을 여러 개 제시하고 사용자들이 신청할 수 있게 한다. 신청자 정보를 수집하고, 관리자 페이지에서 수집된 정보를 확인하고 관리한다.
Domain: web-app (tour-booking landing page + admin)
Goal: 여행지 투어 프로그램을 소개하고 온라인으로 신청을 받으며, 관리자가 신청자를 확인·관리할 수 있는 웹사이트를 무료 인프라로 운영한다.

## Stage A Round 2: Technology and Constraints
Question: 기술 스택과 반드시 지켜야 할 조건은 무엇인가요?
Answer:
- 기술 스택: Next.js (App Router) + Payload CMS + PostgreSQL (사용자 지정)
- 개발: 로컬에서 작업
- 배포 목표: Vercel + Supabase (PostgreSQL)
- 비용: 무료로 진행 (Vercel Hobby, Supabase Free 요금제)
- 언어: 한국어 + 영어 (Payload localization)
- 알림: 이메일 (신청자 접수 확인, 관리자 새 신청 알림) — 무료 요금제 메일 발송 서비스
Constraints:
- 모든 인프라는 무료 요금제 범위 안에서 운영
- Vercel Hobby 요금제는 비상업 개인 용도 한정 — 실제 상업 운영 시 Pro 전환 검토 필요 (사용자에게 안내함)
- Supabase Free 요금제는 비활성 시 프로젝트 일시정지 — 운영 시 주의 (사용자에게 안내함)
- 서버리스 환경이므로 Supabase 연결 풀러(pooler) 사용 필요
- 신청 폼에 개인정보 수집·이용 동의 필수

## Stage A Round 3: Scope and Boundaries
Question: 핵심 기능과 범위의 경계는 어디까지인가요?
Answer:
- 신청 방식: 비회원 신청 + 회원 신청 둘 다 허용
- 회원 로그인: 이메일 + 비밀번호 (Payload 내장 인증)
- 결제: 없음 (신청만 받음, 결제는 현장/계좌이체로 별도 처리)
- 일정·정원: 투어별 날짜·시간 회차(session) 등록 + 회차별 정원, 정원 도달 시 자동 마감
- 관리자 기능: 신청 상태 관리(대기 → 확정 → 취소), 신청자 CSV 내려받기, 통계 대시보드
- 관리자 권한 분리: 선택하지 않음 (단일 관리자 역할)
- 개인정보 보관 기간: 나중에 정하기 (동의 체크박스만 우선 구현, 보관 기간은 결정 필요 항목)
Scope:
- In scope: 투어 목록/상세 랜딩페이지(한·영), 회차·정원 관리, 비회원/회원 신청, 회원 로그인·내 신청 내역, 이메일 알림, Payload 관리자(상태 관리, CSV, 대시보드)
- Out of scope: 온라인 결제·환불, 소셜 로그인, 카카오 알림톡, 다중 관리자 권한, 중국어·일본어 등 추가 언어

## Follow-up Round (after plan-audit iteration 1)
Question: 감사에서 드러난 범위 공백 4건
Answer:
- 취소와 정원: 한번 마감되면 그대로 유지. 해석 — 정원이 차서 회차가 '마감' 상태가 되면, 이후 신청이 취소돼도 자동으로 다시 열리지 않음. 다시 열려면 관리자가 정원 또는 마감 상태를 직접 수정. 마감 전에는 취소된 신청이 정원 계산에서 빠짐 (이 해석은 오케스트레이터가 명시한 가정)
- 비회원 신청 조회: 조회 없음 (비회원은 접수 확인 이메일로만 확인, 내역 조회는 회원 전용)
- 신청 상태 변경: 관리자가 대기·확정·취소 사이를 자유롭게 변경. 단, 취소 → 대기/확정으로 되돌릴 때 정원이 찼으면 차단
- 통계 대시보드 지표: 회차별 정원 대비 신청 수 (이것만)
Still undecided: 개인정보 보관 기간, 이메일 발송 서비스, 서비스 정식 명칭, 패키지 매니저

## Follow-up Round 2 (after plan-audit iteration 2)
Question: 일행 신청 1건(예: 3명)은 정원에서 몇 자리를 차감하나요?
Answer: 인원 수만큼 차감 (3명 신청 = 3자리). 신청 폼에 인원 수 입력란을 둔다. 자동 마감·취소 복원 차단·대시보드 '정원 대비 신청 수'는 모두 인원 합계 기준.
Note: 동시 신청 시 정원 초과 방지(트랜잭션/잠금)는 사용자가 직접 정한 항목이 아니라, '정원 도달 시 자동 마감' 결정에서 도출한 요구사항(가정)이다.

## Stage B Round 4: Verification, Surfaces, and Sharing
Verification: 자동 테스트 — Vitest(단위·통합) + Playwright(E2E 신청 흐름)
UI surface: has-ui
External systems: PostgreSQL (Supabase), 이메일 발송 서비스 (무료 요금제), 이미지 저장소 (Supabase Storage 등 S3 호환), Vercel 호스팅
Team sharing: solo
