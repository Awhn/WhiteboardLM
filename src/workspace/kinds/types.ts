import type { ComponentType } from 'react'
import type { NodeKind, Workspace } from '../types'

/** 노드 본문 컴포넌트가 받는 공통 props */
export interface NodeBodyProps {
  workspace: Workspace
  /** editable 카인드에서만 의미 있음 */
  editing: boolean
  onEditingChange: (editing: boolean) => void
}

/**
 * 노드 카인드 정의 — 파일 핸들러(FileHandler)와 동일한 모듈식 레지스트리 패턴.
 * 새 노드 종류 = 정의 객체 하나 작성 + registry 배열에 추가.
 */
export interface NodeKindDefinition {
  id: NodeKind
  label: string
  icon: string
  description: string
  /** (구) 선언형 실행 참여 여부 — v2에서는 항상 false (P4 잔재, 제거 예정) */
  declarative: boolean
  /** 사용자가 본문 내용을 바꿀 수 있는가 (컨텍스트·AI 잠금 판단에 사용) */
  editable: boolean
  /**
   * 헤더 ✏️ 보기/편집 토글을 쓰는가.
   * true = 더블클릭 보기/편집 전환(declarative·note), false = 본문이 항상-편집형(code) 또는 비편집(file·web)
   */
  usesEditToggle: boolean
  /**
   * source 엣지로 연결됐을 때 AI가 읽을 전체 내용 (M11).
   * 라벨까지 포함한 detail 문자열을 반환하며, 비어 있으면 null.
   */
  getContextText?: (ws: Workspace) => string | null
  /** 노드 본문 렌더러 (뷰어/에디터를 소유) */
  Body: ComponentType<NodeBodyProps>
  /** 생성 시 병합할 기본 필드 */
  createInitial?: () => Partial<Workspace>
}
