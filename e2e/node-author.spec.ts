import { expect, test } from '@playwright/test'
import { defineWorkspace } from './helpers'

/** 생성자(author) 구분 — 인간/AI 포스트잇 색상이 다르다 (v2 P1) */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('사용자가 만든 노드는 human, 템플릿(AI 산출물)은 ai', async ({ page }) => {
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  const node = page.locator('.react-flow__node').first()
  await expect(node.locator('[data-author="human"]')).toHaveCount(1)
  await expect(node).toContainText('👤 나')

  // 콘텐츠를 채워 템플릿 노출
  await node.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('# 자료\n\n분석 대상')
  await page.getByRole('button', { name: '저장', exact: true }).click()

  // 엣지를 끌어 템플릿 드롭 → AI 노드 생성
  const handle = node.locator('.react-flow__handle-right')
  const box = await handle.boundingBox()
  if (!box) throw new Error('handle')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(760, 460, { steps: 8 })
  await page.mouse.up()
  await page.locator('[data-template-id="summary"]').click()

  // 새로 생긴 노드는 AI 생성자
  const aiNode = page.locator('.react-flow__node', { hasText: '요약:' })
  await expect(aiNode.locator('[data-author="ai"]')).toHaveCount(1)
  await expect(aiNode).toContainText('🤖 AI')
})

test('생성자 정보가 새로고침 후에도 유지', async ({ page }) => {
  await defineWorkspace(page, '메모', '메모')
  await page.reload()
  await expect(page.locator('.react-flow__node [data-author="human"]')).toHaveCount(1)
})
