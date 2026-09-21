import type { RequestHandler } from 'express';
import type { ApiError } from '@quiz/shared';
import type { z } from 'zod';

export function zodIssues(error: z.ZodError): ApiError['issues'] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Valida req.body con el esquema y lo reemplaza por el valor parseado (con trims aplicados). */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Datos inválidos', issues: zodIssues(result.error) } satisfies ApiError);
      return;
    }
    req.body = result.data;
    next();
  };
}
