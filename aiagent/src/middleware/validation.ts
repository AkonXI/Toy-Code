import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.issues })
      return
    }
    req.body = result.data
    next()
  }
}

export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid parameters', details: result.error.issues })
      return
    }
    next()
  }
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      res.status(400).json({ error: 'Invalid query parameters', details: result.error.issues })
      return
    }
    req.query = result.data as any
    next()
  }
}
