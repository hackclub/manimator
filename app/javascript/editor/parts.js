// A scene's parts: a comment line like `# ── The court and the hoop` names the part of the scene below it, down to the
// next one. They're plain comments, so they read fine anywhere, but the story's code pane and the editor fold on
// them, so a newcomer first sees a scene as a few named parts instead of a wall of code (onboarding/scenes.js puts
// them in π's scenes; anyone can write their own).
export const PART = /^\s*# ── (.+?)\s*$/

// The parts in a list of lines (strings): [{ name, heading, start, end, lines }], with indexes into the list.
// `heading` is the heading line's index, start..end its code (end inclusive, trailing blank lines left out), and
// lines how many lines that is.
export function partsOf(texts) {
  const heads = []
  texts.forEach((text, i) => { const m = text.match(PART); if (m) heads.push([i, m[1]]) })
  return heads.map(([heading, name], k) => {
    let end = (heads[k + 1]?.[0] ?? texts.length) - 1
    while (end > heading && !texts[end].trim()) end--
    return { name, heading, start: heading + 1, end, lines: end - heading }
  })
}
