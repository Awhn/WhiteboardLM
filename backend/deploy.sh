#!/usr/bin/env bash
#
# WhiteboardLM 백엔드 → Google Cloud Run 배포 (소스 기반, Dockerfile 사용)
#
# 사용법 (backend/ 디렉터리에서 실행):
#   PROJECT=my-gcp-project CORS_ORIGINS=https://whiteboardlm.pages.dev ./deploy.sh
#
# 선택 변수:
#   REGION   배포 리전        (기본: asia-northeast3 = 서울)
#   SERVICE  Cloud Run 서비스명 (기본: whiteboardlm-backend)
#   DATABASE_URL  관리형 Postgres URL (지정 시 보드 영속화; 생략 시 비내구성 SQLite)
#   ENABLE_RUN_PYTHON  true 로 주면 코드 실행 도구 활성화 (기본 비활성 — RCE 위험)
#
set -euo pipefail

PROJECT="${PROJECT:?GCP 프로젝트 ID를 PROJECT=... 로 지정하세요}"
REGION="${REGION:-asia-northeast3}"
SERVICE="${SERVICE:-whiteboardlm-backend}"
CORS_ORIGINS="${CORS_ORIGINS:-https://whiteboardlm.pages.dev}"

# 콤마가 포함된 값을 안전히 전달하기 위해 커스텀 구분자(@) 사용
ENV_VARS="^@^CORS_ALLOW_ORIGINS=${CORS_ORIGINS}"
[[ -n "${DATABASE_URL:-}" ]] && ENV_VARS="${ENV_VARS}@DATABASE_URL=${DATABASE_URL}"
[[ -n "${ENABLE_RUN_PYTHON:-}" ]] && ENV_VARS="${ENV_VARS}@ENABLE_RUN_PYTHON=${ENABLE_RUN_PYTHON}"

echo "▶ 배포: ${SERVICE} (project=${PROJECT}, region=${REGION})"
echo "  CORS_ALLOW_ORIGINS=${CORS_ORIGINS}"
echo "  DATABASE_URL=${DATABASE_URL:+<설정됨>}${DATABASE_URL:-<미설정: 비내구성 SQLite>}"
echo "  ENABLE_RUN_PYTHON=${ENABLE_RUN_PYTHON:-false}"

gcloud run deploy "${SERVICE}" \
  --source . \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "${ENV_VARS}"

echo "✅ 완료. 위 Service URL을 Cloudflare Pages의 빌드 환경변수 VITE_API_BASE 에 설정하세요."
# 서버 측 프로바이더 키를 쓰려면(제로-시크릿이 아닌 경우) Secret Manager 권장:
#   gcloud run services update "${SERVICE}" --region "${REGION}" \
#     --set-secrets ANTHROPIC_API_KEY=anthropic-key:latest
