// Copies the MediaPipe WASM runtime from node_modules and downloads the two models into public/ so the camera exercises
// do not depend on a CDN at run time. Never fails the install: when offline the app falls back to the CDN.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const models = {
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'pose_landmarker_lite.task': 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

try {
  if (existsSync(wasmSrc)) {
    mkdirSync(wasmDst, { recursive: true });
    cpSync(wasmSrc, wasmDst, { recursive: true });
    console.log('[mediapipe] WASM runtime copied to public/mediapipe/wasm');
  } else console.log('[mediapipe] node_modules/@mediapipe/tasks-vision not found yet; skipped WASM copy');
} catch (e) { console.warn('[mediapipe] WASM copy skipped:', e.message); }

mkdirSync(join(root, 'public', 'models'), { recursive: true });
for (const [file, url] of Object.entries(models)) {
  const dst = join(root, 'public', 'models', file);
  if (existsSync(dst)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
    console.log(`[mediapipe] downloaded ${file}`);
  } catch (e) {
    console.warn(`[mediapipe] could not download ${file} (${e.message}). The app will use the CDN instead; run "npm run setup:mediapipe" when online.`);
  }
}
