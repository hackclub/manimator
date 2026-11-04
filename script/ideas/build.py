"""Builds db/seeds/ideas.json from batches of ideas written against script/ideas/standards.json.

    python3 script/ideas/build.py ideas-a.json ideas-b.json ...

Each batch was written by an LLM following script/ideas/brief.md, one per band of standards. This merges them, adds
each standard's topic, gives every idea a stable key, and drops near-duplicates: TF-IDF cosine similarity between
titles plus lines, over SIMILAR. Good enough at this size; swap in embeddings if the pool grows a lot.

standards.json is the Common Core math standards (grades 3-8 and high school) from the Common Standards Project
(commonstandardsproject.com, CC BY 3.0 US), with each standard put in the band of the class that usually covers it.
"""
import json, math, re, sys, collections, pathlib

SIMILAR = 0.5
ROOT = pathlib.Path(__file__).resolve().parents[2]
STOP = set("a an the of and or to in on is it its as by for with that this into from at be are you your one two each then them they their its how why what when which".split())


def words(text):
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP and len(w) > 1]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main(paths):
    standards = {s["code"]: s for s in json.load(open(ROOT / "script/ideas/standards.json"))}
    ideas, problems = [], []
    for path in paths:
        for idea in json.load(open(path)):
            s = standards.get(idea.get("standard"))
            if not s or not idea.get("title") or not idea.get("line"):
                problems.append(f"skipped (unknown standard or empty): {idea}")
                continue
            ideas.append({
                "key": f"{s['code']}/{slug(idea['title'])}", "standard": s["code"], "topic": s["domain"],
                "band": s["band"], "title": idea["title"].strip(), "line": idea["line"].strip(),
                "needs": sorted(set(idea.get("needs") or [])),
            })

    # Same key twice: keep the first.
    seen, unique = set(), []
    for idea in ideas:
        if idea["key"] in seen:
            problems.append(f"duplicate key: {idea['key']}")
        else:
            seen.add(idea["key"]); unique.append(idea)

    # TF-IDF vectors, then drop any idea too close to one already kept.
    docs = [words(f"{i['title']} {i['title']} {i['line']}") for i in unique]
    df = collections.Counter(w for d in docs for w in set(d))
    n = len(docs)
    vecs = []
    for d in docs:
        tf = collections.Counter(d)
        v = {w: c * math.log(n / df[w]) for w, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1
        vecs.append({w: x / norm for w, x in v.items()})
    kept, dropped = [], []
    for i, v in enumerate(vecs):
        twin = next((k for k in kept if sum(x * vecs[k].get(w, 0) for w, x in v.items()) > SIMILAR), None)
        if twin is None:
            kept.append(i)
        else:
            dropped.append((unique[i], unique[twin]))

    out = [unique[i] for i in kept]
    json.dump(out, open(ROOT / "db/seeds/ideas.json", "w"), indent=1, ensure_ascii=False)
    print(f"{len(out)} ideas kept, {len(dropped)} near-duplicates dropped, {len(problems)} problems")
    print(collections.Counter(i["band"] for i in out))
    print("needs:", collections.Counter(n for i in out for n in i["needs"]))
    for a, b in dropped:
        print(f"  dropped {a['standard']} {a['title']!r}  ~  {b['standard']} {b['title']!r}")
    for p in problems:
        print("  " + p)


if __name__ == "__main__":
    main(sys.argv[1:])
