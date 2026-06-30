"""서버사이드 Agent 도구 레지스트리 (M12).

LiteLLM이 정규화하는 OpenAI 스타일 function calling으로 모든 프로바이더
(Anthropic/OpenAI/Gemini)에서 동일하게 동작한다.
새 도구 = @tool 데코레이터로 함수 하나 추가.
"""

import json
import os
import subprocess
import sys
from collections.abc import Callable

_REGISTRY: dict[str, Callable[..., str]] = {}
TOOL_SPECS: list[dict] = []

MAX_OUTPUT = 4000
MAX_CODE_LEN = 10_000

# 코드 실행 도구는 임의 파이썬을 실행하므로(공개 엔드포인트 = RCE 위험)
# 기본 비활성. ENABLE_RUN_PYTHON=1 일 때만 등록한다.
ENABLE_RUN_PYTHON = os.environ.get("ENABLE_RUN_PYTHON", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# 자식 프로세스에 넘길 환경변수 화이트리스트 — API 키/DATABASE_URL 등 비밀 유출 차단
_SUBPROCESS_ENV_ALLOWLIST = ("PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "PYTHONPATH")


def _scrubbed_env() -> dict[str, str]:
    return {k: os.environ[k] for k in _SUBPROCESS_ENV_ALLOWLIST if k in os.environ}


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


_RUN_PYTHON_SPEC = (
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
    """프로토타입용 코드 실행 — 타임아웃 10초, 비밀 제거 환경, 길이 제한.

    공개·무인증 엔드포인트에서 도달 가능하므로 ENABLE_RUN_PYTHON 으로만 노출된다.
    """
    if len(code) > MAX_CODE_LEN:
        return f"오류: 코드가 너무 깁니다 (최대 {MAX_CODE_LEN}자)"
    try:
        proc = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=10,
            env=_scrubbed_env(),
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


def register_run_python() -> None:
    """run_python 도구를 멱등하게 등록한다 (테스트·명시적 활성화에서 호출)."""
    if "run_python" in _REGISTRY:
        return
    tool(*_RUN_PYTHON_SPEC)(run_python)


if ENABLE_RUN_PYTHON:
    register_run_python()


def tool_specs_json() -> str:
    return json.dumps(TOOL_SPECS, ensure_ascii=False)
