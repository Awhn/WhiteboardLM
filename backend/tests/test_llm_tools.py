"""LiteLLM 프록시 — 도구 레지스트리·function calling 루프·멀티 프로바이더 키 검사."""

import json
import os
import sys
from types import SimpleNamespace

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ.pop("OPENAI_API_KEY", None)
os.environ.pop("LLM_MODEL", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import llm  # noqa: E402
from app.main import app  # noqa: E402
from app.tools import run_tool  # noqa: E402

client = TestClient(app)


def test_run_python_tool():
    result = run_tool("run_python", {"code": "print(6 * 7)"})
    assert "42" in result
    assert "exit code: 0" in result


def test_run_python_tool_error_is_captured():
    result = run_tool("run_python", {"code": "raise ValueError('boom')"})
    assert "boom" in result
    assert "exit code: 1" in result


def test_unknown_tool():
    assert "등록되지 않은 도구" in run_tool("nope", {})


def _msg(content=None, tool_calls=None):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content, tool_calls=tool_calls))]
    )


def _tool_call(call_id: str, name: str, arguments: dict):
    return SimpleNamespace(
        id=call_id,
        function=SimpleNamespace(name=name, arguments=json.dumps(arguments)),
    )


def test_execute_item_tool_loop(monkeypatch):
    """1차 응답: run_python 호출 → 도구 실행 결과를 먹인 2차 응답: 최종 텍스트."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    responses = [
        _msg(tool_calls=[_tool_call("tc-1", "run_python", {"code": "print(2 ** 10)"})]),
        _msg(content="계산 결과는 1024입니다."),
    ]
    captured: list[list[dict]] = []

    def fake_completion(messages, **kwargs):
        captured.append([dict(m) for m in messages])
        return responses.pop(0)

    monkeypatch.setattr(llm, "_completion", fake_completion)

    result, trace = llm.execute_item("계산 단계", "워크스페이스", "검증", None, None, None)
    assert result == "계산 결과는 1024입니다."
    assert trace[0]["tool"] == "run_python"
    assert "1024" in trace[0]["result"]
    # 2차 호출의 히스토리에 assistant tool_calls + tool 결과가 포함
    second = captured[1]
    assert any(m.get("role") == "assistant" and m.get("tool_calls") for m in second)
    assert any(m.get("role") == "tool" and "1024" in m.get("content", "") for m in second)


def test_execute_endpoint_returns_tool_trace(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    responses = [
        _msg(tool_calls=[_tool_call("tc-1", "run_python", {"code": "print('ok')"})]),
        _msg(content="완료"),
    ]
    monkeypatch.setattr(llm, "_completion", lambda messages, **kw: responses.pop(0))

    res = client.post(
        "/api/llm/execute", json={"title": "t", "workspaceName": "w", "purpose": "p"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["result"] == "완료"
    assert body["toolTrace"][0]["tool"] == "run_python"


def test_503_names_required_key_per_provider(monkeypatch):
    # 기본(anthropic) 모델 → ANTHROPIC_API_KEY 안내
    res = client.post(
        "/api/llm/dynamic-fields", json={"name": "a", "type": "output", "purpose": "b"}
    )
    assert res.status_code == 503
    assert "ANTHROPIC_API_KEY" in res.json()["detail"]

    # openai 모델로 전환 → OPENAI_API_KEY 안내
    monkeypatch.setenv("LLM_MODEL", "openai/gpt-4o-mini")
    res = client.post(
        "/api/llm/dynamic-fields", json={"name": "a", "type": "output", "purpose": "b"}
    )
    assert res.status_code == 503
    assert "OPENAI_API_KEY" in res.json()["detail"]

    # gemini 모델 → GEMINI_API_KEY 안내
    monkeypatch.setenv("LLM_MODEL", "gemini/gemini-2.5-pro")
    res = client.post(
        "/api/llm/dynamic-fields", json={"name": "a", "type": "output", "purpose": "b"}
    )
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["detail"]


def test_strip_fences():
    assert llm._strip_fences('```json\n[{"a": 1}]\n```') == '[{"a": 1}]'
    assert llm._strip_fences('[{"a": 1}]') == '[{"a": 1}]'
