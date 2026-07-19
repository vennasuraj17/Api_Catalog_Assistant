import Fastify from 'fastify';
import { askRoutes }      from './routes/ask.js';
import { assessRoutes }   from './routes/assess.js';
import { scenarioRoutes } from './routes/scenarios.js';

const app = Fastify({ logger: true });

// Health check — used by container orchestrators and smoke tests
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

// Route groups
await app.register(askRoutes);
await app.register(assessRoutes);
await app.register(scenarioRoutes);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
