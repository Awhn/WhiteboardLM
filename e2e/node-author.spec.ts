import { expect, test } from '@playwright/test'
import { createNote } from './helpers'

/** 생성자(author) 구분 — 인간/AI 포스트잇 색상이 다르다 (v2 P1) */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('사용자가 만든 노드는 human 생성자로 표시', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  const node = page.locator('.react-flow__node').first()
  await expect(node.locator('[data-author="human"]')).toHaveCount(1)
  await expect(node).toContainText('👤 나')
})

test('생성자 정보가 새로고침 후에도 유지', async ({ page }) => {
  await createNote(page, '메모')
  await page.reload()
  await expect(page.locator('.react-flow__node [data-author="human"]')).toHaveCount(1)
})
