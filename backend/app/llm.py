"""Anthropic API 서버사이드 프록시 (M15) — 클라이언트의 키 노출을 막는다.

ANTHROPIC_API_KEY가 없으면 503을 반환하고, 프런트엔드는 스텁 LLM으로 폴백한다.
비스트리밍 messages.create 사용 (생성물이 짧아 스트리밍 불필요).
"""

import json
import os

import anthropic
from fastapi import HTTPException

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY가 설정되지 않았습니다. 프런트엔드 스텁으로 폴백하세요.",
        )
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _text(response: anthropic.types.Message) -> str:
    if response.stop_reason == "refusal":
        raise HTTPException(status_code=502, detail="모델이 요청을 거부했습니다.")
    return "".join(b.text for b in response.content if b.type == "text")


def generate_dynamic_fields(name: str, ws_type: str, purpose: str) -> list[dict]:
    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=(
            "당신은 선언형 작업 정의 도우미다. 작업공간의 목적을 보고, 작업을 정확히 "
            "정의하기 위해 추가로 받아야 할 입력 필드를 JSON 배열로만 출력한다. "
            '각 원소: {"id": string, "label": string, "type": "text"|"select"|"multiline"|"number", '
            '"options": string[]|null, "value": ""}. 3~5개. JSON 외 다른 텍스트 금지.'
        ),
        messages=[
            {
                "role": "user",
                "content": f"작업공간 이름: {name}\n타입: {ws_type}\n목적: {purpose}",
            }
        ],
    )
    try:
        fields = json.loads(_text(response))
        assert isinstance(fields, list)
        return fields
    except (json.JSONDecodeError, AssertionError) as e:
        raise HTTPException(status_code=502, detail=f"LLM 출력 파싱 실패: {e}") from e


def generate_checklist(name: str, ws_type: str, purpose: str, fields: list[dict]) -> list[str]:
    client = get_client()
    field_text = "\n".join(f"- {f.get('label')}: {f.get('value')}" for f in fields)
    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=(
            "당신은 작업 계획 도우미다. 선언형 정의를 보고 실행 체크리스트를 만든다. "
            "각 줄은 '[AI] 제목', '[인간] 제목', '[승인] 제목' 중 하나의 형식. "
            "4~7줄, 줄바꿈으로 구분, 다른 텍스트 금지. 마지막 줄은 반드시 [승인] 항목."
        ),
        messages=[
            {
                "role": "user",
                "content": f"작업공간: {name} ({ws_type})\n목적: {purpose}\n동적 필드:\n{field_text}",
            }
        ],
    )
    return [line for line in _text(response).splitlines() if line.strip()]


def execute_item(req_title: str, ws_name: str, purpose: str, comment: str | None,
                 context: str | None, tool_result: str | None) -> str:
    client = get_client()
    parts = [f"작업공간: {ws_name}", f"목적: {purpose}", f"수행할 단계: {req_title}"]
    if comment:
        parts.append(f"반려 코멘트(반드시 반영): {comment}")
    if context:
        parts.append(f"엣지 그래프 컨텍스트:\n{context}")
    if tool_result:
        parts.append(f"도구 실행 결과:\n{tool_result}")
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=(
            "당신은 WhiteboardLM의 실행 에이전트다. 주어진 체크리스트 단계를 수행한 "
            "결과물을 마크다운으로 작성한다. 결과물 본문만 출력한다."
        ),
        messages=[{"role": "user", "content": "\n\n".join(parts)}],
    )
    return _text(response)
