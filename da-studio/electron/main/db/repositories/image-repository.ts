import { execute, getDb, queryAll, queryOne } from '../connection'

export function listImages(datasetId: number) {
  return queryAll('SELECT * FROM images WHERE dataset_id = ? ORDER BY created_at ASC', [datasetId])
}

export function getImage(id: number) {
  return queryOne('SELECT * FROM images WHERE id = ?', [id])
}

export function createImage(
  datasetId: number,
  filename: string,
  originalName: string,
  md5: string,
  width = 0,
  height = 0
) {
  return {
    id: execute(
      'INSERT INTO images (dataset_id, filename, original_name, md5, width, height) VALUES (?, ?, ?, ?, ?, ?)',
      [datasetId, filename, originalName, md5, width, height]
    ),
    dataset_id: datasetId,
    filename,
    original_name: originalName,
    md5,
    width,
    height,
    created_at: new Date().toISOString()
  }
}

export function deleteImage(id: number): void {
  const db = getDb()
  db.transaction((imageId: number) => {
    db.prepare('DELETE FROM annotations WHERE image_id = ?').run(imageId)
    db.prepare('DELETE FROM images WHERE id = ?').run(imageId)
  })(id)
}
