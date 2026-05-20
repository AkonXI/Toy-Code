import { ChatDeepSeek } from "@langchain/deepseek";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { pipeline } from "@huggingface/transformers";

export const DEFAULT_MODEL = "deepseek-v4-pro";

// LangChain 模型（离线调用：摘要/分类/标题/修改）
let _chatModel: ChatDeepSeek | null = null;
let _fastModel: ChatDeepSeek | null = null;

export function getChatModel(): ChatDeepSeek {
  if (!_chatModel) {
    _chatModel = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: DEFAULT_MODEL,
    });
  }
  return _chatModel;
}

export function getFastModel(): ChatDeepSeek {
  if (!_fastModel) {
    _fastModel = new ChatDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: "deepseek-v4-flash",
      maxTokens: 8192,
      temperature: 0.1,
      modelKwargs: {
        thinking: { type: "disabled" },
      },
    });
  }
  return _fastModel;
}

// AI SDK 模型（主搜索流：streamText + tools + reasoning）
export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// --- 文本向量化 ---

let embedPipe: any = null;

export async function getEmbedding(text: string): Promise<number[]> {
  if (!embedPipe) {
    embedPipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5");
  }
  const result = await embedPipe(text, { pooling: "mean", normalize: true });
  return Array.from(result.data);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb);
  return mag === 0 ? 0 : dot / mag;
}

// --- 备选：纯 JS TF-IDF 向量化（当 transformer 模型不可用时降级使用）---

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && t.length < 20);
}

interface VocabEntry {
  index: number
  df: number
}

export class TextVectorizer {
  private vocab: Record<string, VocabEntry> = {};
  private dim = 0;
  private totalDocs = 0;

  fit(docs: string[]): void {
    this.vocab = {};
    this.totalDocs = docs.length;
    for (const doc of docs) {
      const seen = new Set<string>();
      for (const t of tokenize(doc)) {
        if (!seen.has(t)) {
          seen.add(t);
          if (this.vocab[t]) {
            this.vocab[t].df++;
          } else {
            this.vocab[t] = { index: this.dim++, df: 1 };
          }
        }
      }
    }
  }

  transform(text: string): number[] {
    const vec = new Array(this.dim).fill(0);
    const tf: Record<string, number> = {};
    for (const t of tokenize(text)) {
      tf[t] = (tf[t] || 0) + 1;
    }
    for (const [term, freq] of Object.entries(tf)) {
      const entry = this.vocab[term];
      if (entry) {
        const idf = Math.log((this.totalDocs + 1) / (entry.df + 1)) + 1;
        vec[entry.index] = freq * idf;
      }
    }
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
    return vec;
  }

  get dimSize(): number {
    return this.dim;
  }
}
