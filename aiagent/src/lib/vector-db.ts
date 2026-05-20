import * as lancedb from "@lancedb/lancedb";
import { getEmbedding, TextVectorizer } from "./providers";

const DB_PATH = "./data/lancedb";

let db: lancedb.Connection | null = null;
let useRealEmbedding = true;

async function getDb(): Promise<lancedb.Connection> {
  if (!db) db = await lancedb.connect(DB_PATH);
  return db;
}

async function embed(text: string, vz: TextVectorizer): Promise<number[]> {
  if (useRealEmbedding) {
    try {
      return await getEmbedding(text);
    } catch {
      useRealEmbedding = false;
    }
  }
  return vz.transform(text);
}

async function embedBatch(texts: string[], vz: TextVectorizer): Promise<number[][]> {
  if (useRealEmbedding) {
    try {
      return await Promise.all(texts.map((t) => getEmbedding(t)));
    } catch {
      useRealEmbedding = false;
    }
  }
  return texts.map((t) => vz.transform(t));
}

export async function indexSystemDocumentChunks(
  globalDocId: number,
  chunks: { pageContent: string; chunkIndex: number }[],
  docType: string,
  category: string,
): Promise<void> {
  if (chunks.length === 0) return;

  const texts = chunks.map((c) => c.pageContent);
  const vz = new TextVectorizer();
  vz.fit(texts);
  const vectors = await embedBatch(texts, vz);

  const conn = await getDb();
  const data = chunks.map((c, i) => ({
    vector: vectors[i],
    text: c.pageContent,
    globalDocId: globalDocId,
    chunkIndex: c.chunkIndex,
    docType,
    category,
  }));

  const tableNames = await conn.tableNames();
  if (!tableNames.includes("system_chunks")) {
    await conn.createTable("system_chunks", data);
  } else {
    const table = await conn.openTable("system_chunks");
    await table.add(data);
  }

  console.log(
    `[vector-db] indexed ${chunks.length} system chunks (${docType}/${category})`,
  );
}

export async function searchSystemChunks(
  query: string,
  k: number = 3,
  category?: string,
): Promise<{ text: string; score: number; docType: string; category: string }[]> {
  const conn = await getDb();
  const tableNames = await conn.tableNames();
  if (!tableNames.includes("system_chunks")) return [];

  const table = await conn.openTable("system_chunks");

  const vz = new TextVectorizer();
  const queryVec = await embed(query, vz);
  const hasValue = queryVec.some((v) => v !== 0);
  if (!hasValue) return [];

  let results: any[];
  if (category) {
    results = await table.search(queryVec).where(`category = "${category}"`).limit(k).toArray();
  } else {
    results = await table.search(queryVec).limit(k).toArray();
  }

  return results.map((r: any) => ({
    text: r.text as string,
    score: Math.max(0, 1 - (r._distance ?? 0)),
    docType: r.docType as string,
    category: r.category as string,
  }));
}

export async function deleteSystemChunks(
  globalDocId: number,
): Promise<void> {
  const conn = await getDb();
  const tableNames = await conn.tableNames();
  if (!tableNames.includes("system_chunks")) return;
  const table = await conn.openTable("system_chunks");
  await table.delete(`globalDocId = ${globalDocId}`);
  console.log(`[vector-db] deleted system chunks for globalDocId ${globalDocId}`);
}
