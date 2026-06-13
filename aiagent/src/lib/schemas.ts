import { z } from 'zod'

const phoneRegex = /^1[3-9]\d{9}$/

export const LoginSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  captcha: z.string().length(6, 'Captcha must be 6 digits'),
  key: z.string().min(1, 'Captcha key is required')
})

export const CaptchaGenerateSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number')
})

export const CaptchaVerifySchema = z.object({
  key: z.string().min(1),
  code: z.string().length(6)
})

export const RagSearchSchema = z.object({
  query: z.string().optional(),
  content: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
  k: z.coerce.number().int().min(1).max(20).optional(),
  conversationId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string().optional(),
        parts: z
          .array(
            z.object({
              type: z.string(),
              text: z.string().optional()
            })
          )
          .optional()
      })
    )
    .optional(),
  userMsgId: z.string().optional(),
  assistantMsgId: z.string().optional()
})

export const ApplyModificationSchema = z.object({
  conversationId: z.string().min(1),
  optimization: z.union([
    z.string(),
    z.object({
      field: z.string(),
      current: z.string(),
      suggestion: z.string(),
      reason: z.string().optional()
    })
  ]),
  type: z.enum(['apply', 'accept']).optional(),
  clientIds: z
    .object({
      user: z.string().optional(),
      processing: z.string().optional()
    })
    .optional(),
  assistantMsgId: z.string().optional()
})

export const RenderResumePdfSchema = z.object({
  markdown: z.string().min(1)
})

export const RagSummarizeSchema = z.object({
  conversationId: z.string().min(1)
})

export const UploadUserDocumentSchema = z.object({
  docType: z.enum(['excellent_resume', 'reference_doc']),
  category: z.string().optional()
})

export const PatchUserDocumentSchema = z.object({
  active: z.union([z.literal(0), z.literal(1), z.coerce.number().refine((v) => v === 0 || v === 1)])
})

export const AdminUploadSystemDocSchema = z.object({
  docType: z.enum(['excellent_resume', 'reference_doc']),
  category: z.string().min(1)
})

export const PatchSystemDocSchema = z.object({
  active: z.union([z.literal(0), z.literal(1), z.coerce.number().refine((v) => v === 0 || v === 1)])
})

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

export const RefIdParamSchema = z.object({
  refId: z.coerce.number().int().positive()
})

export const ConversationIdParamSchema = z.object({
  conversationId: z.string().min(1)
})

export const ConversationIdQuerySchema = z.object({
  conversationId: z.string().min(1)
})
