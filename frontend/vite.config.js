import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the browser talks to Vite on :5173 and Vite forwards API calls and
// uploaded images to the Node API on :5000, so the frontend always uses relative URLs.
// In production nginx does the same job (see frontend/nginx.conf).
const API = process.env.VITE_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
});
