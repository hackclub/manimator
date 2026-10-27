// Python worker: boots Pyodide once, then bakes scenes into frame buffers and
// streams them to the main thread after every self.play() / self.wait().
// Runs as a module worker outside the importmap, so it imports nothing by bare name.
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/"

let interrupt = null
let runScene = null
let pyodide = null
let booted = null

async function boot(manimUrl) {
  const t0 = performance.now()
  const [{ loadPyodide }, manimSource] = await Promise.all([
    import(`${PYODIDE_URL}pyodide.mjs`),
    fetch(manimUrl).then((r) => r.text()),
  ])
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL })
  await pyodide.loadPackage("numpy")
  pyodide.FS.writeFile("/home/pyodide/manim.py", manimSource)
  pyodide.runPython("import sys; sys.path.insert(0, '/home/pyodide'); import manim")
  runScene = pyodide.pyimport("manim")._run_user_scene
  if (interrupt) pyodide.setInterruptBuffer(interrupt)
  self.postMessage({ type: "ready", ms: performance.now() - t0 })
}

function run(id, code, fps, scene) {
  if (interrupt) Atomics.store(interrupt, 0, 0)
  const t0 = performance.now()
  let frames = 0
  const emit = (data, lengths, meta) => {
    const d = data.getBuffer()
    const l = lengths.getBuffer()
    const f32 = new Float32Array(d.data)
    const i32 = new Int32Array(l.data)
    d.release()
    l.release()
    frames += i32.length
    self.postMessage({ type: "chunk", id, data: f32, lengths: i32, meta: JSON.parse(meta) }, [f32.buffer, i32.buffer])
  }
  try {
    const result = runScene(code, emit, fps, scene)
    const [name, scenes] = result.toJs()
    result.destroy()
    self.postMessage({ type: "done", id, ms: performance.now() - t0, frames, scene: name, scenes })
  } catch (err) {
    const text = String(err?.message ?? err)
    if (text.includes("KeyboardInterrupt")) {
      self.postMessage({ type: "cancelled", id })
      return
    }
    const lines = [...text.matchAll(/File "<scene>", line (\d+)/g)]
    const line = lines.length ? Number(lines[lines.length - 1][1]) : null
    const summary = text.trim().split("\n").filter(Boolean).pop() ?? text
    self.postMessage({ type: "error", id, message: summary, line, traceback: cleanTraceback(text) })
  }
}

// Drop frames from the engine itself so tracebacks point at the user's code.
function cleanTraceback(text) {
  const out = []
  let skip = false
  for (const line of text.split("\n")) {
    if (/^\s+File "/.test(line)) skip = !line.includes('"<scene>"')
    if (!skip) out.push(line)
  }
  return out.join("\n")
}

self.onmessage = async (e) => {
  const msg = e.data
  if (msg.type === "init") {
    interrupt = msg.interrupt ? new Int32Array(msg.interrupt) : null
    booted = boot(msg.manimUrl).catch((err) => {
      self.postMessage({ type: "error", id: -1, message: `Failed to load Python: ${err}`, line: null, traceback: "" })
    })
    return
  }
  if (msg.type === "run") {
    await booted
    if (runScene) run(msg.id, msg.code, msg.fps, msg.scene)
  }
}
