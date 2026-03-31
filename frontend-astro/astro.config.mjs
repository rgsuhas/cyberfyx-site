// @ts-check
import { defineConfig } from 'astro/config';

const runtime = /** @type {any} */ (globalThis);
const apiProxyTarget = runtime.process?.env?.API_PROXY_TARGET ?? 'http://127.0.0.1:8000';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  },
});
