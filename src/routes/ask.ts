import type { FastifyInstance } from 'fastify';
import { ask } from '../services/assistant.js';
import type { AskRequest, AskResponse } from '../types/index.js';

export async function askRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AskRequest; Reply: AskResponse }>('/ask', {
    schema: {
      body: {
        type: 'object',
        required: ['question'],
        properties: { question: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req) => {
    const { question } = req.body;
    return ask(question);
  });
}
