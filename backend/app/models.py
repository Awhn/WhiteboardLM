"""PostgreSQL 스키마 5종: Board / Workspace / Edge / ChecklistItem / Snapshot (M15).

선언형 정의·코멘트·활동 로그처럼 구조가 진화 중인 필드는 JSON 컬럼으로 두어
프런트엔드 도메인 모델과 1:1 매핑을 유지한다.
"""

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), default="기본 보드")
    pointer: Mapped[dict] = mapped_column(JSON, default=dict)
    board_log: Mapped[list] = mapped_column(JSON, default=list)

    workspaces: Mapped[list["Workspace"]] = relationship(
        cascade="all, delete-orphan", backref="board"
    )
    edges: Mapped[list["Edge"]] = relationship(
        cascade="all, delete-orphan", backref="board"
    )
    checklist_items: Mapped[list["ChecklistItem"]] = relationship(
        cascade="all, delete-orphan", backref="board"
    )
    snapshots: Mapped[list["Snapshot"]] = relationship(
        cascade="all, delete-orphan", backref="board"
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    board_id: Mapped[str] = mapped_column(ForeignKey("boards.id"), index=True)
    name: Mapped[str] = mapped_column(String(256))
    type: Mapped[str] = mapped_column(String(32))  # output | context | intermediate
    declaration: Mapped[dict] = mapped_column(JSON, default=dict)
    content: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[dict] = mapped_column(JSON, default=dict)
    size: Mapped[dict] = mapped_column(JSON, default=dict)
    access_granted: Mapped[bool] = mapped_column(Boolean, default=False)


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    board_id: Mapped[str] = mapped_column(ForeignKey("boards.id"), index=True)
    source: Mapped[str] = mapped_column(String(64))
    target: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(32))  # reference | source | update | validate
    hop_limit: Mapped[int] = mapped_column(Integer, default=1)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    board_id: Mapped[str] = mapped_column(ForeignKey("boards.id"), index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(Text)
    tag: Mapped[str] = mapped_column(String(32))  # AI | human | approval | blocking | permission
    status: Mapped[str] = mapped_column(String(32))  # pending | staged | committed
    assignee: Mapped[str | None] = mapped_column(String(128), nullable=True)
    related_workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    comments: Mapped[list] = mapped_column(JSON, default=list)
    activity_log: Mapped[list] = mapped_column(JSON, default=list)
    order: Mapped[int] = mapped_column(Integer, default=0)


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    board_id: Mapped[str] = mapped_column(ForeignKey("boards.id"), index=True)
    workspace_id: Mapped[str] = mapped_column(String(64), index=True)
    checklist_item_id: Mapped[str] = mapped_column(String(64))
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[str] = mapped_column(String(64))
