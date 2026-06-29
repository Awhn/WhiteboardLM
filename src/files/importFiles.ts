import { useBoardStore } from '../board/boardStore'
import { findHandlerForFile, SUPPORTED_LABEL } from './registry'

/** localStorage 영속화를 고려한 파일 크기 한도 */
const MAX_FILE_SIZE = 3 * 1024 * 1024

export interface ImportResult {
  imported: number
  errors: string[]
}

/**
 * 외부 파일들을 캔버스로 가져온다 (Padlet 스타일).
 * 각 파일은 기본적으로 context 타입 작업공간 노드가 되며, 본문에 파일 뷰어가 표시된다.
 */
export async function importFilesToBoard(
  files: Iterable<File>,
  position?: { x: number; y: number },
): Promise<ImportResult> {
  const store = useBoardStore.getState()
  const errors: string[] = []
  let imported = 0

  for (const file of files) {
    const handler = findHandlerForFile(file)
    if (!handler) {
      errors.push(`「${file.name}」: 지원하지 않는 형식입니다. (지원: ${SUPPORTED_LABEL})`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(
        `「${file.name}」: ${(file.size / 1024 / 1024).toFixed(1)}MB — 한도(3MB)를 초과합니다.`,
      )
      continue
    }
    try {
      const attachment = await handler.parse(file)
      store.addWorkspace({
        name: file.name,

        attachment,
        declaration: {
          purpose: `외부 ${handler.label} 파일: ${file.name}`,
          dynamicFields: [],
        },
        // 여러 파일을 동시에 떨어뜨리면 살짝 어긋나게 배치
        position: position && {
          x: position.x + imported * 40,
          y: position.y + imported * 40,
        },
      })
      store.logBoard(`파일 가져오기: ${handler.icon} ${file.name} → 컨텍스트 작업공간`)
      imported++
    } catch (e) {
      errors.push(`「${file.name}」: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { imported, errors }
}
