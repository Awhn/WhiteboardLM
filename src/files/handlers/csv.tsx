import Papa from 'papaparse'
import type { FileAttachment, FileHandler } from '../types'

/** localStorage 저장량을 고려한 보관 한도 */
const MAX_STORED_ROWS = 500
const MAX_TEXT_ROWS = 50

interface CsvData {
  headers: string[]
  rows: string[][]
  totalRows: number
}

function CsvViewer({ attachment }: { attachment: FileAttachment }) {
  const { headers, rows, totalRows } = attachment.data as CsvData
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold text-slate-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="odd:bg-white even:bg-slate-50/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b border-slate-100 px-2 py-1 text-slate-600">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalRows > rows.length && (
        <p className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-400">
          전체 {totalRows}행 중 {rows.length}행 표시
        </p>
      )}
    </div>
  )
}

export const csvHandler: FileHandler = {
  id: 'csv',
  label: 'CSV',
  icon: '📊',
  extensions: ['.csv', '.tsv'],
  mimeTypes: ['text/csv', 'text/tab-separated-values'],
  parse: (file) =>
    new Promise<FileAttachment>((resolve, reject) => {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (result) => {
          if (result.data.length === 0) {
            reject(new Error('비어 있는 CSV 파일입니다.'))
            return
          }
          const [headers, ...allRows] = result.data
          const rows = allRows.slice(0, MAX_STORED_ROWS)
          const textLines = [
            headers.join(', '),
            ...allRows.slice(0, MAX_TEXT_ROWS).map((r) => r.join(', ')),
          ]
          resolve({
            handlerId: 'csv',
            fileName: file.name,
            mimeType: file.type || 'text/csv',
            size: file.size,
            data: { headers, rows, totalRows: allRows.length } satisfies CsvData,
            textContent: `CSV 「${file.name}」 (${allRows.length}행)\n${textLines.join('\n')}`,
          })
        },
        error: (e) => reject(e),
      })
    }),
  Viewer: CsvViewer,
}
