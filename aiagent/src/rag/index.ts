import fs from "fs";
import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFParse } from "pdf-parse";
import { cosineSimilarity, getEmbedding, TextVectorizer } from "../lib/providers";

export interface Document {
  pageContent: string;
  metadata: Record<string, unknown>;
}

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && t.length < 20);
}

function buildQueryTerms(query: string): Map<string, number> {
  const terms = tokenize(query);
  const freq = new Map<string, number>();
  for (const t of terms) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

function scoreChunk(chunk: string, queryTerms: Map<string, number>): number {
  const chunkText = chunk.toLowerCase();
  let score = 0;
  for (const [term, qf] of queryTerms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = chunkText.match(re);
    if (matches) {
      score += matches.length * qf;
    }
  }
  const words = tokenize(chunk).length;
  if (words > 0) {
    score = score / Math.log(words + 1);
  }
  return score;
}

export class PDFRAG {
  public chunks: Document[] = [];
  private config: RAGConfig;
  private splitter: RecursiveCharacterTextSplitter;

  constructor(config?: Partial<RAGConfig>) {
    this.config = {
      chunkSize: config?.chunkSize ?? 1000,
      chunkOverlap: config?.chunkOverlap ?? 200,
    };
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });
  }

  private async parsePDF(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  async loadDocuments(dirPath: string, reset = true): Promise<void> {
    if (reset) this.chunks = [];
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const ext = path.extname(file).toLowerCase();

      let text = "";
      if (ext === ".pdf") {
        text = await this.parsePDF(filePath);
      } else if (ext === ".txt") {
        text = fs.readFileSync(filePath, "utf-8");
      }

      if (text) {
        const texts = await this.splitter.splitText(text);
        for (let i = 0; i < texts.length; i++) {
          this.chunks.push({
            pageContent: texts[i],
            metadata: { source: file, index: i },
          });
        }
      }
    }
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (this.chunks.length === 0) return [];
    const queryTerms = buildQueryTerms(query);
    if (queryTerms.size === 0) return this.chunks.slice(0, k);

    const scored = this.chunks.map((chunk) => ({
      chunk,
      score: scoreChunk(chunk.pageContent, queryTerms),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((r) => r.chunk);
  }

  async loadDocumentsFromText(
    docs: { text: string; metadata?: Record<string, unknown> }[],
    reset = true,
  ): Promise<void> {
    if (reset) this.chunks = [];
    for (const doc of docs) {
      const texts = await this.splitter.splitText(doc.text);
      for (let i = 0; i < texts.length; i++) {
        this.chunks.push({
          pageContent: texts[i],
          metadata: doc.metadata || { index: i },
        });
      }
    }
  }
}

/** 支持 TF 粗筛 + 向量精排的 RAG（用于参考文件/系统文档） */
export class VectorRAG extends PDFRAG {
  private vectors: number[][] = [];
  private vectorizer = new TextVectorizer();

  /** 从 chunks 构建向量索引 */
  async buildIndex(): Promise<void> {
    const docs = this.chunks.map((chunk) => chunk.pageContent);
    if (docs.length === 0) return;
    this.vectorizer.fit(docs);
    try {
      this.vectors = await Promise.all(docs.map((d) => getEmbedding(d)));
      console.log(`[VectorRAG] built index: ${docs.length} docs, ${this.vectors[0].length} dims`);
    } catch {
      // 降级：使用 TF-IDF 向量
      this.vectors = docs.map((d) => this.vectorizer.transform(d));
      console.log(`[VectorRAG] fallback to TF-IDF: ${docs.length} docs, ${this.vectorizer.dimSize} dims`);
    }
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    // TF 粗筛缩小候选
    const tfCandidates = await super.similaritySearch(query, Math.max(k * 3, 10));
    if (tfCandidates.length === 0) return [];

    // 向量精排
    let queryVec: number[];
    try {
      queryVec = await getEmbedding(query);
    } catch {
      queryVec = this.vectorizer.transform(query);
    }
    const hasValue = queryVec.some((v) => v !== 0);
    if (!hasValue) return tfCandidates.slice(0, k);

    const scored = tfCandidates.map((chunk, i) => {
      const origIdx = this.chunks.findIndex((c) => c === chunk);
      return {
        chunk,
        score: origIdx >= 0 && origIdx < this.vectors.length
          ? cosineSimilarity(queryVec, this.vectors[origIdx])
          : 0,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((r) => r.chunk);
  }
}

export { buildQueryTerms, scoreChunk };
