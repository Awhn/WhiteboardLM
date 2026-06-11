import { expect, test } from '@playwright/test'
import { defineWorkspace, waitForPointer } from './helpers'

/**
 * Phase 1 통합 테스트 (M9)
 * 핵심 루프: 선언형 정의 → 체크리스트 자동 생성 → 포인터 실행
 *            → staged(검토) → committed(스냅샷) → 되돌리기
 * LLM은 StubLLMClient — 목적에 "!error" 포함 시 의도적 실패.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('빈 보드 → 작업공간 추가 UX', async ({ page }) => {
  await expect(page.getByText('보드가 비어 있습니다')).toBeVisible()
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await expect(page.getByText('보드가 비어 있습니다')).toHaveCount(0)
})

test('전체 루프: 정의 → 체크리스트 → 포인터 → staged/committed → 되돌리기', async ({
  page,
}) => {
  await defineWorkspace(page, '주간 리포트', '지난 주 팀 활동 요약 리포트 작성')

  // 체크리스트 생성
  await page.getByRole('button', { name: '📋 체크리스트 생성' }).click()
  await expect(page.locator('aside li').first()).toBeVisible()
  const total = await page.locator('aside li').count()
  expect(total).toBeGreaterThanOrEqual(4)

  // 포인터 실행 → [AI] 항목 staged 후 [인간] 항목에서 대기
  await page.getByRole('button', { name: '포인터 이동' }).click()
  await waitForPointer(page, /대기 중/)
  expect(await page.locator('aside li[data-status="staged"]').count()).toBeGreaterThan(0)
  await expect(page.locator('.react-flow__node pre')).toContainText('스텁 출력')

  // 노드(WYSIWYG)에는 체크리스트가 렌더링되지 않아야 함
  expect(await page.locator('.react-flow__node li').count()).toBe(0)

  // staged 전부 승인 → committed
  while ((await page.locator('aside li[data-status="staged"]').count()) > 0) {
    await page
      .locator('aside li[data-status="staged"]')
      .first()
      .getByRole('button', { name: '승인' })
      .click()
  }

  // [인간]/[승인] 항목 완료 → 포인터 재개 → 최종 done
  while ((await page.locator('aside li[data-status="pending"]').count()) > 0) {
    await page
      .locator('aside li[data-status="pending"]')
      .first()
      .getByRole('button', { name: '완료' })
      .click()
    await waitForPointer(page, /대기 중|완료/)
    // 재개 후 새로 staged된 항목 승인
    while ((await page.locator('aside li[data-status="staged"]').count()) > 0) {
      await page
        .locator('aside li[data-status="staged"]')
        .first()
        .getByRole('button', { name: '승인' })
        .click()
    }
  }
  await waitForPointer(page, /완료/)
  expect(await page.locator('aside li[data-status="committed"]').count()).toBe(total)

  // 되돌리기: 첫 committed 시점으로 → 이후 committed 항목은 pending 전환
  // (스냅샷은 "승인 시점"의 content를 캡처하므로 content는 그 시점 그대로 복원된다)
  const contentBefore = await page.locator('.react-flow__node pre').innerText()
  page.on('dialog', (d) => void d.accept())
  await page
    .locator('aside li[data-status="committed"]')
    .first()
    .getByRole('button', { name: '⏪ 복원' })
    .click()
  await expect(page.locator('aside li[data-status="committed"]')).toHaveCount(1)
  expect(await page.locator('aside li[data-status="pending"]').count()).toBe(total - 1)
  const contentAfter = await page.locator('.react-flow__node pre').innerText()
  expect(contentAfter.length).toBeLessThanOrEqual(contentBefore.length)
})

test('반려 → 코멘트 → AI 재작업에 코멘트 반영', async ({ page }) => {
  await defineWorkspace(page, '리포트', '반려 재작업 테스트용 리포트')
  await page.getByRole('button', { name: '📋 체크리스트 생성' }).click()
  await expect(page.locator('aside li').first()).toBeVisible()
  await page.getByRole('button', { name: '포인터 이동' }).click()
  await waitForPointer(page, /대기 중/)

  const stagedRow = page.locator('aside li[data-status="staged"]').first()
  await stagedRow.getByRole('button', { name: '반려' }).click()
  await stagedRow.getByPlaceholder(/반려 사유/).fill('목차를 더 짧게')
  await stagedRow.getByRole('button', { name: '반려 확정' }).click()

  await waitForPointer(page, /대기 중/)
  await expect(page.locator('.react-flow__node pre')).toContainText('목차를 더 짧게')
})

test('작업공간 2개: 엣지 연결 + 독립 체크리스트 + 전체 체크리스트 드로어', async ({
  page,
}) => {
  await defineWorkspace(page, '자료 조사', '리포트용 자료 조사')
  await page.getByRole('button', { name: '📋 체크리스트 생성' }).click()
  await expect(page.locator('aside li').first()).toBeVisible()

  await defineWorkspace(page, '최종 리포트', '조사 자료 기반 최종 리포트')
  await page.getByRole('button', { name: '📋 체크리스트 생성' }).click()
  await expect(page.locator('aside li').first()).toBeVisible()

  // 핸들 드래그로 엣지 연결
  const src = page.locator('.react-flow__node').nth(0).locator('.react-flow__handle-right')
  const tgt = page.locator('.react-flow__node').nth(1).locator('.react-flow__handle-left')
  const sb = await src.boundingBox()
  const tb = await tgt.boundingBox()
  if (!sb || !tb) throw new Error('handle not found')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  // 전체 체크리스트 드로어: 두 작업공간 그룹 모두 표시
  await page.getByRole('button', { name: '📋 전체 체크리스트' }).first().click()
  await expect(page.locator('section')).toHaveCount(2)
  await expect(page.locator('section').first()).toContainText('자료 조사')
  await expect(page.locator('section').nth(1)).toContainText('최종 리포트')

  // 행동 로그 탭
  await page.getByRole('button', { name: '🕘 행동 로그' }).click()
  await expect(page.getByText('아직 기록된 행동이 없습니다')).toHaveCount(0)
})

test('엣지케이스: 빈 정의·API 오류·필드 누락', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await page.locator('.react-flow__node').first().click()

  // 빈 정의: 목적이 없으면 동적 필드 생성 비활성
  await expect(page.getByRole('button', { name: '✨ 동적 필드 생성' })).toBeDisabled()
  // 필드 누락: 정의 미완료면 체크리스트 생성 비활성
  await expect(page.getByRole('button', { name: '📋 체크리스트 생성' })).toBeDisabled()

  // API 오류: "!error" 훅 → 오류 폴백 UI + 수동 추가 경로
  await page.locator('aside textarea').first().fill('오류 테스트 !error')
  await page.getByRole('button', { name: '✨ 동적 필드 생성' }).click()
  await expect(page.getByText('다시 시도')).toBeVisible()
  await page.getByPlaceholder('필드 이름').fill('수동 필드')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await expect(page.locator('aside').getByText('수동 필드')).toBeVisible()

  // 목적을 정상으로 바꾸고 수동 필드만 채우면 정의 완료
  await page.locator('aside textarea').first().fill('정상 목적')
  await page
    .locator('aside')
    .getByText('수동 필드')
    .locator('..')
    .locator('..')
    .locator('input')
    .fill('값')
  await expect(page.locator('aside').getByText('✓ 정의 완료')).toBeVisible()
})

test('새로고침 후 보드 상태 영속 (localStorage)', async ({ page }) => {
  await defineWorkspace(page, '영속 테스트', '영속화 검증')
  await page.getByRole('button', { name: '📋 체크리스트 생성' }).click()
  await expect(page.locator('aside li').first()).toBeVisible()
  const itemCount = await page.locator('aside li').count()

  await page.reload()
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await page.locator('.react-flow__node').first().click()
  await expect(page.locator('aside li')).toHaveCount(itemCount)
})
