import type { FileAttachment, FileHandler } from '../types'

interface PdfData {
  dataUrl: string
}

function PdfViewer({ attachment }: { attachment: FileAttachment }) {
  const { dataUrl } = attachment.data as PdfData
  return (
    <iframe
      src={dataUrl}
      title={attachment.fileName}
      className="h-full w-full border-0"
      data-testid="pdf-viewer"
    />
  )
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

export const pdfHandler: FileHandler = {
  id: 'pdf',
  label: 'PDF',
  icon: '📕',
  extensions: ['.pdf'],
  mimeTypes: ['application/pdf'],
  parse: async (file) => {
    const dataUrl = await readAsDataUrl(file)
    return {
      handlerId: 'pdf',
      fileName: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      data: { dataUrl } satisfies PdfData,
      // 텍스트 추출은 추후 pdfjs 도입 시 핸들러만 교체하면 된다
      textContent: `PDF 파일 「${file.name}」 (${(file.size / 1024).toFixed(0)}KB). 원문은 노드 뷰어에서 확인 가능.`,
    }
  },
  Viewer: PdfViewer,
}
