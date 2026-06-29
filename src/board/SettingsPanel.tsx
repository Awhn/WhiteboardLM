import { useState } from 'react'
import { useLLMConfig } from '../llm/config'

const MODEL_PRESETS = [
  { value: '', label: '서버 기본값 사용' },
  { value: 'anthropic/claude-opus-4-8', label: 'Anthropic · Claude Opus 4.8' },
  { value: 'anthropic/claude-haiku-4-5', label: 'Anthropic · Claude Haiku 4.5' },
  { value: 'openai/gpt-4o', label: 'OpenAI · GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI · GPT-4o mini' },
  { value: 'gemini/gemini-2.5-pro', label: 'Google · Gemini 2.5 Pro' },
  { value: 'gemini/gemini-2.5-flash', label: 'Google · Gemini 2.5 Flash' },
]

/**
 * 설정 탭: 백엔드 주소 + 모델 + API 키.
 * API 키는 브라우저(localStorage)에 저장되어 요청 헤더로 백엔드에 전달된다(서버 env보다 우선).
 * 백엔드 미설정 또는 키 미입력 시 스텁 LLM으로 동작한다.
 */
export function SettingsPanel() {
  const { apiBase, model, apiKey, localMode, endpoint, setConfig } = useLLMConfig()
  const [showKey, setShowKey] = useState(false)

  const isCustomModel = !MODEL_PRESETS.some((p) => p.value === model)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white" data-testid="settings-panel">
      <header className="border-b border-slate-200 px-4 py-2.5">
        <h2 className="text-sm font-bold text-slate-800">⚙️ LLM 설정</h2>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* 로컬 모드 토글 */}
        <div className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2">
          <button
            role="switch"
            aria-checked={localMode}
            aria-label="로컬 모드"
            onClick={() => setConfig({ localMode: !localMode })}
            data-testid="settings-localmode"
            className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
              localMode ? 'bg-indigo-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                localMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <div className="min-w-0 text-[11px] leading-snug">
            <p className="font-semibold text-slate-700">브라우저에서 직접 호출 (로컬 모드)</p>
            <p className="text-slate-400">
              백엔드 없이 브라우저가 프로바이더 API를 직접 호출합니다. 도구(코드 실행 등)는
              미지원이며, 키가 브라우저에서 직접 전송됩니다.
            </p>
          </div>
        </div>

        <div
          className={`rounded-md px-3 py-2 text-[11px] leading-snug ${
            localMode
              ? apiKey
                ? 'bg-indigo-50 text-indigo-700'
                : 'bg-amber-50 text-amber-700'
              : apiBase
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {localMode
            ? apiKey
              ? '로컬 모드: 브라우저에서 직접 호출합니다 (백엔드 불필요).'
              : '로컬 모드 ON — 아래에 프로바이더 API 키를 입력하세요. 없으면 스텁 폴백.'
            : apiBase
              ? '백엔드 프록시 사용 중. 키가 없으면 서버 env → 그래도 없으면 스텁 폴백.'
              : '백엔드 주소가 없어 스텁(데모)으로 동작합니다. 백엔드 주소를 넣거나 로컬 모드를 켜세요.'}
        </div>

        {!localMode && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">백엔드 주소</span>
            <input
              value={apiBase}
              onChange={(e) => setConfig({ apiBase: e.target.value.trim() })}
              placeholder="http://localhost:8000"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              data-testid="settings-apibase"
            />
          </label>
        )}

        {localMode && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">
              엔드포인트 (선택)
            </span>
            <input
              value={endpoint}
              onChange={(e) => setConfig({ endpoint: e.target.value.trim() })}
              placeholder="http://localhost:11434 (Ollama·LM Studio 등)"
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              data-testid="settings-endpoint"
            />
            <p className="mt-1 text-[10px] leading-snug text-slate-400">
              경로가 아닌 <b>베이스 URL</b>만 입력하세요 (예: <code>http://localhost:11434</code>).
              <code>/v1/chat/completions</code>는 자동으로 붙습니다. 접두사 없는 모델명은 OpenAI 호환
              API로 호출하며, <code>anthropic/…</code>·<code>gemini/…</code>를 쓰면 해당 형식으로 보냅니다.
              <br />
              ⚠️ 브라우저 직접 호출이라 대상 서버가 <b>CORS</b>를 허용해야 합니다(Ollama는{' '}
              <code>OLLAMA_ORIGINS</code> 설정). 차단되면 로컬 모드를 끄고 백엔드 프록시를 사용하세요.
            </p>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">모델</span>
          <select
            value={isCustomModel ? '__custom__' : model}
            onChange={(e) => {
              if (e.target.value !== '__custom__') setConfig({ model: e.target.value })
            }}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            data-testid="settings-model"
          >
            {MODEL_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            {isCustomModel && <option value="__custom__">사용자 지정: {model}</option>}
          </select>
          <input
            value={model}
            onChange={(e) => setConfig({ model: e.target.value.trim() })}
            placeholder="예: anthropic/claude-opus-4-8 (LiteLLM 모델 문자열)"
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] focus:border-blue-400 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">API 키</span>
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setConfig({ apiKey: e.target.value.trim() })}
              placeholder="sk-... (선택한 모델의 프로바이더 키)"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              data-testid="settings-apikey"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="rounded-md border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50"
            >
              {showKey ? '숨김' : '보기'}
            </button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-400">
            {localMode
              ? '로컬 모드: 키가 브라우저에서 프로바이더로 직접 전송됩니다. 공용 PC 주의.'
              : '키는 이 브라우저에만 저장되어 요청 헤더로 백엔드에 전달됩니다(서버 env보다 우선).'}
          </p>
        </label>

        {apiKey && (
          <button
            onClick={() => setConfig({ apiKey: '' })}
            className="text-[11px] font-medium text-red-500 hover:underline"
          >
            저장된 키 삭제
          </button>
        )}

        <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          현재 상태:{' '}
          <span className={localMode && apiKey ? 'font-semibold text-indigo-600' : apiBase ? 'font-semibold text-emerald-600' : ''}>
            {localMode
              ? apiKey
                ? '로컬 모드 · 브라우저 직접 호출'
                : '로컬 모드(키 없음) · 스텁'
              : apiBase
                ? apiKey
                  ? '백엔드 · 키 전달'
                  : '백엔드 · 서버 env 키'
                : '스텁'}
          </span>
        </div>
      </div>
    </div>
  )
}
