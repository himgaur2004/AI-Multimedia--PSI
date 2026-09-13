import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://127.0.0.1:8000';

  return {
    esbuild: {
      jsx: 'automatic',
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    // Expose env vars with VITE_ prefix to the browser bundle
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || ''),
    },
  };
});
