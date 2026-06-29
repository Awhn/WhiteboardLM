import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { githubLight } from '@uiw/codemirror-theme-github'
import { useBoardStore } from '../../board/boardStore'
import type { NodeBodyProps } from './types'

/** 언어 id → CodeMirror 확장 (없으면 일반 텍스트) */
const LANG_EXTENSIONS: Record<string, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  markdown: () => markdown(),
  json: () => json(),
}

const LANG_OPTIONS = ['python', 'javascript', 'typescript', 'markdown', 'json', 'text']

/** 코드 에디터 본문 (CodeMirror 6) — 항상 편집 가능, 언어 선택 지원 */
export function CodeBody({ workspace }: NodeBodyProps) {
  const updateWorkspace = useBoardStore((s) => s.updateWorkspace)
  const language = (workspace.kindData?.language as string) ?? 'python'

  const extensions = useMemo<Extension[]>(() => {
    const make = LANG_EXTENSIONS[language]
    return make ? [make()] : []
  }, [language])

  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col" data-testid="code-body">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
        <span>💻</span>
        <select
          value={language}
          onChange={(e) =>
            updateWorkspace(workspace.id, {
              kindData: { ...workspace.kindData, language: e.target.value },
            })
          }
          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
          aria-label="코드 언어"
          data-testid="code-language"
        >
          {LANG_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-xs">
        <CodeMirror
          value={workspace.content}
          theme={githubLight}
          extensions={extensions}
          onChange={(value) => updateWorkspace(workspace.id, { content: value })}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
          height="100%"
        />
      </div>
    </div>
  )
}
