import { ipcMain, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getDatasetAnnotations, listDatasets } from '../db'

function parseGroups(raw: string | null): any[] { if (!raw) return []; try { const p = JSON.parse(raw); return Array.isArray(p) ? p.slice(0, 4) : [] } catch { return [] } }
function buildGroupIdMap(groups: any[]): Map<string, string> { return new Map(groups.map((g, i) => [g.name || String(i + 1), g.id || String(i + 1)])) }
function groupIdOf(m: Map<string, string>, name: string): string { return typeof name === 'string' ? m.get(name) || name : '' }
function exportShape(s: any, m: Map<string, string>) { const { group, current, ...rest } = s; return { ...rest, group_id: groupIdOf(m, group ?? '') } }
function csv(v: unknown): string { return `"${(v == null ? '' : String(v)).replace(/"/g, '""')}"` }
function parseShapes(raw: string): any[] { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }

export function registerExportIpcHandlers(): void {
  ipcMain.handle('annotation:export', async (_e, datasetId: number, format: string) => {
    const rows = getDatasetAnnotations(datasetId).map((row: any) => ({ ...row, parsedShapes: parseShapes(row.shapes) })).filter((row: any) => row.parsedShapes.length > 0)
    const groupMap = buildGroupIdMap(parseGroups(listDatasets().find(d => d.id === datasetId)?.groups ?? null))
    const saveResult = await dialog.showSaveDialog({ filters: [...(format === 'json' ? [{ name: 'JSON', extensions: ['json'] }] : []), ...(format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [])] })
    if (saveResult.canceled || !saveResult.filePath) return
    if (format === 'json') {
      writeFileSync(saveResult.filePath, JSON.stringify(rows.map(r => ({ image_md5: r.image_md5 || String(r.image_id), image_name: r.image_name, shapes: r.parsedShapes.map((s: any) => exportShape(s, groupMap)), meta: JSON.parse(r.meta) })), null, 2), 'utf-8')
    } else {
      const lines = ['image_md5,image_name,shape_type,group_id,x,y,w,h,rotation,points']
      for (const row of rows) {
        for (const shape of row.parsedShapes) {
          const base = `${csv(row.image_md5 || String(row.image_id))},${csv(row.image_name)},${csv(shape.type)},${csv(groupIdOf(groupMap, shape.group))}`
          if (shape.type === 'rect') lines.push(`${base},${shape.x},${shape.y},${shape.w},${shape.h},${shape.rotation ?? 0},`)
          else if (shape.type === 'point') lines.push(`${base},${shape.x},${shape.y},,,,,`)
          else if ('points' in shape) lines.push(`${base},,,,,,${csv(shape.points.map((p: any) => `${p.x},${p.y}`).join(';'))}`)
        }
      }
      writeFileSync(saveResult.filePath, '\uFEFF' + lines.join('\n'), 'utf-8')
    }
  })
}
