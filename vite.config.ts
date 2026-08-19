import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],build:{rollupOptions:{input:'app.html',output:{format:'iife',inlineDynamicImports:true,entryFileNames:'assets/app.js',assetFileNames:'assets/app.[ext]'}}}});
