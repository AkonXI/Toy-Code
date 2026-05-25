# aiagent

Express + AI SDK v6 + LangChain + DeepSeek + LanceDB

## Important

**All AI responses must be in Chinese.** Include "请用中文回答" in prompts.

## 操作指引

- **优先使用 MCP 服务** 进行文件读写、搜索、网页抓取等操作

## Commands

```
npm run dev       # nodemon + tsx, watches src/
npm run build     # tsc → dist/
npm start         # node dist/index.js
npm test          # vitest --run
npm test:watch    # vitest watch
```

## Environment

- `DEEPSEEK_API_KEY` required
- `PORT` defaults to 3000
- `ALLOWED_ORIGINS` — CORS whitelist

## Architecture

```
src/
  index.ts              # Entry, routes + shutdown + CORS
  routes/
    rag/index.ts        # RAG search, PDF modification, upload, intent, restore
    conversation/       # GET/POST/DELETE conversations + messages
    user/               # GET /user/profile
    admin/              # System knowledge base
  lib/
    providers.ts        # ChatDeepSeek + embedding + TextVectorizer
    prompts.ts          # ChatPromptTemplate-based prompt builders
    resume-pdfmaker.ts  # PDF generation (pdfmake + SourceHanSansSC)
    resume-markdown.ts  # replaceText (4-level matching)
    vector-db.ts        # LanceDB index/search/delete
  auth/                 # Login, logout, token middleware, captcha
  storage/              # schema.sql + repository + file-manager + summary-manager
  rag/index.ts          # PDFRAG + VectorRAG
```

## Key Dependencies

| Package | Purpose |
| :--- | :--- |
| `@ai-sdk/deepseek` | Main search (reasoning + SSE + tools) |
| `@langchain/core` | StructuredOutputParser, ChatPromptTemplate |
| `@langchain/deepseek` | Offline LLM calls |
| `@lancedb/lancedb` | System-level vector DB |
| `@huggingface/transformers` | `Xenova/bge-small-zh-v1.5` embedding |

## Core Features

- **Conversation Init**: Upload resume → LLM converts to Markdown → stores chunks
- **RAG Search**: Intent classification → tool registration → streamText
- **Intent Types**: `建议`/`修改`/`追问` via `StructuredOutputParser`
- **Tools**: `updateResumeTool` + `proposeModificationTool` → unified `{ field, current, suggestion, reason }`
- **Text Replacement**: 4-level matching (exact → flat → normalized → head+tail)
- **Auto Summary**: Chain-based, triggers at 60 unsummarized messages
- **PDF Generation**: pdfmake, Markdown inline parsing, nested lists

## LLM Architecture

| Use Case | SDK | Model |
| :--- | :--- | :--- |
| Main search (streaming) | `@ai-sdk/deepseek` | `deepseek-v4-pro` |
| Classify/apply/summarize | `@langchain/deepseek` | `deepseek-v4-pro` |
| Markdown conversion | `@langchain/deepseek` | `deepseek-v4-flash` |

## Testing

- `npm test` = vitest, 48 tests in `test/`
- Coverage: routes, auth, captcha, RAG, storage, prompts, reasoning
