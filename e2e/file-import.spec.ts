import { expect, test } from '@playwright/test'
import { createNote, runMission } from './helpers'

/**
 * 외부 파일 가져오기 (Padlet 스타일) — 파일은 기본적으로 context 타입
 * 작업공간 노드가 되며, 본문에 간단한 파일 뷰어가 표시된다.
 */

const CSV_FILE = {
  name: 'members.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('이름,역할\n민수,개발\n지영,디자인\n현우,기획\n'),
}

// 최소 유효 PDF (한 페이지짜리 빈 문서)
const PDF_BYTES = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('📎 버튼으로 CSV 가져오기 → 컨텍스트 노드 + 테이블 뷰어 + 영속화', async ({
  page,
}) => {
  await page.getByTestId('file-input').setInputFiles(CSV_FILE)

  const node = page.locator('.react-flow__node').first()
  await expect(node).toContainText('members.csv')
  await expect(node).toContainText('파일') // 파일 카인드
  // 테이블 뷰어: 헤더 + 데이터 행
  await expect(node.locator('th')).toHaveCount(2)
  await expect(node.locator('table')).toContainText('민수')
  // 파일 노드에는 콘텐츠 편집 버튼이 없음
  await expect(node.getByRole('button', { name: '콘텐츠 편집' })).toHaveCount(0)

  // 새로고침 후에도 유지
  await page.reload()
  await expect(page.locator('.react-flow__node table')).toContainText('지영')
})

test('PDF 가져오기 → 내장 뷰어(iframe) 표시', async ({ page }) => {
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF_BYTES) })

  const node = page.locator('.react-flow__node').first()
  await expect(node).toContainText('doc.pdf')
  await expect(node.getByTestId('pdf-viewer')).toHaveCount(1)
})

test('드래그&드롭으로 캔버스에 파일 추가', async ({ page }) => {
  // DataTransfer를 만들어 drop 이벤트 디스패치
  const dataTransfer = await page.evaluateHandle(
    ([name, content]) => {
      const dt = new DataTransfer()
      dt.items.add(new File([content], name, { type: 'text/csv' }))
      return dt
    },
    ['dropped.csv', '항목,값\nA,1\nB,2\n'] as const,
  )
  await page.dispatchEvent('.react-flow', 'drop', { dataTransfer })

  const node = page.locator('.react-flow__node').first()
  await expect(node).toContainText('dropped.csv')
  await expect(node.locator('table')).toContainText('항목')

  // 행동 로그에 기록
  await page.getByRole('button', { name: '🕘 로그' }).click()
  await expect(page.getByText(/파일 가져오기: .*dropped\.csv/)).toBeVisible()
})

test('지원하지 않는 형식은 안내 후 무시', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.accept()
  })
  await page
    .getByTestId('file-input')
    .setInputFiles({ name: 'data.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from('?') })

  await expect.poll(() => dialogs.length).toBeGreaterThan(0)
  expect(dialogs[0]).toContain('지원하지 않는 형식')
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
})

test('가까이 둔 CSV 파일이 에이전트 공간 컨텍스트로 로드 (v2)', async ({ page }) => {
  // 작업 노드 + CSV 파일 노드 (인접 배치 → 공간 이웃)
  await createNote(page, '# 분석')
  await page.getByTestId('file-input').setInputFiles(CSV_FILE)

  // 노트 노드 위에서 미션 실행 → 공간 근접만으로 CSV가 컨텍스트에 포함
  await runMission(page, 'summarizer', 0, '멤버 데이터 요약')

  await expect(
    page.locator('.react-flow__node', { hasText: 'Summarizer' }).getByTestId('content-view'),
  ).toContainText('members.csv', { timeout: 30_000 })
})
