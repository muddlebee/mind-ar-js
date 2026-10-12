import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({mode}) => ({
  root: fileURLToPath(new URL('./examples/face-tracking/try-on/', import.meta.url)),
  base: './',
  publicDir: 'public', // Only this demo's notices; never copy unrelated examples/models.
  plugins: mode === 'https' ? [basicSsl()] : [],
  resolve: {alias: {
    'three/addons/': 'three/examples/jsm/',
    ...(mode === 'test' ? {'../../../src/face-target/three.js': fileURLToPath(new URL('./examples/face-tracking/try-on/checks/fixture-adapter.js', import.meta.url))} : {}),
  }},
  server: {host: '0.0.0.0', port: 4173, strictPort: true, fs: {allow: [fileURLToPath(new URL('.', import.meta.url))]}},
  preview: {host: '0.0.0.0', port: 4173, strictPort: true},
  build: {
    outDir: '../../../dist-try-on',
    emptyOutDir: true,
    target: 'es2020',
  },
}));
