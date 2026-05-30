import { Request, Response } from "express";
import { streamText, stepCountIs } from "ai";
import { deepseek, DEFAULT_MODEL, getChatModel } from "../../../lib/providers";
import { buildSearchPrompt, buildTitlePrompt } from "../../../lib/prompts";
import { DocumentLoader } from "../../../lib/document-loader";
import {
  getConversationTitle,
  updateConversationTitle,
  isConversationOwner,
  buildHistoryPrompt,
} from "../../../storage/repository";
import { getDatabase } from "../../../storage/database";
import { extractUserId, MulterFile } from "../utils";
import { classifyIntent } from "./intent";
import { buildRagContext } from "./rag-context";
import { updateResumeTool, proposeModificationTool } from "./tools";
import fs from "fs";
import path from "path";

const docsDir = path.join(process.cwd(), "docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const systemRAG = new DocumentLoader({ chunkSize: 1000, chunkOverlap: 200 });

async function initSystemRAG(retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const files = fs.readdirSync(docsDir);
      if (files.length > 0) {
        await systemRAG.loadDocuments(docsDir);
        console.log(`System RAG initialized with ${files.length} documents`);
      } else {
        console.log("System RAG: no documents found, skipping initialization");
      }
      return;
    } catch (error) {
      console.error(
        `System RAG init attempt ${i + 1}/${retries} failed:`,
        error,
      );
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delay));
    }
  }
}

initSystemRAG();

export async function performSearch(
  reqBody: {
    query: string;
    content?: string;
    files?: MulterFile[];
    k?: number;
    url?: string;
    useSystemDocs?: boolean;
    conversationId?: string;
  },
  res: Response,
  req: Request,
) {
  const {
    query,
    content,
    files,
    url,
    useSystemDocs = true,
    conversationId,
  } = reqBody;

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  if (conversationId) {
    const userId = await extractUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Authentication failed" });
      return;
    }
    const isOwner = await isConversationOwner(conversationId, userId);
    if (!isOwner) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const title = await getConversationTitle(conversationId);
    if (!title) {
      try {
        const response = await getChatModel().invoke([
          { role: "user", content: await buildTitlePrompt(query) },
        ]);
        const titleText =
          typeof response.content === "string" ? response.content : "";
        await updateConversationTitle(conversationId, titleText.trim());
        console.log("Generated conversation title:", titleText.trim());
      } catch (e) {
        console.error("Failed to generate title:", e);
      }
    }
  }

  const context = await buildRagContext(
    { query, content, files, url, useSystemDocs, conversationId, systemRAG },
    res,
    req,
  );
  if (!context) return;
  const { resumeContent, excellentResumeContent, referenceDocContent } = context;

  const history = conversationId
    ? await buildHistoryPrompt(conversationId)
    : "";
  const historySection = history ? `\n对话历史:\n${history}\n` : "";

  const resumeSection = resumeContent
    ? `【待修改简历】\n${resumeContent}\n\n`
    : "";
  const excellentResumeSection = excellentResumeContent
    ? `【优秀简历范例】\n${excellentResumeContent}\n\n`
    : "";
  const referenceDocSection = referenceDocContent
    ? `【岗位参考资料】\n${referenceDocContent}\n\n`
    : "";

  console.log("[perf] intent-classify");
  const intent = await classifyIntent(query);
  console.log("[perf] intent-classify");

  const tools: Record<string, any> =
    intent === "追问"
      ? {}
      : {
          updateResume: updateResumeTool,
          proposeModification: proposeModificationTool,
        };
  console.log("[DEBUG] tools registered:", Object.keys(tools));

  console.log("[perf] build-prompt");
  const searchPrompt = await buildSearchPrompt({
    historySection,
    resumeSection,
    excellentResumeSection,
    referenceDocSection,
    query,
    intent,
  });
  console.log("[perf] build-prompt");
  console.log(
    "[DEBUG] search prompt (first 300):",
    searchPrompt.slice(0, 300),
  );

  console.log("[perf] streamText");

  const reasonChunks: string[] = [];
  let assistantMsgId: number | null = null;

  if (conversationId) {
    try {
      const displayText = req.body.displayText || query;
      const db = getDatabase();
      db.prepare(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
      ).run(conversationId, "user", displayText, Date.now());
      db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(Date.now(), conversationId);
    } catch (e) {
      console.error("Failed to persist user message:", e);
    }
  }

  const result = streamText({
    model: deepseek(DEFAULT_MODEL),
    tools,
    stopWhen: stepCountIs(6),
    maxRetries: 3,
    prompt: searchPrompt,
    onStepFinish: ({ text, reasoning }) => {
      if (reasoning) {
        for (const part of reasoning) {
          if ('text' in part) reasonChunks.push(part.text);
        }
      }
      if (conversationId) {
        try {
          const db = getDatabase();
          const write = db.transaction(() => {
            if (!assistantMsgId) {
              const now = Date.now();
              const result = db.prepare(
                "INSERT INTO messages (conversation_id, role, content, reasoning, created_at) VALUES (?, ?, ?, ?, ?)",
              ).run(conversationId, "assistant", String(text), reasonChunks.join('\n'), now);
              db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
              assistantMsgId = result.lastInsertRowid as number;
            } else {
              db.prepare(
                "UPDATE messages SET content = ?, reasoning = ? WHERE id = ?",
              ).run(String(text), reasonChunks.join('\n'), assistantMsgId);
            }
          });
          write();
        } catch (e) {
          console.error("Failed to persist messages:", e);
        }
      }
    },
    onFinish: async ({ text }) => {
      console.log("[perf] streamText");
      if (conversationId && assistantMsgId) {
        try {
          const db = getDatabase();
          db.prepare(
            "UPDATE messages SET content = ?, reasoning = ? WHERE id = ?",
          ).run(String(text), reasonChunks.join('\n'), assistantMsgId);
        } catch (e) {
          console.error("Failed to finalize messages:", e);
        }
      }
    },
  });

  result.pipeUIMessageStreamToResponse(res as any);
}
