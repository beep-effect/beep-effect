"""adapter-config — SourceObservation extractor for JSON/JSONC config corpus
units of the beep-ci-ops §4b normalization run.

Covers: turbo.json (per-task records + a whole-document record),
.fallowrc.jsonc, standards/fallow.pilot.inventory.jsonc,
standards/fallow.boundaries.provenance.schema.json,
packages/drivers/hubspot/package.json (one whole-document record each).

Facts: `config_key_value` for scalar pairs (key/value grammar-guarded and
pairing-verified with the validator's own rules, mirrored below) and
`task_depends_on_syntactically` for turbo `dependsOn` entries. Input bytes come
from `git show <commit>:<path>` — never the working tree.

Usage:
  python adapter-config.py --self-check <golden_dir>
  python adapter-config.py --repo <root> --out <observations_dir>
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ADAPTER_ID = "adapter-config"
ADAPTER_VERSION = "1.0.0"
PARSER = "python-json+positioned-scanner"
SCRIPT = (
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/"
    "beep-ci-ops/adapters/adapter-config.py"
)
GOLDEN_REL = (
    "explorations/beep-ci-operational-ontology/ontology/extraction/s4/"
    "beep-ci-ops/adapters/golden/config/input.jsonc"
)

TURBO = "turbo.json"
DOC_FILES = [
    ".fallowrc.jsonc",
    "packages/drivers/hubspot/package.json",
    "standards/fallow.boundaries.provenance.schema.json",
    "standards/fallow.pilot.inventory.jsonc",
]

# --- validator mirrors (validate_artifacts.py) -------------------------------


def strip_comments(text: str) -> str:
    text = re.sub(r"<!--.*?(-->|\Z)", "", text, flags=re.S)
    text = re.sub(r"/\*.*?(\*/|\Z)", "", text, flags=re.S)
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"#[^\n]*", "", text)
    text = re.sub(r"^[ \t]*[;!][^\n]*", "", text, flags=re.M)
    return text


def strip_comments_config(text: str, path: str) -> str:
    text = strip_comments(text)
    if str(path).endswith((".ini", ".properties")):
        text = re.sub(r"[;!][^\n]*", "", text)
    return text


def occurs(probe: str, text: str) -> bool:
    return re.search(rf"(?<![\w$#]){re.escape(str(probe))}(?![\w$#])", text) is not None


def config_pair_occurs(key: str, val: str, text: str) -> bool:
    if not val:
        return False
    k, v = re.escape(str(key)), re.escape(str(val))
    post = r"(?=[ \t]*(?:[\r\n,}\])>/;#]|$))"
    unq_end = r"(?=[ \t]*(?:\r?\n(?![ \t])|\Z))"
    pat = (
        rf"(?:^|[\s\"'{{,]){k}[\"']?\s*[:=]\s*"
        rf"(?:\"{v}\"{post}|'{v}'{post}|{v}{unq_end})"
    )
    return re.search(pat, text, re.M) is not None


def ident_ok(obj: str) -> bool:
    return not re.search(r"[\s/]", re.sub(r"<[^<>]*>", "", obj))


def key_ok(key: str) -> bool:
    return bool(re.fullmatch(r"[^\s=/]+", key))


# --- JSONC handling ----------------------------------------------------------


def strip_jsonc_for_parse(text: str) -> str:
    """Remove // and /* */ comments outside strings, preserving newlines."""
    out: list[str] = []
    i, n = 0, len(text)
    in_str = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = n if j == -1 else j
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            seg = text[i : (n if j == -1 else j + 2)]
            out.append("\n" * seg.count("\n"))
            i = n if j == -1 else j + 2
            continue
        out.append(c)
        i += 1
    body = "".join(out)
    # trailing commas (jsonc tolerance)
    return re.sub(r",(\s*[}\]])", r"\1", body)


def find_block_span(text: str, key: str, search_from: int) -> tuple[int, int] | None:
    """Line span (1-based, inclusive) of `"key": { ... }` starting at/after
    offset search_from in RAW text; string-aware brace matching."""
    m = re.compile(rf'"{re.escape(key)}"\s*:\s*{{').search(text, search_from)
    if not m:
        return None
    start_idx = m.start()
    depth = 0
    in_str = False
    i = text.index("{", m.end() - 1)
    j = i
    while j < len(text):
        c = text[j]
        if in_str:
            if c == "\\":
                j += 2
                continue
            if c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    start_line = text.count("\n", 0, start_idx) + 1
    end_line = text.count("\n", 0, j) + 1
    return (start_line, end_line)


def scalar_pairs(node: object, out: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, (dict, list)):
                scalar_pairs(v, out)
            elif isinstance(v, bool):
                out.append((str(k), "true" if v else "false"))
            elif isinstance(v, (int, float)):
                out.append((str(k), json.dumps(v)))
            elif isinstance(v, str) and v:
                out.append((str(k), v))
    elif isinstance(node, list):
        for v in node:
            scalar_pairs(v, out)


# --- record assembly ---------------------------------------------------------


def canonical_id(commit: str, path: str, s: int, e: int, pairs: list) -> str:
    payload = [commit, path, s, e, pairs, ADAPTER_ID, ADAPTER_VERSION]
    return "so:sha256:" + hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest()


def make_record(
    commit: str,
    path: str,
    lines: list[str],
    s: int,
    e: int,
    name: str,
    kind: str,
    raw_facts: list[tuple[str, str]],
) -> dict | None:
    span_text = "".join(lines[s - 1 : e])
    stripped = strip_comments(span_text)
    stripped_cfg = strip_comments_config(span_text, path)
    facts: list[list[str]] = []
    seen: set[tuple[str, str]] = set()
    for pred, obj in raw_facts:
        if (pred, obj) in seen:
            continue
        if pred == "config_key_value":
            k, _, v = obj.partition("=")
            if not key_ok(k) or not v or re.search(r"\s", v):
                continue
            if not config_pair_occurs(k, v, stripped_cfg):
                continue
        elif pred == "task_depends_on_syntactically":
            if not ident_ok(obj) or not occurs(obj, stripped):
                continue
        else:
            continue
        seen.add((pred, obj))
        facts.append([pred, obj])
    if not occurs(name, stripped):
        return None
    if not facts:
        # zero representable facts -> the escape hatch record (disposition-only)
        facts.append(["unrepresentable_construct", kind])
    facts.sort()
    return {
        "id": canonical_id(commit, path, s, e, facts),
        "schema_version": 1,
        "repository": {"commit": commit, "path": path},
        "source_span": {
            "start_line": s,
            "end_line": e,
            "content_sha256": hashlib.sha256(span_text.encode()).hexdigest(),
        },
        "extractor": {
            "id": ADAPTER_ID,
            "version": ADAPTER_VERSION,
            "parser": PARSER,
            "script": SCRIPT,
        },
        "symbol": {
            "qualified_name": f"{path}::{name}",
            "lexical_name": name,
            "syntactic_kind": kind,
        },
        "observed_facts": [{"predicate": p, "object": o} for p, o in facts],
        "source_excerpt": lines[s - 1].strip()[:200] if s - 1 < len(lines) else "",
        "epistemic_status": "parser_derived",
    }


def split_keepends(text: str) -> list[str]:
    return text.splitlines(keepends=True)


def extract_turbo(commit: str, path: str, text: str) -> list[dict]:
    lines = split_keepends(text)
    data = json.loads(strip_jsonc_for_parse(text))
    recs: list[dict] = []
    tasks = data.get("tasks", {})
    tasks_span = find_block_span(text, "tasks", 0)
    tasks_start_idx = 0
    if tasks_span:
        tasks_start_idx = sum(len(ln) for ln in lines[: tasks_span[0] - 1])
    for task_name in tasks:
        span = find_block_span(text, task_name, tasks_start_idx)
        if span is None:
            continue
        raw: list[tuple[str, str]] = []
        spec = tasks[task_name]
        if isinstance(spec, dict):
            for k, v in spec.items():
                if isinstance(v, bool):
                    raw.append(("config_key_value", f"{k}={'true' if v else 'false'}"))
                elif isinstance(v, (int, float)):
                    raw.append(("config_key_value", f"{k}={json.dumps(v)}"))
                elif isinstance(v, str) and v:
                    raw.append(("config_key_value", f"{k}={v}"))
            for dep in spec.get("dependsOn", []) or []:
                if isinstance(dep, str) and dep:
                    raw.append(("task_depends_on_syntactically", dep))
        rec = make_record(
            commit, path, lines, span[0], span[1], task_name, "config_task", raw
        )
        if rec:
            recs.append(rec)
    # whole-document record: every scalar pair in the file
    all_pairs: list[tuple[str, str]] = []
    scalar_pairs(data, all_pairs)
    raw = [("config_key_value", f"{k}={v}") for k, v in all_pairs]
    doc = make_record(
        commit, path, lines, 1, len(lines), "tasks", "config_document", raw
    )
    if doc:
        recs.append(doc)
    return recs


def extract_doc(commit: str, path: str, text: str) -> list[dict]:
    lines = split_keepends(text)
    data = json.loads(strip_jsonc_for_parse(text))
    pairs: list[tuple[str, str]] = []
    scalar_pairs(data, pairs)
    raw = [("config_key_value", f"{k}={v}") for k, v in pairs]
    anchor = None
    if isinstance(data, dict):
        for k in data:
            if key_ok(str(k)):
                anchor = str(k)
                break
    if anchor is None:
        return []
    rec = make_record(commit, path, lines, 1, len(lines), anchor, "config_document", raw)
    return [rec] if rec else []


def git_show(repo: Path, commit: str, path: str) -> str:
    p = subprocess.run(
        ["git", "-C", str(repo), "show", f"{commit}:{path}"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if p.returncode != 0:
        raise RuntimeError(f"git show {commit}:{path} failed: {p.stderr.strip()}")
    return p.stdout


def self_check(golden_dir: Path) -> None:
    inp = golden_dir / "config" / "input.jsonc"
    expected_file = golden_dir / "config" / "expected.yaml"
    if not inp.exists() or not expected_file.exists():
        print(f"adapter-config: golden fixture incomplete under {golden_dir}/config/", file=sys.stderr)
        sys.exit(1)
    text = inp.read_text()
    got = extract_turbo("GOLDEN", GOLDEN_REL, text)
    expected = yaml.safe_load(expected_file.read_text())
    c = lambda r: json.dumps(r, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    if sorted(map(c, got)) != sorted(map(c, expected)):
        for g, w in zip(sorted(map(c, got)), sorted(map(c, expected))):
            if g != w:
                print(f"- want: {w}\n+ got:  {g}", file=sys.stderr)
        print(
            f"count: want {len(expected)} got {len(got)}",
            file=sys.stderr,
        )
        print("adapter-config: golden self-check FAILED", file=sys.stderr)
        sys.exit(1)
    print(f"adapter-config --self-check PASS ({len(got)} records)")


def main() -> None:
    argv = sys.argv[1:]
    if argv[:1] == ["--self-check"] and len(argv) == 2:
        self_check(Path(argv[1]))
        return
    if "--repo" not in argv or "--out" not in argv:
        print("usage: --self-check <golden_dir> | --repo <root> --out <dir>", file=sys.stderr)
        sys.exit(2)
    repo = Path(argv[argv.index("--repo") + 1]).resolve()
    out = Path(argv[argv.index("--out") + 1]).resolve()
    commit = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        timeout=10,
    ).stdout.strip()
    recs: list[dict] = []
    recs.extend(extract_turbo(commit, TURBO, git_show(repo, commit, TURBO)))
    for path in DOC_FILES:
        recs.extend(extract_doc(commit, path, git_show(repo, commit, path)))
    out.mkdir(parents=True, exist_ok=True)
    for rec in recs:
        sha12 = rec["id"].split(":")[-1][:12]
        (out / f"so-{sha12}.yaml").write_text(
            yaml.safe_dump(rec, sort_keys=False, allow_unicode=True, width=100)
        )
    print(f"adapter-config: wrote {len(recs)} SourceObservations to {out}")


if __name__ == "__main__":
    main()
