import { expect, test } from '@playwright/test'

/** 좌측 파일트리 탐색기 (BoardExplorer) */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

async function addKind(page: import('@playwright/test').Page, kind: string) {
  await page.getByRole('button', { name: '노드 종류 선택' }).click()
  await page.locator(`[data-testid="kind-add-menu"] [data-kind="${kind}"]`).click()
}

test('노드를 카인드별로 묶어 트리로 표시 + 클릭 시 선택', async ({ page }) => {
  await addKind(page, 'note')
  await addKind(page, 'code')
  await addKind(page, 'note')

  const explorer = page.getByTestId('board-explorer')
  await expect(explorer).toBeVisible()
  // 카인드 그룹 헤더
  await expect(explorer.getByText('노트', { exact: false })).toBeVisible()
  await expect(explorer.getByText('코드', { exact: false })).toBeVisible()
  // 노트 그룹에 2개 행
  const rows = explorer.locator('[data-node-id]')
  await expect(rows).toHaveCount(3)

  // 행 클릭 → 우측 사이드바에서 선택됨
  await rows.first().click()
  await expect(page.locator('aside')).toBeVisible()
})

test('탐색기 접기/펼치기 토글', async ({ page }) => {
  await addKind(page, 'note')
  await expect(page.getByTestId('board-explorer')).toBeVisible()
  await page.getByRole('button', { name: '탐색기 닫기' }).click()
  await expect(page.getByTestId('board-explorer')).toHaveCount(0)
  await page.getByRole('button', { name: '탐색기 열기' }).click()
  await expect(page.getByTestId('board-explorer')).toBeVisible()
})
