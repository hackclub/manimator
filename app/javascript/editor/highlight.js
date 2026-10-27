// A small Python tokenizer for read-only snippets (the home page's resume card),
// colored like the editor. Ported from the "3a" design.
const KEYWORDS = new Set(["from", "import", "class", "def", "lambda", "for", "in", "return", "if", "else", "elif", "and", "or", "not", "while", "with", "as"])
const TOKEN = /(\s+)|(r?"[^"]*"|r?'[^']*')|(#.*$)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"'#])/g

export function highlightLine(line) {
  const out = document.createDocumentFragment()
  let prev = ""
  for (const m of line.matchAll(TOKEN)) {
    const s = m[0]
    let cls = null
    if (m[2]) cls = "tok-str"
    else if (m[3]) cls = "tok-comment"
    else if (m[4]) cls = "tok-num"
    else if (m[5]) {
      if (KEYWORDS.has(s)) cls = "tok-kw"
      else if (s === "True" || s === "False" || s === "None") cls = "tok-num"
      else if (s === "self") cls = "tok-self"
      else if (prev === "class") cls = "tok-class"
      else if (line[m.index + s.length] === "(") cls = "tok-fn"
      prev = s
    } else if (m[6]) cls = "tok-punct"
    if (cls) {
      const span = document.createElement("span")
      span.className = cls
      span.textContent = s
      out.append(span)
    } else out.append(s)
  }
  return out
}
