import { expect, test } from '@playwright/test'
import { createNote, runMission } from './helpers'

/** 설정의 로컬 모드 토글 — 브라우저에서 직접 LLM 호출 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('로컬 모드 토글이 백엔드 주소 입력을 숨기고 localStorage에 영속', async ({ page }) => {
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  // 기본: 백엔드 주소 보임
  await expect(page.getByTestId('settings-apibase')).toBeVisible()

  // 토글 ON
  await page.getByTestId('settings-localmode').click()
  await expect(page.getByTestId('settings-localmode')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('settings-apibase')).toHaveCount(0) // 백엔드 주소 숨김
  await expect(page.getByText(/로컬 모드 ON/)).toBeVisible()

  // 새로고침 후 유지
  await page.reload()
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await expect(page.getByTestId('settings-localmode')).toHaveAttribute('aria-checked', 'true')
  const stored = await page.evaluate(() => localStorage.getItem('whiteboardlm-llm-config'))
  expect(stored).toContain('"localMode":true')
})

test('로컬 모드 + 키 없음 → 스텁 폴백으로 미션은 정상 동작', async ({ page }) => {
  // 로컬 모드 ON, 키는 입력하지 않음
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await page.getByTestId('settings-localmode').click()

  await createNote(page, '# 주제')
  // BrowserLLMClient가 키 없음으로 throw → 스텁 폴백 → 미션 정상 실행
  await runMission(page, 'researcher', 0, '자료 조사')
  await expect(
    page.locator('.react-flow__node', { hasText: 'Researcher' }).getByTestId('content-view'),
  ).toContainText('스텁 출력', { timeout: 30_000 })
})
