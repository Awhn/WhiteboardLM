"""서버사이드 Agent 도구 레지스트리 (M12).

LiteLLM이 정규화하는 OpenAI 스타일 function calling으로 모든 프로바이더
(Anthropic/OpenAI/Gemini)에서 동일하게 동작한다.
새 도구 = @tool 데코레이터로 함수 하나 추가.
"""

import json
import subprocess
import sys
from collections.abc import Callable

_REGISTRY: dict[str, Callable[..., str]] = {}
TOOL_SPECS: list[dict] = []

MAX_OUTPUT = 4000


def tool(name: str, description: str, parameters: dict):
    """함수를 LLM 도구로 등록한다."""

    def decorator(fn: Callable[..., str]):
        _REGISTRY[name] = fn
        TOOL_SPECS.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": description,
                    "parameters": parameters,
                },
            }
        )
        return fn

    return decorator


def run_tool(name: str, arguments: dict) -> str:
    fn = _REGISTRY.get(name)
    if fn is None:
        return f"오류: 등록되지 않은 도구 '{name}'"
    try:
        result = fn(**arguments)
    except TypeError as e:
        return f"오류: 잘못된 인자 — {e}"
    except Exception as e:  # 도구 실패가 루프 전체를 죽이지 않도록
        return f"오류: {e}"
    return result[:MAX_OUTPUT]


@tool(
    "run_python",
    "파이썬 코드를 실행하고 stdout/stderr를 반환한다. 계산, 데이터 변환, 검증에 사용. "
    "결과는 반드시 print()로 출력해야 한다.",
    {
        "type": "object",
        "properties": {
            "code": {"type": "string", "description": "실행할 파이썬 코드"},
        },
        "required": ["code"],
    },
)
def run_python(code: str) -> str:
    """프로토타입용 코드 실행 — 타임아웃 10초. 운영 배포 시 컨테이너 격리 필요."""
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        return "오류: 실행 시간 초과 (10초)"
    parts = []
    if proc.stdout:
        parts.append(f"stdout:\n{proc.stdout}")
    if proc.stderr:
        parts.append(f"stderr:\n{proc.stderr}")
    parts.append(f"exit code: {proc.returncode}")
    return "\n".join(parts)


def tool_specs_json() -> str:
    return json.dumps(TOOL_SPECS, ensure_ascii=False)
