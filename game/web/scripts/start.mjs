import { build, preview } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.GHOST_PORT ?? 4173);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid GHOST_PORT');
}

await build({ root });

const server = await preview({
  root,
  preview: {
    host: '127.0.0.1',
    port,
    strictPort: true
  }
});

let closing = false;
function close() {
  if (closing) return;
  closing = true;
  server.httpServer.close(() => process.exit(0));
  server.httpServer.closeAllConnections?.();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);

console.log(JSON.stringify({
  type: 'ghost-ready',
  url: `http://127.0.0.1:${port}/`,
  runId: process.env.GHOST_HARNESS_RUN_ID ?? ''
}));
