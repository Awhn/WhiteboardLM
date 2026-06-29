import { expect, test } from '@playwright/test'
import { defineWorkspace } from './helpers'

/** 우측 통합 패널 — 세로탭(정의/체크리스트/로그/설정) + API 설정 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('세로탭으로 정의/체크리스트/로그/설정 전환', async ({ page }) => {
  await defineWorkspace(page, '리포트', '리포트 작성')

  // 노드 선택 시 자동으로 정의 탭
  await expect(page.locator('aside').getByText('선언형 정의')).toBeVisible()

  // 레일 탭으로 전환
  await page.locator('[data-testid="right-rail"] [data-tab="checklist"]').click()
  await expect(page.getByText('✅ 전체 체크리스트')).toBeVisible()

  await page.locator('[data-testid="right-rail"] [data-tab="log"]').click()
  await expect(page.getByText('🕘 행동 로그')).toBeVisible()

  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await expect(page.getByTestId('settings-panel')).toBeVisible()

  // 패널 접기/펼치기
  await page.getByRole('button', { name: '패널 접기' }).click()
  await expect(page.getByTestId('settings-panel')).toHaveCount(0)
  await page.getByRole('button', { name: '패널 펼치기' }).click()
  await expect(page.getByTestId('settings-panel')).toBeVisible()
})

test('설정 탭: API 키·모델 입력이 localStorage에 저장되어 새로고침 유지', async ({ page }) => {
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await page.getByTestId('settings-apibase').fill('http://localhost:8000')
  await page.getByTestId('settings-apikey').fill('sk-test-123')
  await page.getByTestId('settings-model').selectOption('openai/gpt-4o-mini')

  await page.reload()
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await expect(page.getByTestId('settings-apibase')).toHaveValue('http://localhost:8000')
  await expect(page.getByTestId('settings-apikey')).toHaveValue('sk-test-123')
  await expect(page.getByTestId('settings-model')).toHaveValue('openai/gpt-4o-mini')

  // localStorage에 설정이 저장됨
  const stored = await page.evaluate(() => localStorage.getItem('whiteboardlm-llm-config'))
  expect(stored).toContain('sk-test-123')
})

test('다른 노드를 선택하면 어느 탭에 있든 자동으로 정의 탭으로 전환', async ({ page }) => {
  await defineWorkspace(page, 'A', 'A 목적')
  await defineWorkspace(page, 'B', 'B 목적') // B가 선택된 상태
  // 설정 탭으로 이동
  await page.locator('[data-testid="right-rail"] [data-tab="settings"]').click()
  await expect(page.getByTestId('settings-panel')).toBeVisible()
  // 다른 노드(A) 선택 → 정의 탭 자동 전환
  await page.locator('.react-flow__node').first().click()
  await expect(page.locator('aside').getByText('선언형 정의')).toBeVisible()
})
