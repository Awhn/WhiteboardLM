"""LLM 서버사이드 프록시 (M15) — LiteLLM 기반 멀티 프로바이더.

LLM_MODEL env로 프로바이더/모델 선택 (LiteLLM 모델 문자열):
  anthropic/claude-opus-4-8 (기본) · openai/gpt-5.2 · gemini/gemini-3-pro 등
해당 프로바이더의 API 키 env가 없으면 503을 반환하고, 프런트엔드는 스텁 LLM으로 폴백한다.

도구 호출은 LiteLLM이 정규화하는 OpenAI 스타일 function calling을 사용해
프로바이더와 무관하게 동일한 루프로 동작한다 (tools.py 레지스트리).
"""

import contextvars
import json
import os
import re

import litellm
from fastapi import HTTPException

from .tools import TOOL_SPECS, run_tool

DEFAULT_MODEL = "anthropic/claude-opus-4-8"
MAX_TOOL_ITERATIONS = 5

# LiteLLM 프로바이더 → 필요한 API 키 env
PROVIDER_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "vertex_ai": "GOOGLE_APPLICATION_CREDENTIALS",
    "azure": "AZURE_API_KEY",
}

# 요청별 오버라이드 (프런트 설정 패널 → X-LLM-Model / X-LLM-Api-Key 헤더)
_model_override: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "model_override", default=None
)
_api_key: contextvars.ContextVar[str | None] = contextvars.ContextVar("api_key", default=None)


def set_request_context(model: str | None, api_key: str | None) -> None:
    """엔드포인트에서 요청 헤더 기준으로 매 요청 설정 (없으면 None으로 리셋)."""
    _model_override.set(model or None)
    _api_key.set(api_key or None)


def current_model() -> str:
    override = _model_override.get()
    if override:
        return override
    legacy = os.environ.get("ANTHROPIC_MODEL")  # 구버전 env 호환
    return os.environ.get("LLM_MODEL") or (f"anthropic/{legacy}" if legacy else DEFAULT_MODEL)


def ensure_provider_key() -> str:
    """선택된 모델의 프로바이더 키가 없으면 503 → 프런트 스텁 폴백.

    사용자가 헤더로 키를 제공하면(요청 컨텍스트) env 검사를 건너뛴다.
    """
    model = current_model()
    try:
        _, provider, *_ = litellm.get_llm_provider(model)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"알 수 없는 모델 '{model}': {e}") from e
    if _api_key.get():
        return model
    key_env = PROVIDER_KEY_ENV.get(provider)
    if key_env and not os.environ.get(key_env):
        raise HTTPException(
            status_code=503,
            detail=f"{key_env}가 설정되지 않았습니다 (모델: {model}). 설정 패널에서 키를 입력하거나 스텁으로 폴백하세요.",
        )
    return model


def _completion(messages: list[dict], **kwargs) -> litellm.ModelResponse:
    api_key = _api_key.get()
    if api_key:
        kwargs.setdefault("api_key", api_key)
    return litellm.completion(model=current_model(), messages=messages, **kwargs)


def _strip_fences(text: str) -> str:
    """일부 모델이 JSON을 코드 펜스로 감싸는 경우 대비."""
    match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()


def propose_mission(
    capability: str, anchor_name: str, anchor_content: str, context: str, fallback: str
) -> str:
    ensure_provider_key()
    try:
        response = _completion(
            [
                {
                    "role": "system",
                    "content": (
                        f"당신은 다음 역량을 가진 에이전트다: {capability} "
                        "주어진 노드와 주변 컨텍스트를 보고, 지금 수행하면 좋을 작업을 "
                        "한국어 한 문장으로 제안한다. 따옴표·접두사·설명 없이 미션 문장만 출력."
                    ),
                },
                {
                    "role": "user",
                    "content": f"대상 노드: {anchor_name}\n내용:\n{anchor_content[:800]}\n\n주변:\n{context[:800]}",
                },
            ],
            max_tokens=256,
        )
        text = _text(response).strip().strip('"\'「」')
        return text or fallback
    except HTTPException:
        raise
    except Exception:
        return fallback


def generate_dynamic_fields(name: str, ws_type: str, purpose: str) -> list[dict]:
    ensure_provider_key()
    response = _completion(
        [
            {
                "role": "system",
                "content": (
                    "당신은 선언형 작업 정의 도우미다. 작업공간의 목적을 보고, 작업을 정확히 "
                    "정의하기 위해 추가로 받아야 할 입력 필드를 JSON 배열로만 출력한다. "
                    '각 원소: {"id": string, "label": string, "type": "text"|"select"|"multiline"|"number", '
                    '"options": string[]|null, "value": ""}. 3~5개. JSON 외 다른 텍스트 금지.'
                ),
            },
            {
                "role": "user",
                "content": f"작업공간 이름: {name}\n타입: {ws_type}\n목적: {purpose}",
            },
        ],
        max_tokens=2048,
    )
    text = response.choices[0].message.content or ""
    try:
        fields = json.loads(_strip_fences(text))
        assert isinstance(fields, list)
        return fields
    except (json.JSONDecodeError, AssertionError) as e:
        raise HTTPException(status_code=502, detail=f"LLM 출력 파싱 실패: {e}") from e


def generate_checklist(name: str, ws_type: str, purpose: str, fields: list[dict]) -> list[str]:
    ensure_provider_key()
    field_text = "\n".join(f"- {f.get('label')}: {f.get('value')}" for f in fields)
    response = _completion(
        [
            {
                "role": "system",
                "content": (
                    "당신은 작업 계획 도우미다. 선언형 정의를 보고 실행 체크리스트를 만든다. "
                    "각 줄은 '[AI] 제목', '[인간] 제목', '[승인] 제목' 중 하나의 형식. "
                    "4~7줄, 줄바꿈으로 구분, 다른 텍스트 금지. 마지막 줄은 반드시 [승인] 항목."
                ),
            },
            {
                "role": "user",
                "content": f"작업공간: {name} ({ws_type})\n목적: {purpose}\n동적 필드:\n{field_text}",
            },
        ],
        max_tokens=2048,
    )
    text = response.choices[0].message.content or ""
    return [line for line in text.splitlines() if line.strip()]


def execute_item(
    req_title: str,
    ws_name: str,
    purpose: str,
    comment: str | None,
    context: str | None,
    tool_result: str | None,
) -> tuple[str, list[dict]]:
    """체크리스트 항목 실행 — function calling 도구 루프 포함.

    반환: (결과 마크다운, 도구 호출 트레이스)
    """
    ensure_provider_key()
    parts = [f"작업공간: {ws_name}", f"목적: {purpose}", f"수행할 단계: {req_title}"]
    if comment:
        parts.append(f"반려 코멘트(반드시 반영): {comment}")
    if context:
        parts.append(f"엣지 그래프 컨텍스트:\n{context}")
    if tool_result:
        parts.append(f"클라이언트 도구 실행 결과:\n{tool_result}")

    messages: list[dict] = [
        {
            "role": "system",
            "content": (
                "당신은 WhiteboardLM의 실행 에이전트다. 주어진 체크리스트 단계를 수행한 "
                "결과물을 마크다운으로 작성한다. 계산·데이터 처리·검증이 필요하면 제공된 "
                "도구를 사용한다. 최종 응답은 결과물 본문만 출력한다."
            ),
        },
        {"role": "user", "content": "\n\n".join(parts)},
    ]

    trace: list[dict] = []
    for _ in range(MAX_TOOL_ITERATIONS):
        response = _completion(messages, max_tokens=4096, tools=TOOL_SPECS)
        msg = response.choices[0].message
        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            return msg.content or "", trace

        # 어시스턴트 턴(도구 호출 포함)을 dict로 재구성해 히스토리에 추가
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in tool_calls
                ],
            }
        )
        for tc in tool_calls:
            try:
                arguments = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                arguments = {}
            result = run_tool(tc.function.name, arguments)
            trace.append({"tool": tc.function.name, "arguments": arguments, "result": result})
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})

    raise HTTPException(status_code=502, detail="도구 호출 반복 한도(5회)를 초과했습니다.")
