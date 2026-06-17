import { WorkspaceContent } from '../WorkspaceContent'
import { FileViewer } from '../../files/FileViewer'
import type { NodeBodyProps } from './types'

/** 마크다운/텍스트 콘텐츠 본문 (declarative · note 공용) */
export function ContentBody({ workspace, editing, onEditingChange }: NodeBodyProps) {
  return (
    <WorkspaceContent
      workspace={workspace}
      editing={editing}
      onEditingChange={onEditingChange}
    />
  )
}

/** 외부 파일 뷰어 본문 */
export function FileBody({ workspace }: NodeBodyProps) {
  if (!workspace.attachment) {
    return (
      <div className="nodrag flex-1 p-3 text-xs italic text-slate-400">
        첨부 파일이 없습니다.
      </div>
    )
  }
  return <FileViewer attachment={workspace.attachment} />
}
