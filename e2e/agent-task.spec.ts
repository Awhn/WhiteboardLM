import { expect, test } from '@playwright/test'
import { addKind, createNote, dragAgentToNode, runMission } from './helpers'

/**
 * v2 에이전트 Task 실행: 공간 컨텍스트, 체크리스트, 도구, 블로킹.
 * (구 phase1/phase2의 개념을 v2 모델로 재구성)
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('미션 실행 → 체크리스트 생성 + AI 파생 노드 + 인간 노드 불변', async ({ page }) => {
  await createNote(page, '# RAG\n\nEmbedding + Vector DB')
  await runMission(page, 'researcher', 0, '자료 조사')

  const aiNode = page.locator('.react-flow__node', { hasText: 'Researcher' })
  await expect(aiNode.getByTestId('content-view')).toContainText('스텁 출력', { timeout: 30_000 })

  // 우측 정의 탭에 Task + 체크리스트 표시
  await aiNode.click()
  await expect(page.locator('aside').getByText('이 노드의 작업')).toBeVisible()
  await expect(page.locator('aside li').first()).toBeVisible()

  // 인간 노드는 그대로
  await expect(page.locator('.react-flow__node [data-author="human"]')).toHaveCount(1)
})

test('가까운 노드 내용이 공간 컨텍스트로 AI에 반영', async ({ page }) => {
  await createNote(page, '# 자료실\n\nFAISS 인덱스 설정 방법')
  await createNote(page, '# 작업 노드') // 인접 배치 → 공간 이웃
  await runMission(page, 'writer', 1, '리포트 작성')

  // 공간 이웃(자료실)이 컨텍스트에 포함
  const aiView = page.locator('.react-flow__node', { hasText: 'Writer' }).getByTestId('content-view')
  await expect(aiView).toContainText('근접', { timeout: 30_000 })
  await expect(aiView).toContainText('자료실')
})

test('도구 사용: "자료" 미션은 web_search 도구를 거친다', async ({ page }) => {
  await createNote(page, '# 주제')
  await runMission(page, 'researcher', 0, '관련 자료 검색')
  await expect(
    page.locator('.react-flow__node', { hasText: 'Researcher' }).getByTestId('content-view'),
  ).toContainText('🔍 웹 검색 결과', { timeout: 30_000 })
})

test('[blocking] 자동 생성 → 완료로 해소', async ({ page }) => {
  await createNote(page, '# 주제')
  // 미션에 !block 훅 포함 → 체크리스트 항목 제목에 전파되어 블로킹 유발
  await dragAgentToNode(page, 'researcher', 0)
  await page.getByTestId('mission-input').fill('방향 판단 필요 !block')
  await page.getByRole('button', { name: '▶ 실행' }).click()

  // AI 파생 노드 생성 후, 블로킹 항목 등장
  await expect(page.locator('.react-flow__node', { hasText: 'Researcher' })).toBeVisible({
    timeout: 30_000,
  })
  await page.locator('.react-flow__node', { hasText: 'Researcher' }).click()
  const blockingRow = page.locator('aside li', { hasText: '진행 불가' })
  await expect(blockingRow).toHaveCount(1, { timeout: 30_000 })
  await expect(blockingRow).toContainText('블로킹')
})

test('파일 노드를 가까이 두면 첨부 내용이 컨텍스트로', async ({ page }) => {
  await createNote(page, '# 분석')
  await page.getByTestId('file-input').setInputFiles({
    name: 'members.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('이름,역할\n민수,개발\n지영,디자인\n'),
  })
  await runMission(page, 'summarizer', 0, '데이터 요약')
  await expect(
    page.locator('.react-flow__node', { hasText: 'Summarizer' }).getByTestId('content-view'),
  ).toContainText('members.csv', { timeout: 30_000 })
})

test('코드 노드 컨텍스트', async ({ page }) => {
  await createNote(page, '# 코드 리뷰 대상')
  await addKind(page, 'code')
  await page.locator('.cm-content').click()
  await page.keyboard.type('def add(a,b): return a+b')
  await runMission(page, 'reviewer', 0, '코드 검토')
  await expect(
    page.locator('.react-flow__node', { hasText: 'Reviewer' }).getByTestId('content-view'),
  ).toContainText('add(a,b)', { timeout: 30_000 })
})
