/**
 * MediaPipe runtime + models are loaded from this server first (works offline, no third-party request with camera
 * frames' context, no dependency on a CDN being reachable) and only fall back to the public CDN when the local files
 * are missing. Run `npm run setup:mediapipe` (also done by `npm install`) to put them in public/.
 */
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';
const CDN_MODEL = {
  face_landmarker: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose_landmarker_lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const;
export type ModelName = keyof typeof CDN_MODEL;

/** A dev server answers unknown paths with index.html (200), so also reject HTML responses. */
async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  }
}
export async function resolveWasmBase(): Promise<{ url: string; local: boolean }> {
  const local = '/mediapipe/wasm';
  return (await exists(`${local}/vision_wasm_internal.wasm`)) ? { url: local, local: true } : { url: CDN_WASM, local: false };
}
export async function resolveModel(name: ModelName): Promise<{ url: string; local: boolean }> {
  const local = `/models/${name}.task`;
  return (await exists(local)) ? { url: local, local: true } : { url: CDN_MODEL[name], local: false };
}
