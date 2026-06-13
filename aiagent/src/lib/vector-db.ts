import { QdrantClient } from '@qdrant/js-client-rest'
import crypto from 'crypto'
import { getEmbedding } from './providers'

const COLLECTION = 'system_chunks'
const USER_COLLECTION = 'user_chunks'
const VECTOR_SIZE = 512

let client: QdrantClient | null = null
let collectionReady = false
let userCollectionReady = false

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY
    })
  }
  return client
}

function pointId(globalDocId: number, chunkIndex: number): string {
  return crypto.createHash('md5').update(`${globalDocId}:${chunkIndex}`).digest('hex')
}

async function ensureCollection(): Promise<void> {
  if (collectionReady) return
  const qdrant = getClient()
  const { collections } = await qdrant.getCollections()
  if (!collections.some((c) => c.name === COLLECTION)) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
    })
    await qdrant.createPayloadIndex(COLLECTION, { field_name: 'category', field_schema: 'keyword' })
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'globalDocId',
      field_schema: 'integer'
    })
  }
  collectionReady = true
}

async function ensureUserCollection(): Promise<void> {
  if (userCollectionReady) return
  const qdrant = getClient()
  const { collections } = await qdrant.getCollections()
  if (!collections.some((c) => c.name === USER_COLLECTION)) {
    await qdrant.createCollection(USER_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
    })
    await qdrant.createPayloadIndex(USER_COLLECTION, {
      field_name: 'userId',
      field_schema: 'integer'
    })
    await qdrant.createPayloadIndex(USER_COLLECTION, {
      field_name: 'globalDocId',
      field_schema: 'integer'
    })
    await qdrant.createPayloadIndex(USER_COLLECTION, {
      field_name: 'category',
      field_schema: 'keyword'
    })
  }
  userCollectionReady = true
}

function userPointId(userId: number, globalDocId: number, chunkIndex: number): string {
  return crypto.createHash('md5').update(`${userId}:${globalDocId}:${chunkIndex}`).digest('hex')
}

export async function indexSystemDocumentChunks(
  globalDocId: number,
  chunks: { pageContent: string; chunkIndex: number }[],
  docType: string,
  category: string
): Promise<void> {
  if (chunks.length === 0) return

  const vectors = await Promise.all(chunks.map((c) => getEmbedding(c.pageContent)))
  await ensureCollection()

  const points = chunks.map((c, i) => ({
    id: pointId(globalDocId, c.chunkIndex),
    vector: vectors[i],
    payload: {
      text: c.pageContent,
      globalDocId,
      chunkIndex: c.chunkIndex,
      docType,
      category
    }
  }))

  await getClient().upsert(COLLECTION, { wait: true, points })
  console.log(`[vector-db] indexed ${chunks.length} system chunks (${docType}/${category})`)
}

export async function searchSystemChunks(
  query: string,
  k: number = 3,
  category?: string
): Promise<{ text: string; score: number; docType: string; category: string }[]> {
  await ensureCollection()
  const queryVec = await getEmbedding(query)

  const filter = category ? { must: [{ key: 'category', match: { value: category } }] } : undefined

  const results = await getClient().search(COLLECTION, {
    vector: queryVec,
    limit: k,
    filter,
    with_payload: true
  })

  return results.map((r) => ({
    text: r.payload?.text as string,
    score: r.score,
    docType: r.payload?.docType as string,
    category: r.payload?.category as string
  }))
}

export async function deleteSystemChunks(globalDocId: number): Promise<void> {
  await ensureCollection()
  await getClient().delete(COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'globalDocId', match: { value: globalDocId } }] }
  })
  console.log(`[vector-db] deleted system chunks for globalDocId ${globalDocId}`)
}

export async function indexUserDocumentChunks(
  userId: number,
  globalDocId: number,
  chunks: { pageContent: string; chunkIndex: number }[],
  docType: string,
  category?: string
): Promise<void> {
  if (chunks.length === 0) return

  const vectors = await Promise.all(chunks.map((c) => getEmbedding(c.pageContent)))
  await ensureUserCollection()

  const points = chunks.map((c, i) => ({
    id: userPointId(userId, globalDocId, c.chunkIndex),
    vector: vectors[i],
    payload: {
      text: c.pageContent,
      userId,
      globalDocId,
      chunkIndex: c.chunkIndex,
      docType,
      category: category || ''
    }
  }))

  await getClient().upsert(USER_COLLECTION, { wait: true, points })
  console.log(`[vector-db] indexed ${chunks.length} user chunks for userId ${userId} (${docType})`)
}

export async function searchUserChunks(
  query: string,
  userId: number,
  k: number = 3,
  category?: string
): Promise<{ text: string; score: number; docType: string; category: string }[]> {
  await ensureUserCollection()
  const queryVec = await getEmbedding(query)

  const must: { key: string; match: { value: string | number } }[] = [
    { key: 'userId', match: { value: userId } }
  ]
  if (category) {
    must.push({ key: 'category', match: { value: category } })
  }

  const results = await getClient().search(USER_COLLECTION, {
    vector: queryVec,
    limit: k,
    filter: { must },
    with_payload: true
  })

  return results.map((r) => ({
    text: r.payload?.text as string,
    score: r.score,
    docType: r.payload?.docType as string,
    category: r.payload?.category as string
  }))
}

export async function deleteUserChunks(userId: number, globalDocId: number): Promise<void> {
  await ensureUserCollection()
  await getClient().delete(USER_COLLECTION, {
    wait: true,
    filter: {
      must: [
        { key: 'userId', match: { value: userId } },
        { key: 'globalDocId', match: { value: globalDocId } }
      ]
    }
  })
  console.log(`[vector-db] deleted user chunks for userId ${userId} globalDocId ${globalDocId}`)
}
