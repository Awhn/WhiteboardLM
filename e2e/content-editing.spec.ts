import { expect, test } from '@playwright/test'
import { defineWorkspace, generateChecklist, runPointerOnNode, waitForPointer } from './helpers'

/**
 * 작업공간 콘텐츠 직접 작성·편집 (텍스트/마크다운).
 * AI와 사용자가 같은 콘텐츠를 함께 만들어 간다.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('더블클릭 → 마크다운 작성 → 저장 → 렌더링 + 새로고침 유지', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()

  await page.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('# 회의록\n\n- 항목 **하나**\n- 항목 둘')
  await page.getByRole('button', { name: '저장', exact: true }).click()

  // 마크다운이 렌더링됨 (h1 + 굵게)
  const view = page.getByTestId('content-view')
  await expect(view.locator('h1')).toHaveText('회의록')
  await expect(view.locator('strong')).toHaveText('하나')

  // 새로고침 후에도 유지
  await page.reload()
  await expect(page.getByTestId('content-view').locator('h1')).toHaveText('회의록')
})

test('✏️ 버튼으로 편집, Esc는 취소되어 내용 유지', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await page.getByRole('button', { name: '콘텐츠 편집' }).click()
  await page.getByTestId('content-editor').fill('원본 내용')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByTestId('content-view')).toContainText('원본 내용')

  // Esc로 취소 → 변경 사항 버려짐
  await page.getByRole('button', { name: '콘텐츠 편집' }).click()
  await page.getByTestId('content-editor').fill('버려질 내용')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('content-view')).toContainText('원본 내용')
  await expect(page.getByTestId('content-view')).not.toContainText('버려질 내용')
})

test('TXT 형식 전환 시 마크다운을 렌더링하지 않음', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await page.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('# 제목처럼 보이는 텍스트')
  await page.getByRole('button', { name: 'TXT' }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()

  const view = page.getByTestId('content-view')
  await expect(view).toContainText('# 제목처럼 보이는 텍스트')
  await expect(view.locator('h1')).toHaveCount(0)

  // 다시 MD로 → 렌더링
  await view.dblclick()
  await page.getByRole('button', { name: 'MD', exact: true }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(view.locator('h1')).toHaveCount(1)
})

test('사용자 작성 콘텐츠 위에 AI 실행 결과가 누적된다', async ({ page }) => {
  await defineWorkspace(page, '공동 작업', '사용자+AI 협업 검증')
  await generateChecklist(page)

  // 사용자가 먼저 작성
  await page.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('## 사용자 메모\n\n먼저 적어둔 내용')
  await page.getByRole('button', { name: '저장', exact: true }).click()

  // AI 실행 → 사용자 내용 보존 + AI 결과 추가
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  const view = page.getByTestId('content-view')
  await expect(view).toContainText('먼저 적어둔 내용')
  await expect(view).toContainText('스텁 출력')

  // 행동 로그에 사용자 편집 기록
  await page.getByRole('button', { name: '🕘 로그' }).click()
  await expect(page.getByText('사용자 편집: 공동 작업')).toBeVisible()
})
