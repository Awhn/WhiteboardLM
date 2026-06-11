import { getHandlerById } from './registry'
import type { FileAttachment } from './types'

/** 첨부 파일을 핸들러의 뷰어로 렌더링하는 디스패처 */
export function FileViewer({ attachment }: { attachment: FileAttachment }) {
  const handler = getHandlerById(attachment.handlerId)

  return (
    <div className="nodrag nowheel flex min-h-0 flex-1 flex-col" data-testid="file-viewer">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
        <span>{handler?.icon ?? '📄'}</span>
        <span className="truncate font-medium">{attachment.fileName}</span>
        <span className="ml-auto shrink-0">{(attachment.size / 1024).toFixed(0)}KB</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {handler ? (
          <handler.Viewer attachment={attachment} />
        ) : (
          <p className="p-3 text-xs italic text-slate-400">
            알 수 없는 파일 형식입니다 ({attachment.handlerId}).
          </p>
        )}
      </div>
    </div>
  )
}
