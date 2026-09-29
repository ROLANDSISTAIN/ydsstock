/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : le même build marche sur un site, dans Tauri et dans Capacitor.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
