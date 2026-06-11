"""DB 엔진/세션. 운영은 PostgreSQL(DATABASE_URL), 개발·테스트는 SQLite 폴백."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./whiteboardlm.db")

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
