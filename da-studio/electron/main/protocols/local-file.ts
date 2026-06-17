import { protocol, net } from 'electron'
import { existsSync } from 'fs'
import { isAbsolute, relative, resolve, sep } from 'path'
import { platform } from 'process'
import { fileURLToPath } from 'url'
import { getUploadDir } from '../storage'

export function registerLocalFileProtocol(): void {
  protocol.handle('local-file', (request) => {
    const fp = localFileUrlToPath(request.url)
    if (!fp) return new Response('Bad Request', { status: 400 })
    if (!isInsideUploadDir(fp)) return new Response('Forbidden', { status: 403 })
    if (existsSync(fp)) return net.fetch(request.url.replace(/^local-file:/, 'file:'))
    return new Response('Not Found', { status: 404 })
  })
}
function localFileUrlToPath(url: string): string | null {
  try {
    return fileURLToPath(url.replace(/^local-file:/, 'file:'))
  } catch {
    return null
  }
}
function isInsideUploadDir(fp: string): boolean {
  const rel = relative(normalize(resolve(getUploadDir())), normalize(resolve(fp)))
  return Boolean(rel) && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}
function normalize(p: string): string {
  return platform === 'win32' ? p.toLowerCase() : p
}
