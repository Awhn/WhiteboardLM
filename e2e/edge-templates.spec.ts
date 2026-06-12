import { expect, test, type Page } from '@playwright/test'
import { defineWorkspace, waitForPointer } from './helpers'

/**
 * 엣지 드래그 → 사전 정의 템플릿 오버레이 → 드롭으로 작업공간 생성·실행.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

/** 소스 노드 핸들에서 엣지를 끌어 빈 캔버스 좌표로 이동 (버튼 누른 상태 유지) */
async function dragEdgeTo(page: Page, targetX: number, targetY: number) {
  const handle = page
    .locator('.react-flow__node')
    .first()
    .locator('.react-flow__handle-right')
  const box = await handle.boundingBox()
  if (!box) throw new Error('handle not found')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps: 8 })
}

test('드래그 중 정지 → 오버레이 → 카드에 드롭 → 생성·자동 실행', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  // 소스에 내용을 채워 모든 템플릿이 노출되게
  await page.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('# 회의 기록\n\n결정 사항 목록')
  await page.getByRole('button', { name: '저장', exact: true }).click()

  await dragEdgeTo(page, 700, 450)
  // 정지 0.6초 → 드래그 모드 오버레이
  await expect(page.getByTestId('template-menu')).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId('template-menu')).toContainText('여기에 놓아 작업 연결')

  // 요약 카드 위로 이동해 드롭
  const card = page.locator('[data-template-id="summary"]')
  const cardBox = await card.boundingBox()
  if (!cardBox) throw new Error('card not found')
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2, {
    steps: 5,
  })
  await page.mouse.up()

  // 새 작업공간 + 엣지 생성, 정의 완료 상태
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  const newNode = page.locator('.react-flow__node', { hasText: '요약:' })
  await expect(newNode).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('aside').getByText('✓ 정의 완료')).toBeVisible()

  // 체크리스트 자동 생성 + 포인터 자동 실행 → 대기 상태 도달
  await waitForPointer(page, /대기 중|완료/)
  await expect(page.locator('aside li').first()).toBeVisible()
  expect(await page.locator('aside li[data-status="staged"]').count()).toBeGreaterThan(0)
})

test('빈 캔버스에 바로 드롭 → 클릭 모드 메뉴 → 클릭으로 생성', async ({ page }) => {
  await defineWorkspace(page, '기획서', '기획서 작성')

  await dragEdgeTo(page, 760, 480)
  await page.mouse.up() // 정지 없이 즉시 드롭

  const menu = page.getByTestId('template-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('어떤 작업을 연결할까요?')
  await expect(menu).toContainText('소스: 기획서')

  // 내용이 없는 노드라 비판·리뷰는 필터링되고, 항상 노출되는 템플릿으로 생성
  await expect(menu.locator('[data-template-id="critique"]')).toHaveCount(0)
  await page.locator('[data-template-id="checklist-gen"]').click()
  await expect(
    page.locator('.react-flow__node', { hasText: '실행 계획: 기획서' }),
  ).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

test('템플릿은 소스 정의에 맞게 필터링 (빈 노드에는 비판·리뷰 미노출)', async ({ page }) => {
  // 내용 없는 빈 작업공간
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await page.keyboard.press('Escape')

  await dragEdgeTo(page, 700, 450)
  await page.mouse.up()
  const menu = page.getByTestId('template-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('[data-template-id="summary"]')).toHaveCount(1)
  await expect(menu.locator('[data-template-id="critique"]')).toHaveCount(0)
  await expect(menu.locator('[data-template-id="transcript"]')).toHaveCount(0)

  // 닫기 버튼으로 취소 — 노드가 생기지 않음
  await page.getByRole('button', { name: '템플릿 메뉴 닫기' }).click()
  await expect(menu).toHaveCount(0)
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
})

test('CSV 파일 노드에서 끌면 시각화·Transcript 템플릿 노출', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles({
    name: 'data.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('월,매출\n1월,100\n2월,140\n'),
  })
  await expect(page.locator('.react-flow__node')).toHaveCount(1)

  await dragEdgeTo(page, 760, 480)
  await page.mouse.up()
  const menu = page.getByTestId('template-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('[data-template-id="visualize"]')).toHaveCount(1)
  await expect(menu.locator('[data-template-id="transcript"]')).toHaveCount(1)
})
