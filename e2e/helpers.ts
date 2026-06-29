import { expect, type Page } from '@playwright/test'

/** Post-it 노트 노드를 추가하고 (선택적으로) 내용을 채운다 */
export async function createNote(page: Page, content?: string) {
  const before = await page.locator('.react-flow__node').count()
  await page
    .getByRole('button', { name: before === 0 ? '+ 첫 작업공간 만들기' : '+ 작업공간 추가' })
    .click()
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1)
  if (content) {
    const node = page.locator('.react-flow__node').last()
    await node.getByTestId('content-view').dblclick()
    await page.getByTestId('content-editor').fill(content)
    await page.getByRole('button', { name: '저장', exact: true }).click()
  }
}

/** 카인드 추가 메뉴로 특정 종류의 노드를 만든다 */
export async function addKind(page: Page, kind: string) {
  await page.getByRole('button', { name: '노드 종류 선택' }).click()
  await page.locator(`[data-testid="kind-add-menu"] [data-kind="${kind}"]`).click()
}

/** dock의 persona 아이콘을 nodeIndex 노드 위로 포인터 드래그한다 */
export async function dragAgentToNode(page: Page, persona: string, nodeIndex: number) {
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

/** 에이전트 드롭 → 미션 교정 → 실행. AI 파생 노드 생성까지 기다린다 */
export async function runMission(
  page: Page,
  persona: string,
  nodeIndex: number,
  mission: string,
) {
  const aiBefore = await page.locator('.react-flow__node [data-author="ai"]').count()
  await dragAgentToNode(page, persona, nodeIndex)
  const input = page.getByTestId('mission-input')
  await expect(input).toBeVisible()
  await input.fill(mission)
  await page.getByRole('button', { name: '▶ 실행' }).click()
  await expect(page.locator('.react-flow__node [data-author="ai"]')).toHaveCount(aiBefore + 1, {
    timeout: 30_000,
  })
}
