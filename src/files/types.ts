import type { ComponentType } from 'react'

/** 작업공간에 첨부된 외부 파일 (직렬화 가능 — localStorage/DB 저장 대상) */
export interface FileAttachment {
  /** 파싱·렌더링을 담당하는 핸들러 id (registry에서 조회) */
  handlerId: string
  fileName: string
  mimeType: string
  size: number
  /** 핸들러별 파싱 결과 (CSV: 표 데이터, PDF: data URL 등) */
  data: unknown
  /**
   * 컨텍스트 로딩(M11)용 텍스트 추출본 — source 엣지로 연결되면
   * 포인터가 이 텍스트를 읽는다. 추출 불가 포맷은 메타데이터 요약.
   */
  textContent: string
}

/**
 * 파일 포맷 핸들러 — 새 포맷은 이 인터페이스를 구현해 registry에 등록만 하면 된다.
 * (파서와 뷰어가 한 모듈에 묶임)
 */
export interface FileHandler {
  id: string
  label: string
  icon: string
  /** 소문자 확장자 목록 (점 포함, 예: '.csv') */
  extensions: string[]
  mimeTypes: string[]
  /** File을 읽어 직렬화 가능한 첨부 데이터로 변환 */
  parse: (file: File) => Promise<FileAttachment>
  /** 노드 본문에 렌더링되는 간단한 뷰어 */
  Viewer: ComponentType<{ attachment: FileAttachment }>
}
