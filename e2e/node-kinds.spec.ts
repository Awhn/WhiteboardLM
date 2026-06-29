import { expect, test } from '@playwright/test'
import { createNote, runMission } from './helpers'

/**
 * 노드 카인드: 노트·코드·웹 노드를 캔버스에서 만들고,
 * 가까이 두면 AI가 공간 컨텍스트로 읽는다 (v2).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

async function addKind(page: import('@playwright/test').Page, kind: string) {
  await page.getByRole('button', { name: '노드 종류 선택' }).click()
  await page.locator(`[data-testid="kind-add-menu"] [data-kind="${kind}"]`).click()
}

test('카인드 추가 메뉴로 노트·코드·웹 노드 생성', async ({ page }) => {
  await addKind(page, 'note')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  // 노드 헤더에 카인드 라벨 표시
  await expect(page.locator('.react-flow__node').first()).toContainText('노트')

  await addKind(page, 'code')
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await expect(page.getByTestId('code-body')).toBeVisible()
  await expect(page.getByTestId('code-language')).toBeVisible()

  await addKind(page, 'web')
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await expect(page.getByTestId('web-url-input')).toBeVisible()
})

test('코드 노드: 언어 변경 + 내용 영속화', async ({ page }) => {
  await addKind(page, 'code')
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.type('print("hi")')
  await page.getByTestId('code-language').selectOption('javascript')
  await page.waitForTimeout(150)

  await page.reload()
  await expect(page.locator('.cm-content')).toContainText('print("hi")')
  await expect(page.getByTestId('code-language')).toHaveValue('javascript')
})

test('웹 노드: URL 임베드 → iframe 표시', async ({ page }) => {
  await addKind(page, 'web')
  await page.getByTestId('web-url-input').fill('example.com')
  await page.getByRole('button', { name: '임베드' }).click()
  const frame = page.getByTestId('web-frame')
  await expect(frame).toHaveCount(1)
  await expect(frame).toHaveAttribute('src', 'https://example.com')
})

test('노드 사이드바엔 노드 정보 + Task 영역', async ({ page }) => {
  await addKind(page, 'note')
  await page.locator('.react-flow__node').first().click()
  const aside = page.locator('aside')
  await expect(aside.getByText('📝 노트')).toBeVisible()
  await expect(aside.getByText('이 노드의 작업')).toBeVisible()
  // 구 선언형 UI는 없음
  await expect(aside.getByRole('button', { name: /동적 필드 생성/ })).toHaveCount(0)
  await expect(
    page.locator('.react-flow__node').first().getByRole('button', { name: '포인터 이동' }),
  ).toHaveCount(0)
})

test('가까이 둔 코드 노드가 에이전트 공간 컨텍스트로 로드 (v2)', async ({ page }) => {
  await createNote(page, '# 코드 리뷰 대상')
  await addKind(page, 'code') // 인접 배치 → 공간 이웃
  await page.locator('.cm-content').click()
  await page.keyboard.type('def add(a,b): return a+b')

  // 노트 노드 위에서 미션 실행 → 공간 근접만으로 코드가 컨텍스트에 포함
  await runMission(page, 'reviewer', 0, '코드 검토')
  await expect(
    page.locator('.react-flow__node', { hasText: 'Reviewer' }).getByTestId('content-view'),
  ).toContainText('add(a,b)', { timeout: 30_000 })
})
