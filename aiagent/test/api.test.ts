import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import app from '../src/index';
import { inMemoryTokens } from '../src/auth/token';
import { getDatabase } from '../src/storage/database';
import {
  ensureUser,
  createConversation,
  storeMessage,
  setConversationDocs,
  setConversationChunks,
  setConversationChunksWithTypes,
  getConversationChunksWithTypes,
  appendConversationChunks,
  deleteChunksByRefId,
  isConversationOwner,
  getUserByPhone,
  getUserConversations,
  getConversationMessages,
  getConversationDocuments,
  deleteConversation,
  restoreConversation,
  setInitialPrompt,
  getInitialPrompt,
} from '../src/storage/repository';
import {
  addFileToConversation,
  getConversationDocsByType,
} from '../src/storage/file-manager';

let server: http.Server;
let testToken: string;
let testPhone = '13800138000';
let testUserId: number;
let testConversationId: string;

function request(options: {
  path: string;
  body?: object;
  token?: string;
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  headers?: Record<string, string>;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const data = options.body ? JSON.stringify(options.body) : '';
    const reqOptions = {
      hostname: 'localhost',
      port: 3000,
      path: options.path,
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(options.token ? { Token: options.token } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString();
      });
      res.on('end', () => resolve({ status: res?.statusCode ?? 0, body }));
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

beforeAll(async () => {
  testToken = 'test_token_' + Date.now();
  return new Promise<void>((resolve) => {
    server = app.listen(3000, async () => {
      inMemoryTokens[testToken] = {
        username: `user_${testPhone}`,
        expires: Date.now() + 86400000,
      };
      testUserId = await ensureUser(testPhone);
      testConversationId = `conv_test_${Date.now()}`;
      await createConversation(testConversationId, testUserId);
      await storeMessage(testConversationId, 'user', '请分析这份简历');
      await storeMessage(testConversationId, 'assistant', '好的，我来分析...');
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server?.close(() => resolve());
  });
});

beforeEach(() => {
  inMemoryTokens[testToken] = {
    username: `user_${testPhone}`,
    expires: Date.now() + 86400000,
  };
});

describe('Root API', () => {
  it('should return welcome message', async () => {
    const { status, body } = await request({ path: '/' });
    expect(status).toBe(200);
    expect(body).toContain('AI Agent BFF Layer Running');
  });
});

describe('Auth API', () => {
  it('should return 400 when login params missing', async () => {
    const { status } = await request({ path: '/auth/login', body: {} });
    expect(status).toBe(400);
  });

  it('should return 200 when logout', async () => {
    const { status } = await request({
      path: '/auth/logout',
      method: 'POST',
      token: testToken,
    });
    expect(status).toBe(200);
  });
});

describe('Captcha API', () => {
  it('should return 400 when phone missing', async () => {
    const { status } = await request({ path: '/captcha/generate', body: {} });
    expect(status).toBe(400);
  });
});

describe('RAG API', () => {
  it('should return 401 when token missing for search', async () => {
    const { status } = await request({
      path: '/rag/search',
      body: { query: 'test' },
    });
    expect(status).toBe(401);
  });

  it('should return 401 when token missing for start', async () => {
    const { status } = await request({ path: '/rag/start', body: {} });
    expect(status).toBe(401);
  });

  it('should return 401 when token missing for apply-modification', async () => {
    const { status } = await request({
      path: '/rag/apply-modification',
      body: {},
    });
    expect(status).toBe(401);
  });

  it('should return 401 when token missing for upload-pdf', async () => {
    const { status } = await request({
      path: '/rag/upload-pdf',
      method: 'POST',
    });
    expect(status).toBe(401);
  });
});

describe('System Docs API', () => {
  it('should return doc list for a conversation', async () => {
    const { status, body } = await request({ path: `/rag/docs?conversationId=${testConversationId}`, token: testToken });
    expect(status).toBe(200);
    const data = JSON.parse(body);
    expect(data.docs).toBeDefined();
    expect(Array.isArray(data.docs)).toBe(true);
  });

  it('should return 401 when token missing', async () => {
    const { status } = await request({ path: '/rag/docs' });
    expect(status).toBe(401);
  });
});

describe('User API', () => {
  it('should return 401 when token missing', async () => {
    const { status } = await request({ path: '/user/profile' });
    expect(status).toBe(401);
  });

  it('should return user profile with valid token', async () => {
    const { status, body } = await request({
      path: '/user/profile',
      token: testToken,
    });
    expect(status).toBe(200);
    const data = JSON.parse(body);
    expect(data.phone).toBe(testPhone);
    expect(data.nickname).toBe(`user_${testPhone}`);
    expect(data.id).toBeDefined();
  });

  it('should return 401 with invalid token', async () => {
    const { status } = await request({
      path: '/user/profile',
      token: 'invalid_token',
    });
    expect(status).toBe(401);
  });
});

describe('Conversations API', () => {
  it('should return 401 when token missing', async () => {
    const { status } = await request({ path: '/conversations' });
    expect(status).toBe(401);
  });

  it('should return conversation list with valid token', async () => {
    const { status, body } = await request({
      path: '/conversations?page=1&pageSize=10',
      token: testToken,
    });
    expect(status).toBe(200);
    const data = JSON.parse(body);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('should return messages with valid token and conversation id', async () => {
    const { status, body } = await request({
      path: `/conversations/${testConversationId}/messages`,
      token: testToken,
    });
    expect(status).toBe(200);
    const data = JSON.parse(body);
    expect(data.data).toBeDefined();
    expect(data.data.messages).toBeDefined();
    expect(Array.isArray(data.data.messages)).toBe(true);
    expect(data.data.documents).toBeDefined();
    expect(data.pagination).toBeDefined();
  });

  it('should return 403 for conversation not owned by user', async () => {
    const otherPhone = '13900139000';
    const otherUserId = await ensureUser(otherPhone);
    const otherConvId = `conv_other_${Date.now()}`;
    await createConversation(otherConvId, otherUserId);

    const { status } = await request({
      path: `/conversations/${otherConvId}/messages`,
      token: testToken,
    });
    expect(status).toBe(403);
  });

  it('should return pagination info correctly', async () => {
    const { status, body } = await request({
      path: `/conversations/${testConversationId}/messages?page=1&pageSize=1`,
      token: testToken,
    });
    expect(status).toBe(200);
    const data = JSON.parse(body);
    expect(data.pagination.pageSize).toBe(1);
    expect(data.data.messages.length).toBeLessThanOrEqual(1);
  });

  it('should soft delete a conversation', async () => {
    const deleteConvId = `conv_delete_${Date.now()}`;
    await createConversation(deleteConvId, testUserId);

    const { status } = await request({
      path: `/conversations/${deleteConvId}`,
      method: 'DELETE',
      token: testToken,
    });
    expect(status).toBe(200);
    const data = JSON.parse(JSON.parse(`{"body": "${status}"}`).body || '{}');
    // 验证删除后可以获取列表，但该对话不在其中
    const { body: listBody } = await request({
      path: '/conversations',
      token: testToken,
    });
    const listData = JSON.parse(listBody);
    const deletedConv = listData.data.find((c: any) => c.id === deleteConvId);
    expect(deletedConv).toBeUndefined();
  });

  it('should return 403 when deleting other user conversation', async () => {
    const otherPhone = '13600136000';
    const otherUserId = await ensureUser(otherPhone);
    const otherConvId = `conv_delete_other_${Date.now()}`;
    await createConversation(otherConvId, otherUserId);

    const { status } = await request({
      path: `/conversations/${otherConvId}`,
      method: 'DELETE',
      token: testToken,
    });
    expect(status).toBe(403);
  });

  it('should restore a soft-deleted conversation', async () => {
    const restoreConvId = `conv_restore_${Date.now()}`;
    await createConversation(restoreConvId, testUserId);

    // 先删除
    await request({
      path: `/conversations/${restoreConvId}`,
      method: 'DELETE',
      token: testToken,
    });

    // 然后恢复
    const { status } = await request({
      path: `/conversations/${restoreConvId}/restore`,
      method: 'POST',
      token: testToken,
    });
    expect(status).toBe(200);

    // 验证恢复后可以在列表中看到
    const { body: listBody } = await request({
      path: '/conversations',
      token: testToken,
    });
    const listData = JSON.parse(listBody);
    const restoredConv = listData.data.find((c: any) => c.id === restoreConvId);
    expect(restoredConv).toBeDefined();
  });

  it('should return 403 when restoring other user conversation', async () => {
    const otherPhone = '13500135000';
    const otherUserId = await ensureUser(otherPhone);
    const otherConvId = `conv_restore_other_${Date.now()}`;
    await createConversation(otherConvId, otherUserId);

    const { status } = await request({
      path: `/conversations/${otherConvId}/restore`,
      method: 'POST',
      token: testToken,
    });
    expect(status).toBe(403);
  });
});

describe('Repository Functions', () => {
  it('should return user by phone', async () => {
    const user = await getUserByPhone(testPhone);
    expect(user).not.toBeNull();
    expect(user?.phone).toBe(testPhone);
  });

  it('should return user conversations', async () => {
    const result = await getUserConversations(testUserId, 1, 10);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('should return conversation messages', async () => {
    const result = await getConversationMessages(testConversationId, 1, 10);
    expect(result.data.length).toBeGreaterThanOrEqual(2);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('should verify conversation ownership', async () => {
    const isOwner = await isConversationOwner(testConversationId, testUserId);
    expect(isOwner).toBe(true);
  });

  it('should return empty for non-owned conversation', async () => {
    const otherPhone = '13700137000';
    const otherUserId = await ensureUser(otherPhone);
    const isOwner = await isConversationOwner(testConversationId, otherUserId);
    expect(isOwner).toBe(false);
  });

  it('should soft delete a conversation', async () => {
    const deleteConvId = `conv_repo_delete_${Date.now()}`;
    await createConversation(deleteConvId, testUserId);

    await deleteConversation(deleteConvId);

    // 验证删除后不在列表中
    const result = await getUserConversations(testUserId, 1, 100);
    const deletedConv = result.data.find((c) => c.id === deleteConvId);
    expect(deletedConv).toBeUndefined();
  });

  it('should restore a soft-deleted conversation', async () => {
    const restoreConvId = `conv_repo_restore_${Date.now()}`;
    await createConversation(restoreConvId, testUserId);

    // 先删除
    await deleteConversation(restoreConvId);

    // 然后恢复
    await restoreConversation(restoreConvId);

    // 验证恢复后在列表中
    const result = await getUserConversations(testUserId, 1, 100);
    const restoredConv = result.data.find((c) => c.id === restoreConvId);
    expect(restoredConv).toBeDefined();
  });
});

describe('Chunk Classification', () => {
  it('should classify resume chunks correctly using doc_type column', async () => {
    const convId = `conv_chunk_resume_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(convId, [
      {
        pageContent: 'Resume chunk 1 content',
        metadata: { source: 'resume.pdf' },
        docType: 'resume',
      },
      {
        pageContent: 'Resume chunk 2 content',
        metadata: { source: 'resume.pdf' },
        docType: 'resume',
      },
    ]);

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(2);
    expect(typedChunks[0].docType).toBe('resume');
    expect(typedChunks[1].docType).toBe('resume');
  });

  it('should classify reference chunks correctly using doc_type column', async () => {
    const convId = `conv_chunk_ref_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(convId, [
      {
        pageContent: 'Reference chunk 1',
        metadata: { source: 'job_desc.pdf' },
        docType: 'reference',
      },
      {
        pageContent: 'Reference chunk 2',
        metadata: { source: 'job_desc.pdf' },
        docType: 'reference',
      },
    ]);

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(2);
    expect(typedChunks[0].docType).toBe('reference');
    expect(typedChunks[1].docType).toBe('reference');
  });

  it('should handle mixed resume and reference chunks', async () => {
    const convId = `conv_chunk_mixed_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(convId, [
      {
        pageContent: 'Resume content',
        metadata: { source: 'my_resume.pdf' },
        docType: 'resume',
      },
      {
        pageContent: 'Reference content',
        metadata: { source: 'reference.pdf' },
        docType: 'reference',
      },
    ]);

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(2);
    expect(typedChunks[0].docType).toBe('resume');
    expect(typedChunks[1].docType).toBe('reference');
  });

  it('should default to resume for chunks without doc_type', async () => {
    const convId = `conv_chunk_orphan_${Date.now()}`;
    await createConversation(convId, testUserId);

    const db = getDatabase();
    db.prepare(
      'INSERT INTO chunks (conversation_id, page_content, metadata, source, chunk_index, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(
      convId,
      'Orphan chunk content',
      JSON.stringify({ source: 'unknown.pdf' }),
      'unknown.pdf',
      0,
      Date.now(),
    );

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(1);
    expect(typedChunks[0].docType).toBe('resume');
  });

  it('should return empty array for conversation with no chunks', async () => {
    const convId = `conv_chunk_empty_${Date.now()}`;
    await createConversation(convId, testUserId);

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(0);
  });

  it('should exclude deleted chunks from results', async () => {
    const convId = `conv_chunk_deleted_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(
      convId,
      [
        {
          pageContent: 'Resume content',
          metadata: { source: 'resume.pdf' },
          docType: 'resume',
        },
        {
          pageContent: 'Reference content',
          metadata: { source: 'ref.pdf' },
          docType: 'reference',
        },
      ],
      1,
    );

    await deleteChunksByRefId(convId, 1);

    const typedChunks = await getConversationChunksWithTypes(convId);
    expect(typedChunks.length).toBe(0);
  });

  it('should delete chunks by ref_id precisely', async () => {
    const convId = `conv_chunk_refid_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(
      convId,
      [
        {
          pageContent: 'Resume content',
          metadata: { source: 'resume.pdf' },
          docType: 'resume',
        },
      ],
      10,
    );

    await appendConversationChunks(
      convId,
      [
        {
          pageContent: 'Job A reference',
          metadata: { source: 'job_a.pdf' },
          docType: 'reference',
        },
      ],
      11,
    );

    await appendConversationChunks(
      convId,
      [
        {
          pageContent: 'Job B reference',
          metadata: { source: 'job_b.pdf' },
          docType: 'reference',
        },
      ],
      12,
    );

    const beforeDelete = await getConversationChunksWithTypes(convId);
    expect(beforeDelete.length).toBe(3);

    await deleteChunksByRefId(convId, 11);

    const afterDelete = await getConversationChunksWithTypes(convId);
    expect(afterDelete.length).toBe(2);
    expect(afterDelete[0].pageContent).toBe('Resume content');
    expect(afterDelete[1].pageContent).toBe('Job B reference');
  });

  it('should store ref_id on chunks for precise file tracking', async () => {
    const convId = `conv_chunk_refid_store_${Date.now()}`;
    await createConversation(convId, testUserId);

    await setConversationChunksWithTypes(
      convId,
      [
        {
          pageContent: 'Resume chunk',
          metadata: { source: 'resume.pdf' },
          docType: 'resume',
        },
      ],
      42,
    );

    const db = getDatabase();
    const row = db
      .prepare(
        'SELECT ref_id FROM chunks WHERE conversation_id = ? AND page_content = ?',
      )
      .get(convId, 'Resume chunk') as { ref_id: number | null };

    expect(row.ref_id).toBe(42);
  });
});

describe('Initial Prompt', () => {
  it('should create conversation with initial_prompt', async () => {
    const convId = `conv_initial_${Date.now()}`;
    const prompt = '请分析这份简历';
    await createConversation(convId, testUserId, prompt);

    const db = getDatabase();
    const row = db
      .prepare('SELECT initial_prompt FROM conversations WHERE id = ?')
      .get(convId) as { initial_prompt: string | null };

    expect(row.initial_prompt).toBe(prompt);
  });

  it('should set initial_prompt correctly', async () => {
    const convId = `conv_setprompt_${Date.now()}`;
    await createConversation(convId, testUserId);
    const prompt = '帮我优化简历';

    await setInitialPrompt(convId, prompt);

    const db = getDatabase();
    const row = db
      .prepare('SELECT initial_prompt FROM conversations WHERE id = ?')
      .get(convId) as { initial_prompt: string | null };

    expect(row.initial_prompt).toBe(prompt);
  });

  it('should return initial_prompt in messages response', async () => {
    const convId = `conv_msg_prompt_${Date.now()}`;
    const prompt = '请分析这份简历';
    await createConversation(convId, testUserId, prompt);
    await storeMessage(convId, 'user', prompt);
    await storeMessage(convId, 'assistant', '好的，我来分析...');

    const result = await getConversationMessages(convId, 1, 10);
    expect(result.initialPrompt).toBe(prompt);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('should return null initial_prompt when not set', async () => {
    const convId = `conv_no_prompt_${Date.now()}`;
    await createConversation(convId, testUserId); // 不传 initial_prompt

    const result = await getConversationMessages(convId, 1, 10);
    expect(result.initialPrompt).toBeNull();
  });
});

describe('Reasoning Persistence', () => {
  it('should store and return reasoning for assistant messages', async () => {
    const convId = `conv_reasoning_${Date.now()}`;
    await createConversation(convId, testUserId);
    const reasoningText = '第一步：分析简历结构...第二步：提取关键技能...';
    await storeMessage(convId, 'user', '请分析简历');
    await storeMessage(convId, 'assistant', '分析结果...', reasoningText);

    const result = await getConversationMessages(convId, 1, 10);
    const assistantMsg = result.data.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.reasoning).toBe(reasoningText);
  });

  it('should have empty reasoning by default', async () => {
    const convId = `conv_no_reasoning_${Date.now()}`;
    await createConversation(convId, testUserId);
    await storeMessage(convId, 'user', '请分析');
    await storeMessage(convId, 'assistant', '好的');

    const result = await getConversationMessages(convId, 1, 10);
    const msgs = result.data;
    msgs.forEach((m) => {
      expect(m).toHaveProperty('reasoning');
    });
  });

  it('should have empty reasoning for user messages', async () => {
    const convId = `conv_user_reasoning_${Date.now()}`;
    await createConversation(convId, testUserId);
    await storeMessage(convId, 'user', '你好');
    await storeMessage(convId, 'assistant', '你好！', '助理推理');

    const result = await getConversationMessages(convId, 1, 10);
    const userMsg = result.data.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg!.reasoning).toBe('');
  });
});
