import { expect, test } from '@playwright/test'
import {
  connectNodes,
  defineWorkspace,
  generateChecklist,
  runPointerOnNode,
  waitForPointer,
} from './helpers'

/**
 * Phase 2 통합 테스트 (M16)
 * 엣지 컨텍스트 그래프(M10/M11), 도구 실행(M12), 블로킹(M13)/권한(M14) 예외 흐름.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('M10: 엣지 인스펙터 — 타입 변경·hop 제한·비활성화', async ({ page }) => {
  await defineWorkspace(page, 'A', 'A 목적')
  await defineWorkspace(page, 'B', 'B 목적')
  await connectNodes(page, 0, 1)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  // 기본 reference 라벨
  await expect(page.locator('.react-flow__edge')).toContainText('참조')

  // 엣지 클릭 → 인스펙터
  await page.locator('.react-flow__edge').first().click({ force: true })
  await expect(page.getByText('hop 제한')).toBeVisible()

  // 타입 → source
  await page.getByRole('button', { name: '📥 소스' }).click()
  await expect(page.locator('.react-flow__edge')).toContainText('소스')

  // hop 2단계
  await page.getByRole('button', { name: '2단계' }).click()
  await expect(page.locator('.react-flow__edge')).toContainText('2hop')

  // 비활성화
  await page.getByRole('button', { name: '활성', exact: true }).click()
  await expect(page.locator('.react-flow__edge')).toContainText('비활성')
})

test('M11+M12: source 컨텍스트 로드 + 도구 실행(tool_use)', async ({ page }) => {
  // A: 컨텍스트가 될 결과물 작업공간 — 먼저 content를 만든다
  await defineWorkspace(page, '자료실', '자료 모음 정리')
  await generateChecklist(page)
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  // M12: "자료" 키워드 항목은 web_search 도구를 거친다
  await expect(page.locator('.react-flow__node').nth(0).locator('pre')).toContainText(
    '🔍 웹 검색 결과',
  )

  // B 생성, A→B 엣지를 source로
  await defineWorkspace(page, '리포트', '자료 기반 리포트 작성')
  await generateChecklist(page)
  await connectNodes(page, 0, 1)
  await page.locator('.react-flow__edge').first().click({ force: true })
  await page.getByRole('button', { name: '📥 소스' }).click()

  // B에서 포인터 실행 → A의 전체 내용이 컨텍스트로 반영
  await runPointerOnNode(page, 1)
  await waitForPointer(page, /대기 중/)
  const bContent = await page.locator('.react-flow__node').nth(1).locator('pre').innerText()
  expect(bContent).toContain('참조 컨텍스트')
  expect(bContent).toContain('자료실')
  expect(bContent).toContain('[전체 내용]')
})

test('M11: reference 타입은 정의만 로드', async ({ page }) => {
  await defineWorkspace(page, '참고 정의', '참고용 정의만 제공')
  await defineWorkspace(page, '본문', '본문 작성')
  await generateChecklist(page)
  await connectNodes(page, 0, 1)
  // 기본 타입이 reference — 그대로 실행
  await runPointerOnNode(page, 1)
  await waitForPointer(page, /대기 중/)
  const content = await page.locator('.react-flow__node').nth(1).locator('pre').innerText()
  expect(content).toContain('[정의만 로드]')
  expect(content).toContain('참고 정의')
  expect(content).not.toContain('[전체 내용]')
})

test('M13: 판단 불가 → [blocking] 자동 생성 → 해소 후 재개', async ({ page }) => {
  await defineWorkspace(page, '블로킹 테스트', '블로킹 흐름 검증')
  await generateChecklist(page)
  // 기존 AI 항목보다 먼저 실행되도록 체크리스트를 재생성하지 않고,
  // !block 훅 항목을 수동 추가 (AI 태그)
  await page.locator('aside').getByPlaceholder('항목 직접 추가').fill('방향 판단 필요 !block')
  await page.locator('aside select').last().selectOption('AI')
  await page.locator('aside').getByRole('button', { name: '+', exact: true }).click()

  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)

  // 자동 생성된 [인간]/[승인] 항목을 완료하며 진행 → !block 항목 도달 시 [blocking] 발생
  const blockingRow = page.locator('aside li', { hasText: '진행 불가' })
  while ((await blockingRow.count()) === 0) {
    await page
      .locator('aside li[data-status="pending"]')
      .first()
      .getByRole('button', { name: '완료' })
      .click()
    await waitForPointer(page, /대기 중|완료/)
  }
  await expect(blockingRow).toHaveCount(1)
  await expect(blockingRow).toContainText('블로킹')
  await expect(blockingRow).toContainText('사유')

  // 해소(완료) → AI 재개 → !block 항목이 staged로
  await blockingRow.getByRole('button', { name: '완료' }).click()
  await waitForPointer(page, /대기 중|완료/)
  await expect(
    page
      .locator('aside li', { hasText: '방향 판단 필요' })
      .filter({ hasNotText: '진행 불가' }),
  ).toHaveAttribute('data-status', 'staged', { timeout: 30_000 })
})

test('M14: context 접근 → [permission] 자동 생성 → 권한 부여 후 재개', async ({ page }) => {
  await defineWorkspace(page, '본문 작업', '권한 흐름 검증')
  await generateChecklist(page)
  await defineWorkspace(page, '사내 자료', '사내 한정 자료', '📚 컨텍스트')
  // 컨텍스트 노드에는 📍 버튼이 없어야 함 (포인터 진입 차단)
  await expect(
    page.locator('.react-flow__node').nth(1).getByRole('button', { name: '포인터 이동' }),
  ).toHaveCount(0)

  await connectNodes(page, 0, 1)
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  // 사이드바가 실행 노드의 체크리스트를 보여주도록 다시 선택
  await page.locator('.react-flow__node').nth(0).click()

  // [permission] 항목: 담당자 자동 할당 + 사유
  const permRow = page.locator('aside li', { hasText: '접근 권한 필요' })
  await expect(permRow).toHaveCount(1)
  await expect(permRow).toContainText('권한')
  await expect(permRow).toContainText('담당: 보드 소유자')

  // 권한 부여 → 재개 → 이번에는 컨텍스트 로드되어 AI 항목 staged
  await permRow.getByRole('button', { name: '권한 부여' }).click()
  await waitForPointer(page, /대기 중/)
  await expect(permRow).toHaveAttribute('data-status', 'committed')
  const content = await page.locator('.react-flow__node').nth(0).locator('pre').innerText()
  expect(content).toContain('사내 자료')
})

test('M14: 권한 대신 엣지 비활성화 선택', async ({ page }) => {
  await defineWorkspace(page, '본문 작업', '엣지 비활성화 검증')
  await generateChecklist(page)
  await defineWorkspace(page, '비공개 자료', '비공개', '📚 컨텍스트')
  await connectNodes(page, 0, 1)
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  await page.locator('.react-flow__node').nth(0).click()

  const permRow = page.locator('aside li', { hasText: '접근 권한 필요' })
  await permRow.getByRole('button', { name: '엣지 비활성화' }).click()
  await expect(page.locator('.react-flow__edge')).toContainText('비활성')
  // 예외 항목도 committed로 기록 (버전 로그)
  await expect(permRow).toHaveAttribute('data-status', 'committed')
  await waitForPointer(page, /대기 중/)
  const content = await page.locator('.react-flow__node').nth(0).locator('pre').innerText()
  expect(content).not.toContain('비공개 자료')
})

test('M12: update 엣지 — 전체 committed 시 대상 작업공간에 결과 반영', async ({ page }) => {
  await defineWorkspace(page, '초안', 'update 전파 검증')
  await generateChecklist(page)
  await defineWorkspace(page, '최종본', '최종본 수합')
  await connectNodes(page, 0, 1)
  await page.locator('.react-flow__edge').first().click({ force: true })
  await page.getByRole('button', { name: '✏️ 업데이트' }).click()

  // 초안 실행 → 전부 승인/완료해 모두 committed로
  await runPointerOnNode(page, 0)
  await waitForPointer(page, /대기 중/)
  // 초안(노드 0)을 선택해 사이드바에서 처리
  await page.locator('.react-flow__node').nth(0).click()
  for (;;) {
    const staged = page.locator('aside li[data-status="staged"]')
    if ((await staged.count()) > 0) {
      await staged.first().getByRole('button', { name: '승인' }).click()
      continue
    }
    const pending = page.locator('aside li[data-status="pending"]')
    if ((await pending.count()) > 0) {
      await pending.first().getByRole('button', { name: '완료' }).click()
      await waitForPointer(page, /대기 중|완료/)
      continue
    }
    break
  }

  // 대상(최종본)에 결과가 반영됨
  await expect(page.locator('.react-flow__node').nth(1).locator('pre')).toContainText(
    '「초안」 작업 결과 반영',
  )
})
