// Fixed per-item header, see the layout notes at the top of manim.py.
export const HEADER = 15

// All baked frames of one run. Chunks stay as received; frames are views into them.
export class FrameStore {
  frames = []
  strings = []
  sections = []
  background = "#000000"
  fps = 30
  done = false

  constructor(runId) {
    this.runId = runId
  }

  append(data, lengths, meta) {
    let off = 0
    for (const len of lengths) {
      this.frames.push(data.subarray(off, off + len))
      off += len
    }
    this.strings.push(...meta.strings)
    this.sections.push(...meta.sections)
    this.background = meta.background
    this.fps = meta.fps
  }

  get length() {
    return this.frames.length
  }

  sectionAt(frame) {
    return this.sections.find((s) => frame >= s.start && frame < s.end) ?? this.sections[this.sections.length - 1]
  }
}
