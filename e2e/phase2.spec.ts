import { expect, test } from '@playwright/test'
import { defineWorkspace, generateChecklist, runPointerOnNode, waitForPointer } from './helpers'

/**
 * Phase 2 (v2 재구성): 공간 컨텍스트 + 도구 실행 + 블로킹 예외.
 * 명시적 엣지·권한 흐름은 v2에서 제거됨 (공간 근접성으로 대체).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('공간 컨텍스트: 가까운 노드 내용이 AI 실행에 반영 + 도구 사용(tool_use)', async ({
  page,
}) => {
  // 자료실(내용 보유) — 먼저 채운다
  await defineWorkspace(page, '자료실', '자료 모음 정리')
  await generateChecklist(page)
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  // "자료" 키워드 항목은 web_search 도구를 거친다
  await expect(page.locator('.react-flow__node').nth(0).getByTestId('content-view')).toContainText(
    '🔍 웹 검색 결과',
  )

  // 리포트 노드를 자료실 근처에 추가 (defineWorkspace가 인접 배치)
  await defineWorkspace(page, '리포트', '자료 기반 리포트 작성')
  await generateChecklist(page)
  await runPointerOnNode(page, 1)
  await waitForPointer(page, /대기 중/)
  const bContent = await page.locator('.react-flow__node').nth(1).getByTestId('content-view').innerText()
  // 공간 이웃(자료실)의 내용이 컨텍스트로 반영
  expect(bContent).toContain('근접')
  expect(bContent).toContain('자료실')
})

test('[blocking] 자동 생성 → 해소 후 재개', async ({ page }) => {
  await defineWorkspace(page, '블로킹 테스트', '블로킹 흐름 검증')
  await generateChecklist(page)
  // !block 훅 항목 수동 추가 (AI 태그)
  await page.locator('aside').getByPlaceholder('항목 직접 추가').fill('방향 판단 필요 !block')
  await page.locator('aside select').last().selectOption('AI')
  await page.locator('aside').getByRole('button', { name: '+', exact: true }).click()

  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)

  const blockingRow = page.locator('aside li', { hasText: '진행 불가' })
  while ((await blockingRow.count()) === 0) {
    await page
      .locator('aside li[data-status="pending"]')
      .first()
      .getByRole('button', { name: '완료' })
      .click()
    await waitForPointer(page, /대기 중|완료/)
  }
  await expect(blockingRow).toHaveCount(1)
  await expect(blockingRow).toContainText('블로킹')

  // 해소(완료) → AI 재개 → !block 항목이 staged로
  await blockingRow.getByRole('button', { name: '완료' }).click()
  await waitForPointer(page, /대기 중|완료/)
  await expect(
    page.locator('aside li', { hasText: '방향 판단 필요' }).filter({ hasNotText: '진행 불가' }),
  ).toHaveAttribute('data-status', 'staged', { timeout: 30_000 })
})

test('DB 저장/불러오기 안정성은 백엔드 pytest로 검증 (placeholder)', async ({ page }) => {
  // 프런트 측: 보드 상태가 localStorage에 영속되는지만 확인
  await defineWorkspace(page, '영속', '영속 검증')
  await generateChecklist(page)
  const n = await page.locator('aside li').count()
  await page.reload()
  await page.locator('.react-flow__node').first().click()
  await expect(page.locator('aside li')).toHaveCount(n)
})
