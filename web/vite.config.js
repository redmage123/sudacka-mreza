import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        tsconfigPaths(),
    ],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_CMS_URL || 'http://localhost:4094',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        // SECURITY: disable source maps in production — exposes full TypeScript source
        sourcemap: false,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                sw: resolve(__dirname, 'src/sw.ts'),
            },
            output: {
                // Output sw.js at the dist root (no hash) so the browser can scope it correctly.
                // All other entry chunks go into assets/ with content hashes as usual.
                entryFileNames: (chunkInfo) => chunkInfo.name === 'sw' ? '[name].js' : 'assets/[name]-[hash].js',
            },
        },
    },
});
