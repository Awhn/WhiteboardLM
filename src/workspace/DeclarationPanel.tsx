import { useState } from 'react'
import { useBoardStore } from '../board/boardStore'
import { getLLMClient } from '../llm'
import { isDeclarationComplete } from './declaration'
import { WORKSPACE_TYPES, WORKSPACE_TYPE_CONFIG } from './typeConfig'
import type { DynamicField, DynamicFieldType, WorkspaceType } from './types'

let manualFieldCounter = 0

/** 선택된 작업공간의 선언형 정의를 편집하는 우측 패널 */
export function DeclarationPanel() {
  const workspace = useBoardStore((s) =>
    s.workspaces.find((w) => w.id === s.selectedWorkspaceId),
  )
  const updateWorkspace = useBoardStore((s) => s.updateWorkspace)
  const updateDeclaration = useBoardStore((s) => s.updateDeclaration)
  const setDynamicFieldValue = useBoardStore((s) => s.setDynamicFieldValue)
  const selectWorkspace = useBoardStore((s) => s.selectWorkspace)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualLabel, setManualLabel] = useState('')
  const [manualType, setManualType] = useState<DynamicFieldType>('text')

  if (!workspace) return null

  const complete = isDeclarationComplete(workspace)
  const { purpose, dynamicFields } = workspace.declaration

  const handleGenerate = async () => {
    const id = workspace.id
    setGenerating(true)
    setError(null)
    try {
      const fields = await getLLMClient().generateDynamicFields({
        name: workspace.name,
        type: workspace.type,
        purpose,
      })
      updateDeclaration(id, { dynamicFields: fields })
    } catch (e) {
      setError(e instanceof Error ? e.message : '동적 필드 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleManualAdd = () => {
    if (!manualLabel.trim()) return
    const field: DynamicField = {
      id: `manual-${Date.now().toString(36)}-${(manualFieldCounter++).toString(36)}`,
      label: manualLabel.trim(),
      type: manualType,
      value: '',
    }
    updateDeclaration(workspace.id, { dynamicFields: [...dynamicFields, field] })
    setManualLabel('')
  }

  const removeField = (fieldId: string) =>
    updateDeclaration(workspace.id, {
      dynamicFields: dynamicFields.filter((f) => f.id !== fieldId),
    })

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800">선언형 정의</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {complete ? '✓ 정의 완료' : '정의 미완료'}
          </span>
        </div>
        <button
          onClick={() => selectWorkspace(null)}
          className="rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">이름</span>
          <input
            value={workspace.name}
            onChange={(e) => updateWorkspace(workspace.id, { name: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-600">타입</span>
          <div className="grid grid-cols-3 gap-1.5">
            {WORKSPACE_TYPES.map((type: WorkspaceType) => {
              const cfg = WORKSPACE_TYPE_CONFIG[type]
              const active = workspace.type === type
              return (
                <button
                  key={type}
                  onClick={() => updateWorkspace(workspace.id, { type })}
                  title={cfg.description}
                  className={`rounded-md border px-1 py-1.5 text-[11px] font-medium transition-colors ${
                    active
                      ? `${cfg.headerClass} ${cfg.borderClass} text-slate-800`
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">
            {WORKSPACE_TYPE_CONFIG[workspace.type].description}
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">목적 요약</span>
          <textarea
            value={purpose}
            onChange={(e) => updateDeclaration(workspace.id, { purpose: e.target.value })}
            placeholder="이 작업공간에서 무엇을 만들 것인지 설명하세요"
            rows={3}
            className="w-full resize-y rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
          />
        </label>

        <button
          onClick={handleGenerate}
          disabled={!purpose.trim() || generating}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {generating
            ? '동적 필드 생성 중…'
            : dynamicFields.length > 0
              ? '🔄 동적 필드 다시 생성'
              : '✨ 동적 필드 생성'}
        </button>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            <p>{error}</p>
            <button onClick={handleGenerate} className="mt-1 font-semibold underline">
              다시 시도
            </button>
            <p className="mt-1 text-red-400">
              계속 실패하면 아래에서 필드를 직접 추가하세요.
            </p>
          </div>
        )}

        {dynamicFields.length > 0 && (
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-slate-600">동적 필드</span>
            {dynamicFields.map((field) => (
              <div key={field.id} className="group">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{field.label}</span>
                  <button
                    onClick={() => removeField(field.id)}
                    className="invisible text-[10px] text-slate-300 hover:text-red-500 group-hover:visible"
                    aria-label={`${field.label} 필드 삭제`}
                  >
                    삭제
                  </button>
                </div>
                <DynamicFieldInput
                  field={field}
                  onChange={(value) => setDynamicFieldValue(workspace.id, field.id, value)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 pt-3">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            필드 직접 추가
          </span>
          <div className="flex gap-1.5">
            <input
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
              placeholder="필드 이름"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
            />
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value as DynamicFieldType)}
              className="rounded-md border border-slate-300 px-1 py-1 text-xs"
            >
              <option value="text">한 줄</option>
              <option value="multiline">여러 줄</option>
              <option value="number">숫자</option>
            </select>
            <button
              onClick={handleManualAdd}
              disabled={!manualLabel.trim()}
              className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function DynamicFieldInput({
  field,
  onChange,
}: {
  field: DynamicField
  onChange: (value: string) => void
}) {
  const base =
    'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none'

  switch (field.type) {
    case 'multiline':
      return (
        <textarea
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={`${base} resize-y`}
        />
      )
    case 'select':
      return (
        <select value={field.value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="" disabled>
            선택하세요
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'number':
      return (
        <input
          type="number"
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )
    default:
      return (
        <input value={field.value} onChange={(e) => onChange(e.target.value)} className={base} />
      )
  }
}
