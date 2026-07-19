import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ask } from '../services/assistant.js';
import type { ScenarioResult } from '../types/index.js';

interface ScenarioData {
  scenarios: Array<{ id: string; type: string; prompt: string }>;
}

export async function scenarioRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /scenarios/run
   * Runs all 10 pre-defined developer scenarios through the assistant
   * and returns each prompt paired with the assistant’s response.
   * Note: makes 10 sequential LLM calls — expect ~30-60 seconds total.
   */
  app.post('/scenarios/run', async () => {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'scenarios.json'), 'utf-8')
    ) as ScenarioData;

    const results: ScenarioResult[] = [];
    for (const s of data.scenarios) {
      const response = await ask(s.prompt);
      results.push({ id: s.id, type: s.type, prompt: s.prompt, response });
    }
    return { results };
  });
}
