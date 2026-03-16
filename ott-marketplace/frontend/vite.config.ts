import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const suppressProxyErrors = (proxy: any) => {
  proxy.on('error', () => {});
  proxy.on('proxyReqWs', (_proxyReq: any, _req: any, socket: any) => {
    socket.on('error', () => {});
    socket.destroy();
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
