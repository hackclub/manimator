// Puts `line` on a new line under the last line matching `anchor`, indented the same.
export function insertAfter(code, anchor, line) {
  const lines = code.split("\n")
  let at = -1
  lines.forEach((text, i) => { if (anchor.test(text)) at = i })
  if (at < 0) return code
  const indent = lines[at].match(/^\s*/)[0]
  lines.splice(at + 1, 0, indent + line)
  return lines.join("\n")
}
