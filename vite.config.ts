import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';
import appConfig from './app.config';

/** `PAGE_SIZE` is defined once in `app.config.ts`. Client code uses `src/constants.ts`; `import.meta.env.VITE_PAGE_SIZE` mirrors it at build time. */
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_PAGE_SIZE': JSON.stringify(appConfig.PAGE_SIZE),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      https: (() => {
        const certPath = process.env.VITE_CERT_PATH || '/tmp/bella-certs/cert.pem';
        const keyPath = process.env.VITE_KEY_PATH || '/tmp/bella-certs/key.pem';
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
        }
        return false;
      })(),
    },
  };
});
