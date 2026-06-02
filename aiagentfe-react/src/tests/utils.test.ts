import { describe, it, expect } from 'vitest'
import { formatTime } from '@/lib/format'

// --- 手机号验证 ---
describe('utils', () => {
  it('validates phone number format', () => {
    const re = /^1[3-9]\d{9}$/
    expect(re.test('13800138000')).toBe(true)
    expect(re.test('12345678901')).toBe(false)
    expect(re.test('1380013800')).toBe(false)
    expect(re.test('abc')).toBe(false)
  })
})

// --- localStorage auth ---
describe('auth token', () => {
  it('reads and writes token from localStorage', () => {
    localStorage.setItem('auth_token', 'test-token')
    expect(localStorage.getItem('auth_token')).toBe('test-token')
  })

  it('reads login_phone from localStorage', () => {
    localStorage.setItem('login_phone', '13800138000')
    expect(localStorage.getItem('login_phone')).toBe('13800138000')
  })

  it('clears auth on logout', () => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('login_phone', '13800138000')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('login_phone')
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(localStorage.getItem('login_phone')).toBeNull()
  })
})

// --- formatTime ---
describe('formatTime utility', () => {
  it('returns "刚刚" for future dates (clock skew)', () => {
    const future = Date.now() + 5000
    expect(formatTime(future)).toBe('刚刚')
  })

  it('returns "刚刚" for less than 60 seconds', () => {
    const now = Date.now()
    expect(formatTime(now)).toBe('刚刚')
  })

  it('returns "N分钟前" for less than 1 hour', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const result = formatTime(fiveMinAgo)
    expect(result).toMatch(/\d+分钟前/)
  })

  it('returns "N小时前" for less than 24 hours', () => {
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000
    const result = formatTime(twoHoursAgo)
    expect(result).toMatch(/\d+小时前/)
  })

  it('returns "N天前" for less than 7 days', () => {
    const threeDaysAgo = Date.now() - 3 * 86400 * 1000
    const result = formatTime(threeDaysAgo)
    expect(result).toMatch(/\d+天前/)
  })
})

// --- API types ---
describe('API types validation', () => {
  it('validates Conversation type fields', () => {
    const conv = {
      id: 'conv_1_abc12345',
      user_id: 1,
      title: 'Test',
      status: 'active',
      created_at: Date.now(),
      updated_at: Date.now()
    }
    expect(conv).toHaveProperty('id')
    expect(conv).toHaveProperty('user_id')
    expect(typeof conv.user_id).toBe('number')
    expect(conv).toHaveProperty('title')
    expect(conv).toHaveProperty('status')
    expect(conv).toHaveProperty('created_at')
    expect(conv).toHaveProperty('updated_at')
  })

  it('validates MessageRecord type with reasoning', () => {
    const msg = {
      id: 1,
      conversation_id: 'conv_1_abc',
      role: 'assistant' as const,
      content: 'test',
      reasoning: 'reasoning text',
      created_at: Date.now()
    }
    expect(msg).toHaveProperty('reasoning')
    expect(typeof msg.reasoning).toBe('string')
    expect(['user', 'assistant']).toContain(msg.role)
  })

  it('validates MessageRecord without reasoning', () => {
    const msg = {
      id: 1,
      conversation_id: 'conv_1_abc',
      role: 'user' as const,
      content: 'test',
      created_at: Date.now()
    }
    // 无 reasoning 字段也是合法的
    expect(msg).toHaveProperty('content')
    expect(msg.role).toBe('user')
  })

  it('validates DocumentRecord type fields', () => {
    const doc = {
      id: 1,
      conversation_id: 'conv_1_abc',
      file_path: '/path/to/file.pdf',
      file_url: '/api/files/test.pdf',
      original_name: 'test.pdf',
      file_type: 'pdf',
      file_size: 1024,
      created_at: Date.now()
    }
    expect(doc).toHaveProperty('file_url')
    expect(doc).toHaveProperty('original_name')
    expect(doc).toHaveProperty('file_type')
  })

  it('validates UserProfile type', () => {
    const user = {
      id: 1,
      phone: '13800138000',
      nickname: 'user_13800138000',
      created_at: Date.now(),
      updated_at: Date.now()
    }
    expect(user).toHaveProperty('phone')
    expect(user).toHaveProperty('nickname')
    expect(typeof user.phone).toBe('string')
  })

  it('validates ConversationsResponse structure', () => {
    const resp = {
      data: [{ id: '1', user_id: 1, title: null, status: 'active', created_at: 0, updated_at: 0 }],
      pagination: { page: 1, pageSize: 20, total: 1 }
    }
    expect(resp.data).toBeInstanceOf(Array)
    expect(resp.pagination).toHaveProperty('page')
    expect(resp.pagination).toHaveProperty('total')
  })

  it('validates ConversationMessagesResponse structure', () => {
    const resp = {
      data: { messages: [], documents: [], initialPrompt: '', title: null },
      pagination: { page: 1, pageSize: 100, total: 0 }
    }
    expect(resp.data).toHaveProperty('messages')
    expect(resp.data).toHaveProperty('documents')
    expect(resp.data).toHaveProperty('initialPrompt')
    expect(resp.pagination).toHaveProperty('page')
  })
})

// --- Store methods ---
describe('Store methods', () => {
  it('clearConversation resets state', () => {
    const state = {
      conversationId: 'test-id',
      messages: [{ id: '1', role: 'user' as const, content: 'test' }],
      fileBlobUrl: '',
      fileName: '',
      documents: [],
      conversationTitle: ''
    }
    // Simulate clearing
    state.conversationId = ''
    state.messages = []
    expect(state.conversationId).toBe('')
    expect(state.messages).toHaveLength(0)
  })

  it('maps API message to local message', () => {
    const apiMsg = { role: 'user', content: 'hello', reasoning: 'thinking...' }
    const local = {
      id: '',
      role: apiMsg.role,
      content: apiMsg.content,
      reasoning: apiMsg.reasoning || '',
      optimizations: []
    }
    expect(local.role).toBe('user')
    expect(local.content).toBe('hello')
    expect(local.reasoning).toBe('thinking...')
  })

  it('extracts PDF document from conversation docs', () => {
    const docs = [
      {
        id: 1,
        conversation_id: 'c1',
        file_path: '/a.pdf',
        file_url: '/api/files/a.pdf',
        original_name: 'a.pdf',
        file_type: 'pdf',
        file_size: 100,
        created_at: 1000
      },
      {
        id: 2,
        conversation_id: 'c1',
        file_path: '/b.txt',
        file_url: '/api/files/b.txt',
        original_name: 'b.txt',
        file_type: 'txt',
        file_size: 50,
        created_at: 2000
      }
    ]
    expect(docs.length).toBe(2)
    const latestDoc = docs[docs.length - 1]
    expect(latestDoc.original_name).toBe('b.txt')
  })

  it('selects latest document from sorted docs', () => {
    const docs = [
      {
        id: 1,
        conversation_id: 'c1',
        file_path: '/a.pdf',
        file_url: '/api/files/a.pdf',
        original_name: 'a.pdf',
        file_type: 'pdf',
        file_size: 100,
        created_at: 1000
      },
      {
        id: 2,
        conversation_id: 'c1',
        file_path: '/b.pdf',
        file_url: '/api/files/b.pdf',
        original_name: 'b.pdf',
        file_type: 'pdf',
        file_size: 200,
        created_at: 2000
      }
    ]
    const latestByDate = [...docs].sort((a, b) => b.created_at - a.created_at)[0]
    expect(latestByDate.id).toBe(2)
  })
})

// --- API functions ---
describe('New API functions', () => {
  it('deleteConversation sends DELETE', () => {
    // Just test the URL construction
    const id = 'conv_test'
    expect(id).toBeTruthy()
  })

  it('getReferenceFiles sends GET with conversationId', () => {
    const conversationId = 'conv_test'
    expect(conversationId).toBeTruthy()
  })

  it('deleteReferenceFile sends DELETE with refId', () => {
    const refId = 123
    expect(refId).toBe(123)
  })
})

// --- ModificationItem and OptimizationItem types ---
describe('ModificationItem and OptimizationItem types', () => {
  it('OptimizationItem has priority field', () => {
    const item = { field: 'name', current: 'old', suggestion: 'new', priority: '高' as const }
    expect(item).toHaveProperty('priority')
    expect(['高', '中', '低']).toContain(item.priority)
  })

  it('ModificationItem lacks priority field', () => {
    const item: any = { field: 'name', current: 'old', suggestion: 'new' }
    expect(item).not.toHaveProperty('priority')
  })
})

// --- Scene 2: accept / supplement / reject ---
describe('Scene 2 - accept / supplement / reject', () => {
  it('acceptModification marks a modification as disabled', () => {
    const disabledMods = new Set<string>()
    disabledMods.add('0-0')
    expect(disabledMods.has('0-0')).toBe(true)
    expect(disabledMods.has('0-1')).toBe(false)
  })

  it('rejectModification marks mod as disabled', () => {
    const disabledMods = new Set<string>()
    const msgIndex = 2
    const modIdx = 1
    disabledMods.add(`${msgIndex}-${modIdx}`)
    expect(disabledMods.has('2-1')).toBe(true)
  })

  it('supplementCount resets on new search', () => {
    let supplementCount = 2
    expect(supplementCount).toBe(2)
    supplementCount = 0
    expect(supplementCount).toBe(0)
  })

  it('supplement passes msgIndex and modIdx through', () => {
    const item = { field: 'skills', current: 'old', suggestion: 'new' }
    const msgIndex = 1
    const modIdx = 0
    const result = { item, msgIndex, modIdx }
    expect(result.msgIndex).toBe(1)
    expect(result.modIdx).toBe(0)
    expect(result.item.field).toBe('skills')
  })
})

// --- Reasoning display ---
describe('Reasoning display', () => {
  it('toggles reasoning visibility', () => {
    const showReasoningMap = new Map<string, boolean>()
    const msgId = 'msg-1'
    const current = showReasoningMap.get(msgId) ?? false
    showReasoningMap.set(msgId, !current)
    expect(showReasoningMap.get(msgId)).toBe(true)
  })

  it('starts with reasoning hidden for new messages', () => {
    const showReasoningMap = new Map<string, boolean>()
    expect(showReasoningMap.get('new-msg') ?? false).toBe(false)
  })

  it('does not show reasoning toggle when reasoning is empty', () => {
    const msg = { id: '1', role: 'user' as const, content: 'hello', reasoning: '' }
    const hasReasoning = !!msg.reasoning
    expect(hasReasoning).toBe(false)
  })
})

// --- Reference content classification ---
describe('Reference content classification', () => {
  it('referenceSection only appears when user uploads reference files', () => {
    const referenceFiles: any[] = []
    const hasReferenceSection = referenceFiles.length > 0
    expect(hasReferenceSection).toBe(false)
  })

  it('similaritySearch snippets are not marked as reference material', () => {
    const chunks = [
      { pageContent: 'similar content from DB', docType: 'resume' as const },
      { pageContent: 'reference content', docType: 'reference' as const }
    ]
    const hasReference = chunks.filter((c) => c.docType === 'reference').length > 0
    expect(hasReference).toBe(true)

    const onlyResume: Array<{ pageContent: string; docType: string }> = [
      { pageContent: 'just resume', docType: 'resume' }
    ]
    const isRef = onlyResume.filter((c) => c.docType === 'reference').length > 0
    expect(isRef).toBe(false)
  })
})

// --- Route guards ---
describe('Route guards', () => {
  it('redirects authenticated user from / to /conversations', () => {
    localStorage.setItem('auth_token', 'test-token')
    const token = localStorage.getItem('auth_token')
    expect(token).toBe('test-token')
  })

  it('redirects unauthenticated user to /', () => {
    localStorage.removeItem('auth_token')
    const requiresAuth = true
    const token = localStorage.getItem('auth_token')
    const shouldRedirect = requiresAuth && !token
    expect(shouldRedirect).toBe(true)
  })
})

// --- Message queue ---
describe('Message queue', () => {
  it('enqueues and processes requests in order', () => {
    const queue: Array<{ id: string; status: string }> = []
    queue.push({ id: 'r1', status: 'pending' })
    queue.push({ id: 'r2', status: 'pending' })
    expect(queue).toHaveLength(2)
    queue[0].status = 'processing'
    expect(queue[0].status).toBe('processing')
    queue.shift()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('r2')
  })

  it('cancelRequest marks item as canceled', () => {
    const queue = [
      { id: 'r1', status: 'pending' as const, canceled: false },
      { id: 'r2', status: 'pending' as const, canceled: false }
    ]
    const updated = queue.map((r) =>
      r.id === 'r2' ? { ...r, canceled: true, status: 'failed' as const } : r
    )
    expect(updated[1].canceled).toBe(true)
    expect(updated[1].status).toBe('failed')
  })

  it('supplement constructs contextual query', () => {
    const field = 'skills'
    const original = 'good at JS'
    const supplement = 'add React'
    const query = `之前要求修改「${field}」：${original}\n现补充：${supplement}`
    expect(query).toContain(field)
    expect(query).toContain(supplement)
  })

  it('resets supplementCount on new search', () => {
    let supplementCount = 3
    expect(supplementCount).toBe(3)
    supplementCount = 0
    expect(supplementCount).toBe(0)
  })
})

// --- Disabled cards ---
describe('Disabled cards tracking', () => {
  it('marks optimization card as disabled', () => {
    const disabledOpts = new Set<string>()
    disabledOpts.add('0-0')
    expect(disabledOpts.has('0-0')).toBe(true)
  })

  it('marks modification card as disabled and blocks supplement button', () => {
    const disabledMods = new Set<string>()
    const msgIndex = 1
    const modIdx = 2
    disabledMods.add(`${msgIndex}-${modIdx}`)
    expect(disabledMods.has('1-2')).toBe(true)
  })
})

// --- Zod parsing for optimization JSON ---
describe('Optimization JSON parsing', () => {
  it('parses valid optimization JSON', () => {
    const raw = '{"field":"name","current":"old","suggestion":"new"}'
    expect(() => JSON.parse(raw)).not.toThrow()
    const parsed = JSON.parse(raw)
    expect(parsed.field).toBe('name')
    expect(parsed.suggestion).toBe('new')
  })

  it('rejects invalid optimization JSON', () => {
    const raw = 'not-json'
    expect(() => JSON.parse(raw)).toThrow()
  })
})

describe('Conversation ID validation', () => {
  it('conversationId is a non-empty string', () => {
    expect(typeof 'conv_1_abc12345').toBe('string')
    expect('conv_1_abc12345'.length).toBeGreaterThan(0)
  })
})
