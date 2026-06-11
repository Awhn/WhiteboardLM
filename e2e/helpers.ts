import { expect, type Page } from '@playwright/test'

/** 작업공간을 추가하고 선언형 정의를 완료한다 */
export async function defineWorkspace(
  page: Page,
  name: string,
  purpose: string,
  type: '🎯 결과물' | '📚 컨텍스트' | '⚙️ 중간 작업' = '🎯 결과물',
) {
  const before = await page.locator('.react-flow__node').count()
  await page
    .getByRole('button', { name: before === 0 ? '+ 첫 작업공간 만들기' : '+ 작업공간 추가' })
    .click()
  await page.locator('.react-flow__node').last().click()
  await expect(page.getByText('선언형 정의')).toBeVisible()
  await page.locator('aside input').first().fill(name)
  await page.getByRole('button', { name: type }).click()
  await page.locator('aside textarea').first().fill(purpose)
  await page.getByRole('button', { name: '✨ 동적 필드 생성' }).click()

  if (type === '🎯 결과물') {
    await expect(page.locator('aside').getByText('대상 독자')).toBeVisible()
    await fillField(page, '대상 독자', '테스트 독자')
    await page.locator('aside select').first().selectOption({ index: 1 })
    await page.locator('aside input[type="number"]').fill('300')
    await page.locator('aside textarea').nth(1).fill('테스트 핵심 내용')
  } else if (type === '📚 컨텍스트') {
    await expect(page.locator('aside').getByText('자료 출처 유형')).toBeVisible()
    await page.locator('aside select').first().selectOption({ index: 1 })
    await fillField(page, '핵심 키워드', '테스트 키워드')
    await page.locator('aside textarea').nth(1).fill('테스트 자료 요약')
  } else {
    await expect(page.locator('aside').getByText('입력으로 받는 것')).toBeVisible()
    await fillField(page, '입력으로 받는 것', '입력 A')
    await fillField(page, '출력으로 넘기는 것', '출력 B')
    await page.locator('aside select').first().selectOption({ index: 1 })
    await page.locator('aside textarea').nth(1).fill('주의사항 없음')
  }
  await expect(page.locator('aside').getByText('✓ 정의 완료')).toBeVisible()
}

export async function fillField(page: Page, label: string, value: string) {
  await page
    .locator('aside')
    .getByText(label)
    .locator('..')
    .locator('..')
    .locator('input')
    .fill(value)
}

export async function generateChecklist(page: Page) {
  await page.getByRole('button', { name: /체크리스트 생성|체크리스트 다시 생성/ }).click()
  await expect(page.locator('aside li').first()).toBeVisible()
}

export async function waitForPointer(page: Page, label: RegExp) {
  await expect(page.getByTestId('pointer-badge')).toHaveText(label, { timeout: 30_000 })
}

/** i번째 노드의 오른쪽 핸들을 j번째 노드의 왼쪽 핸들로 드래그해 엣지를 만든다 */
export async function connectNodes(page: Page, i: number, j: number) {
  const src = page.locator('.react-flow__node').nth(i).locator('.react-flow__handle-right')
  const tgt = page.locator('.react-flow__node').nth(j).locator('.react-flow__handle-left')
  const sb = await src.boundingBox()
  const tb = await tgt.boundingBox()
  if (!sb || !tb) throw new Error('handle not found')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 })
  await page.mouse.up()
}

/** 노드 i의 📍 버튼으로 포인터를 이동·실행한다 */
export async function runPointerOnNode(page: Page, i: number) {
  await page
    .locator('.react-flow__node')
    .nth(i)
    .getByRole('button', { name: '포인터 이동' })
    .click()
}
