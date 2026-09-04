// Copies the MediaPipe WASM runtime from node_modules into public/ so the
// pose pipeline is served from our own origin (works offline, no CDN).
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const dest = join(root, 'public', 'mediapipe')

mkdirSync(dest, { recursive: true })
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  copyFileSync(join(src, f), join(dest, f))
}
console.log('MediaPipe WASM copied to public/mediapipe')
