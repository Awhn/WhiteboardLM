FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# 비루트 사용자로 실행 (컨테이너 하드닝)
RUN useradd --create-home --uid 10001 appuser
USER appuser

# Cloud Run은 $PORT(기본 8080)를 주입하고 해당 포트로 헬스 프로브를 보낸다.
# exec form CMD는 ${PORT}를 확장하지 않으므로 sh -c 래퍼가 필요하다. EXPOSE는 정보용.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
