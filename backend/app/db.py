"""DB 엔진/세션. 운영은 PostgreSQL(DATABASE_URL), 개발·테스트는 SQLite 폴백."""

import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

logger = logging.getLogger("whiteboardlm")

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./whiteboardlm.db")

# Cloud Run 등 stateless 환경에서 파일 SQLite는 인스턴스 재시작/스케일아웃 시 사라진다.
# DATABASE_URL을 주지 않으면 보드 영속화가 비내구성임을 부팅 시 경고한다.
# (LLM 프록시 기능은 DB 없이도 정상 동작하므로 치명적 오류는 아니다.)
if "DATABASE_URL" not in os.environ:
    logger.warning(
        "DATABASE_URL 미설정 — SQLite 폴백(%s) 사용. 무상태 호스팅(Cloud Run 등)에서는 "
        "보드 저장이 비내구성입니다. 영속화하려면 DATABASE_URL에 관리형 Postgres(Neon/Supabase 등)를 지정하세요.",
        DATABASE_URL,
    )

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# 인메모리 SQLite(테스트)는 커넥션마다 DB가 분리되므로 단일 커넥션을 공유한다
pool_kwargs = {"poolclass": StaticPool} if DATABASE_URL in ("sqlite://", "sqlite:///:memory:") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
