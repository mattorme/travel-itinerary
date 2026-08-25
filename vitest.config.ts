import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Component tests render to static markup, which needs no DOM.
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
    ],
    globals: true,
    // Hermetic: tests must never depend on a developer's .env.local, and must
    // never be one typo away from calling a real API with a real key.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      OPENAI_API_KEY: 'test-openai-key',
      GOOGLE_MAPS_SERVER_KEY: 'test-google-key',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
