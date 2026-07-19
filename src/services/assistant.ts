/**
 * assistant.ts
 * LLM-powered question answering over the API catalog.
 *
 * Design:
 *  - The full 60-API catalog is serialised to ~3 KB of text and injected
 *    into the system prompt.  At that size it fits comfortably inside any
 *    modern context window and avoids the latency of vector retrieval for
 *    a catalog this small.
 *  - For spec assessments we run the deterministic checker first, then
 *    attach the structured results so the LLM can give concrete suggestions
 *    rather than guessing.
 *  - Intent is detected heuristically; the LLM self-signals ambiguity
 *    via natural language patterns we detect in the reply.
 */
import OpenAI from 'openai';
import { getCatalogText } from './catalog.js';
import { assessSpec, assessAllSpecs } from './assessor.js';
import { listAvailableSpecs } from './specs.js';
import type { AskResponse } from '../types/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an API Catalog Assistant embedded inside a developer portal.
You have access to a catalog of 60 APIs and a set of OpenAPI specs.

Capabilities:
1. Answer natural-language questions about the catalog — status, dependencies, domains,
   gateways, owners, protocols, onboarding dates.
2. Interpret and explain API quality assessment results and suggest concrete fixes.
3. Handle ambiguous or underspecified requests gracefully — state what you are assuming
   and ask ONE clarifying question when needed.

Tone: concise, developer-friendly, factual.  Always cite specific API names.
If a question cannot be answered from the catalog data, say so clearly.`;

export async function ask(question: string): Promise<AskResponse> {
  const catalogText    = getCatalogText();
  const availableSpecs = listAvailableSpecs();
  const lq             = question.toLowerCase();

  // — Intent detection ————————————————————————————————————————————
  const assessKeywords = ['spec', 'quality', 'wrong', 'security problem', 'rank',
    'best', 'worst', 'assess', 'fix', 'improve', 'rubric', 'score'];
  const isAssessment = assessKeywords.some(k => lq.includes(k));
  let intent: AskResponse['intent'] = 'qa';
  let extraContext = '';

  if (isAssessment) {
    intent = 'assess';

    const isRanking = lq.includes('rank') ||
      lq.includes('all spec') || lq.includes('all the spec') ||
      lq.includes('from best') || lq.includes('from worst');

    if (isRanking) {
      const rankings = assessAllSpecs();
      extraContext = '\n\n=== SPEC RANKINGS (programmatic) ===\n' +
        rankings.map((r, i) =>
          `${i + 1}. ${r.apiName}: ${r.score}/100 (${r.grade}) — ` +
          `passed ${r.passedRules}/12 rules`
        ).join('\n');
    } else {
      // Match a specific spec in the question
      const matched = availableSpecs.find(s =>
        lq.includes(s) ||
        lq.includes(s.replace(/-api$/, '').replace(/-/g, ' '))
      );
      if (matched) {
        const result = assessSpec(matched);
        if (result) {
          const failed = result.results.filter(r => !r.passed);
          extraContext =
            `\n\n=== ASSESSMENT: ${matched} ===\n` +
            `Score: ${result.score}/100 (${result.grade}), ` +
            `passed ${result.passedRules}/12 rules\n` +
            `\nFailed rules:\n` +
            failed.map(r =>
              `- [${r.ruleId}] ${r.title} (${r.severity})\n` +
              `  Issues: ${r.issues.join('; ')}\n` +
              `  Fix: ${r.suggestions.join('; ')}`
            ).join('\n');
        }
      }
    }
  }

  // — Build prompt ———————————————————————————————————————————
  const userMessage =
    `API Catalog (60 APIs — one per line):\n${catalogText}\n\n` +
    `Available OpenAPI specs: ${availableSpecs.join(', ')}` +
    extraContext +
    `\n\n---\nQuestion: ${question}`;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 900,
  });

  const answer = completion.choices[0]?.message?.content ?? 'No response generated.';

  // Detect if the LLM flagged ambiguity
  if (/could you (?:clarify|specify)|what do you mean|did you mean|are you asking|which .+ did you/i.test(answer)) {
    intent = 'ambiguous';
  }

  return { answer, intent };
}
