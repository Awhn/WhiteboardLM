import { expect, test } from '@playwright/test'
import { createNote } from './helpers'

/** 캔버스 상호작용 — 더블클릭 추가, 박스 선택, 우클릭 메뉴 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('빈 캔버스 더블클릭으로 노드 추가', async ({ page }) => {
  await createNote(page) // 빈 보드 오버레이 제거용 1개
  await page.locator('.react-flow__pane').dblclick({ position: { x: 520, y: 420 } })
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
})

test('좌클릭 드래그 박스 선택으로 여러 노드 동시 선택', async ({ page }) => {
  await createNote(page)
  await createNote(page)
  const n0 = await page.locator('.react-flow__node').nth(0).boundingBox()
  const n1 = await page.locator('.react-flow__node').nth(1).boundingBox()
  if (!n0 || !n1) throw new Error('노드 bbox 없음')
  const left = Math.min(n0.x, n1.x) - 20
  const top = Math.min(n0.y, n1.y) - 20
  const right = Math.max(n0.x + n0.width, n1.x + n1.width) + 40
  const bottom = Math.max(n0.y + n0.height, n1.y + n1.height) + 40
  // 빈 영역(우하단)에서 시작해 좌상단으로 드래그 → 두 노드를 감싼다
  await page.mouse.move(right, bottom)
  await page.mouse.down()
  await page.mouse.move(left, top, { steps: 15 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
})

test('노드 우클릭 → 컨텍스트 메뉴 → 삭제', async ({ page }) => {
  await createNote(page)
  await page.locator('.react-flow__node').first().click({ button: 'right' })
  await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
  // 에이전트 실행 항목(페르소나)도 함께 노출
  await expect(page.locator('[data-testid="canvas-context-menu"] [data-persona="researcher"]')).toBeVisible()
  await page.getByTestId('ctx-delete-node').click()
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
})

test('빈 캔버스 우클릭 → 여기에 노드 추가', async ({ page }) => {
  await createNote(page)
  await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 520, y: 420 } })
  await expect(page.getByTestId('canvas-context-menu')).toBeVisible()
  await page.getByTestId('ctx-add-node').click()
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
})
