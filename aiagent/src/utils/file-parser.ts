import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

export interface MulterFile {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

export async function parseFileContent(file: MulterFile): Promise<string> {
  const ext = file.originalname.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') {
    const pdfParser = new PDFParse({ data: file.buffer })
    try {
      const pdfData = await pdfParser.getText()
      return pdfData.text
    } finally {
      await pdfParser.destroy()
    }
  } else if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer })
    return result.value
  } else {
    return file.buffer.toString('utf-8')
  }
}
