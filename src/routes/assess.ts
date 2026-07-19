import type { FastifyInstance } from 'fastify';
import { assessSpec, assessAllSpecs } from '../services/assessor.js';
import { listAvailableSpecs } from '../services/specs.js';
import type { AssessRequest, AssessmentResult } from '../types/index.js';

export async function assessRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /assess
   * Body: { apiName: string }
   * Runs all 12 rubric checks against the named spec and returns a
   * structured AssessmentResult with per-rule pass/fail and suggestions.
   */
  app.post<{ Body: AssessRequest }>('/assess', {
    schema: {
      body: {
        type: 'object',
        required: ['apiName'],
        properties: { apiName: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { apiName } = req.body;
    const result = assessSpec(apiName);
    if (!result) {
      return reply.code(404).send({
        error: `No spec found for '${apiName}'`,
        available: listAvailableSpecs(),
      });
    }
    return result as AssessmentResult;
  });

  /**
   * GET /assess/rank
   * Returns all 10 specs sorted best-to-worst by quality score.
   */
  app.get('/assess/rank', async () => ({ rankings: assessAllSpecs() }));

  /**
   * GET /assess/specs
   * Lists the API names for which a spec file exists.
   */
  app.get('/assess/specs', async () => ({ specs: listAvailableSpecs() }));
}
