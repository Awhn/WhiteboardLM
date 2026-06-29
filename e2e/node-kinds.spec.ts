import { expect, test } from '@playwright/test'
import { connectNodes, defineWorkspace, generateChecklist, runPointerOnNode, waitForPointer } from './helpers'

/**
 * 노드 카인드 (M23/M24): 노트·코드·웹 노드를 캔버스에서 만들고,
 * source 엣지로 연결하면 AI가 그 내용을 컨텍스트로 읽는다.
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
  // 노트는 컨텍스트 타입(기본) + 편집 토글 보유
  await expect(page.locator('.react-flow__node').first()).toContainText('컨텍스트')

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

test('비선언형 노드 사이드바엔 선언/체크리스트 대신 안내', async ({ page }) => {
  await addKind(page, 'note')
  await page.locator('.react-flow__node').first().click()
  const aside = page.locator('aside')
  await expect(aside.getByText('📝 노트')).toBeVisible()
  // 선언형 전용 UI는 없음
  await expect(aside.getByRole('button', { name: /동적 필드 생성/ })).toHaveCount(0)
  await expect(aside.getByText(/source 엣지로 연결하면/)).toBeVisible()
  // 포인터 이동 버튼도 없음 (declarative 아님)
  await expect(
    page.locator('.react-flow__node').first().getByRole('button', { name: '포인터 이동' }),
  ).toHaveCount(0)
})

test('코드 노드를 source 엣지로 연결하면 AI 컨텍스트로 로드', async ({ page }) => {
  await defineWorkspace(page, '코드 리뷰', '연결된 코드를 리뷰')
  await generateChecklist(page)
  await addKind(page, 'code')
  // 코드 작성
  await page.locator('.cm-content').click()
  await page.keyboard.type('def add(a,b): return a+b')

  // 코드 노드(컨텍스트) 접근 허용 — 권한 흐름을 피하기 위해 타입을 intermediate로
  await page.locator('.react-flow__node').nth(1).click()
  await page.locator('aside').getByRole('button', { name: '⚙️ 중간 작업' }).click()

  await connectNodes(page, 1, 0) // 코드 → 리뷰
  await page.locator('.react-flow__edge').first().click({ force: true })
  await page.getByRole('button', { name: '📥 소스' }).click()

  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  const content = await page
    .locator('.react-flow__node')
    .nth(0)
    .getByTestId('content-view')
    .innerText()
  expect(content).toContain('add(a,b)')
})
