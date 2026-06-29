import { expect, test } from '@playwright/test'
import { createNote } from './helpers'

/** 보드 기본 동작 — 빈 보드 UX, 노드 추가, localStorage 영속 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('빈 보드 → 첫 노드 추가 UX', async ({ page }) => {
  await expect(page.getByText('보드가 비어 있습니다')).toBeVisible()
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await expect(page.getByText('보드가 비어 있습니다')).toHaveCount(0)
})

test('노드 내용·생성자가 새로고침 후 유지', async ({ page }) => {
  await createNote(page, '# 메모\n\n유지될 내용')
  await expect(page.locator('.react-flow__node').getByTestId('content-view')).toContainText(
    '유지될 내용',
  )
  await page.reload()
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await expect(page.locator('.react-flow__node [data-author="human"]')).toHaveCount(1)
  await expect(page.locator('.react-flow__node').getByTestId('content-view')).toContainText(
    '유지될 내용',
  )
})
