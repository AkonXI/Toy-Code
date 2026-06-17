import { queryOne, run, queryAll } from '../connection'
export function getAnnotation(imageId: number) {
  return queryOne('SELECT * FROM annotations WHERE image_id = ?', [imageId])
}
export function saveAnnotation(imageId: number, shapes: string, meta: string): void {
  if (getAnnotation(imageId))
    run(
      "UPDATE annotations SET shapes = ?, meta = ?, updated_at = datetime('now') WHERE image_id = ?",
      [shapes, meta, imageId]
    )
  else
    run(
      "INSERT INTO annotations (image_id, shapes, meta, updated_at) VALUES (?, ?, ?, datetime('now'))",
      [imageId, shapes, meta]
    )
}
export function getDatasetAnnotations(datasetId: number) {
  return queryAll(
    'SELECT a.image_id, i.md5 AS image_md5, i.original_name AS image_name, a.shapes, a.meta FROM annotations a JOIN images i ON i.id = a.image_id WHERE i.dataset_id = ? AND a.shapes != ? ORDER BY i.created_at ASC',
    [datasetId, '[]']
  )
}
export function getAnnotationStatuses(datasetId: number) {
  return queryAll(
    "SELECT i.id AS image_id, CASE WHEN a.id IS NOT NULL AND a.shapes != '[]' THEN 1 ELSE 0 END AS annotated, CASE WHEN a.id IS NOT NULL AND a.shapes = '[]' AND json_extract(a.meta, '$.skipped') = 1 THEN 1 ELSE 0 END AS skipped FROM images i LEFT JOIN annotations a ON a.image_id = i.id WHERE i.dataset_id = ? ORDER BY i.created_at ASC",
    [datasetId]
  ).map((r: any) => ({
    image_id: r.image_id,
    annotated: Boolean(r.annotated),
    skipped: Boolean(r.skipped)
  }))
}
export function saveSkip(imageId: number): void {
  saveAnnotation(imageId, '[]', JSON.stringify({ skipped: true }))
}
