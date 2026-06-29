import { expect, test, type Page } from '@playwright/test'

/**
 * v2 P3a: Agent Dock에서 페르소나를 노드 위로 드래그 → 미션 말풍선 교정 →
 * 실행 시 AI 파생 노드 생성 + 체크리스트 실행.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

/** dock의 persona 아이콘을 nodeIndex 노드 위로 포인터 드래그한다 */
async function dragAgentToNode(page: Page, persona: string, nodeIndex: number) {
  const icon = page.locator(`[data-testid="agent-dock"] [data-persona="${persona}"]`)
  const node = page.locator('.react-flow__node').nth(nodeIndex)
  const ib = await icon.boundingBox()
  const nb = await node.boundingBox()
  if (!ib || !nb) throw new Error('bbox')
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2)
  await page.mouse.down()
  await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('하단 Agent Dock에 페르소나 5종 표시', async ({ page }) => {
  const dock = page.getByTestId('agent-dock')
  await expect(dock).toBeVisible()
  for (const p of ['researcher', 'writer', 'summarizer', 'organizer', 'reviewer']) {
    await expect(dock.locator(`[data-persona="${p}"]`)).toHaveCount(1)
  }
})

test('에이전트 드롭 → 미션 말풍선 → 실행 → AI 파생 노드 생성', async ({ page }) => {
  // 인간 노드 하나 (앵커)
  await page.getByRole('button', { name: '+ 첫 작업공간 만들기' }).click()
  await page.getByTestId('content-view').dblclick()
  await page.getByTestId('content-editor').fill('# RAG\n\nEmbedding + Vector DB')
  await page.getByRole('button', { name: '저장', exact: true }).click()

  await dragAgentToNode(page, 'researcher', 0)

  // 미션 말풍선이 뜨고 페르소나 힌트가 미리 채워짐
  const bubble = page.getByTestId('mission-bubble')
  await expect(bubble).toBeVisible()
  await expect(bubble).toContainText('Researcher')
  const input = page.getByTestId('mission-input')
  await expect(input).not.toHaveValue('')

  // 미션 교정 후 실행
  await input.fill('RAG 활용 사례 조사')
  await bubble.getByRole('button', { name: '▶ 실행' }).click()

  // AI 파생 노드가 새로 생김 (author=ai)
  const aiNode = page.locator('.react-flow__node [data-author="ai"]')
  await expect(aiNode).toHaveCount(1, { timeout: 30_000 })
  const node = page.locator('.react-flow__node', { hasText: 'Researcher' })
  await expect(node).toContainText('🤖 AI')

  // 결과 콘텐츠에 미션이 반영됨 (스텁 출력)
  await expect(node.getByTestId('content-view')).toContainText('스텁 출력', { timeout: 30_000 })

  // 인간 앵커 노드는 그대로 (AI가 수정하지 않음)
  const human = page.locator('.react-flow__node', { hasText: 'RAG' }).first()
  await expect(human.locator('[data-author="human"]')).toHaveCount(1)

  // dock의 researcher에 태스크 배지
  await expect(
    page.locator('[data-testid="agent-dock"] [data-persona="researcher"]'),
  ).toContainText(/[0-9]/)
})
