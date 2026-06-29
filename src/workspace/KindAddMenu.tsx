import { useState } from 'react'
import { useBoardStore } from '../board/boardStore'
import { CREATABLE_KINDS } from './kinds/registry'

/** 툴바의 카인드 선택 드롭다운 — 노트·코드·웹 등 다양한 노드 종류 생성 */
export function KindAddMenu() {
  const addWorkspace = useBoardStore((s) => s.addWorkspace)
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)
  const [open, setOpen] = useState(false)

  const create = (kind: (typeof CREATABLE_KINDS)[number]['id']) => {
    const ws = addWorkspace({ kind })
    selectWorkspace(ws.id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="다른 종류의 노드 추가"
        aria-label="노드 종류 선택"
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
      >
        ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul
            className="absolute left-0 top-full z-40 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
            data-testid="kind-add-menu"
          >
            {CREATABLE_KINDS.map((k) => (
              <li key={k.id}>
                <button
                  onClick={() => create(k.id)}
                  data-kind={k.id}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-blue-50"
                >
                  <span className="text-base">{k.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-700">{k.label}</span>
                    <span className="block text-[10px] leading-snug text-slate-400">
                      {k.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
