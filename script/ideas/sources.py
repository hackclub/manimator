"""Builds script/ideas/sources.json: the lessons animation ideas are written from, each with a link people can read.

    python3 script/ideas/sources.py

Two sources:
- Euclid's Elements, in David Joyce's edition (mathcs.clarku.edu/~djoyce/java/elements): every proposition of the
  13 books, with its statement.
- Purplemath (purplemath.com): every lesson in its index, with the page's own title and description.

Each lesson gets a band: the math class that usually covers it, as in Idea::CLASSES. Fetches about 200 pages, a
second apart, and caches them in script/ideas/.cache so a rerun doesn't fetch them again.
"""
import html, json, pathlib, re, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / "script/ideas/.cache"
EUCLID = "https://mathcs.clarku.edu/~djoyce/java/elements/"
PURPLEMATH = "https://www.purplemath.com/modules/"

# Book II is algebra drawn as rectangles; V is ratios; VII-IX are whole numbers; X is irrational lengths; XII finds
# areas and volumes by exhaustion, the step before calculus. The rest is plane and solid geometry.
BOOKS = {
    "I": "geometry", "II": "algebra1", "III": "geometry", "IV": "geometry", "V": "middle", "VI": "geometry",
    "VII": "middle", "VIII": "algebra2", "IX": "middle", "X": "precalc", "XI": "geometry", "XII": "precalc",
    "XIII": "geometry",
}
BOOK_TOPICS = {
    "I": "Triangles, parallels and area", "II": "Geometric algebra", "III": "Circles",
    "IV": "Polygons in and around circles", "V": "Ratio and proportion", "VI": "Similar figures",
    "VII": "Number theory", "VIII": "Numbers in continued proportion", "IX": "Number theory",
    "X": "Incommensurable lengths", "XI": "Solid geometry", "XII": "Areas and volumes by exhaustion",
    "XIII": "The regular solids",
}
SECTIONS = {
    "prelim": ("middle", "Preliminary topics"), "beginning": ("algebra1", "Beginning algebra"),
    "intermed": ("algebra2", "Intermediate algebra"), "advanced": ("precalc", "Advanced algebra"),
    "wordprobs": ("algebra1", "Word problems"), "appendix": ("middle", "Appendix"), "trig": ("precalc", "Trigonometry"),
}
# Pages about the site or about school, not math to animate.
CHROME = {"Select a Course Below", "Purplemath", "MathHelp.com", "Share This Page", "Visit Our Profiles"}
SKIP = {"bibleval", "mathtext", "howgrade", "placment", "why_math", "grklttrs", "conventn", "romannum", "metric"}


def fetch(url):
    path = CACHE / re.sub(r"[^A-Za-z0-9.]+", "_", url)
    if not path.exists():
        CACHE.mkdir(exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (manimator idea builder)"})
        path.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        time.sleep(1)
    return path.read_bytes().decode("utf-8", errors="replace")


def clean(text):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).strip()


def euclid():
    out = []
    for book, band in BOOKS.items():
        page = fetch(f"{EUCLID}book{book}/book{book}.html")
        # The books differ a little: quoted or bare hrefs, a period inside the link or after it, or none.
        pattern = r'<dt>[^<]*(?:<[^a][^>]*>)*<a href="?(prop' + book + r'(\d+)\.html)"?>Proposition \d+.*?<dd>(.*?)(?=<p>|</dl>)'
        for m in re.finditer(pattern, page, re.S):
            href, n, text = m.groups()
            out.append({
                "code": f"Euclid {book}.{n}", "source": "Euclid's Elements", "topic": f"Book {book}: {BOOK_TOPICS[book]}",
                "title": f"Book {book}, Proposition {n}", "text": clean(text), "band": band,
                "url": f"{EUCLID}book{book}/{href}",
            })
    return out


def purplemath():
    index = fetch(f"{PURPLEMATH}index.htm")
    out, seen = [], set()
    for section, (band, topic) in SECTIONS.items():
        start = index.find(f'id="index_{section}"')
        block = index[start:index.find("</div> <!-- grid", start)]
        for href in re.findall(r'<a href="([a-z0-9_]+)\.htm[^"]*"', block):
            if href in seen or href in SKIP:
                continue
            seen.add(href)
            page = fetch(f"{PURPLEMATH}{href}.htm")
            title = clean(re.search(r"<title>(.*?)</title>", page, re.S).group(1)).removesuffix(" | Purplemath")
            desc = re.search(r'<meta name="description" content="([^"]*)"', page)
            # The lesson's section headings ("How do I use the Quadratic Formula?"), minus the site's own chrome.
            headings = [h for h in map(clean, re.findall(r"<h[23][^>]*>(.*?)</h[23]>", page, re.S)) if h not in CHROME]
            out.append({
                "code": f"Purplemath {href}", "source": "Purplemath", "topic": topic, "title": title,
                "text": clean(desc.group(1)) if desc else title, "sections": headings, "band": band,
                "url": f"{PURPLEMATH}{href}.htm",
            })
    return out


if __name__ == "__main__":
    sources = euclid() + purplemath()
    json.dump(sources, open(ROOT / "script/ideas/sources.json", "w"), indent=1, ensure_ascii=False)
    import collections
    print(len(sources), "lessons", collections.Counter(s["source"] for s in sources))
    print(collections.Counter(s["band"] for s in sources))
