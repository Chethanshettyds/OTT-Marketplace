import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

// Suppress noisy WebSocket proxy errors (ECONNRESET, ECONNABORTED) —
// these are harmless and happen whenever the browser closes a connection.
const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, opts) => {
  if (msg.includes('ECONNRESET') || msg.includes('ECONNABORTED') || msg.includes('ws proxy')) return;
  originalWarn(msg, opts);
};
const originalError = logger.error.bind(logger);
logger.error = (msg, opts) => {
  if (msg.includes('ECONNRESET') || msg.includes('ECONNABORTED') || msg.includes('ws proxy')) return;
  originalError(msg, opts);
};

const suppressProxyErrors = (proxy: any) => {
  proxy.on('error', () => {});
  proxy.on('proxyReqWs', (_proxyReq: any, _req: any, socket: any) => {
    socket.on('error', () => {});
  });
  proxy.on('proxyRes', (_proxyRes: any, _req: any, res: any) => {
    res.on('error', () => {});
  });
  proxy.on('open', (proxySocket: any) => {
    proxySocket.on('error', () => {});
  });
  proxy.on('close', () => {});
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: suppressProxyErrors,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        configure: suppressProxyErrors,
      },
    },
  },
});
