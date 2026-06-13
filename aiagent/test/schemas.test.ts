import { describe, it, expect } from 'vitest'
import {
  LoginSchema,
  CaptchaGenerateSchema,
  CaptchaVerifySchema,
  RagSearchSchema,
  ApplyModificationSchema,
  RenderResumePdfSchema,
  RagSummarizeSchema,
  UploadUserDocumentSchema,
  PatchUserDocumentSchema,
  AdminUploadSystemDocSchema,
  PatchSystemDocSchema,
  IdParamSchema,
  RefIdParamSchema,
  ConversationIdParamSchema,
  ConversationIdQuerySchema
} from '../src/lib/schemas'

describe('LoginSchema', () => {
  it('should accept valid login', () => {
    const result = LoginSchema.parse({ phone: '13800138000', captcha: '123456', key: 'abc' })
    expect(result.phone).toBe('13800138000')
  })

  it('should reject invalid phone', () => {
    expect(() => LoginSchema.parse({ phone: '123', captcha: '123456', key: 'abc' })).toThrow()
  })

  it('should reject short captcha', () => {
    expect(() =>
      LoginSchema.parse({ phone: '13800138000', captcha: '12345', key: 'abc' })
    ).toThrow()
  })
})

describe('RagSearchSchema', () => {
  it('should accept search with only query', () => {
    const result = RagSearchSchema.parse({ query: '优化简历' })
    expect(result.query).toBe('优化简历')
  })

  it('should accept empty object', () => {
    const result = RagSearchSchema.parse({})
    expect(result).toBeDefined()
  })

  it('should reject invalid url', () => {
    expect(() => RagSearchSchema.parse({ url: 'not-a-url' })).toThrow()
  })
})

describe('ApplyModificationSchema', () => {
  it('should accept valid modification', () => {
    const result = ApplyModificationSchema.parse({
      conversationId: 'conv_123',
      optimization: { field: 'summary', current: 'old text', suggestion: 'new text' }
    })
    expect(result.conversationId).toBe('conv_123')
  })

  it('should accept optimization as JSON string', () => {
    const result = ApplyModificationSchema.parse({
      conversationId: 'conv_123',
      optimization: JSON.stringify({ field: 'summary', current: 'old', suggestion: 'new' })
    })
    expect(typeof result.optimization).toBe('string')
  })
})

describe('RenderResumePdfSchema', () => {
  it('should reject empty markdown', () => {
    expect(() => RenderResumePdfSchema.parse({ markdown: '' })).toThrow()
  })
})

describe('UploadUserDocumentSchema', () => {
  it('should accept valid doc type', () => {
    const result = UploadUserDocumentSchema.parse({ docType: 'excellent_resume' })
    expect(result.docType).toBe('excellent_resume')
  })

  it('should reject invalid doc type', () => {
    expect(() => UploadUserDocumentSchema.parse({ docType: 'invalid' })).toThrow()
  })
})

describe('PatchUserDocumentSchema', () => {
  it('should accept 0', () => {
    expect(PatchUserDocumentSchema.parse({ active: 0 }).active).toBe(0)
  })

  it('should accept 1', () => {
    expect(PatchUserDocumentSchema.parse({ active: 1 }).active).toBe(1)
  })

  it('should reject 2', () => {
    expect(() => PatchUserDocumentSchema.parse({ active: 2 })).toThrow()
  })
})

describe('IdParamSchema', () => {
  it('should coerce string to number', () => {
    const result = IdParamSchema.parse({ id: '42' })
    expect(result.id).toBe(42)
  })

  it('should reject negative id', () => {
    expect(() => IdParamSchema.parse({ id: '-1' })).toThrow()
  })
})
