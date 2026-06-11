import type { Workspace } from './types'

/**
 * 정의 완료 = 목적이 입력되고, 동적 필드가 생성되었으며, 모든 필드에 값이 채워진 상태.
 * 완료 시 체크리스트 자동 생성(M5)의 트리거가 된다.
 */
export function isDeclarationComplete(workspace: Workspace): boolean {
  const { purpose, dynamicFields } = workspace.declaration
  return (
    purpose.trim().length > 0 &&
    dynamicFields.length > 0 &&
    dynamicFields.every((f) => f.value.trim().length > 0)
  )
}
