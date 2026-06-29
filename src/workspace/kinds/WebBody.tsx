import { useState } from 'react'
import { useBoardStore } from '../../board/boardStore'
import type { NodeBodyProps } from './types'

const normalizeUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** 웹 페이지 임베드 본문 — URL 미설정 시 입력 폼, 설정 시 iframe */
export function WebBody({ workspace }: NodeBodyProps) {
  const updateWorkspace = useBoardStore((s) => s.updateWorkspace)
  const logBoard = useBoardStore((s) => s.logBoard)
  const url = (workspace.kindData?.url as string) ?? ''
  const [draft, setDraft] = useState(url)

  const setUrl = (value: string) =>
    updateWorkspace(workspace.id, { kindData: { ...workspace.kindData, url: value } })

  if (!url) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const next = normalizeUrl(draft)
          if (!next) return
          setUrl(next)
          logBoard(`웹 임베드: ${workspace.name} → ${next}`)
        }}
        className="nodrag flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-4"
      >
        <p className="text-xs text-slate-400">임베드할 페이지 URL을 입력하세요</p>
        <div className="flex w-full gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://example.com"
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
            data-testid="web-url-input"
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            임베드
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          ※ 임베드를 차단하는 사이트(CSP/X-Frame-Options)는 표시되지 않을 수 있습니다.
        </p>
      </form>
    )
  }

  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col" data-testid="web-body">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
        <span>🌐</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-blue-600 hover:underline"
          title={url}
        >
          {url}
        </a>
        <button
          onClick={() => {
            setDraft(url)
            setUrl('')
          }}
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200"
        >
          변경
        </button>
      </div>
      <iframe
        src={url}
        title={workspace.name}
        className="min-h-0 flex-1 border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        data-testid="web-frame"
      />
    </div>
  )
}
