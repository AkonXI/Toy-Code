import { closeDatabase, openDatabase } from './connection'
import { migrateDatabase } from './migrate'
export function initDatabase(): void { openDatabase(); migrateDatabase() }
export { closeDatabase }
export * from './repositories/annotation-repository'
export * from './repositories/dataset-repository'
export * from './repositories/image-repository'
