import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useBoardStore } from '../board/boardStore'
import type { ContentFormat, Workspace } from './types'

/**
 * 작업공간 콘텐츠 뷰어/에디터.
 * AI(러너)뿐 아니라 사용자도 노드 안에서 직접 콘텐츠를 작성·편집한다.
 * - 보기: 마크다운 렌더링(기본) 또는 일반 텍스트
 * - 편집: 본문 더블클릭 또는 헤더 ✏️ 버튼 → textarea, ⌘/Ctrl+Enter 저장, Esc 취소
 */
export function WorkspaceContent({
  workspace,
  editing,
  onEditingChange,
}: {
  workspace: Workspace
  editing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const format: ContentFormat = workspace.contentFormat ?? 'markdown'

  if (editing) {
    // 마운트 시점(편집 시작)의 content로 초기화되도록 별도 컴포넌트로 분리
    return <ContentEditor workspace={workspace} onClose={() => onEditingChange(false)} />
  }

  return (
    <div
      className="nodrag nowheel flex-1 overflow-auto p-3 text-xs leading-relaxed text-slate-600"
      onDoubleClick={() => onEditingChange(true)}
      title="더블클릭하여 편집"
      data-testid="content-view"
    >
      {workspace.content ? (
        format === 'markdown' ? (
          <div className="prose prose-sm prose-slate max-w-none prose-headings:mb-1.5 prose-headings:mt-3 prose-p:my-1.5 prose-pre:my-1.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{workspace.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{workspace.content}</pre>
        )
      ) : (
        <span className="italic text-slate-400">
          더블클릭하여 직접 작성하거나, 정의를 완료하고 포인터를 이동하면 AI가 결과를
          기록합니다.
        </span>
      )}
    </div>
  )
}

function ContentEditor({
  workspace,
  onClose,
}: {
  workspace: Workspace
  onClose: () => void
}) {
  const updateWorkspace = useBoardStore((s) => s.updateWorkspace)
  const logBoard = useBoardStore((s) => s.logBoard)
  const [draft, setDraft] = useState(workspace.content)
  const format: ContentFormat = workspace.contentFormat ?? 'markdown'

  const save = () => {
    if (draft !== workspace.content) {
      updateWorkspace(workspace.id, { content: draft })
      logBoard(`사용자 편집: ${workspace.name}`)
    }
    onClose()
  }

  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
        }}
        placeholder={
          format === 'markdown'
            ? '# 제목\n\n마크다운으로 작성하세요…'
            : '텍스트를 입력하세요…'
        }
        className="min-h-0 flex-1 resize-none p-3 font-mono text-xs leading-relaxed text-slate-700 focus:outline-none"
        data-testid="content-editor"
      />
      <footer className="flex items-center gap-1 border-t border-slate-100 bg-slate-50 px-2 py-1">
        <FormatToggle
          format={format}
          onChange={(next) => updateWorkspace(workspace.id, { contentFormat: next })}
        />
        <span className="ml-auto text-[9px] text-slate-400">⌘↵ 저장 · Esc 취소</span>
        <button
          onClick={onClose}
          className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200"
        >
          취소
        </button>
        <button
          onClick={save}
          className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700"
        >
          저장
        </button>
      </footer>
    </div>
  )
}

function FormatToggle({
  format,
  onChange,
}: {
  format: ContentFormat
  onChange: (format: ContentFormat) => void
}) {
  return (
    <div className="flex overflow-hidden rounded border border-slate-200">
      {(
        [
          ['markdown', 'MD'],
          ['plain', 'TXT'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          title={value === 'markdown' ? '마크다운' : '일반 텍스트'}
          className={`px-1.5 py-0.5 text-[9px] font-semibold ${
            format === value
              ? 'bg-slate-700 text-white'
              : 'bg-white text-slate-400 hover:bg-slate-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
