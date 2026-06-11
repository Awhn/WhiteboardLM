import { csvHandler } from './handlers/csv'
import { pdfHandler } from './handlers/pdf'
import type { FileHandler } from './types'

/**
 * 파일 포맷 핸들러 레지스트리.
 * 새 포맷 지원 = 핸들러 모듈 작성 + 여기에 한 줄 추가.
 */
export const FILE_HANDLERS: FileHandler[] = [pdfHandler, csvHandler]

export function findHandlerForFile(file: File): FileHandler | undefined {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  return FILE_HANDLERS.find(
    (h) => h.mimeTypes.includes(file.type) || h.extensions.includes(ext),
  )
}

export const getHandlerById = (id: string): FileHandler | undefined =>
  FILE_HANDLERS.find((h) => h.id === id)

/** <input type=file>의 accept 속성 값 */
export const ACCEPT_ATTRIBUTE = FILE_HANDLERS.flatMap((h) => [
  ...h.extensions,
  ...h.mimeTypes,
]).join(',')

/** 지원 포맷 안내 문구 (오류 메시지 등) */
export const SUPPORTED_LABEL = FILE_HANDLERS.map((h) => h.label).join(', ')
