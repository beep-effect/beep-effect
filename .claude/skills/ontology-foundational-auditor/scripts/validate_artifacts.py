"""Machine enforcement for the auditor's artifact contracts (v14).

v3 bound records to id strings and file bytes; round-4 seats proved id-joins
and lone-file digests are not coherence. v4 binds CONTENT, HISTORY, and
AUTHORITY:

- coherence joins: IC.hypothesis_ref must equal the OTP's; FA verdict must
  equal OTP foundational_status; an index row's observation must appear in its
  proposal's hypothesis evidence; alternative-seat pairs must join internally;
  the OTP's claimed category must match what its identity card rules;
- history: a PASS is illegal on any digest a FAIL EVER judged (not just the
  previous review), review rounds must be contiguous, and a PASS after a FAIL
  requires a revision_log entry on the proposal naming the failed digest —
  a comment tweak is not a revision;
- authority: ratifications carry proposal_sha256 and go stale when the
  proposal's bytes change; ratifications are only recognized under
  governance/ratifications/; accepted-IRI warrants count only digest-fresh
  accepts; the alternative seat is exactly work/alternative/;
- evidence: SO/PO ids are RECOMPUTED from a canonical JSON serialization (a
  random/stale hex id cannot match — content-consistency, not
  authorship); fact objects must occur TOKEN-BOUNDED in
  the COMMENT-STRIPPED span (id⊄override, JSDoc text is not a literal member,
  a comment mention is not a declaration); config facts check key AND value;
  nested key sets are closed; manifest paths are root-confined; the manifest
  commit is checked against git and against every observation.

Usage (UV_CACHE_DIR keeps uv usable in read-only-cache workspaces; add
--offline after the first run if the network is restricted):
  UV_CACHE_DIR="${UV_CACHE_DIR:-$PWD/.uv-cache}" uv run --with pyyaml \
    python validate_artifacts.py <ontology-root> [--gate] [--repo <root>]
  ... validate_artifacts.py --self-test

Pass the ONTOLOGY ROOT (ontologies/{name}). The gate REQUIRES --repo unless
the manifest carries pin_waived: true (boolean) WITH a substantive reason —
and even then the skip is FLAGGED. Exit 1 on any violation.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

import yaml

SKILL_DIR = Path(__file__).resolve().parent.parent

# --- closed syntactic vocabulary + per-predicate object grammar -------------
IDENT_OBJ = {
    "declares_field", "declares_member", "declares_parameter",
    "declares_return_type", "extends_syntactically", "implements_syntactically",
    "references_type", "exports_symbol", "task_depends_on_syntactically",
    "declares_type_alias", "declares_union_member",
    "declares_intersection_member", "decorates_with",
    "unrepresentable_construct",
}
FREE_OBJ = {"declares_literal_member"}
CONFIG_OBJ = {"config_key_value"}
PREDICATES = IDENT_OBJ | FREE_OBJ | CONFIG_OBJ
CONFIG_EXTS = (".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".env",
               ".properties", ".xml")
HASH_COMMENT_EXTS = (".py", ".rb", ".sh", ".yaml", ".yml", ".toml", ".ini",
                     ".env", ".properties")

# CLOSED key sets — nested too: interpretation smuggles through ANY open level.
SO_KEYS = {"id", "schema_version", "repository", "source_span", "extractor",
           "symbol", "observed_facts", "source_excerpt", "epistemic_status"}
PO_KEYS = {"id", "schema_version", "repository", "source_span", "quote",
           "epistemic_status"}
SO_NESTED = {"repository": {"commit", "path"},
             "source_span": {"start_line", "end_line", "content_sha256"},
             "extractor": {"id", "version", "parser", "script"},
             "symbol": {"qualified_name", "lexical_name", "syntactic_kind"}}
FACT_KEYS = {"predicate", "object"}

ID_GRAMMAR = {"dh": r"^dh:[\w-]+:\d+$", "ic": r"^ic:[\w-]+:\d+$",
              "fa": r"^fa:[\w-]+:\d+$", "otp": r"^otp:[\w-]+:\d+$",
              "rat": r"^rat:\d+$", "rej": r"^rej:\d+$"}
REVIEW_NAME = re.compile(r"^(otp-[\w-]+-\d+)(-r\d+)?\.review\.yaml$")

TRI = {True, False, "unresolved"}
REPR = {"domain_referent", "information_artifact", "implementation_artifact_only",
        "lexical_alias", "unresolved"}
SURVIVING_REPR = {"domain_referent", "information_artifact"}
CATEGORY = {"kind", "subkind", "role", "phase", "relator", "quality", "mode", "event",
            "process", "situation", "information_object", "none", "unresolved"}
RIGIDITY = {"rigid", "anti_rigid", "semi_rigid", "unresolved"}
DEPENDENCE = {"none", "relational", "intrinsic", "unresolved"}
TEST_VALUES = {"separated", "merged", "not_applicable", "unresolved"}
FA_TESTS = ("spec_vs_execution", "world_vs_information", "role_vs_bearer",
            "context_reification_needed")
VERDICT = {"analyzed", "explicitly_deferred"}
DECISION = {"accept", "reject", "revise"}
REVIEW_VERDICT = {"PASS", "FAIL", "INDETERMINATE"}
SURFACES = ("taxonomy", "identity", "warrant", "null_discriminator")
ALWAYS_PRESENT_SURFACES = ("identity", "warrant", "null_discriminator")
DISC_DENYLIST = [r"named type", r"\bid field\b", r"has (an? )?id\b",
                 r"doc ?comment", r"is a (class|type|interface)\b"]
CE_DENYLIST = [r"REQUIRED:", r"attempt at least one"]
TRIVIAL_REASONS = {"out of scope", "n/a", "irrelevant", "not relevant", "later"}
PROMPT_ROLES = {"denotation": "prompts/denotation.md",
                "foundational": "prompts/ufo-analysis.md",
                "synthesis": "prompts/synthesis.md",
                "adversary": "prompts/ontoclean-adversary.md",
                "alternative": "prompts/alternative-model.md"}
CQ_EXCLUDED_PRIORITIES = {"could_have", "wont_have"}

errors = []
flags = []  # gate-mode FLAGGED items (submit, but the steward sees them)


def err(path, msg):
    errors.append(f"{path}: {msg}")


def get(d, dotted):
    cur = d
    for p in dotted.split("."):
        cur = cur.get(p) if isinstance(cur, dict) else None
    return cur


def need(d, keys, path):
    for k in keys:
        v = get(d, k)
        if v in (None, "", [], {}) or (isinstance(v, str) and not v.strip()):
            err(path, f"missing/empty required field {k}")


def record(fn):
    def guarded(d, p):
        if not isinstance(d, dict):
            err(p, f"record must be a mapping, got {type(d).__name__}")
            return
        fn(d, p)
    return guarded


def dicts(seq, path, what):
    if seq is None:
        return
    if not isinstance(seq, (list, tuple)):
        err(path, f"{what} must be a list, got {type(seq).__name__}")
        return
    for x in seq:
        if isinstance(x, dict):
            yield x
        else:
            err(path, f"{what} entry {x!r} is not a mapping")


def is_exact_int(v):
    return type(v) is int  # bool is NOT int here: type(True) is bool


def is_exact_num(v):
    return type(v) in (int, float)


def is_tri(v):
    # exact types only: True is not an int here, and only the exact STRING
    # "unresolved" is the third state — arbitrary __eq__ objects are not
    return type(v) is bool or (type(v) is str and v == "unresolved")


def need_bool(d, key, path):
    v = get(d, key)
    if v is not None and type(v) is not bool:
        err(path, f"{key} must be a BOOLEAN (yaml true/false), got {v!r} — "
                  "integers and strings that compare equal to a boolean are "
                  "not booleans")
    return v if type(v) is bool else None


def need_str(d, key, path, minlen=1):
    v = get(d, key)
    if not isinstance(v, str) or len(v.strip()) < minlen:
        err(path, f"{key} must be a non-blank STRING"
                  + (f" (>= {minlen} chars)" if minlen > 1 else "")
                  + f", got {v!r}")
        return None
    return v


def aslist(x):
    """Every nested iteration goes through this — a scalar where a list belongs
    is malformed input, and malformed input yields violations, never crashes."""
    return x if isinstance(x, (list, tuple)) else []


def closed_keys(d, allowed, path, label):
    if isinstance(d, dict):
        unknown = set(d) - allowed
        if unknown:
            err(path, f"{label}: unknown key(s) {sorted(unknown)} — key sets are "
                      "CLOSED at every level; extra fields are where interpretation "
                      "smuggles in")


def sha12(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


class _DupKeyError(Exception):
    pass


class _DupSafeLoader(yaml.SafeLoader):
    """A duplicate-key mapping is AMBIGUOUS AUTHORITY: yaml last-wins lets a
    human read one verdict and the machine enforce another. Every authority
    surface (artifacts, CQ suite, prior index, manifest) loads through this
    loader, which refuses the ambiguity instead of resolving it."""

    def construct_mapping(self, node, deep=False):
        seen = set()
        for key_node, _ in node.value:
            k = self.construct_object(key_node, deep=deep)
            try:
                dup = k in seen
                seen.add(k)
            except TypeError:
                continue  # unhashable keys are diagnosed by the shape checks
            if dup:
                raise _DupKeyError(
                    f"duplicate mapping key {k!r} (line {node.start_mark.line + 1})"
                    " — last-wins YAML lets two verdicts share one file; refused")
        return super().construct_mapping(node, deep=deep)


def yload(data):
    """The ONE yaml entry point for authority bytes — duplicate keys raise."""
    return yaml.load(data, Loader=_DupSafeLoader)


RUN_ID_RE = re.compile(
    r"orun-\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?")
# fraction bounded at 9 digits: runs/<rid>.manifest.yaml must stay far
# below NAME_MAX — an unbounded fraction is validator-legal yet
# unarchivable (ENAMETOOLONG), which is exactly the non-totality the
# closed grammar exists to prevent


def valid_run_id(rid):
    """THE run-id grammar — one closed, archive-component-safe form shared by
    check_manifest and --print-run-id (parser parity is a contract: a
    rotation that accepts what validation rejects, or vice versa, is two
    grammars). The charset is closed ([0-9TZ:+-.] after the prefix), so
    slashes, backslashes, whitespace, and control bytes die STRUCTURALLY —
    fromisoformat alone accepts any single date/time separator including
    `/`, which nests archive paths. Exact match on the EXACT string: no
    normalization before validation."""
    if type(rid) is not str or not RUN_ID_RE.fullmatch(rid):
        return False
    try:
        from datetime import datetime
        datetime.fromisoformat(rid[5:].replace("Z", "+00:00"))
    except ValueError:
        return False  # 2026-99-99 is a shape, not a date
    return True


def need_hex(d, key, path, n, required=True):
    """Digest fields are exact-type STRINGS of n hex chars. str() coercion is
    forbidden here: a 12-digit YAML INTEGER stringifies to twelve decimal
    digits, every one of which is a valid hex character."""
    v = get(d, key)
    if v is None:
        if required:
            err(path, f"{key} is required ({n} hex)")
        return None
    if type(v) is not str or not re.fullmatch(rf"[0-9a-f]{{{n}}}", v):
        err(path, f"{key} must be a lowercase {n}-hex STRING, got {v!r} — a "
                  "numeric scalar that stringifies to decimal digits is not a "
                  "digest")
        return None
    return v


def skey(x):
    """Exact-string-or-None join key. Malformed ids/refs are diagnosed by
    the record checks and the intake sweep; THIS filter is what keeps them
    out of every hash table and .get() lookup so they can never traceback
    downstream. dict.get(unhashable) raises too — lookups need it as much
    as constructions."""
    return x if type(x) is str else None


def safe_text(s):
    """Authority-controlled strings rendered into the human audit surface
    (RATIFICATION SUMMARY, flags) get every C0/C1 control and newline shown
    as a visible escape — a verbatim carrying \x1b[2J must not be able to
    clear the terminal and forge the summary the steward audits."""
    return "".join(
        c if (ord(c) >= 0x20 and not 0x7f <= ord(c) <= 0x9f) else
        f"\\x{ord(c):02x}"
        for c in s)


def join_key(x, path, what):
    """Authority ids participate in set/dict joins ONLY as exact strings —
    malformed input (a list, a mapping, an integer) is a VIOLATION and is
    quarantined before any membership test can raise on an unhashable key."""
    if type(x) is str:
        return x
    err(path, f"{what} must be a STRING id, got {x!r} — malformed authority "
              "is quarantined from joins, never hashed")
    return None


def identity_expectation(supplies, carries):
    """What the OTP's ontoclean.identity MUST say, given the card's two
    provider facts. UNRESOLVED TAKES PRECEDENCE: a card with EITHER provider
    unsettled is an unsettled card, and a definite OTP claim over it is a
    commitment the analysis never made — the affirmative branches run only
    on fully settled cards."""
    if "unresolved" in (supplies, carries):
        return "unresolved"
    if supplies is True:
        return "supplies"
    if carries is True:
        return "carries"
    if supplies is False and carries is False:
        return "none"
    return None


def lexical_symlink_violations(root, rel):
    """lstat-first symlink checks over EVERY lexical component of root/rel
    strictly below root — the final file AND each parent directory: a regular
    file under a symlinked runs/ directory is still an alias. Returns the
    offending component names (resolve() must never run before this)."""
    bad = []
    try:
        root = Path(root)
        lexical = root / str(rel)
        if lexical.is_symlink():
            bad.append(lexical.name)
        anc = lexical.parent
        while anc != root and root in anc.parents:
            if anc.is_symlink():
                bad.append(anc.name)
            anc = anc.parent
    except (OSError, RuntimeError) as ex:
        # ENAMETOOLONG, permission errors, symlink loops during lstat:
        # an unexaminable path is a condemned path, never a crash
        bad.append(f"<unexaminable: {ex}>")
    return bad


def canonical_obs_id(kind, d):
    """SO/PO ids are RECOMPUTED, never trusted: a canonical JSON serialization
    of the record's evidentiary content. This proves CONTENT-CONSISTENCY (a
    random or stale hex cannot match); it does NOT prove the adapter authored
    the record — any author can run the formula (Known Limits)."""
    if kind == "so":
        of = d.get("observed_facts")
        of = of if isinstance(of, (list, tuple)) else []
        facts = sorted([[str(f.get("predicate")), str(f.get("object"))]
                        for f in of if isinstance(f, dict)])
        payload = [get(d, "repository.commit"), get(d, "repository.path"),
                   get(d, "source_span.start_line"), get(d, "source_span.end_line"),
                   facts, get(d, "extractor.id"), get(d, "extractor.version")]
    else:
        payload = [get(d, "repository.commit"), get(d, "repository.path"),
                   get(d, "source_span.start_line"), get(d, "source_span.end_line"),
                   d.get("quote")]
    digest = hashlib.sha256(json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()).hexdigest()
    return f"{kind}:sha256:{digest}"


def strip_comments(text, path):
    """Strip the UNION of comment families the supported syntaxes use — a
    mention needs only one comment syntax to hide in, so the stripper knows
    them all, extension-independently, and fails CLOSED (a legitimate token
    inside another family's comment-lookalike, e.g. a // URL in YAML, is
    stripped too — an honest fact then fails occurrence rather than a
    dishonest one passing). An UNCLOSED <!-- runs to end of text, as HTML
    defines it."""
    # comments are removed with EMPTY replacement: inserting a space would
    # CREATE a whitelisted key boundary the raw bytes never had
    # (prefix/*c*/mode must glue to prefixmode, not split into two tokens)
    text = re.sub(r"<!--.*?(-->|\Z)", "", text, flags=re.S)  # XML/HTML, unclosed=EOF
    text = re.sub(r"/\*.*?(\*/|\Z)", "", text, flags=re.S)  # C block, unclosed=EOF
    text = re.sub(r"//[^\n]*", "", text)                      # C line
    text = re.sub(r"#[^\n]*", "", text)                       # hash
    text = re.sub(r"^[ \t]*[;!][^\n]*", "", text, flags=re.M)  # ini ; / props !
    return text


_PAIRING_COMMENT_FAMILIES = {
    ".json": (),                      # JSON defines NO comments
    ".jsonc": ("cline", "cblock"),
    ".yaml": ("hash_ws",), ".yml": ("hash_ws",),
    ".toml": ("hash_line",),  # TOML: `#` starts a comment ANYWHERE outside
                              # strings, no preceding whitespace required
                              # (tomllib-verified); a `#` inside a quoted
                              # value truncates to an unpairable half-quote,
                              # which fails CLOSED
    ".ini": ("linestart_hash", "linestart_semi"),      # ConfigParser default:
    ".properties": ("linestart_hash", "linestart_bang"),  # inline ;/! is PAYLOAD
    ".env": ("hash_ws",),
    ".xml": ("xml",),
}


def strip_comments_config(text, path):
    """PAIRING stripping is syntax-aware and boundary-correct: strip ONLY what
    the file's own syntax defines as a comment, with that syntax's boundary
    rules, so stripping can never SHORTEN a parsed value into the asserted
    prefix (truncating `safe#prod` to `safe` manufactures a pairing the
    file's parser does not see). YAML/ENV `#` comments require start-of-
    line or preceding whitespace; TOML `#` starts a comment ANYWHERE
    outside strings; ini/properties markers are line-START only
    (Java Properties and ConfigParser both treat inline `;`/`!` as payload);
    JSON has no comments at all. Unknown extensions strip NOTHING — for
    pairing, fail-closed means refusing to authenticate, never inventing.
    (Comments are removed with EMPTY replacement: inserting a space would
    CREATE a key boundary the raw bytes never had.)"""
    ext = ("." + str(path).rsplit(".", 1)[-1].lower()) if "." in str(path) else ""
    fams = _PAIRING_COMMENT_FAMILIES.get(ext, ())
    # PHYSICAL LINE BREAKS: YAML/properties/ini accept lone CR and CRLF as
    # line breaks; every line-start/line-end rule below is written against
    # \n, so normalize first or a CR-only comment shields its mention
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # a document-start BOM is invisible whitespace that would otherwise shield
    # a first-line comment from every line-start branch below
    text = text.lstrip("﻿")
    if "xml" in fams:
        text = re.sub(r"<!--.*?(-->|\Z)", "", text, flags=re.S)  # unclosed=EOF
    if "cblock" in fams:
        text = re.sub(r"/\*.*?(\*/|\Z)", "", text, flags=re.S)
    if "cline" in fams:
        text = re.sub(r"//[^\n]*", "", text)
    if "hash_line" in fams:
        text = re.sub(r"#[^\n]*", "", text)
    if "hash_ws" in fams:
        text = re.sub(r"(?:^|(?<=[ \t]))#[^\n]*", "", text, flags=re.M)
    # ini/properties leading whitespace before a line-start marker includes
    # FORM FEED (java.util.Properties: space, tab, form feed)
    if "linestart_hash" in fams:
        text = re.sub(r"^[ \t\f]*#[^\n]*", "", text, flags=re.M)
    if "linestart_semi" in fams:
        text = re.sub(r"^[ \t\f]*;[^\n]*", "", text, flags=re.M)
    if "linestart_bang" in fams:
        text = re.sub(r"^[ \t\f]*![^\n]*", "", text, flags=re.M)
    return text


def occurs(probe, text):
    """Token-bounded occurrence: `id` does not occur in `override` — and `#`
    is identifier punctuation too (TS/JS private fields: #id is not id)."""
    return re.search(rf"(?<![\w$#]){re.escape(str(probe))}(?![\w$#])", text) is not None


def config_pair_occurs(key, val, text, path=""):
    """A config fact is a PAIRING, not two tokens: mode=safe must occur as
    `mode: safe` / `"mode": "safe"` / `mode = "safe"` — key and value each
    occurring on different keys authenticates a pairing not in the file.
    Boundaries include identifier punctuation (`.` `-` `#` `$`), so
    `foo-mode`, `database.mode`, and `safe-mode` are different tokens; the
    caller passes COMMENT-STRIPPED text (a commented-out pair is a mention)."""
    if not val:
        return False  # empty values are rejected upstream; never fall back
    k, v = re.escape(str(key)), re.escape(str(val))
    # key positions, by how the supported syntaxes actually place keys:
    #  - a BARE key with any value form sits at LINE START (optional indent) —
    #    ini/properties/env keys start lines, YAML block keys start lines,
    #    TOML keys start lines; a mid-line bare `mode=safe` is PAYLOAD of the
    #    real key on that line (`level=strict ; mode=safe`), never a pairing;
    #  - a QUOTE-WRAPPED key ("mode"/'mode', BOTH quotes — x"mode cannot pair)
    #    may follow start/whitespace or JSON/flow structure ({ , [);
    #  - only XML-family files allow a mid-line bare key, and only in the
    #    attribute shape: `=` with a QUOTE-PAIRED value.
    # Glued prefixes (prefix{mode, x,mode, x"mode) authenticate a key the
    # file's parser never sees, so they are not openers.
    # value: either QUOTE-PAIRED (an opening quote demands its closing twin,
    # so a stripper-truncated "safe cannot pair) or unquoted and terminated
    # at end-of-line — safe;strict, safe%strict, "safe strict" all die
    post = r"(?=[ \t]*(?:[\r\n,}}\])>/;#]|$))"
    unq_end = r"(?=[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*(?:(?![ \t\r\n])|\Z)|\Z))"
    # \Z not $: MULTILINE $ matches before every newline and would defeat the
    # continuation guard; the (?:[ \t]*\r?\n)* run looks THROUGH blank lines —
    # a YAML plain scalar continues across them, so the first NONBLANK line
    # decides whether the value really ended at this EOL; the final class
    # excludes \r\n too, so backtracking cannot treat a blank line as the
    # deciding character
    q_val = rf"(?:\"{v}\"{post}|'{v}'{post})"
    # a claimed value that BEGINS with a quote byte may not ride the unquoted
    # arm outside ini/properties: comment-stripping a quoted payload leaves a
    # half-quoted prefix ("safe from "safe#prod"), and the unquoted arm would
    # accept that half-quote as a complete value — quote-initial claims must
    # pair their quote
    quote_initial = str(val)[:1] in "\"'"
    any_val = q_val if quote_initial else rf"(?:{q_val}|{v}{unq_end})"
    # separator spacing is HORIZONTAL ([ \t]*, never \s*): a separator that
    # crosses a newline joins two natural lines into a pairing no line-based
    # parser sees (properties `alpha_mode\n=safe` is key alpha_mode with an
    # EMPTY value plus an empty-key record — the asserted pair does not exist)
    sep = r"[ \t]*[:=][ \t]*"
    lower = str(path).lower()
    if lower.endswith((".ini", ".properties")):
        # quotes are PAYLOAD in ini/properties (neither ConfigParser-default
        # nor java.util.Properties strips them, and inline ;/#/! after a
        # quoted half stays payload too) — the ONLY honest shape is the raw
        # bytes ending the value at EOL; a claimed value may itself carry
        # quotes and matches through the unquoted arm verbatim
        arms = [rf"^[ \t]*{k}{sep}{v}{unq_end}"]
    else:
        arms = [rf"^[ \t]*{k}{sep}{any_val}",
                rf"(?:^|[ \t{{,\[])\"{k}\"{sep}{any_val}",
                rf"(?:^|[ \t{{,\[])'{k}'{sep}{any_val}"]
        if lower.endswith((".xml", ".html", ".xhtml", ".svg")):
            arms.append(rf"(?:^|[ \t]){k}[ \t]*=[ \t]*{q_val}")  # XML attribute
    return re.search("|".join(arms), text, re.M) is not None


# --- per-record checks ------------------------------------------------------

def check_kind_id(d, p, kind):
    if kind in ID_GRAMMAR and not re.fullmatch(ID_GRAMMAR[kind].strip("^$"), str(d.get("id", ""))):
        err(p, f"id {d.get('id')!r} does not match the {kind}: id grammar "
               f"({ID_GRAMMAR[kind]})")


@record
def check_so(d, p):
    need(d, ["id", "repository.commit", "repository.path", "source_span",
             "source_span.content_sha256", "extractor.id", "extractor.version",
             "extractor.script", "symbol", "observed_facts", "epistemic_status"], p)
    closed_keys(d, SO_KEYS, p, "SourceObservation")
    for k, allowed in SO_NESTED.items():
        closed_keys(d.get(k), allowed, p, k)
    if not re.match(r"^so:sha256:[0-9a-f]{64}$", str(d.get("id", ""))):
        err(p, "id must be so:sha256:<64 hex>")
    elif d.get("id") != canonical_obs_id("so", d):
        err(p, "id does not equal the canonical digest of this record's content "
               "(commit, path, span, sorted facts, adapter id+version, JSON-"
               "canonical) — the id is computed, never asserted")
    if d.get("epistemic_status") != "parser_derived":
        err(p, "SourceObservation epistemic_status must be parser_derived (prose uses po-)")
    if not is_exact_int(d.get("schema_version")) or d.get("schema_version") != 1:
        err(p, f"schema_version must be the integer 1, got {d.get('schema_version')!r}")
    for k in ("extractor.id", "extractor.version", "extractor.script",
              "extractor.parser", "symbol.lexical_name", "symbol.qualified_name",
              "symbol.syntactic_kind", "repository.commit", "repository.path"):
        need_str(d, k, p)
    need_hex(d, "source_span.content_sha256", p, 64)
    span = d.get("source_span") if isinstance(d.get("source_span"), dict) else {}
    if not is_exact_int(span.get("start_line")) or \
            not is_exact_int(span.get("end_line")) or \
            span.get("start_line") < 1 or \
            span.get("end_line") < span.get("start_line"):
        err(p, "source_span lines must be exact INTEGERS with "
               "1 <= start_line <= end_line (strings and booleans are not "
               "coordinates)")
    path = str(get(d, "repository.path") or "")
    if "source_excerpt" in d and not isinstance(d.get("source_excerpt"), str):
        err(p, f"source_excerpt must be a STRING, got {d.get('source_excerpt')!r}")
    preds = set()
    for f in dicts(d.get("observed_facts"), p, "observed_facts"):
        closed_keys(f, FACT_KEYS, p, "observed_facts entry")
        pred, obj = f.get("predicate"), f.get("object")
        preds.add(pred)
        if pred not in PREDICATES:
            err(p, f"predicate {pred!r} outside the closed syntactic vocabulary")
            continue
        if not isinstance(obj, str) or not obj:
            err(p, f"{pred}: object must be a non-empty STRING (a YAML integer "
                   f"is not a syntactic token), got {obj!r}")
            continue
        if pred in IDENT_OBJ:
            bare = re.sub(r"<[^<>]*>", "", obj)
            if re.search(r"[\s/]", bare):
                err(p, f"{pred}: object {obj!r} is prose, not an identifier")
        elif pred in CONFIG_OBJ:
            if not re.match(r"^[^\s=/]+=\S+$", obj):
                err(p, f"config_key_value: object must be '<key>=<value>' with a "
                       f"NON-EMPTY value, got {obj!r} — an empty value collapses "
                       "pairing to key-only occurrence")
            if not path.endswith(CONFIG_EXTS):
                err(p, f"config_key_value is only legal for config-file paths, not {path!r}")
    if "unrepresentable_construct" in preds and len(preds) > 1:
        err(p, "unrepresentable_construct may not share a record with other predicates")


def so_is_unrepresentable_only(d):
    of = d.get("observed_facts")
    of = of if isinstance(of, (list, tuple)) else []
    facts = [f for f in of if isinstance(f, dict)]
    return bool(facts) and all(
        f.get("predicate") == "unrepresentable_construct" for f in facts)


@record
def check_po(d, p):
    need(d, ["id", "repository.commit", "repository.path", "source_span",
             "source_span.start_line", "source_span.end_line", "quote"], p)
    closed_keys(d, PO_KEYS, p, "ProseObservation")
    for k in ("repository", "source_span"):
        closed_keys(d.get(k), SO_NESTED[k] - {"content_sha256"} if k == "source_span"
                    else SO_NESTED[k], p, k)
    if not re.match(r"^po:sha256:[0-9a-f]{64}$", str(d.get("id", ""))):
        err(p, "id must be po:sha256:<64 hex>")
    elif d.get("id") != canonical_obs_id("po", d):
        err(p, "id does not equal the canonical digest of (commit, path, span, "
               "quote) — the id is computed, never asserted")
    if d.get("epistemic_status") != "quoted_prose":
        err(p, "ProseObservation epistemic_status must be quoted_prose")
    if not is_exact_int(d.get("schema_version")) or d.get("schema_version") != 1:
        err(p, f"schema_version must be the integer 1, got {d.get('schema_version')!r}")
    for k in ("repository.commit", "repository.path"):
        need_str(d, k, p)
    if not isinstance(d.get("quote"), str) or len(d.get("quote").strip()) < 10:
        err(p, "quote must be a substantive verbatim STRING excerpt (>=10 chars "
               "stripped) — an integer or whitespace is not a quotation")
    span = d.get("source_span") if isinstance(d.get("source_span"), dict) else {}
    if not is_exact_int(span.get("start_line")) or \
            not is_exact_int(span.get("end_line")) or \
            span.get("start_line") < 1 or \
            span.get("end_line") < span.get("start_line"):
        err(p, "source_span lines must be exact INTEGERS with "
               "1 <= start_line <= end_line (strings and booleans are not "
               "coordinates)")


@record
def check_dh(d, p):
    need(d, ["id", "observation_refs", "representation_status", "confidence"], p)
    check_kind_id(d, p, "dh")
    need_str(d, "proposed_referent.label", p)
    pr_ref = d.get("proposed_referent")
    if pr_ref is not None and not isinstance(pr_ref, dict):
        err(p, f"proposed_referent must be a MAPPING, got {pr_ref!r} — a "
               "scalar here would crash the membership check, and malformed "
               "input is a violation, never a crash")
    elif "description" in (pr_ref or {}) and \
            not isinstance(get(d, "proposed_referent.description"), str):
        err(p, "proposed_referent.description must be a STRING")
    need_str(d, "null_hypothesis.label", p)
    need_str(d, "null_hypothesis.rationale", p)
    if d.get("observation_refs") is not None and \
            not isinstance(d.get("observation_refs"), (list, tuple)):
        err(p, f"observation_refs must be a list, got "
               f"{type(d.get('observation_refs')).__name__}")
    if d.get("cq_warrants") is not None:
        if not isinstance(d.get("cq_warrants"), (list, tuple)):
            err(p, f"cq_warrants must be a list, got "
                   f"{type(d.get('cq_warrants')).__name__}")
        for c in aslist(d.get("cq_warrants")):
            if not re.fullmatch(r"CQ-[\w-]+", str(c)):
                err(p, f"cq_warrants entry {c!r} is not a CQ id")
    nhv = get(d, "null_hypothesis.rejected")
    if nhv is not None and type(nhv) is not bool:
        err(p, f"null_hypothesis.rejected must be a BOOLEAN, got {nhv!r}")
    if d.get("epistemic_status") not in (None, "proposed"):
        err(p, "DenotationHypothesis epistemic_status must be proposed")
    for a in dicts(d.get("alternatives"), p, "alternatives"):
        if "label" in a and not isinstance(a.get("label"), str):
            err(p, f"alternatives.label must be a STRING, got {a.get('label')!r}")
        if a.get("representation_status") is not None and \
                a.get("representation_status") not in REPR:
            err(p, f"alternatives.representation_status "
                   f"{a.get('representation_status')!r} invalid")
        if a.get("plausibility") is not None and \
                a.get("plausibility") not in ("viable", "weak"):
            err(p, f"alternatives.plausibility {a.get('plausibility')!r} invalid")
    for ref in aslist(d.get("observation_refs")):
        if not re.match(r"^(so|po):sha256:[0-9a-f]{64}$", str(ref)):
            err(p, f"observation_refs entry {ref!r} is not a full so:/po: id")
    if d.get("representation_status") not in REPR:
        err(p, f"representation_status {d.get('representation_status')!r} invalid")
    nh = d.get("null_hypothesis") if isinstance(d.get("null_hypothesis"), dict) else {}
    if "rejected" not in nh:
        err(p, "null_hypothesis.rejected missing")
    if nh.get("rejected") is True:
        if nh.get("discriminator") is not None and \
                not isinstance(nh.get("discriminator"), str):
            err(p, f"null_hypothesis.discriminator must be a STRING, got "
                   f"{nh.get('discriminator')!r} — a stringified number is not "
                   "an observation-backed fact")
        disc = str(nh.get("discriminator") or "").strip() \
            if isinstance(nh.get("discriminator"), str) else ""
        if not disc:
            err(p, "null rejected without a discriminator")
        else:
            if len(disc) < 30:
                err(p, f"discriminator too thin ({len(disc)} chars)")
            for pat in DISC_DENYLIST:
                if re.search(pat, disc, re.I):
                    err(p, f"discriminator matches denylist pattern {pat!r}")
            if disc == str(nh.get("rationale") or "").strip():
                err(p, "discriminator merely repeats the rationale")
    conf = d.get("confidence")
    if not isinstance(conf, dict) or type(conf.get("use_for_acceptance")) is not bool \
            or conf.get("use_for_acceptance") is not False:
        err(p, "confidence block is REQUIRED with boolean use_for_acceptance: false")
    elif not is_exact_num(conf.get("value")) or \
            not 0 <= conf.get("value") <= 1:
        err(p, f"confidence.value must be a number in [0,1], got {conf.get('value')!r}")
    if "evidence" in d:
        err(p, "duplicate provenance edge: use observation_refs only")


@record
def check_ic(d, p):
    need(d, ["id", "hypothesis_ref", "identity.identity_criterion", "ontoclean",
             "ufo_analysis", "temporality", "counterexamples"], p)
    check_kind_id(d, p, "ic")
    if not is_tri(get(d, "identity.supplies_identity")):
        err(p, "identity.supplies_identity must be true|false|unresolved")
    crit = get(d, "identity.identity_criterion")
    if not isinstance(crit, str):
        err(p, f"identity_criterion must be a STRING, got {crit!r}")
        crit = ""
    if len(crit.strip()) < 20:
        err(p, "identity_criterion too thin")
    elif re.search(r"\bid (field|column)\b|\bidentifier\b", crit, re.I) and \
            not re.search(r"\b(not|never|evidence|rather than)\b", crit, re.I):
        err(p, "identity_criterion is identifier-is-identity — a technical key is "
               "evidence, never the criterion (padding the sentence does not "
               "change what it says)")
    oc = d.get("ontoclean") if isinstance(d.get("ontoclean"), dict) else {}
    if oc.get("rigidity") not in RIGIDITY:
        err(p, f"ontoclean.rigidity {oc.get('rigidity')!r} invalid")
    for k in ("carries_identity", "supplies_identity"):
        if not is_tri(oc.get(k)):
            err(p, f"ontoclean.{k} must be BOOLEAN true|false or 'unresolved' "
                   f"(got {oc.get(k)!r} — integers are neither)")
    si_a, si_b = get(d, "identity.supplies_identity"), oc.get("supplies_identity")
    # is_tri (exact-type) guards the agreement: malformed input (a list, an
    # integer that compares equal to a boolean) is diagnosed by the per-field
    # checks above and must stay DATA here — never a crash, never a false
    # disagreement
    if is_tri(si_a) and is_tri(si_b) and si_a != si_b:
        err(p, "identity.supplies_identity and ontoclean.supplies_identity disagree "
               "— the two provider fields describe ONE fact (a boolean on one side "
               "and unresolved on the other IS disagreement: the fact is either "
               "settled or it is not)")
    if "unity" not in oc:
        err(p, "ontoclean.unity missing (empty string is legal; absence is not)")
    elif not isinstance(oc.get("unity"), str):
        err(p, f"ontoclean.unity must be a STRING, got {oc.get('unity')!r}")
    if oc.get("dependence") not in DEPENDENCE:
        err(p, f"ontoclean.dependence {oc.get('dependence')!r} invalid")
    if get(d, "ufo_analysis.candidate_category") not in CATEGORY:
        err(p, "ufo_analysis.candidate_category invalid")
    tp = d.get("temporality") if isinstance(d.get("temporality"), dict) else {}
    for k in ("exists_during_interval", "may_change_state_without_losing_identity"):
        if not is_tri(tp.get(k)):
            err(p, f"temporality.{k} must be BOOLEAN true|false or 'unresolved'")
    if d.get("status") != "proposed":
        err(p, "status must be 'proposed'")
    for k in ("identity.reidentification_key", "ufo_analysis.alternatives",
              "ufo_analysis.existential_dependencies", "temporality.terminal_states"):
        v = get(d, k)
        if v is not None and not isinstance(v, (list, tuple)):
            err(p, f"{k} must be a list, got {type(v).__name__}")
    ces = list(dicts(d.get("counterexamples"), p, "counterexamples"))
    if not ces:
        err(p, "at least one counterexample must be attempted")
    for ce in ces:
        if not isinstance(ce.get("description"), str):
            err(p, f"counterexample.description must be a STRING, got "
                   f"{ce.get('description')!r}")
            continue
        desc = ce.get("description").strip()
        if len(desc) < 10:
            err(p, "counterexample.description empty/trivial")
        for pat in CE_DENYLIST:
            if re.search(pat, desc):
                err(p, "counterexample.description is the template placeholder")


@record
def check_fa(d, p):
    need(d, ["id", "hypothesis_ref", "identity_card_ref", "tests", "verdict"], p)
    check_kind_id(d, p, "fa")
    tests = d.get("tests") if isinstance(d.get("tests"), dict) else {}
    for t in FA_TESTS:
        v = tests.get(t)
        if t == "context_reification_needed":
            if not is_tri(v):
                err(p, f"tests.{t} must be BOOLEAN true|false or 'unresolved'")
        elif v not in TEST_VALUES:
            err(p, f"tests.{t} missing/invalid")
    if d.get("verdict") not in VERDICT:
        err(p, f"verdict {d.get('verdict')!r} invalid")
    if "needed_evidence" in d and not isinstance(d.get("needed_evidence"), str):
        err(p, f"needed_evidence must be a STRING, got "
               f"{d.get('needed_evidence')!r} — it is printed as operative "
               "steward-facing text")
    if d.get("verdict") == "explicitly_deferred" and \
            (not isinstance(d.get("needed_evidence"), str) or
             len(d.get("needed_evidence").strip()) < 15):
        err(p, "explicitly_deferred requires needed_evidence")
    rm = d.get("rival_models")
    if rm is not None and not isinstance(rm, (list, tuple)):
        err(p, f"rival_models must be a list, got {type(rm).__name__}")
    for r in dicts(rm, p, "rival_models"):
        if not isinstance(r.get("label"), str) or not r.get("label").strip():
            err(p, f"rival_models.label must be a non-blank STRING, got "
                   f"{r.get('label')!r}")
        if "still_viable" not in r:
            err(p, "rival_models entry missing still_viable — an unlabeled "
                   "viability disappears from the silent-merge rule")
        elif type(r.get("still_viable")) is not bool:
            err(p, f"rival_models.still_viable must be a BOOLEAN, got "
                   f"{r.get('still_viable')!r} — strings AND integers that compare "
                   "equal to a boolean are not booleans")
    if not isinstance(d.get("strongest_counterexample"), str) or \
            len(d.get("strongest_counterexample").strip()) < 10:
        err(p, "strongest_counterexample is required as a substantive STRING — an "
               "analysis that attempted no counterexample ran no adversarial test "
               "on itself")


def fa_ran_no_tests(d):
    """Vacuity is judged on the three UFO tests — the boolean
    context_reification_needed is not a test run, so flipping it to false
    does not make an all-unresolved analysis a real one."""
    tests = d.get("tests") if isinstance(d.get("tests"), dict) else {}
    return all(tests.get(t) == "unresolved" for t in FA_TESTS
               if t != "context_reification_needed")


@record
def check_otp(d, p):
    need(d, ["id", "hypothesis_ref", "identity_card_ref", "foundational_status",
             "term.local_name", "definition.text", "foundational.ufo_category",
             "reuse", "operational_warrant", "status"], p)
    check_kind_id(d, p, "otp")
    if d.get("foundational_status") not in VERDICT:
        err(p, "foundational_status must be analyzed|explicitly_deferred")
    if d.get("status") != "proposed":
        err(p, "status must be 'proposed'")
    reuse = d.get("reuse")
    if not isinstance(reuse, dict) or type(reuse.get("searched")) is not bool \
            or reuse.get("searched") is not True:
        err(p, "reuse.searched must be boolean true — declaring the search skipped "
               "does not exempt the mandatory reuse pass; run it")
    if isinstance(reuse, dict) and "exact_reuse_found" in reuse and \
            type(reuse.get("exact_reuse_found")) is not bool:
        err(p, f"reuse.exact_reuse_found must be a BOOLEAN, got "
               f"{reuse.get('exact_reuse_found')!r} — a string 'true' silently "
               "skips the mapping-evidence branch")
    if isinstance(reuse, dict) and reuse.get("mappings") is not None and \
            not isinstance(reuse.get("mappings"), (list, tuple)):
        err(p, f"reuse.mappings must be a list, got "
               f"{type(reuse.get('mappings')).__name__} — the shape contract "
               "does not depend on which branch exact_reuse_found took")
    if isinstance(reuse, dict) and reuse.get("exact_reuse_found") is True:
        maps = list(dicts(reuse.get("mappings"), p, "reuse.mappings"))
        if not maps:
            err(p, "exact_reuse_found without a mapping")
        for m in maps:
            if not isinstance(m.get("iri"), str) or not m.get("iri") or \
                    not isinstance(m.get("compatibility"), str) or \
                    len(m.get("compatibility").strip()) < 20:
                err(p, "each reuse mapping needs a STRING iri + a STRING "
                       "compatibility justification (>=20 chars)")
    for pc in dicts(d.get("parents"), p, "parents"):
        parent = pc.get("parent")
        if not isinstance(parent, str) or not parent:
            err(p, f"parents.parent must be a non-blank STRING, got {parent!r}")
            continue
        elif re.search(r"[\s/]", re.sub(r"<[^<>]*>", "", parent)):
            err(p, f"parents.parent {parent!r} is prose, not a term identifier — "
                   "a subsumption edge is a commitment, not a sentence")
        if not isinstance(pc.get("justification"), str) or \
                len(pc.get("justification").strip()) < 20:
            err(p, "parents entry needs a substantive STRING justification (>=20 chars)")
    for rl in dicts(d.get("revision_log"), p, "revision_log"):
        if type(rl.get("from_sha256")) is not str or \
                not re.fullmatch(r"[0-9a-f]{64}", rl.get("from_sha256")):
            err(p, "revision_log entry needs from_sha256 (64 hex of the FAILed bytes)")
        addr = rl.get("addressed")
        if not isinstance(addr, list) or not addr or \
                any(not isinstance(a, str) or not a.strip() for a in addr):
            err(p, "revision_log.addressed must be a non-empty LIST of attack rule "
                   "names — a scalar or blank entry is a guestbook signature")
    for k in ("ontoclean.rigidity", "ontoclean.dependence"):
        if not str(get(d, k) or "").strip():
            err(p, f"missing/empty required field {k} — the proposal DERIVES its "
                   "OntoClean block from its identity card; omitting it is not "
                   "agreement")
    if get(d, "ontoclean.identity") not in ("supplies", "carries", "none",
                                            "unresolved"):
        err(p, f"ontoclean.identity must be supplies|carries|none|unresolved, got "
               f"{get(d, 'ontoclean.identity')!r} — free prose lets 'does not "
               "supply' pass a substring test; a closed enum cannot lie by "
               "phrasing")
    ds = get(d, "definition.source")
    if ds is not None and not isinstance(ds, (list, tuple)):
        err(p, f"definition.source must be a list, got {type(ds).__name__}")
    for k in ("term.local_name", "term.preferred_label", "term.proposed_iri",
              "definition.text"):
        need_str(d, k, p)
    if "gufo_alignment" in (d.get("foundational") or {}) and \
            not isinstance(get(d, "foundational.gufo_alignment"), str):
        err(p, "foundational.gufo_alignment must be a STRING")
    for k in ("alternatives_rejected", "open_issues", "revision_requests",
              "operational_warrant.competency_questions",
              "operational_warrant.semantic_support_for"):
        v = get(d, k)
        if v is not None and not isinstance(v, (list, tuple)):
            err(p, f"{k} must be a list, got {type(v).__name__} — a scalar edge "
                   "silently erased by list-coercion is an authority edge erased")
    if get(d, "term.owl_entity_kind") not in ("class", "object_property",
                                              "data_property", "individual"):
        err(p, f"term.owl_entity_kind {get(d, 'term.owl_entity_kind')!r} invalid")
    if "review" in d:
        rv = d.get("review")
        if not isinstance(rv, dict):
            err(p, f"review must be a MAPPING of stage -> status, got {rv!r} — "
                   "the schema publishes this progress block as a mapping "
                   "(authority still lives in .review.yaml + ratifications)")
        else:
            for rk, rvv in rv.items():
                if not isinstance(rvv, str) or not rvv.strip():
                    err(p, f"review.{rk} must be a non-blank STRING status, "
                           f"got {rvv!r}")
    w = d.get("operational_warrant") if isinstance(d.get("operational_warrant"), dict) else {}
    cqs, sup = aslist(w.get("competency_questions")), aslist(w.get("semantic_support_for"))
    if not cqs and not sup:
        err(p, "no operational warrant")
    if cqs and sup:
        err(p, "a term is a DECISION term (CQs) or a SUPPORT term — never both")
    for c in cqs:
        if not isinstance(c, str) or not c.strip():
            err(p, f"competency_questions entry {c!r} is not a non-blank CQ id")
    for s in sup:
        s = str(s)
        if not (s.startswith("otp:") or re.match(r"^https?://", s)):
            err(p, f"semantic_support_for entry {s!r} must be an otp: id or a ratified term IRI")
        if s == str(d.get("id")) or s == str(get(d, "term.proposed_iri") or "\x00"):
            err(p, "semantic_support_for is self-referential")


@record
def check_rat(d, p):
    need(d, ["id", "proposal_ref", "proposal_sha256", "decision", "steward.id",
             "decided_at", "verbatim_decision"], p)
    check_kind_id(d, p, "rat")
    need_str(d, "steward.id", p)
    need_str(d, "steward.name", p)
    fname = str(getattr(p, "name", ""))
    m = re.match(r"^rat-0*(\d+)\.yaml$", fname)
    if fname.startswith("rat-") and not m:
        err(p, f"ratification filename {fname!r} must be rat-<nnn>.yaml — a "
               "non-numeric authority filename escapes the numbering lifecycle")
    if m and str(d.get("id")) != f"rat:{int(m.group(1))}":
        err(p, f"file {fname} carries id {d.get('id')!r} — the filename number "
               "and record id must agree or numbering games hide decisions")
    if type(d.get("proposal_sha256")) is not str or \
            not re.fullmatch(r"[0-9a-f]{64}", d.get("proposal_sha256")):
        err(p, "proposal_sha256 must be the sha256 of the proposal FILE bytes the "
               "steward actually saw — an id-only ratification authorizes whatever "
               "the file later becomes")
    if d.get("decision") not in DECISION:
        err(p, f"decision {d.get('decision')!r} invalid")
    if not isinstance(d.get("decided_at"), str):
        err(p, f"decided_at must be a STRING timestamp, got {d.get('decided_at')!r}")
    ts = str(d.get("decided_at") or "")
    try:
        from datetime import datetime
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        err(p, "decided_at must be a PARSEABLE ISO8601 date/timestamp (2026-99-99 "
               "is a shape, not a date) — authority metadata conforms or it is "
               "not authority metadata")
    need_str(d, "verbatim_decision", p)
    if "rationale" in d and not isinstance(d.get("rationale"), str):
        err(p, f"rationale must be a STRING, got {d.get('rationale')!r} — "
               "authority prose is text, not a stringified scalar")
    if d.get("decision") in ("reject", "revise") and \
            (not isinstance(d.get("rationale"), str) or
             len(d.get("rationale").strip()) < 20):
        err(p, "reject/revise requires a substantive rationale (>=20 chars)")


@record
def check_rej(d, p):
    need(d, ["id", "proposal_ref", "rationale"], p)
    check_kind_id(d, p, "rej")
    fname = str(getattr(p, "name", ""))
    m = re.match(r"^rej-0*(\d+)\.yaml$", fname)
    if fname.startswith("rej-") and not m:
        err(p, f"rejection filename {fname!r} must be rej-<nnn>.yaml")
    if m and str(d.get("id")) != f"rej:{int(m.group(1))}":
        err(p, f"file {fname} carries id {d.get('id')!r} — filename number and "
               "record id must agree")
    if not isinstance(d.get("rationale"), str) or \
            len(d.get("rationale").strip()) < 20:
        err(p, "rejection-ledger rationale must be a substantive STRING "
               "(>=20 chars) — it is what stops future re-proposal")


@record
def check_review(d, p):
    need(d, ["target", "target_sha256", "chain_sha256", "seat", "verdict",
             "surfaces"], p)
    if not re.match(r"^otp:[\w-]+:\d+$", str(d.get("target") or "")):
        err(p, "review target must be an otp: id — edge reviews bind to nothing; "
               "taxonomy edges live in the proposal's parents and are reviewed there")
    for k in ("target_sha256", "chain_sha256"):
        if type(d.get(k)) is not str or not re.fullmatch(r"[0-9a-f]{64}", d.get(k)):
            err(p, f"{k} must be 64 hex (target = proposal file bytes; chain = "
                   "FRAMED sha256 over the OTP+IC+FA+DH files plus the cited SO/PO "
                   "records, sorted by filename — filename+length+bytes per member, "
                   "then the CQ-suite digest as a virtual member)")
    if d.get("seat") != "ontoclean-adversary":
        err(p, "review dispositions are the ADVERSARY seat's artifact")
    if d.get("verdict") not in REVIEW_VERDICT:
        err(p, f"verdict {d.get('verdict')!r} invalid")
    if "needed_evidence" in d and not isinstance(d.get("needed_evidence"), str):
        err(p, f"needed_evidence must be a STRING, got "
               f"{d.get('needed_evidence')!r} — it is printed as operative "
               "FLAGGED text at the gate")
    if d.get("verdict") == "INDETERMINATE" and \
            (not isinstance(d.get("needed_evidence"), str) or
             len(d.get("needed_evidence").strip()) < 15):
        err(p, "INDETERMINATE must name the discriminating evidence")
    surf = d.get("surfaces") if isinstance(d.get("surfaces"), dict) else {}
    if "no_surface_reasons" in d and not isinstance(d.get("no_surface_reasons"), dict):
        err(p, "no_surface_reasons must be a MAPPING")
    if "rival_models_still_viable" in d and \
            not isinstance(d.get("rival_models_still_viable"), (list, tuple)):
        err(p, "rival_models_still_viable must be a LIST — a scalar suppresses "
               "the DISPUTED flag by shape")
    reasons = d.get("no_surface_reasons") if isinstance(d.get("no_surface_reasons"), dict) else {}
    attacks = list(dicts(d.get("attacks"), p, "attacks"))
    landed = False
    for s in SURFACES:
        v = surf.get(s)
        if v not in ("attacked", "no_surface"):
            err(p, f"surfaces.{s} must be attacked|no_surface")
        elif v == "no_surface":
            if s in ALWAYS_PRESENT_SURFACES:
                err(p, f"surfaces.{s} cannot be no_surface")
            elif not isinstance(reasons.get(s), str) or \
                    len(reasons.get(s).strip()) < 10:
                err(p, f"surfaces.{s}: no_surface requires a concrete STRING "
                       "reason (a stringified scalar is not a reason)")
        elif not any(a.get("surface") == s for a in attacks):
            err(p, f"surfaces.{s} claims attacked but no attack row carries surface: {s}")
    for a in attacks:
        if a.get("outcome") not in ("landed", "survived"):
            err(p, f"attack outcome {a.get('outcome')!r} invalid")
        if a.get("surface") not in SURFACES:
            err(p, f"attack surface {a.get('surface')!r} invalid")
        if not isinstance(a.get("rule"), str) or not a.get("rule").strip():
            err(p, "every attack row needs a non-blank STRING rule — an unnamed "
                   "attack cannot be joined to a revision_log and never has to be "
                   "answered")
        if not isinstance(a.get("counterexample"), str) or \
                len(a.get("counterexample").strip()) < 10:
            err(p, "every attack row needs a concrete STRING counterexample")
        landed = landed or a.get("outcome") == "landed"
    if d.get("verdict") == "PASS" and landed:
        err(p, "verdict PASS with a landed attack is self-contradictory")
    if d.get("verdict") == "FAIL" and not landed:
        err(p, "verdict FAIL with zero landed attacks is self-contradictory — what "
               "failed, if nothing landed? (and an empty landed set makes the "
               "revision_log join vacuous)")
    if "revision_requests" in d:
        rr = d.get("revision_requests")
        if not isinstance(rr, (list, tuple)):
            err(p, f"revision_requests must be a LIST of non-blank strings, "
                   f"got {type(rr).__name__} — it is the adversary's ONLY "
                   "legal repair channel")
        else:
            for x in rr:
                if not isinstance(x, str) or not x.strip():
                    err(p, f"revision_requests entry {x!r} is not a non-blank "
                           "STRING")
    ev = aslist(d.get("evidence"))
    if not ev:
        err(p, "evidence must cite the observation/CQ ids the verdict stands on")
    for e in ev:
        if not re.fullmatch(r"(so|po):sha256:[0-9a-f]{64}|CQ-[\w-]+", str(e)):
            err(p, f"evidence entry {e!r} is not a full observation id or CQ id")


@record
def check_manifest(d, p):
    need(d, ["run_id", "repository.commit", "ontology.name", "scope_doc.path",
             "cq_suite.path", "adapters", "agents"], p)
    cq_count = get(d, "cq_suite.cq_count")
    if not is_exact_int(cq_count) or cq_count < 1:
        err(p, "cq_suite.cq_count must be an exact INTEGER >= 1 (the zero-CQ "
               "HARD STOP; a YAML boolean is not a count)")
    if not valid_run_id(d.get("run_id")):
        err(p, "run_id must match the closed grammar orun-YYYY-MM-DDTHH:MM:SS"
               "[.f][Z|±HH:MM] on the EXACT string (orun-999 is a character "
               "class; a `/` separator nests archive paths; edge whitespace "
               "and control bytes are not normalized away) — the SAME grammar "
               "--print-run-id enforces")
    if not isinstance(get(d, "ontology.name"), str):
        err(p, "ontology.name must be a string")
    need_bool(d, "repository.dirty", p)
    need_bool(d, "first_run", p)
    pw = get(d, "repository.pin_waived")
    if pw is not None and type(pw) is not bool:
        err(p, f"repository.pin_waived must be a BOOLEAN, got {pw!r} — neither a "
               "string that says 'no' nor an integer may read as a waiver state")
        pw = None
    if pw is True:
        need_str(d, "repository.waiver_reason", p, minlen=20)
    if get(d, "repository.dirty") is True and pw is not True:
        err(p, "dirty source requires pin_waived: true with a reason")
    for k in ("scope_doc.path", "cq_suite.path", "repository.commit"):
        need_str(d, k, p)
    need_hex(d, "scope_doc.sha256_12", p, 12)
    need_hex(d, "cq_suite.sha256_12", p, 12)
    for a in dicts(d.get("adapters"), p, "adapters"):
        for k in ("id", "version", "script", "golden_fixture"):
            if not isinstance(a.get(k), str) or not a.get(k).strip():
                err(p, f"adapters entry {k} must be a non-blank STRING, got "
                       f"{a.get(k)!r} — a YAML integer joins nothing; the "
                       "extractor tuple is text")
        need_hex(a, "script_sha256_12", p, 12)
    agents = d.get("agents") if isinstance(d.get("agents"), dict) else {}
    for role, expected_prompt in PROMPT_ROLES.items():
        a = agents.get(role) if isinstance(agents.get(role), dict) else {}
        if not isinstance(a.get("model"), str) or not a.get("model").strip():
            err(p, f"agents.{role}.model must be a non-blank STRING, got "
                   f"{a.get('model')!r}")
        if a.get("prompt") != expected_prompt:
            err(p, f"agents.{role}.prompt must be {expected_prompt!r} — the "
                   "role-to-prompt binding is fixed; an omitted or swapped prompt "
                   "path makes the digest lock meaningless")
        else:
            f = SKILL_DIR / expected_prompt
            if not f.is_file():
                err(p, f"agents.{role}: shipped prompt missing at {expected_prompt}")
            elif sha12(f.read_bytes()) != a.get("prompt_sha256_12"):
                err(p, f"agents.{role}.prompt_sha256_12 does not match the shipped "
                       "prompt bytes")
    if need_bool(d, "agents.adversary.independent_context", p) is not True:
        err(p, "agents.adversary.independent_context must be boolean true")
    if need_bool(d, "agents.alternative.blinded", p) is not True:
        err(p, "agents.alternative.blinded must be boolean true")
    eng = d.get("engine") if isinstance(d.get("engine"), dict) else {}
    want_val = sha12(Path(__file__).resolve().read_bytes())
    shared = SKILL_DIR.parent / "_shared"
    contracts = sorted(
        list((shared / "schemas").glob("*.yaml")) +
        list(shared.glob("*.yaml")) + list(shared.glob("*.md")) +
        list(shared.glob("*.json")) +
        list((SKILL_DIR / "templates").glob("*.yaml")),
        key=lambda f: str(f.relative_to(SKILL_DIR.parent)))
    hc = hashlib.sha256()
    for cf in contracts:
        data = cf.read_bytes()
        hc.update(f"{cf.relative_to(SKILL_DIR.parent)}\n{len(data)}\n".encode())
        hc.update(data)
    want_con = hc.hexdigest()[:12]
    if eng.get("validator_sha256_12") != want_val:
        err(p, f"engine.validator_sha256_12 must equal the digest of the validator "
               f"that judges this run ({want_val}) — a manifest that cannot name "
               "its engine reconstructs nothing")
    if eng.get("contracts_sha256_12") != want_con:
        err(p, f"engine.contracts_sha256_12 must equal the framed digest of the "
               f"FULL contract closure — shared schemas, rules, references, the "
               f"namespace map, and the skill templates ({want_con})")
    if d.get("first_run") is not True and \
            not str(d.get("prior_index") or "").strip():
        err(p, "prior_index must name the previous run's index (first_run: true "
               "is the only exemption)")
    pi = str(d.get("prior_index") or "").strip()
    if d.get("first_run") is True and pi:
        err(p, "first_run: true with a prior_index is a contradiction — a first "
               "run has no predecessor; a non-first run may not claim firstness")
    if pi:
        if not re.fullmatch(r"runs/orun-[^/]+\.index\.yaml", pi):
            err(p, f"prior_index {pi!r} must be an ARCHIVED index "
                   "(runs/<run_id>.index.yaml) — the current canonical index or "
                   "any other live path is not a predecessor")
        if need_hex(d, "prior_index_sha256_12", p, 12) is None:
            err(p, "prior_index_sha256_12 (12 hex of the prior index file BYTES, "
                   "exact-type string) is required — an unauthenticated prior "
                   "index is mutable carry-forward authority")
    for k in ("empty_corpus_reason", "unresolved_fraction_waiver"):
        v = d.get(k)
        if v not in (None, "") and (not isinstance(v, str) or len(v.strip()) < 20):
            err(p, f"{k} must be a substantive reason (>=20 chars)")


# --- cross-record checks ----------------------------------------------------

def cross_check_chain(otps, dhs, ics, fas, obs_ids):
    """Coherence, not id-existence: the IC must be OF the OTP's hypothesis, the
    FA must join the same card, and verdicts must agree across the pair."""
    out = []
    dh_by = {d.get("id"): d for _, d in dhs if type(d.get("id")) is str}
    ic_by = {d.get("id"): d for _, d in ics if type(d.get("id")) is str}
    fa_by_hyp = {d.get("hypothesis_ref"): d for _, d in fas
                 if type(d.get("hypothesis_ref")) is str}
    for p, d in dhs:
        for ref in aslist(d.get("observation_refs")):
            if type(ref) is not str:
                out.append(f"{p}: observation_refs entry {ref!r} is not a STRING "
                           "id — quarantined from the join")
            elif ref not in obs_ids:
                out.append(f"{p}: observation_refs {ref!r} matches no scanned observation")
    for p, d in fas:
        ic = ic_by.get(skey(d.get("identity_card_ref")))
        if ic is None:
            out.append(f"{p}: identity_card_ref {d.get('identity_card_ref')!r} "
                       "resolves to no IdentityCard")
        elif ic.get("hypothesis_ref") != d.get("hypothesis_ref"):
            out.append(f"{p}: joins an IdentityCard of a DIFFERENT hypothesis "
                       f"({ic.get('hypothesis_ref')!r}) — cross-wired records are "
                       "not an analysis")
    for p, d in otps:
        hyp, icr = skey(d.get("hypothesis_ref")), skey(d.get("identity_card_ref"))
        dh = dh_by.get(hyp)
        if dh is None:
            out.append(f"{p}: hypothesis_ref {hyp!r} resolves to no DenotationHypothesis")
        else:
            nh = dh.get("null_hypothesis") if isinstance(dh.get("null_hypothesis"), dict) else {}
            if not (nh.get("rejected") is True and nh.get("discriminator") and
                    dh.get("representation_status") in SURVIVING_REPR):
                out.append(f"{p}: hypothesis {hyp!r} did NOT survive")
        ic = ic_by.get(icr)
        if ic is None:
            out.append(f"{p}: identity_card_ref {icr!r} resolves to no IdentityCard")
        elif ic.get("hypothesis_ref") != hyp:
            out.append(f"{p}: identity card {icr!r} rules hypothesis "
                       f"{ic.get('hypothesis_ref')!r}, not this proposal's {hyp!r} "
                       "— an OTP may not borrow another referent's identity analysis")
        fa = fa_by_hyp.get(hyp)
        if fa is None:
            out.append(f"{p}: no FoundationalAnalysis covers hypothesis {hyp!r}")
        else:
            if fa.get("identity_card_ref") != icr:
                out.append(f"{p}: its FoundationalAnalysis joins card "
                           f"{fa.get('identity_card_ref')!r}, the proposal joins "
                           f"{icr!r} — the closure must be ONE card")
            if fa.get("verdict") != d.get("foundational_status"):
                out.append(f"{p}: foundational_status {d.get('foundational_status')!r} "
                           f"contradicts the analysis verdict {fa.get('verdict')!r} — "
                           "the proposal does not get to relabel the analysis")
            if any((r or {}).get("still_viable") in (True, "true", "True")
                   for r in aslist(fa.get("rival_models")) if isinstance(r, dict)):
                siblings = sum(1 for _, o in otps if o.get("hypothesis_ref") == hyp)
                if siblings < 2 and not (d.get("open_issues") or []):
                    out.append(f"{p}: the analysis lists a still-viable rival model "
                               "but there is ONE proposal and no open_issues entry — "
                               "the forbidden silent merge")
    return out


def cross_check_support_graph(otps, rats, otp_digests):
    out = []
    by_id = {d.get("id"): (d, p) for p, d in otps if type(d.get("id")) is str}
    accepted_iris = set()
    for _, r in rats:
        if r.get("decision") == "accept":
            ref = str(r.get("proposal_ref"))
            tgt = by_id.get(ref)
            if tgt and r.get("proposal_sha256") == otp_digests.get(ref):
                iri = get(tgt[0], "term.proposed_iri")
                if iri:
                    accepted_iris.add(str(iri))
    for p, d in otps:
        for s in aslist(get(d, "operational_warrant.semantic_support_for")):
            s = str(s)
            if s.startswith("otp:"):
                tgt = by_id.get(s)
                if tgt is None:
                    out.append(f"{p}: semantic_support_for {s!r} does not resolve")
                elif not aslist(get(tgt[0], "operational_warrant.competency_questions")):
                    out.append(f"{p}: semantic_support_for {s!r} targets a term with "
                               "no decision-CQ warrant")
            elif re.match(r"^https?://", s) and s not in accepted_iris:
                out.append(f"{p}: semantic_support_for IRI {s!r} matches no "
                           "DIGEST-FRESH steward-accepted proposal — a mutated or "
                           "unratified IRI is not a ratified term")
    return out


def cross_check_rats(rats, otps, otp_digests):
    out = []
    by_id = {d.get("id"): d for _, d in otps if type(d.get("id")) is str}
    seen_verbatim, seen_ref = {}, {}
    for p, d in rats:
        ref = str(d.get("proposal_ref") or "")
        verb = str(d.get("verbatim_decision") or "").strip()
        if ref in seen_ref:
            out.append(f"{p}: second ratification for {ref} (first: {seen_ref[ref]})")
        seen_ref[ref] = str(p)
        tgt = by_id.get(ref)
        if tgt is None:
            out.append(f"{p}: proposal_ref {ref!r} does not resolve to a proposal")
        else:
            if d.get("proposal_sha256") != otp_digests.get(ref):
                out.append(f"{p}: STALE ratification — the proposal's bytes changed "
                           "after the steward decided; the decision authorizes the "
                           "bytes the steward saw, nothing later")
            local = str(get(tgt, "term.local_name") or "")
            slug = ref.split(":")[1] if ref.count(":") >= 2 else ""
            names = [n for n in (local, slug) if len(n) >= 3]
            if not names:
                if ref not in verb:
                    out.append(f"{p}: term name too short — the verbatim must "
                               f"contain the full proposal id {ref!r}")
            elif not any(re.search(rf"\b{re.escape(n)}\b", verb, re.I) for n in names):
                out.append(f"{p}: verbatim_decision does not name this proposal ({local!r})")
        key = re.sub(r"\s+", " ", verb.lower())
        if key in seen_verbatim:
            out.append(f"{p}: verbatim_decision is byte-identical to {seen_verbatim[key]}")
        else:
            seen_verbatim[key] = str(p)
    return out


def check_prior_rows(rows, path):
    """Predecessor-LOCAL structural validation. The prior index is
    digest-authenticated and actively used as transition authority (re-park
    refusal, carried joins) — malformed local shape there is malformed
    authority, not the deleted-history residual. Cross-run reference
    resolution is deliberately NOT required (old proposed/mapped refs may
    have rotated away); everything locally checkable is checked."""
    out = []
    seen = set()
    for r in rows or []:
        if not isinstance(r, dict):
            out.append(f"prior_index row {r!r} is not a mapping")
            continue
        obs = r.get("observation")
        if type(obs) is not str or not obs.strip():
            out.append(f"prior_index row observation {obs!r} is not a STRING id")
            continue
        if not re.fullmatch(r"(so|po):sha256:[0-9a-f]{64}", obs):
            out.append(f"prior_index row observation {obs!r} does not match the "
                       "(so|po):sha256:<64hex> id grammar")
        if obs in seen:
            out.append(f"prior_index DUPLICATE row for {obs} — last-wins lookup "
                       "would suppress the re-park refusal")
        seen.add(obs)
        outcome = r.get("outcome")
        if outcome not in ("irrelevant", "mapped", "proposed", "unresolved"):
            out.append(f"prior_index row {obs}: invalid/missing outcome {outcome!r}")
        cfp = r.get("carried_from_prior")
        if cfp is not None and type(cfp) is not bool:
            out.append(f"prior_index row {obs}: carried_from_prior must be a "
                       f"BOOLEAN, got {cfp!r}")
        if cfp is True and outcome not in ("irrelevant", "unresolved"):
            out.append(f"prior_index row {obs}: carried row cannot be "
                       f"{outcome!r} — nothing observed in that run supports it")
        if outcome == "irrelevant":
            reason = r.get("reason") if isinstance(r.get("reason"), str) else ""
            if len(reason.strip()) < 15 or reason.strip().lower() in TRIVIAL_REASONS:
                out.append(f"prior_index row {obs}: irrelevant needs a concrete "
                           "reason (same meter as the live index)")
        for k in ("reason", "needed_evidence"):
            if k in r and not isinstance(r.get(k), str):
                out.append(f"prior_index row {obs}: {k} must be a STRING, got "
                           f"{r.get(k)!r}")
        if outcome == "unresolved":
            if not isinstance(r.get("needed_evidence"), str) or                     len(r.get("needed_evidence").strip()) < 15:
                out.append(f"prior_index row {obs}: unresolved requires "
                           "needed_evidence")
            since = r.get("since")
            if type(since) is not str or \
                    not re.fullmatch(r"\d{4}-\d{2}-\d{2}", since):
                out.append(f"prior_index row {obs}: since must be EXACTLY "
                           "YYYY-MM-DD")
            else:
                from datetime import date
                try:
                    if date.fromisoformat(since) > date.today():
                        out.append(f"prior_index row {obs}: since is in the future")
                except ValueError:
                    out.append(f"prior_index row {obs}: since is not a real date")
        if outcome in ("mapped", "proposed"):
            ref = r.get("ref")
            if type(ref) is not str or not ref.strip():
                out.append(f"prior_index row {obs}: {outcome} ref {ref!r} is not "
                           "a non-blank STRING")
    return out


def cross_check_rejections(rats, rejs, otp_ids=None):
    out = []
    rej_refs = {str(d.get("proposal_ref")) for _, d in rejs}
    reject_rats = {str(d.get("proposal_ref")): d.get("rationale")
                   for _, d in rats if d.get("decision") == "reject"}
    for p, d in rats:
        if d.get("decision") == "reject" and str(d.get("proposal_ref")) not in rej_refs:
            out.append(f"{p}: reject decision with no rejection-ledger record")
    seen_rej = {}
    for p, d in rejs:
        ref = str(d.get("proposal_ref"))
        if ref in seen_rej:
            out.append(f"{p}: DUPLICATE rejection-ledger row for {ref} (also "
                       f"{seen_rej[ref]}) — one ledger entry per proposal")
        seen_rej[ref] = str(p)
        if otp_ids is not None and ref not in otp_ids:
            out.append(f"{p}: rejection ledger names {ref!r} but no such "
                       "proposal is in the scan — a ledger row for a ghost "
                       "proposal suppresses future proposals nobody rejected")
        if ref not in reject_rats:
            out.append(f"{p}: rejection ledger row for {ref} has NO "
                       "decision: reject ratification — the ledger records a "
                       "steward rejection; without the ratification it is "
                       "authority nobody authored")
        else:
            rat_rationale = reject_rats[ref]
            led = d.get("rationale")
            if isinstance(rat_rationale, str) and isinstance(led, str) and \
                    led.strip() != rat_rationale.strip():
                out.append(f"{p}: rejection-ledger rationale for {ref} is NOT "
                           "the ratification's rationale — the ledger must "
                           "carry the steward's OWN reason; a substituted "
                           "reason suppresses future proposals on authority "
                           "the steward never gave")
    return out


def review_round(path):
    m = re.search(r"-r(\d+)\.review\.yaml$", str(path))
    return int(m.group(1)) if m else 1


def latest_reviews(reviews):
    cur = {}
    for p, d in sorted(reviews, key=lambda t: (review_round(t[0]), str(t[0]))):
        tgt = str(d.get("target"))
        if tgt not in cur or review_round(p) >= review_round(cur[tgt][0]):
            cur[tgt] = (p, d)
    return cur


def cross_check_review_binding(reviews, otp_records):
    """History, not last-verdict: a PASS is illegal on any digest a FAIL EVER
    judged; a PASS after a FAIL on new bytes requires the proposal to carry a
    revision_log naming every failed digest; review rounds are contiguous."""
    out = []
    for p, d in reviews:
        tgt = d.get("target")
        if type(tgt) is str and tgt not in otp_records:
            out.append(f"{p}: review target {tgt!r} resolves to NO scanned "
                       "proposal — an orphan review is authority bound to "
                       "nothing, and pre-planted history for a future id")
    digests = {}
    for oid, (path, _) in otp_records.items():
        try:
            digests[oid] = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        except Exception:  # noqa: BLE001
            pass
    failed = {}        # tgt -> set of FAILed digests
    failed_rules = {}  # (tgt, digest) -> landed attack rules of that FAIL
    prior_failed = {}  # tgt -> {round: digests}; gate retire-targets are only
                       # digests from rounds BEFORE the latest per target
    rounds = {}        # tgt -> {round: path}
    for p, d in sorted(reviews, key=lambda t: (review_round(t[0]), str(t[0]))):
        tgt, tsha, v = str(d.get("target")), str(d.get("target_sha256") or ""), d.get("verdict")
        r = review_round(p)
        prev = rounds.setdefault(tgt, {})
        if r in prev:
            out.append(f"{p}: SECOND review at round {r} for {tgt} (first: "
                       f"{prev[r]}) — two files cannot both be one round; "
                       "history is a sequence, not a pile")
        prev[r] = str(p)
        landed_rules_here = {str(a.get("rule")) for a in aslist(d.get("attacks"))
                             if isinstance(a, dict) and a.get("outcome") == "landed"
                             and a.get("rule")}
        if v == "FAIL":
            failed.setdefault(tgt, set()).add(tsha)
            failed_rules.setdefault((tgt, tsha), set()).update(landed_rules_here)
            prior_failed.setdefault(tgt, {}).setdefault(r, set()).add(tsha)
        elif v == "INDETERMINATE":
            if tsha in failed.get(tgt, ()):
                out.append(f"{p}: INDETERMINATE on the SAME proposal bytes a FAIL "
                           f"already judged ({tgt}) — an abstention does not retire "
                           "a FAIL; only CHANGED bytes with revision_log coverage do")
            # landed attacks inside an INDETERMINATE are history too: a later
            # PASS on unchanged bytes may not silently mark them survived
            failed_rules.setdefault((tgt, tsha), set()).update(landed_rules_here)
            if landed_rules_here:
                failed.setdefault(tgt, set()).add(tsha)
                prior_failed.setdefault(tgt, {}).setdefault(r, set()).add(tsha)
        elif v == "PASS":
            if tsha in failed.get(tgt, ()):
                out.append(f"{p}: PASS on the SAME proposal bytes a FAIL (or a "
                           f"landed-attack INDETERMINATE) already judged ({tgt}) — "
                           "revision means the bytes change, not the verdict")
            elif failed.get(tgt):
                rec = otp_records.get(tgt)
                logged = {}
                if rec:
                    # UNION entries sharing a digest: the schema permits
                    # splitting addressed rules across entries, and a
                    # last-wins dict would erase earlier answers
                    for e in aslist(rec[1].get("revision_log")):
                        if isinstance(e, dict):
                            logged.setdefault(str(e.get("from_sha256")),
                                              set()).update(
                                str(a) for a in aslist(e.get("addressed"))
                                if isinstance(a, str))
                for fd in failed[tgt]:
                    if fd not in logged:
                        out.append(f"{p}: PASS after FAIL without a revision_log "
                                   f"entry naming failed digest {fd[:12]}…")
                    else:
                        unanswered = failed_rules.get((tgt, fd), set()) - logged[fd]
                        if unanswered:
                            out.append(f"{p}: revision_log for failed digest "
                                       f"{fd[:12]}… does not address the FAIL's "
                                       f"landed attack rule(s) {sorted(unanswered)} — "
                                       "a log entry that answers none of the attacks "
                                       "that landed is a guestbook signature, not a "
                                       "revision")
    for tgt, rs in rounds.items():
        if set(rs) != set(range(1, max(rs) + 1)):
            out.append(f"reviews for {tgt}: rounds {sorted(rs)} are non-contiguous — "
                       "a deleted or skipped round is deleted history")
    prior_only = {}
    for tgt, by_round in prior_failed.items():
        if not by_round:
            continue
        latest = max(rounds.get(tgt, {1: None}))
        prior_only[tgt] = set()
        for rnd, digs in by_round.items():
            if rnd < latest:
                prior_only[tgt].update(digs)
    return out, digests, {"all": failed, "prior": prior_only,
                          "rules": failed_rules}


def cross_check_index(rows, idx_path, seen_obs, otps, dhs, unrep_ids, prior_rows=None):
    out = []
    by_id = {d.get("id"): d for _, d in otps if type(d.get("id")) is str}
    dh_by = {d.get("id"): d for _, d in dhs if type(d.get("id")) is str}
    prior_by = {r.get("observation"): r for r in (prior_rows or [])
                if isinstance(r, dict) and type(r.get("observation")) is str}
    indexed = set()
    if rows is not None and not isinstance(rows, list):
        out.append(f"{idx_path}: index must be a LIST of rows, got {type(rows).__name__}")
        return out
    for r in rows or []:
        if not isinstance(r, dict):
            out.append(f"{idx_path}: row {r!r} is not a mapping")
            continue
        obs, outcome = r.get("observation"), r.get("outcome")
        if type(obs) is not str:
            out.append(f"{idx_path}: row observation {obs!r} is not a STRING id "
                       "— malformed authority is quarantined from joins, never "
                       "hashed")
            continue
        if obs in indexed:
            out.append(f"{idx_path}: duplicate row for {obs}")
        indexed.add(obs)
        cfp = r.get("carried_from_prior")
        if cfp is not None and type(cfp) is not bool:
            out.append(f"{idx_path}: row {obs}: carried_from_prior must be a "
                       f"BOOLEAN, got {cfp!r}")
        carried = cfp is True
        if carried:
            if obs not in prior_by:
                out.append(f"{idx_path}: row {obs}: carried_from_prior but the id is "
                           "NOT in the prior index — carrying an invented ghost is "
                           "denominator padding, not drift accounting")
            if obs in seen_obs:
                out.append(f"{idx_path}: row {obs}: carried_from_prior on an "
                           "observation THIS run emitted — carried means the parser "
                           "no longer produces it; a live observation marked carried "
                           "is a denominator bypass")
            if outcome not in ("irrelevant", "unresolved"):
                out.append(f"{idx_path}: row {obs}: a carried (retired/parked) "
                           f"observation cannot be {outcome!r} — nothing observed "
                           "THIS run supports it")
        elif obs not in seen_obs:
            out.append(f"{idx_path}: row {obs} matches no scanned observation")
        prior = prior_by.get(obs)
        if carried:
            flags.append(f"{idx_path}: row {obs}: CARRIED retirement/park "
                         f"({outcome}: {str(r.get('reason') or r.get('needed_evidence'))!r}) "
                         "— the steward judges whether it is truthful")
        elif prior and prior.get("outcome") == "unresolved" and outcome == "irrelevant":
            flags.append(f"{idx_path}: row {obs}: prior-UNRESOLVED row re-dispositioned "
                         f"IRRELEVANT ({str(r.get('reason'))!r}) — the steward judges "
                         "whether this retirement is truthful")
        if outcome not in ("irrelevant", "mapped", "proposed", "unresolved"):
            out.append(f"{idx_path}: row {obs}: invalid outcome {outcome!r}")
            continue
        if "reason" in r and not isinstance(r.get("reason"), str):
            out.append(f"{idx_path}: row {obs}: reason must be a STRING, got "
                       f"{r.get('reason')!r} — steward-facing prose is text")
        if "needed_evidence" in r and not isinstance(r.get("needed_evidence"), str):
            out.append(f"{idx_path}: row {obs}: needed_evidence must be a STRING, "
                       f"got {r.get('needed_evidence')!r}")
        if outcome == "irrelevant":
            reason = str(r.get("reason") or "").strip() \
                if isinstance(r.get("reason"), str) else ""
            if len(reason) < 15 or reason.lower() in TRIVIAL_REASONS:
                out.append(f"{idx_path}: row {obs}: irrelevant needs a concrete reason")
        elif outcome in ("mapped", "proposed"):
            ref = str(r.get("ref") or "")
            tgt = by_id.get(ref)
            if tgt is None:
                out.append(f"{idx_path}: row {obs}: {outcome} ref {ref!r} must resolve")
            else:
                if outcome == "mapped" and get(tgt, "reuse.exact_reuse_found") is not True:
                    out.append(f"{idx_path}: row {obs}: mapped ref is not a reuse proposal")
                dh = dh_by.get(skey(tgt.get("hypothesis_ref"))) or {}
                if obs not in aslist(dh.get("observation_refs")):
                    out.append(f"{idx_path}: row {obs}: proposal {ref!r} does not "
                               "cite this observation in its hypothesis evidence — "
                               "closing an observation with someone else's proposal "
                               "skips its analysis")
        else:  # unresolved
            ne = str(r.get("needed_evidence") or "").strip() \
                if isinstance(r.get("needed_evidence"), str) else ""
            if len(ne) < 15:
                out.append(f"{idx_path}: row {obs}: unresolved requires needed_evidence")
            since = str(r.get("since") or "")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", since):
                out.append(f"{idx_path}: row {obs}: since must be EXACTLY YYYY-MM-DD")
            else:
                try:
                    if date.fromisoformat(since) > date.today():
                        out.append(f"{idx_path}: row {obs}: since is in the future")
                except ValueError:
                    out.append(f"{idx_path}: row {obs}: since is not a real date")
            prior = prior_by.get(obs)
            if prior and prior.get("outcome") == "unresolved" and \
                    str(prior.get("needed_evidence") or "").strip() == ne:
                out.append(f"{idx_path}: row {obs}: re-parked VERBATIM from the prior run")
        if obs in unrep_ids and outcome in ("mapped", "proposed"):
            out.append(f"{idx_path}: row {obs}: unrepresentable_construct observations "
                       "may only be unresolved or irrelevant")
    missing = seen_obs - indexed
    if missing:
        out.append(f"{idx_path}: {len(missing)} observation(s) have NO disposition: "
                   f"{sorted(str(m) for m in missing)[:3]}")
    return out


# --- fidelity recompute (--repo) --------------------------------------------

def safe_join(repo_root, rel, p, what="repository.path"):
    rel = str(rel or "")
    if rel.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", rel):
        err(p, f"{what} {rel!r} is absolute — pinned paths are relative to the root")
        return None
    try:
        # strict-first resolution: Python 3.13 changed NON-strict resolve()
        # to swallow symlink loops instead of raising, which would let a
        # looped component slide through confinement. resolve(strict=True)
        # raises OSError(ELOOP) on every supported runtime; only a
        # merely-missing tail (FileNotFoundError) falls back to lenient
        # resolution — a loop can never reach the fallback because strict
        # resolution dies at the looping component before any missing tail.
        try:
            target = (repo_root / rel).resolve(strict=True)
        except FileNotFoundError:
            target = (repo_root / rel).resolve()
        root_res = repo_root.resolve()
    except (OSError, RuntimeError) as ex:
        err(p, f"{what} {rel!r} cannot be resolved ({ex}) — fails CLOSED as a "
               "violation, never a crash")
        return None
    if not str(target).startswith(str(root_res) + "/") and target != root_res:
        err(p, f"{what} {rel!r} escapes the pinned root")
        return None
    return target


def make_pinned_reader(repo_root, out, dirty_waived):
    """Consumed bytes come from the PINNED COMMIT (git show HEAD:path), never
    the working tree: a tracked symlink to untracked bytes, a skip-worktree or
    assume-unchanged file, and every other mutable-index game all die here.
    Symlink (120000) and gitlink (160000) modes are rejected — evidence is a
    blob, not a pointer. Only the FLAGGED dirty-waiver path reads the tree."""
    def pinned_read(rel, where):
        import posixpath
        raw = str(rel or "")
        if ".." in raw.split("/"):
            out.append(f"{where}: consumed path {raw!r} contains a raw '..' "
                       "component — parent traversal is rejected BEFORE "
                       "normalization, in-repo cancellation included")
            return None
        rel_n = posixpath.normpath(raw).rstrip("/")
        if rel_n in (".", ""):
            rel_n = ""
        if not rel_n or rel_n.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", rel_n):
            out.append(f"{where}: consumed path {rel!r} is absolute/empty")
            return None
        if ".." in rel_n.split("/"):
            out.append(f"{where}: consumed path {rel!r} escapes the pinned root")
            return None
        try:
            ls = subprocess.run(["git", "-C", str(repo_root), "ls-files", "-s",
                                 "--", rel_n], capture_output=True, text=True,
                                timeout=10)
        except subprocess.TimeoutExpired:
            out.append(f"{where}: git ls-files for {rel_n!r} TIMED OUT — fails "
                       "CLOSED as a violation, never a crash")
            return None
        if ls.returncode != 0 or not ls.stdout.strip():
            out.append(f"{where}: consumed path {rel_n!r} is NOT tracked at the "
                       "pinned commit — untracked bytes are not pinned evidence")
            return None
        mode = ls.stdout.split()[0]
        if mode in ("120000", "160000"):
            out.append(f"{where}: consumed path {rel_n!r} is a symlink/submodule "
                       f"(mode {mode}) — evidence is a blob, not a pointer to "
                       "bytes outside the pin")
            return None
        if dirty_waived:
            # the waiver changes WHERE bytes come from (worktree, FLAGGED); it
            # does not waive object-type authentication — when HEAD resolves
            # the path, it must still be a blob (a tree/forged entry dies even
            # on the waived route; a path absent at HEAD — e.g. newly added on
            # a dirty tree — has no object to authenticate and stays within
            # the disclosed waiver residual)
            try:
                typ = subprocess.run(["git", "-C", str(repo_root), "cat-file",
                                      "-t", f"HEAD:{rel_n}"],
                                     capture_output=True, text=True, timeout=10)
                if typ.returncode == 0 and typ.stdout.strip() != "blob":
                    out.append(f"{where}: HEAD:{rel_n} is "
                               f"{typ.stdout.strip()!r}, not a blob — the dirty "
                               "waiver reads worktree bytes but does not waive "
                               "object-type authentication")
                    return None
            except subprocess.TimeoutExpired:
                out.append(f"{where}: git cat-file for {rel_n!r} TIMED OUT — "
                           "fails CLOSED")
                return None
            try:
                return (repo_root / rel_n).read_bytes()
            except Exception as ex:  # noqa: BLE001
                out.append(f"{where}: cannot read {rel_n!r} ({ex})")
                return None
        try:
            typ = subprocess.run(["git", "-C", str(repo_root), "cat-file", "-t",
                                  f"HEAD:{rel_n}"],
                                 capture_output=True, text=True, timeout=10)
            if typ.returncode != 0 or typ.stdout.strip() != "blob":
                out.append(f"{where}: HEAD:{rel_n} is "
                           f"{typ.stdout.strip() or 'unresolvable'}, not a blob — "
                           "a directory listing is not evidence")
                return None
            show = subprocess.run(["git", "-C", str(repo_root), "show",
                                   f"HEAD:{rel_n}"],
                                  capture_output=True, timeout=15)
            if show.returncode != 0:
                out.append(f"{where}: git show HEAD:{rel_n} FAILED — pinned-blob "
                           "verification fails CLOSED")
                return None
            return show.stdout
        except subprocess.TimeoutExpired:
            out.append(f"{where}: git read of {rel_n!r} TIMED OUT — fails CLOSED")
            return None
    return pinned_read


def repo_fidelity(sos, pos, manifest, otps, reviews, dhs, repo_root):
    out = []
    man_commit = get(manifest[1], "repository.commit") if manifest else None
    dirty_waived = bool(manifest and get(manifest[1], "repository.dirty") is True
                        and get(manifest[1], "repository.pin_waived") is True)
    pinned_read = make_pinned_reader(repo_root, out, dirty_waived)
    try:
        head = subprocess.run(["git", "-C", str(repo_root), "rev-parse", "HEAD"],
                              capture_output=True, text=True, timeout=10)
        if head.returncode != 0:
            out.append(f"{repo_root}: cannot resolve git HEAD — an unpinnable tree "
                       "must use an explicit pin waiver, not silence")
        else:
            if man_commit and head.stdout.strip() != str(man_commit):
                out.append(f"{repo_root}: manifest commit {str(man_commit)[:12]} does "
                           f"not match git HEAD {head.stdout.strip()[:12]} — the pin "
                           "names a tree that is not the one being read")
            status = subprocess.run(["git", "-C", str(repo_root), "status",
                                     "--porcelain", "-uno"],
                                    capture_output=True, text=True, timeout=10)
            if status.returncode != 0:
                out.append(f"{repo_root}: git status FAILED (rc={status.returncode}) "
                           "— dirty-state verification fails CLOSED, never open")
            elif status.stdout.strip() and \
                    not (manifest and get(manifest[1], "repository.dirty") is True):
                out.append(f"{repo_root}: the working tree has TRACKED modifications "
                           "but the manifest asserts dirty: false")
            # per-read blob authentication happens in pinned_read; the status
            # check above is the dirty METER, not the evidence authority
    except Exception as ex:  # noqa: BLE001
        out.append(f"{repo_root}: cannot verify commit against git ({ex})")
    for p, d in sos:
        if man_commit and get(d, "repository.commit") != man_commit:
            out.append(f"{p}: observation commit differs from the manifest pin")
        blob = pinned_read(get(d, "repository.path"), p)
        if blob is None:
            continue
        span = d.get("source_span") if isinstance(d.get("source_span"), dict) else {}
        try:
            lines = blob.decode(errors="replace").splitlines(keepends=True)
            s, e = int(span.get("start_line", 0)), int(span.get("end_line", 0))
            span_text = "".join(lines[s - 1:e])
            if hashlib.sha256(span_text.encode()).hexdigest() != span.get("content_sha256"):
                out.append(f"{p}: source_span.content_sha256 does not match the "
                           "PINNED BLOB (git show HEAD:path) — working-tree bytes "
                           "are not the pin")
            stripped = strip_comments(span_text, get(d, "repository.path"))
            stripped_cfg = strip_comments_config(span_text, get(d, "repository.path"))
            lex = get(d, "symbol.lexical_name")
            if lex and not occurs(lex, stripped):
                out.append(f"{p}: symbol {lex!r} does not occur (token-bounded, "
                           "comments stripped) in its own span")
            for f in aslist(d.get("observed_facts")):
                if not isinstance(f, dict):
                    continue
                pred, obj = f.get("predicate"), str(f.get("object") or "")
                if pred == "unrepresentable_construct" or not obj:
                    continue
                if pred == "config_key_value":
                    key, _, val = obj.partition("=")
                    if not config_pair_occurs(key, val, stripped_cfg,
                                              get(d, "repository.path")):
                        out.append(f"{p}: config pair {key!r}={val!r} does not occur "
                                   "AS A PAIRING in the span — key and value found "
                                   "on different keys authenticate a pairing that "
                                   "is not in the file")
                elif not occurs(obj, stripped):
                    out.append(f"{p}: fact object {obj!r} does not occur token-bounded "
                               "in the comment-stripped span — substring shadows "
                               "(id⊂override) and comment mentions are not declarations")
        except Exception as ex:  # noqa: BLE001
            out.append(f"{p}: cannot verify span against repo ({ex})")
    for p, d in pos:
        if man_commit and get(d, "repository.commit") != man_commit:
            out.append(f"{p}: observation commit differs from the manifest pin")
        blob = pinned_read(get(d, "repository.path"), p)
        if blob is None:
            continue
        span = d.get("source_span") if isinstance(d.get("source_span"), dict) else {}
        try:
            lines = blob.decode(errors="replace").splitlines(keepends=True)
            s, e = int(span.get("start_line", 0)), int(span.get("end_line", 0))
            span_text = "".join(lines[s - 1:e])
            quote = re.sub(r"\s+", " ", str(d.get("quote") or "").strip())
            norm_span = re.sub(r"\s+", " ", span_text)
            if not quote or quote not in norm_span:
                out.append(f"{p}: quote does not occur verbatim in its span")
        except Exception as ex:  # noqa: BLE001
            out.append(f"{p}: cannot verify quote against repo ({ex})")
    if manifest:
        mp, md = manifest
        for label, node in (("scope_doc", md.get("scope_doc")),
                            ("cq_suite", md.get("cq_suite"))):
            node = node if isinstance(node, dict) else {}
            rel, want = node.get("path"), node.get("sha256_12")
            if not rel:
                continue
            data = pinned_read(rel, mp)
            if data is None:
                continue
            if not want:
                out.append(f"{mp}: {label}.sha256_12 missing")
            elif sha12(data) != want:
                out.append(f"{mp}: {label}.sha256_12 does not match the pinned {rel}")
        for a in aslist(md.get("adapters")):
            if not isinstance(a, dict):
                continue
            for field, label in (("script", "adapter script"),
                                 ("golden_fixture", "golden fixture")):
                rel = a.get(field)
                if not rel:
                    continue
                if field == "script":
                    data = pinned_read(rel, mp)
                    if data is not None and a.get("script_sha256_12") and \
                            sha12(data) != a.get("script_sha256_12"):
                        out.append(f"{mp}: {label} digest does not match the pinned {rel}")
                else:
                    rel_n = re.sub(r"^\./+", "", str(rel)).rstrip("/")
                    if rel_n.startswith(":") or "*" in rel_n or "?" in rel_n or \
                            "[" in rel_n:
                        out.append(f"{mp}: {label} {rel_n!r} is not a LITERAL "
                                   "repository-relative path — pathspec magic "
                                   "(:(exclude)…) and globs would let the "
                                   "manifest select members the fixture never "
                                   "named")
                        continue
                    # GIT_LITERAL_PATHSPECS kills remaining pathspec magic on
                    # both enumeration calls; -z gives NUL-delimited RAW
                    # pathnames consumed as BYTES (text mode would decode with
                    # the locale — crashing on legal non-UTF-8 names — and
                    # translate a raw CR to LF, re-opening the
                    # no-HEAD-object waiver arm under a translated name)
                    genv = dict(os.environ, GIT_LITERAL_PATHSPECS="1")
                    try:
                        ls = subprocess.run(["git", "-C", str(repo_root),
                                             "ls-files", "-s", "-z", "--", rel_n],
                                            capture_output=True, timeout=10,
                                            env=genv)
                    except subprocess.TimeoutExpired:
                        out.append(f"{mp}: git ls-files for {label} TIMED OUT — "
                                   "fails CLOSED")
                        continue
                    if ls.returncode != 0 or not ls.stdout.strip(b"\0").strip():
                        out.append(f"{mp}: {label} {rel_n!r} has no tracked files "
                                   "at the pinned commit")
                        continue
                    try:
                        # bytes here too: status output embeds raw pathnames,
                        # and text-mode decoding crashes on legal non-UTF-8
                        # names before any verdict is produced
                        st = subprocess.run(["git", "-C", str(repo_root), "status",
                                             "--porcelain", "--ignored=matching",
                                             "--", rel_n],
                                            capture_output=True,
                                            timeout=10, env=genv)
                    except subprocess.TimeoutExpired:
                        out.append(f"{mp}: git status on {label} TIMED OUT — "
                                   "fails CLOSED")
                        continue
                    if st.returncode != 0:
                        out.append(f"{mp}: git status on {label} FAILED — "
                                   "fails CLOSED")
                    elif st.stdout.strip() and not dirty_waived:
                        out.append(f"{mp}: {label} {rel_n!r} contains modified/"
                                   "untracked/ignored files — a fixture suite "
                                   "with unpinned members is unpinned")
                    for brow in ls.stdout.split(b"\0"):
                        if not brow:
                            continue
                        # -z format: "<mode> <oid> <stage>\t<raw path>" — the
                        # path is RAW BYTES; os.fsdecode round-trips them
                        # losslessly (surrogateescape) into the strings the
                        # later git/worktree calls re-encode identically
                        bmeta, btab, bmember = brow.partition(b"\t")
                        try:
                            parts = bmeta.decode("ascii").split()
                            member = os.fsdecode(bmember)
                        except Exception:
                            parts, member = [], ""
                        if not btab or len(parts) < 3 or not member:
                            out.append(f"{mp}: {label} ls-files row {brow!r} "
                                       "unparseable — fails CLOSED")
                            continue
                        gmode = parts[0]
                        if gmode in ("120000", "160000"):
                            out.append(f"{mp}: {label} member {member!r} is a "
                                       f"symlink/submodule (mode {gmode}) — fixture "
                                       "evidence is blobs, not pointers")
                            continue
                        try:
                            # bytes: git's stderr echoes the raw pathname on a
                            # miss, and text-mode decoding of a legal
                            # non-UTF-8 name crashes before any verdict
                            typ = subprocess.run(["git", "-C", str(repo_root),
                                                  "cat-file", "-t",
                                                  f"HEAD:{member}"],
                                                 capture_output=True,
                                                 timeout=10)
                        except subprocess.TimeoutExpired:
                            out.append(f"{mp}: cat-file for {member!r} TIMED OUT")
                            continue
                        typ_out = typ.stdout.strip().decode("ascii", "replace")
                        if dirty_waived:
                            # the waiver skips only the worktree==HEAD-blob
                            # comparison below; object-type authentication
                            # stays live — a stage mode claiming file over a
                            # HEAD tree object is a forgery on any route
                            if typ.returncode == 0 and typ_out != "blob":
                                out.append(f"{mp}: {label} member {member!r} is "
                                           f"{typ_out!r} at HEAD, not "
                                           "a blob — the dirty waiver does not "
                                           "waive object-type authentication")
                            continue
                        if typ.returncode != 0 or typ_out != "blob":
                            out.append(f"{mp}: {label} member {member!r} is "
                                       f"{typ_out or 'unresolvable'} at "
                                       "HEAD, not a blob — a stage mode that says "
                                       "file over a tree object is a forged entry")
                            continue
                        try:
                            show = subprocess.run(["git", "-C", str(repo_root),
                                                   "show", f"HEAD:{member}"],
                                                  capture_output=True, timeout=15)
                        except subprocess.TimeoutExpired:
                            out.append(f"{mp}: git show for {member!r} TIMED OUT")
                            continue
                        try:
                            wt = (repo_root / member).read_bytes()
                        except Exception:  # noqa: BLE001
                            wt = None
                        if show.returncode != 0 or wt is None or show.stdout != wt:
                            out.append(f"{mp}: {label} member {member!r} worktree "
                                       "bytes do not equal the pinned blob — a "
                                       "skip-worktree/assume-unchanged fixture is "
                                       "unpinned evidence the self-check will read")
        cq_rel = get(md, "cq_suite.path")
        cq_bytes = pinned_read(cq_rel, mp) if cq_rel else None
        if cq_bytes is not None:
            try:
                loaded = yload(cq_bytes)
                entries = loaded if isinstance(loaded, list) else None
                if entries is None and isinstance(loaded, dict):
                    for k in ("cqs", "competency_questions", "questions"):
                        if isinstance(loaded.get(k), list):
                            entries = loaded[k]
                if entries is None:
                    out.append(f"{mp}: CQ file shape unrecognized — fails closed")
                else:
                    if len(entries) != get(md, "cq_suite.cq_count"):
                        out.append(f"{mp}: cq_count mismatch ({len(entries)} in file)")
                    cq_ids, excluded = set(), set()
                    for e in entries:
                        if isinstance(e, dict):
                            cid = e.get("id")
                            if not isinstance(cid, str) or not re.match(r"^CQ-[\w-]+$", cid):
                                out.append(f"{mp}: CQ entry with malformed/missing id "
                                           f"{cid!r} — a null id stringifies into a "
                                           "citable ghost")
                                continue
                            if cid in cq_ids:
                                out.append(f"{mp}: duplicate CQ id {cid!r}")
                            cq_ids.add(cid)
                            pr = str(e.get("priority") or "")
                            if pr and pr not in ("must_have", "should_have"):
                                excluded.add(cid)  # unknown priorities fail CLOSED
                        elif isinstance(e, str) and re.match(r"^CQ-[\w-]+$", e):
                            cq_ids.add(e)
                        else:
                            out.append(f"{mp}: CQ entry {e!r} is not a CQ")
                    for p, d in otps:
                        for c in aslist(get(d, "operational_warrant.competency_questions")):
                            c = str(c)
                            if c not in cq_ids:
                                out.append(f"{p}: cited CQ {c!r} does not exist in {cq_rel}")
                            elif c in excluded:
                                out.append(f"{p}: cited CQ {c!r} has a non-Must/Should "
                                           "priority — admission is warranted by "
                                           "Must/Should CQs only (unknown values fail closed)")
                        for c in aslist(get(d, "definition.source")):
                            if str(c).startswith("CQ-") and str(c) not in cq_ids:
                                out.append(f"{p}: definition.source CQ {c!r} does not "
                                           "exist in the suite")
                    for rp, rd in reviews:
                        for e in aslist(rd.get("evidence")):
                            if str(e).startswith("CQ-") and str(e) not in cq_ids:
                                out.append(f"{rp}: evidence CQ {e!r} does not exist "
                                           "in the suite — a verdict cannot stand "
                                           "on a ghost warrant")
                    for dp, dd in dhs:
                        for c in aslist(dd.get("cq_warrants")):
                            if str(c) not in cq_ids:
                                out.append(f"{dp}: cq_warrants {c!r} does not exist "
                                           "in the suite")
            except Exception as ex:  # noqa: BLE001
                out.append(f"{mp}: cannot verify CQ suite ({ex})")
    return out


# --- scan + gate ------------------------------------------------------------

CHECKS = {"so": check_so, "po": check_po, "dh": check_dh, "ic": check_ic,
          "fa": check_fa, "otp": check_otp, "rat": check_rat, "rej": check_rej}

RECORD_DISPATCH = (("so-", "so"), ("po-", "po"), ("dh-", "dh"), ("ic-", "ic"),
                   ("fa-", "fa"), ("otp-", "otp"), ("rat-", "rat"),
                   ("rej-", "rej"))


def validate_dir(root, gate=False, repo=None):
    root = Path(root)
    if not root.is_dir():
        err(root, "scan root does not exist or is not a directory")
        return
    kinds = {k: [] for k in ("so", "po", "dh", "ic", "fa", "otp", "rat", "rej",
                             "review")}
    manifest, index = None, None
    ids_seen = {}
    for f in sorted(root.rglob("*.yaml")):
        name = f.name
        rel_parts = f.relative_to(root).parts
        if rel_parts[:1] == ("runs",) and name not in (
                "run-manifest.yaml", "dispositions.index.yaml"):
            # runs/ is the ROTATION LEDGER (archived orun-<rid>.manifest/
            # .index pairs + engine history), never live evidence. v13
            # silently absorbed record-prefixed files here into the live
            # scan, so a rotated predecessor's observations validated
            # against the successor's manifest. v14 makes that poison LOUD
            # and quarantines the file from every join; full per-run record
            # trees rotate to the SIBLING shelter ../archives/<root-name>/,
            # OUTSIDE the scan root — no in-root exemption exists to hide
            # live records in. Ledger bytes are not parsed here: the one
            # prior index this run stands on is byte- and row-validated at
            # its manifest join, and a shadow manifest/index under runs/
            # still falls through to the authoritative-location checks.
            if name.endswith(".review.yaml") or \
                    any(name.startswith(pfx) for pfx, _ in RECORD_DISPATCH):
                err(f, "record-prefixed file under runs/ — archived per-run "
                       "records are NOT live evidence; rotate them to the "
                       "sibling archive shelter (../archives/<root-name>/), "
                       "never leave them in the scan root")
            continue
        try:
            d = yload(f.read_text()) or {}
        except Exception as ex:  # noqa: BLE001
            err(f, f"unparseable: {ex}")
            continue
        if name == "run-manifest.yaml":
            if rel_parts != ("work", "run-manifest.yaml"):
                err(f, "run-manifest.yaml is only authoritative at "
                       "work/run-manifest.yaml — a manifest elsewhere is a shadow")
                continue
            if manifest is not None:
                err(f, f"SECOND run manifest (first: {manifest[0]}) — the "
                       "provenance record is a singleton, not a last-wins pile")
                continue
            if isinstance(d, dict):
                manifest = (f, d)
            check_manifest(d, f)
        elif name == "dispositions.index.yaml":
            if rel_parts != ("work", "dispositions.index.yaml"):
                err(f, "dispositions.index.yaml is only authoritative at "
                       "work/dispositions.index.yaml — an index elsewhere is a shadow")
                continue
            if index is not None:
                err(f, f"SECOND dispositions index (first: {index[0]})")
                continue
            index = (f, d)
        elif name.endswith(".review.yaml"):
            check_review(d, f)
            if isinstance(d, dict):
                m = REVIEW_NAME.match(name)
                if not m:
                    err(f, "review filename must be otp-<slug>-<nnn>[-rN].review.yaml "
                           "— free-named reviews make rounds and targets untrackable")
                else:
                    tgt = str(d.get("target") or "")
                    expected = "otp-" + "-".join(tgt.split(":")[1:]) if tgt.count(":") == 2 else ""
                    if expected and m.group(1).lower() != expected.lower():
                        err(f, f"review filename {m.group(1)!r} does not correspond to "
                               f"its target {tgt!r} (expected {expected!r}) — a review "
                               "filed under another proposal's name hides its history")
                kinds["review"].append((f, d))
        else:
            for prefix, key in RECORD_DISPATCH:
                if name.startswith(prefix):
                    CHECKS[key](d, f)
                    if not isinstance(d, dict):
                        break  # malformed: violation recorded; QUARANTINED from joins
                    if key == "rat" and rel_parts[:2] != ("governance", "ratifications"):
                        err(f, "ratification records are only authoritative under "
                               "governance/ratifications/ — an authority-shaped file "
                               "in a writable location is a forgery surface")
                        break
                    # QUARANTINE-BY-NORMALIZATION: every id/ref slot that can
                    # ever key a join table or a .get() lookup is forced to
                    # str-or-None at intake, AFTER the record check diagnosed
                    # its shape — downstream code can then never hash a
                    # malformed value, including code written later
                    for jk in ("id", "hypothesis_ref", "identity_card_ref",
                               "target", "proposal_ref"):
                        if jk in d and d.get(jk) is not None and \
                                type(d.get(jk)) is not str:
                            err(f, f"{jk} {d.get(jk)!r} is not a STRING — "
                                   "quarantined from every join")
                            d[jk] = None
                    for lk in ("observation_refs", "evidence"):
                        if isinstance(d.get(lk), list) and \
                                any(type(x) is not str for x in d.get(lk)):
                            err(f, f"{lk} carries non-STRING entries — "
                                   "quarantined from every join")
                            d[lk] = [x for x in d.get(lk) if type(x) is str]
                    kinds[key].append((f, d))
                    rid = d.get("id")
                    if rid is not None:
                        if (key, rid) in ids_seen:
                            err(f, f"duplicate id {rid!r} (also in {ids_seen[(key, rid)]})")
                        ids_seen[(key, rid)] = str(f)
                    break

    if manifest is not None:
        declared = get(manifest[1], "ontology.name")
        if isinstance(declared, str) and declared and declared != root.name:
            err(manifest[0], f"ontology.name {declared!r} does not match the "
                f"ontology root directory {root.name!r} — every documented path "
                "derives from this name; an unbound name unbinds them all")
    if manifest is None:
        if any(kinds.values()) or index is not None:
            err(root / "work/run-manifest.yaml",
                "records exist but work/run-manifest.yaml does not — an unpinned "
                "run has no provenance and every stage-boundary check is void")
        else:
            err(root, "scan found NO records and no manifest — an empty root must "
                      "never read as a green run (wrong path?)")

    def is_alt(p):
        return p.relative_to(root).parts[:2] == ("work", "alternative")

    primary = {k: [(p, d) for p, d in kinds[k] if not is_alt(p)]
               for k in ("otp", "ic", "fa", "dh")}
    alt = {k: [(p, d) for p, d in kinds[k] if is_alt(p)] for k in ("ic", "fa")}
    obs_ids = {d.get("id") for _, d in kinds["so"] + kinds["po"]
               if type(d.get("id")) is str}
    unrep_ids = {d.get("id") for _, d in kinds["so"]
                 if so_is_unrepresentable_only(d) and type(d.get("id")) is str}
    otp_records = {d.get("id"): (p, d) for p, d in primary["otp"]
                   if type(d.get("id")) is str}

    # ONE primary IC and ONE primary FA per hypothesis — a later-sorting shadow
    # record must never be able to supply the gate's ruling for a hypothesis
    # whose reviewed closure joins a different card.
    for kind_key, label in (("ic", "IdentityCard"), ("fa", "FoundationalAnalysis")):
        seen_hyp = {}
        for p, d in primary[kind_key]:
            h = d.get("hypothesis_ref")
            if h is not None and type(h) is not str:
                err(p, f"hypothesis_ref {h!r} is not a STRING — quarantined "
                       "from the seat join")
                continue
            if h in seen_hyp:
                err(p, f"second primary {label} for {h!r} (first: {seen_hyp[h]}) — "
                       "one analysis per hypothesis; a duplicate is a shadow-ruling "
                       "injection point")
            seen_hyp[h] = str(p)

    # every SourceObservation's extractor must be ONE of the manifest's pinned
    # adapters — an unpinned extractor tuple is an unpinned interpreter
    if manifest is not None:
        pinned = {(str(a.get("id")), str(a.get("version")), str(a.get("script")))
                  for a in aslist(manifest[1].get("adapters")) if isinstance(a, dict)}
        for p, d in kinds["so"]:
            tup = (str(get(d, "extractor.id")), str(get(d, "extractor.version")),
                   str(get(d, "extractor.script")))
            if pinned and tup not in pinned:
                err(p, f"extractor {tup} matches no adapter pinned in the manifest — "
                       "observations from an unrecorded extractor are unpinned evidence")

    errors.extend(cross_check_chain(primary["otp"], primary["dh"], primary["ic"],
                                    primary["fa"], obs_ids))
    if primary["otp"] or kinds["rat"] or index is not None:
        # once the run is proposing/ratifying OR closing its index, EVERY
        # observation must have entered denotation — an irrelevant disposition
        # is an analysis OUTCOME, not a way to skip the analysis (SKILL step 3)
        cited = set()
        for _, dh in primary["dh"]:
            cited.update(x for x in aslist(dh.get("observation_refs"))
                         if type(x) is str)
        for missing in sorted(str(o) for o in obs_ids - cited)[:5]:
            err(root, f"observation {missing} was never cited by any "
                      "DenotationHypothesis — the denotation stage is mandatory "
                      "for every observation; rejecting without hypothesizing is "
                      "the skipped-null-hypothesis hard blocker")
    binding_errs, otp_digests, failed_map = cross_check_review_binding(
        kinds["review"], otp_records)
    dh_by_id_all = {d.get("id"): d for _, d in primary["dh"]
                    if type(d.get("id")) is str}
    for rp, rd in kinds["review"]:
        tgt_rec = otp_records.get(str(rd.get("target")))
        tgt_dh = dh_by_id_all.get(skey(tgt_rec[1].get("hypothesis_ref"))) \
            if tgt_rec else None
        closure_ids = {x for x in aslist(tgt_dh.get("observation_refs"))
                       if type(x) is str} if tgt_dh else set()
        for e in aslist(rd.get("evidence")):
            e = str(e)
            if e.startswith(("so:", "po:")):
                if e not in obs_ids:
                    err(rp, f"evidence {e[:24]}… matches no scanned observation — "
                            "ghost evidence in ANY review manufactures history")
                elif closure_ids and e not in closure_ids:
                    err(rp, f"evidence {e[:24]}… is outside the target hypothesis's "
                            "observations")
    errors.extend(binding_errs)
    errors.extend(cross_check_support_graph(primary["otp"], kinds["rat"], otp_digests))
    errors.extend(cross_check_rats(kinds["rat"], primary["otp"], otp_digests))
    errors.extend(cross_check_rejections(
        kinds["rat"], kinds["rej"],
        otp_ids={str(d.get("id")) for _, d in kinds["otp"]}))

    # alternative-seat internal coherence: one joined pair per hypothesis
    alt_ic_by_hyp, alt_fa_by_hyp = {}, {}
    for p, d in alt["ic"]:
        h = d.get("hypothesis_ref")
        if h is not None and type(h) is not str:
            err(p, f"alternative hypothesis_ref {h!r} is not a STRING — "
                   "quarantined from the seat join")
            continue
        if h in alt_ic_by_hyp:
            err(p, f"second alternative IdentityCard for {h!r} — one pair per "
                   "hypothesis; ambiguous seats are no seat")
        alt_ic_by_hyp[h] = d
    for p, d in alt["fa"]:
        h = d.get("hypothesis_ref")
        if h is not None and type(h) is not str:
            err(p, f"alternative hypothesis_ref {h!r} is not a STRING — "
                   "quarantined from the seat join")
            continue
        if h in alt_fa_by_hyp:
            err(p, f"second alternative FoundationalAnalysis for {h!r}")
        alt_fa_by_hyp[h] = d
        ic = alt_ic_by_hyp.get(h)
        if ic is not None and d.get("identity_card_ref") != ic.get("id"):
            err(p, "alternative FA does not join its own seat's IdentityCard")

    prior_rows = None
    if manifest is not None and get(manifest[1], "prior_index"):
        lex_bad = lexical_symlink_violations(root, get(manifest[1], "prior_index"))
        for comp in lex_bad:
            err(manifest[0], f"prior_index component {comp!r} is a SYMLINK at its "
                "lexical path — an aliased predecessor (or an archive reached "
                "through an aliased directory) is not an archived one "
                "(resolve() must never run before this check)")
        # a lexically-condemned path is QUARANTINED: resolution/read never run
        # on it (a symlink loop would turn the detected violation into a crash)
        prior = None if lex_bad else safe_join(
            root, get(manifest[1], "prior_index"), manifest[0], "prior_index")
        if prior is not None:
            if prior.is_symlink():
                err(manifest[0], f"prior_index {prior} is a SYMLINK — an aliased "
                    "predecessor is not an archived one")
                prior = None
        if prior is not None:
            try:
                pdata = prior.read_bytes()
                want12 = str(get(manifest[1], "prior_index_sha256_12") or "")
                if want12 and sha12(pdata) != want12:
                    err(manifest[0], "prior_index bytes do not match "
                        "prior_index_sha256_12 — carried authority from a mutated "
                        "prior index is forged authority")
                prior_rows = yload(pdata)
                if not isinstance(prior_rows, list):
                    err(manifest[0], "prior_index root must be a LIST of rows")
                    prior_rows = []
                for m_ in check_prior_rows(prior_rows, manifest[0]):
                    err(manifest[0], m_)
            except Exception as ex:  # noqa: BLE001
                err(manifest[0], f"prior_index unreadable: {ex}")
                prior_rows = []
            new_ids = {r.get("observation") for r in
                       aslist(index[1] if index else [])
                       if isinstance(r, dict)
                       and type(r.get("observation")) is str}
            for r in prior_rows:
                if isinstance(r, dict) and r.get("outcome") == "unresolved" and \
                        type(r.get("observation")) is str and \
                        r.get("observation") not in new_ids:
                    err(manifest[0], f"prior unresolved observation "
                        f"{r.get('observation')} has NO row in this run's index")

    if obs_ids or index is not None:
        if index is None:
            # totality is a COMPLETION invariant: required once proposals exist
            # (and always at the gate); an observe/denote-stage validation of a
            # run with no proposals yet may legitimately have no index.
            if gate or primary["otp"]:
                err(root / "work/dispositions.index.yaml",
                    "dispositions.index.yaml missing")
        else:
            errors.extend(cross_check_index(index[1], index[0], obs_ids,
                                            primary["otp"], primary["dh"],
                                            unrep_ids, prior_rows))
    elif manifest is not None and \
            len(str(get(manifest[1], "empty_corpus_reason") or "").strip()) < 20:
        err(manifest[0], "run produced ZERO observations without a substantive "
            "empty_corpus_reason")

    if repo is not None:
        errors.extend(repo_fidelity(kinds["so"], kinds["po"], manifest,
                                    primary["otp"], kinds["review"],
                                    primary["dh"], Path(repo)))
    if gate:
        obs_paths = {d.get("id"): p for p, d in kinds["so"] + kinds["po"]
                     if type(d.get("id")) is str}
        run_gate(root, kinds, primary, alt_ic_by_hyp, alt_fa_by_hyp, index,
                 manifest, otp_digests, obs_paths, failed_map,
                 repo_supplied=repo is not None)


def norm_cat(v):
    return str(v or "").lower().split(":")[-1] or None


def run_gate(root, kinds, primary, alt_ic_by_hyp, alt_fa_by_hyp, index, manifest,
             otp_digests, obs_paths, failed_map, repo_supplied):
    if manifest is None:
        err(root, "GATE: no run-manifest.yaml in scan")
    if manifest and get(manifest[1], "repository.pin_waived") is True:
        flags.append(f"{root}: PIN WAIVED: "
                     f"{get(manifest[1], 'repository.waiver_reason')!r}"
                     + ("" if repo_supplied else " — fidelity NOT verified (no --repo)"))
    if manifest and get(manifest[1], "empty_corpus_reason"):
        flags.append(f"{root}: EMPTY CORPUS declared: "
                     f"{get(manifest[1], 'empty_corpus_reason')!r}")
    if not repo_supplied and not (manifest and
                                  get(manifest[1], "repository.pin_waived") is True):
        err(root, "GATE: --repo is required at submission (an explicit boolean "
                  "pin waiver with reason is the only exemption, and it is flagged)")
    current = latest_reviews(kinds["review"])
    # gate lookups follow the OTP's JOINED ids (identity_card_ref, and the FA
    # that joins that card) — never a by-hypothesis dict a shadow record could
    # win; uniqueness-per-hypothesis is separately enforced upstream.
    prim_ic_by_hyp = {d.get("hypothesis_ref"): d for _, d in primary["ic"]
                      if type(d.get("hypothesis_ref")) is str}
    ic_by_id = {d.get("id"): d for _, d in primary["ic"]
                if type(d.get("id")) is str}
    ic_paths = {d.get("id"): p for p, d in primary["ic"]
                if type(d.get("id")) is str}
    dh_paths = {d.get("id"): p for p, d in primary["dh"]
                if type(d.get("id")) is str}
    fa_by_icr = {d.get("identity_card_ref"): d for _, d in primary["fa"]
                 if type(d.get("identity_card_ref")) is str}
    fa_paths_by_icr = {d.get("identity_card_ref"): p for p, d in primary["fa"]
                       if type(d.get("identity_card_ref")) is str}
    verdicts = []
    for p, d in primary["otp"]:
        oid, hyp = str(d.get("id")), d.get("hypothesis_ref")
        rev = current.get(oid)
        if rev is None:
            err(p, "GATE: no adversary review disposition targets this proposal")
        else:
            if rev[1].get("target_sha256") != otp_digests.get(oid):
                err(p, f"GATE: latest review {rev[0]} is bound to DIFFERENT proposal "
                       "bytes — re-review")
            chain_files = [p]
            for x in (ic_paths.get(skey(d.get("identity_card_ref"))),
                      dh_paths.get(skey(hyp)),
                      fa_paths_by_icr.get(skey(d.get("identity_card_ref")))):
                if x:
                    chain_files.append(x)
            dh_rec = next((dd for _, dd in primary["dh"] if dd.get("id") == hyp), {})
            for ref in aslist(dh_rec.get("observation_refs")):
                op = obs_paths.get(skey(ref))
                if op:
                    chain_files.append(op)
            h = hashlib.sha256()
            for cf in sorted(chain_files, key=lambda x: Path(x).name):
                try:
                    data = Path(cf).read_bytes()
                    # FRAMED: filename + length prefix each member — raw
                    # concatenation lets bytes migrate across file boundaries
                    # without changing the digest
                    h.update(f"{Path(cf).name}\n{len(data)}\n".encode())
                    h.update(data)
                except Exception as ex:  # noqa: BLE001
                    err(p, f"GATE: closure member {Path(cf).name!r} cannot be "
                           f"read ({ex}) — a review digest over a TRUNCATED "
                           "closure binds nothing; submission refused")
            # the warrant's ground closes the closure: the CQ suite digest is a
            # virtual member — a PASS must not survive its warrant changing
            h.update(f"cq:{get(manifest[1], 'cq_suite.sha256_12') if manifest else ''}\n".encode())
            if rev[1].get("chain_sha256") != h.hexdigest():
                err(p, f"GATE: latest review {rev[0]} chain_sha256 does not match "
                       "the current FULL closure (OTP+IC+FA+DH + every cited SO/PO "
                       "record + the CQ-suite digest) — something the review stands "
                       "on changed after review; re-review the revised closure")
            verdicts.append(rev[1].get("verdict"))
            if rev[1].get("verdict") == "FAIL":
                err(p, f"GATE: BLOCKED by {rev[0]} (FAIL)")
            else:
                unlogged = failed_map.get("prior", {}).get(oid, set())
                logged = {}
                for e in aslist(d.get("revision_log")):
                    if isinstance(e, dict):
                        # union across entries sharing a digest (see binding)
                        logged.setdefault(str(e.get("from_sha256")),
                                          set()).update(
                            str(a) for a in aslist(e.get("addressed"))
                            if isinstance(a, str))
                for fd in unlogged:
                    if fd not in logged:
                        err(p, f"GATE: a FAIL was judged at digest {fd[:12]}… and "
                               "the proposal's revision_log does not cover it — a "
                               "FAIL is retired only by changed bytes WITH "
                               "revision_log coverage; an abstention or byte tweak "
                               "alone does not retire it")
                    else:
                        unanswered = failed_map.get("rules", {}).get(
                            (oid, fd), set()) - logged[fd]
                        if unanswered:
                            err(p, f"GATE: revision_log for failed digest "
                                   f"{fd[:12]}… does not address the landed attack "
                                   f"rule(s) {sorted(unanswered)} — naming the "
                                   "digest while answering none of its attacks is "
                                   "a guestbook signature, whatever the verdict "
                                   "that follows")
                if rev[1].get("verdict") == "INDETERMINATE":
                    flags.append(f"{p}: submits FLAGGED (INDETERMINATE): "
                                 f"{rev[1].get('needed_evidence')}")
            if aslist(d.get("parents")) and \
                    get(rev[1], "surfaces.taxonomy") != "attacked":
                err(p, "GATE: the proposal asserts parent edges but the review left "
                       "taxonomy unattacked — no_surface is a lie when parents exist")
            if rev[1].get("rival_models_still_viable"):
                flags.append(f"{p}: DISPUTED — the review lists still-viable rivals")
        dh_rec_cite = next((dd for _, dd in primary["dh"] if dd.get("id") == hyp), {})
        closure_ids = {x for x in aslist(dh_rec_cite.get("observation_refs"))
                       if type(x) is str}
        if rev is not None:
            for e in aslist(rev[1].get("evidence")):
                e = str(e)
                if e.startswith(("so:", "po:")) and e not in closure_ids:
                    err(p, f"GATE: review evidence {e[:24]}… is not among the "
                           "target hypothesis's observations — evidence outside "
                           "the reviewed closure is unbound by its digest and "
                           "cannot ground this verdict")
        for s in aslist(get(d, "definition.source")):
            s = str(s)
            if s.startswith(("so:", "po:")) and s not in closure_ids:
                err(p, f"GATE: definition.source {s[:24]}… is not among the "
                       "proposal's own hypothesis observations")
            elif not s.startswith(("so:", "po:", "CQ-")):
                err(p, f"GATE: definition.source entry {s!r} is not an "
                       "observation/CQ id")
        if hyp not in alt_ic_by_hyp or hyp not in alt_fa_by_hyp:
            err(p, "GATE: blinded alternative seat must cover this hypothesis with "
                   "BOTH an ic- and an fa- record")
        else:
            if fa_ran_no_tests(alt_fa_by_hyp[hyp]):
                err(p, "GATE: the alternative seat's analysis ran NO tests (all "
                       "unresolved) — a vacuous second opinion is no coverage")
            ca = norm_cat(get(alt_ic_by_hyp.get(hyp, {}), "ufo_analysis.candidate_category"))
            cb = norm_cat(get(prim_ic_by_hyp.get(skey(hyp)) or {},
                              "ufo_analysis.candidate_category"))
            if ca and cb and ca != cb:
                flags.append(f"{p}: DISPUTED — alternative seat says {ca!r}, primary "
                             f"says {cb!r}; steward chooses")
        ic = ic_by_id.get(d.get("identity_card_ref")) or {}
        ic_cat = norm_cat(get(ic, "ufo_analysis.candidate_category"))
        otp_cat = norm_cat(get(d, "foundational.ufo_category"))
        if otp_cat and ic_cat and otp_cat != ic_cat:
            err(p, f"GATE: the proposal claims category {otp_cat!r} but its identity "
                   f"card rules {ic_cat!r} — a proposal may not out-claim its analysis")
        for field, ic_key in (("rigidity", "ontoclean.rigidity"),
                              ("dependence", "ontoclean.dependence")):
            ov, iv = get(d, f"ontoclean.{field}"), get(ic, ic_key)
            if ov and iv and str(ov) != str(iv):
                err(p, f"GATE: the proposal's ontoclean.{field} {ov!r} contradicts "
                       f"its identity card's {iv!r} — the proposal DERIVES these "
                       "fields from its analysis; it may not re-decide them")
        oid_claim = get(d, "ontoclean.identity")
        supplies = get(ic, "identity.supplies_identity")
        carries = get(ic, "ontoclean.carries_identity")
        want = identity_expectation(supplies, carries)
        if want is not None and oid_claim in ("supplies", "carries", "none",
                                              "unresolved") and \
                oid_claim != want:
            err(p, f"GATE: the identity card rules {want!r} but the proposal's "
                   f"ontoclean.identity claims {oid_claim!r} — the proposal derives "
                   "this field; it may not re-decide it")
        cat = otp_cat or ic_cat
        rig = get(ic, "ontoclean.rigidity")
        if cat in ("kind", "subkind"):
            if rig != "rigid":
                err(p, f"GATE: OntoClean BLOCK — {cat} requires rigidity: rigid "
                       f"(got {rig!r})")
            if cat == "kind" and not (get(ic, "identity.supplies_identity") is True and
                                      get(ic, "ontoclean.supplies_identity") is True):
                err(p, "GATE: OntoClean BLOCK — a kind must SUPPLY identity, and "
                       "BOTH provider fields must say so")
            if cat == "subkind" and get(ic, "ontoclean.carries_identity") is not True:
                err(p, "GATE: OntoClean BLOCK — a subkind must CARRY (inherit) "
                       "identity; it need not supply it")
        elif cat == "role":
            if get(ic, "ontoclean.dependence") != "relational":
                err(p, "GATE: OntoClean BLOCK — a role is relationally dependent by "
                       "definition; dependence must be relational")
            if rig != "anti_rigid":
                err(p, "GATE: OntoClean BLOCK — a role is anti-rigid by definition "
                       "(a rigid role is a kind wearing a costume)")
        elif cat == "phase" and rig != "anti_rigid":
            err(p, "GATE: OntoClean BLOCK — a phase is anti-rigid by definition")
        if d.get("foundational_status") == "explicitly_deferred":
            fa = fa_by_icr.get(skey(d.get("identity_card_ref"))) or {}
            flags.append(f"{p}: submits FLAGGED (explicitly_deferred): "
                         f"{fa.get('needed_evidence', 'needed_evidence MISSING')}")
    n_indet = verdicts.count("INDETERMINATE")
    if n_indet >= 2 and n_indet / len(verdicts) >= 0.5:
        err(root, f"GATE: {n_indet}/{len(verdicts)} verdicts are INDETERMINATE — "
                  "verdict-flooding (two or more abstentions covering half the "
                  "proposals is a disengaged adversary; a SINGLE substantive "
                  "abstention always submits FLAGGED as documented)")
    if index is not None and isinstance(index[1], list):
        rows = [r for r in index[1] if isinstance(r, dict)
                and not (type(r.get("carried_from_prior")) is bool
                         and r.get("carried_from_prior"))]
        nonirr = [r for r in rows if r.get("outcome") != "irrelevant"]
        unres = [r for r in nonirr if r.get("outcome") == "unresolved"]
        if nonirr:
            frac = len(unres) / len(nonirr)
            print(f"GATE: unresolved fraction {len(unres)}/{len(nonirr)} = {frac:.0%} "
                  "(carried rows excluded from arithmetic)")
            w = get(manifest[1], "unresolved_fraction_waiver") if manifest else None
            if frac > 0.5:
                if w:
                    flags.append(f"{index[0]}: unresolved {frac:.0%} WAIVED: {w!r}")
                else:
                    err(index[0], f"GATE: {frac:.0%} of non-irrelevant observations "
                        "are unresolved — a parked run")
            elif w:
                # a pre-planted waiver the meter never invoked is still an
                # authority assertion the steward must see — dormant is not
                # invisible
                flags.append(f"{index[0]}: unresolved_fraction_waiver DECLARED "
                             f"but not invoked (fraction {frac:.0%}): "
                             f"{safe_text(str(w))!r}")
    if kinds["rat"]:
        print("GATE: RATIFICATION SUMMARY (verify each is the steward's own words):")
        for p, d in kinds["rat"]:
            print(f"  {safe_text(str(d.get('proposal_ref')))}: "
                  f"{safe_text(str(d.get('decision')))} by "
                  f"{safe_text(str(get(d, 'steward.id')))} — "
                  f"\"{safe_text(str(d.get('verbatim_decision')))}\"")


# --- self-test --------------------------------------------------------------

def expect_err(label, fn, *args):
    n = len(errors)
    fn(*args)
    assert len(errors) > n, f"{label}: rule failed to fire"
    del errors[n:]


def expect_out(label, needle, out):
    assert any(needle in m for m in out), f"{label}: rule failed to fire"


def expect_silent(label, out):
    assert not out, f"{label}: unexpected errors {out[:2]}"


def self_test():
    import copy
    so = {"id": "", "schema_version": 1,
          "repository": {"commit": "c1", "path": "src/a.ts"},
          "source_span": {"start_line": 1, "end_line": 2, "content_sha256": "d" * 64},
          "extractor": {"id": "e", "version": "1", "script": "s", "parser": "ts"},
          "symbol": {"lexical_name": "A", "qualified_name": "src.A",
                      "syntactic_kind": "class"},
          "observed_facts": [{"predicate": "extends_syntactically", "object": "P"}],
          "epistemic_status": "parser_derived"}
    so["id"] = canonical_obs_id("so", so)
    check_so(copy.deepcopy(so), "self:good_so")
    assert not errors, f"good_so should pass: {errors}"
    b = copy.deepcopy(so)
    b["id"] = "so:sha256:" + "a" * 64
    expect_err("canonical SO id", check_so, b, "self:handtyped_id_so")
    b = copy.deepcopy(so)
    b["symbol"]["ontology_interpretation"] = "ufo:Kind"
    expect_err("nested unknown key", check_so, b, "self:nested_so")
    b = copy.deepcopy(so)
    b["observed_facts"][0]["object"] = "Requester/role of Person"
    b["id"] = canonical_obs_id("so", b)
    expect_err("object prose smuggle", check_so, b, "self:prose_so")
    b = copy.deepcopy(so)
    b["observed_facts"] = [{"predicate": "unrepresentable_construct", "object": "RoleMixin"},
                            {"predicate": "declares_field", "object": "id"}]
    b["id"] = canonical_obs_id("so", b)
    expect_err("mixed unrepresentable", check_so, b, "self:mixed_so")

    good_dh = {"id": "dh:x:001", "observation_refs": [so["id"]],
               "proposed_referent": {"label": "x"}, "representation_status": "domain_referent",
               "null_hypothesis": {"label": "n", "rejected": True, "rationale": "r",
                                    "discriminator": "the lease lifecycle transitions in "
                                                     "state machine code no serialization "
                                                     "record could drive"},
               "confidence": {"value": 0.5, "use_for_acceptance": False}}
    check_dh(copy.deepcopy(good_dh), "self:good_dh")
    assert not errors, f"good_dh should pass: {errors}"
    b = copy.deepcopy(good_dh)
    b["null_hypothesis"]["discriminator"] = "it is a named type with an id field padded"
    expect_err("discriminator denylist", check_dh, b, "self:denylist_dh")

    good_otp = {"id": "otp:Lease:001", "hypothesis_ref": "dh:x:001",
                "identity_card_ref": "ic:x:001", "foundational_status": "analyzed",
                "ontoclean": {"rigidity": "rigid", "identity": "supplies",
                               "dependence": "none"},
                "term": {"local_name": "Lease", "preferred_label": "lease",
                          "proposed_iri": "https://ex.test/Lease",
                          "owl_entity_kind": "class"},
                "definition": {"text": "d"},
                "foundational": {"ufo_category": "relator"},
                "reuse": {"searched": True, "exact_reuse_found": False},
                "operational_warrant": {"competency_questions": ["CQ-001"]},
                "status": "proposed"}
    check_otp(copy.deepcopy(good_otp), "self:good_otp")
    assert not errors, f"good_otp should pass: {errors}"
    b = copy.deepcopy(good_otp)
    del b["foundational"]
    expect_err("ufo_category required", check_otp, b, "self:nocat_otp")
    b = copy.deepcopy(good_otp)
    b["revision_log"] = [{"from_sha256": "a" * 64, "addressed": "x"}]
    expect_err("addressed must be a list", check_otp, b, "self:scalar_addressed")
    b = copy.deepcopy(good_otp)
    b["reuse"]["searched"] = False
    expect_err("searched must be true", check_otp, b, "self:unsearched_otp")
    b = copy.deepcopy(good_otp)
    b["operational_warrant"]["semantic_support_for"] = ["otp:Other:001"]
    expect_err("warrant XOR", check_otp, b, "self:dualrole_otp")
    b = copy.deepcopy(good_otp)
    b["parents"] = [{"parent": "Person as rigid kind", "justification": "x" * 25}]
    expect_err("parents prose", check_otp, b, "self:parents_otp")
    b = copy.deepcopy(good_otp)
    b["id"] = "not-an-otp"
    expect_err("otp id grammar", check_otp, b, "self:badid_otp")
    expect_err("malformed OTP no crash", check_otp, [], "self:list_otp")

    rat = {"id": "rat:001", "proposal_ref": "otp:Lease:001",
           "proposal_sha256": "f" * 64, "decision": "accept",
           "steward": {"id": "steward-1", "name": "A Steward"},
           "decided_at": "2026-08-27",
           "verbatim_decision": "I accept the Lease proposal."}
    check_rat(copy.deepcopy(rat), "self:good_rat")
    assert not errors, f"good_rat should pass: {errors}"
    b = copy.deepcopy(rat)
    del b["proposal_sha256"]
    expect_err("rat content binding", check_rat, b, "self:unbound_rat")
    out = cross_check_rats([("self:r1", rat)], [("self:otp", good_otp)],
                           {"otp:Lease:001": "0" * 64})
    expect_out("stale rat", "STALE ratification", out)
    out = cross_check_rats([("self:r1", rat)], [("self:otp", good_otp)],
                           {"otp:Lease:001": "f" * 64})
    expect_silent("fresh rat passes", out)

    rev = {"target": "otp:Lease:001", "target_sha256": "e" * 64,
           "chain_sha256": "c" * 64, "seat": "ontoclean-adversary", "verdict": "PASS",
           "surfaces": {"taxonomy": "no_surface", "identity": "attacked",
                        "warrant": "attacked", "null_discriminator": "attacked"},
           "no_surface_reasons": {"taxonomy": "proposal asserts no is-a edge"},
           "evidence": ["so:sha256:" + "a" * 64, "CQ-001"],
           "attacks": [{"surface": "identity", "rule": "identity-conflict",
                        "counterexample": "two renewals wrongly identified",
                        "outcome": "survived"},
                        {"surface": "warrant", "rule": "listing-cq-warrant",
                         "counterexample": "CQ answerable without the term",
                         "outcome": "survived"},
                        {"surface": "null_discriminator", "rule": "discriminator-true-of-dto",
                         "counterexample": "a DTO twin makes the fact true anyway",
                         "outcome": "survived"}]}
    check_review(copy.deepcopy(rev), "self:good_review")
    assert not errors, f"good review should pass: {errors}"
    b = copy.deepcopy(rev)
    b["target"] = "edge: Child -> Parent"
    expect_err("edge target rejected", check_review, b, "self:edge_review")
    b = copy.deepcopy(rev)
    del b["chain_sha256"]
    expect_err("chain binding required", check_review, b, "self:nochain_review")

    P = Path
    revs = [(P("w/otp-x-001.review.yaml"),
             {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "FAIL"}),
            (P("w/otp-x-001-r2.review.yaml"),
             {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "INDETERMINATE"}),
            (P("w/otp-x-001-r3.review.yaml"),
             {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "PASS"})]
    out, _, _ = cross_check_review_binding(revs, {})
    expect_out("FAIL revived through INDETERMINATE", "SAME proposal bytes", out)
    revs[2] = (P("w/otp-x-001-r3.review.yaml"),
               {"target": "otp:x:001", "target_sha256": "b" * 64, "verdict": "PASS"})
    out, _, _ = cross_check_review_binding(revs, {})
    expect_out("PASS after FAIL needs revision_log", "revision_log", out)
    out, _, _ = cross_check_review_binding(
        [(P("w/otp-x-001-r2.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "PASS"})], {})
    expect_out("round continuity", "non-contiguous", out)

    ic_other = {"id": "ic:x:001", "hypothesis_ref": "dh:OTHER:001"}
    out = cross_check_chain([("self:otp", good_otp)], [("self:dh", good_dh)],
                            [("self:ic", ic_other)], [], {so["id"]})
    expect_out("IC cross-wire", "not this proposal's", out)
    fa_def = {"id": "fa:x:001", "hypothesis_ref": "dh:x:001",
              "identity_card_ref": "ic:x:001", "verdict": "explicitly_deferred"}
    ic_ok = {"id": "ic:x:001", "hypothesis_ref": "dh:x:001"}
    out = cross_check_chain([("self:otp", good_otp)], [("self:dh", good_dh)],
                            [("self:ic", ic_ok)], [("self:fa", fa_def)], {so["id"]})
    expect_out("FA verdict join", "contradicts the analysis verdict", out)

    out = cross_check_index(
        [{"observation": "so:sha256:" + "9" * 64, "outcome": "proposed",
          "ref": "otp:Lease:001", "carried_from_prior": True}],
        "self:idx", set(), [("self:otp", good_otp)], [("self:dh", good_dh)], set(),
        prior_rows=[])
    expect_out("fake carried row", "NOT in the prior index", out)
    expect_out("carried cannot be proposed", "cannot be 'proposed'", out)
    out = cross_check_index(
        [{"observation": "so:sha256:" + "8" * 64, "outcome": "proposed",
          "ref": "otp:Lease:001"}],
        "self:idx", {"so:sha256:" + "8" * 64}, [("self:otp", good_otp)],
        [("self:dh", good_dh)], set())
    expect_out("row-evidence join", "does not cite this observation", out)
    out = cross_check_index(
        [{"observation": so["id"], "outcome": "unresolved",
          "needed_evidence": "consult the registrar SME", "since": "2020-01-01 junk"}],
        "self:idx", {so["id"]}, [], [], set())
    expect_out("since exact ISO", "EXACTLY YYYY-MM-DD", out)

    out = cross_check_support_graph(
        [("self:a", {"id": "otp:a:001", "operational_warrant":
                     {"semantic_support_for": ["https://ex.test/X"]}})], [], {})
    expect_out("IRI needs digest-fresh accept", "DIGEST-FRESH", out)

    ic_full = {"id": "ic:x:001", "hypothesis_ref": "dh:x:001",
               "identity": {"supplies_identity": True,
                            "identity_criterion": "the identifier assigned by the "
                                                  "registrar enrollment office system"},
               "ontoclean": {"rigidity": "rigid", "carries_identity": True,
                              "supplies_identity": True, "unity": "", "dependence": "none"},
               "ufo_analysis": {"candidate_category": "kind"},
               "temporality": {"exists_during_interval": True,
                                "may_change_state_without_losing_identity": True},
               "counterexamples": [{"description": "a guest auditor enrolled without "
                                                    "registration tests the criterion"}],
               "status": "proposed"}
    expect_err("identifier pad fires at any length", check_ic, ic_full, "self:pad_ic")
    b = copy.deepcopy(ic_full)
    b["identity"]["identity_criterion"] = ("sameness is the enrollment relationship "
                                            "itself; the registrar number is evidence, "
                                            "never the criterion")
    b["identity"]["supplies_identity"] = True
    check_ic(b, "self:negation_ic")
    assert not errors, f"negation-context criterion should pass: {errors}"
    b = copy.deepcopy(b)
    b["ontoclean"]["supplies_identity"] = False
    expect_err("provider fields agree", check_ic, b, "self:disagree_ic")

    man = {"run_id": "r", "repository": {"commit": "c", "pin_waived": "no"},
           "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
           "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
           "adapters": [{"id": "a", "script": "s", "script_sha256_12": "d", "golden_fixture": "g"}],
           "agents": {}, "first_run": True}
    expect_err("pin_waived must be boolean", check_manifest, man, "self:strwaive_man")

    # v5: binding-seam rules
    assert not occurs("id", "class S { #id: string }"), "#id boundary failed"
    assert occurs("id", "class S { id: string }"), "plain id must occur"
    assert not config_pair_occurs("mode", "safe",
                                  '"mode": "strict",\n"level": "safe"'), \
        "config pair must reject cross-key pairing"
    assert config_pair_occurs("mode", "safe", '"mode": "safe"'), \
        "config pair must accept the real pairing"
    b = copy.deepcopy(ic_full)
    b["identity"]["identity_criterion"] = ("sameness is the enrollment relationship "
                                            "itself, never the number")
    b["ontoclean"]["supplies_identity"] = "unresolved"
    expect_err("provider boolean-vs-unresolved", check_ic, b, "self:mixed_provider")
    out = cross_check_index(
        [{"observation": so["id"], "outcome": "unresolved",
          "needed_evidence": "consult the registrar SME", "since": "2020-01-01",
          "carried_from_prior": True}],
        "self:idx", {so["id"]}, [], [], set(),
        prior_rows=[{"observation": so["id"], "outcome": "unresolved",
                     "needed_evidence": "old evidence text here"}])
    expect_out("carried on a LIVE observation", "denominator bypass", out)
    assert fa_ran_no_tests({"tests": {"spec_vs_execution": "unresolved",
                                       "world_vs_information": "unresolved",
                                       "role_vs_bearer": "unresolved",
                                       "context_reification_needed": False}}), \
        "boolean must not defeat the vacuity predicate"
    out, _, _ = cross_check_review_binding(
        [(P("w/otp-x-001.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "FAIL",
           "attacks": [{"surface": "warrant", "rule": "listing-cq-warrant",
                        "outcome": "landed"}]}),
         (P("w/otp-x-001-r2.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "b" * 64, "verdict": "PASS"})],
        {"otp:x:001": (P("nonexistent"),
                       {"revision_log": [{"from_sha256": "a" * 64,
                                          "addressed": ["some-other-rule"]}]})})
    expect_out("addressed joined to landed rules", "does not address", out)
    out, _, _ = cross_check_review_binding(
        [(P("w/aaa.review.yaml"), {"target": "otp:x:001", "target_sha256": "a" * 64,
                                    "verdict": "FAIL"}),
         (P("w/zzz.review.yaml"), {"target": "otp:x:001", "target_sha256": "b" * 64,
                                    "verdict": "PASS"})], {})
    expect_out("duplicate round", "SECOND review at round", out)
    b = copy.deepcopy(rat)
    b["id"] = "rat:banana"
    expect_err("rat id grammar", check_rat, b, "self:banana_rat")
    b = copy.deepcopy(rat)
    b["id"] = "rat:1\n"
    expect_err("rat id trailing newline", check_rat, b, "self:newline_rat")
    b = copy.deepcopy(rat)
    b["decided_at"] = "definitely-not-a-timestamp"
    expect_err("decided_at ISO8601", check_rat, b, "self:badtime_rat")
    b = copy.deepcopy(rat)
    b["decided_at"] = "2026-99-99T25:61:61+00:00"
    expect_err("decided_at real calendar", check_rat, b, "self:impossible_rat")
    b = copy.deepcopy(rat)
    b["steward"] = {"id": 7}
    expect_err("steward typed + named", check_rat, b, "self:numsteward_rat")
    out, _, _ = cross_check_review_binding(
        [(P("w/otp-x-001.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "FAIL",
           "attacks": [{"surface": "warrant", "rule": "r1", "outcome": "landed"}]}),
         (P("w/otp-x-001-r2.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64,
           "verdict": "INDETERMINATE"})], {})
    expect_out("FAIL is sticky vs INDET", "abstention does not retire", out)
    out, _, _ = cross_check_review_binding(
        [(P("w/otp-x-001.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64,
           "verdict": "INDETERMINATE",
           "attacks": [{"surface": "identity", "rule": "identity-conflict",
                        "outcome": "landed"}]}),
         (P("w/otp-x-001-r2.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "PASS"})], {})
    expect_out("landed-INDET history", "SAME proposal bytes", out)
    b = copy.deepcopy(rev)
    b["evidence"] = ["so:not-an-id"]
    expect_err("evidence full-id form", check_review, b, "self:thin_ev_review")
    fa_sv = {"id": "fa:x:001", "hypothesis_ref": "dh:x:001",
             "identity_card_ref": "ic:x:001",
             "tests": {"spec_vs_execution": "separated",
                        "world_vs_information": "separated",
                        "role_vs_bearer": "separated",
                        "context_reification_needed": False},
             "verdict": "analyzed",
             "strongest_counterexample": "a serialization twin was tried and failed",
             "rival_models": [{"label": "role-model", "still_viable": "true"}]}
    expect_err("still_viable boolean type", check_fa, fa_sv, "self:strviable_fa")
    b = copy.deepcopy(good_otp)
    b["ontoclean"]["identity"] = "does not supply identity"
    expect_err("identity enum closed", check_otp, b, "self:prose_identity_otp")
    b = copy.deepcopy(good_otp)
    b["reuse"] = {"searched": True, "exact_reuse_found": "true"}
    expect_err("exact_reuse_found boolean", check_otp, b, "self:strreuse_otp")
    fa_int = {"id": "fa:x:001", "hypothesis_ref": "dh:x:001",
              "identity_card_ref": "ic:x:001",
              "tests": {"spec_vs_execution": "separated",
                         "world_vs_information": "separated",
                         "role_vs_bearer": "separated",
                         "context_reification_needed": False},
              "verdict": "analyzed",
              "strongest_counterexample": "a serialization twin was tried and failed",
              "rival_models": [{"label": "r", "still_viable": 0}]}
    expect_err("still_viable exact bool (int 0)", check_fa, fa_int, "self:intviable_fa")
    b = copy.deepcopy(rat)
    b["steward"]["name"] = 7
    expect_err("steward.name string", check_rat, b, "self:numname_rat")
    assert not config_pair_occurs("mode", "safe", '"mode": "safe;strict"'), \
        "value-prefix semicolon bleed"
    assert not config_pair_occurs("mode", "safe", "mode: safe strict"), \
        "unquoted value-prefix space bleed"
    assert not config_pair_occurs("mode", "safe", "database%mode: safe"), \
        "percent key bleed"
    assert config_pair_occurs("mode", "safe", 'mode: safe  '), \
        "honest trailing-space pairing"
    assert config_pair_occurs("mode", "safe", '<root mode="safe"/>', "a.xml"), \
        "honest xml attr pairing"
    assert not config_pair_occurs(
        "mode", "safe",
        strip_comments_config('level=strict ; mode=safe', "a.ini")), \
        "inline ini semicolon"
    assert not config_pair_occurs(
        "mode", "safe",
        strip_comments("<root mode=\"strict\"/>\n<!-- unclosed\nmode=\"safe\"", "a.xml")), \
        "unclosed xml comment"
    man3 = {"run_id": "orun-999", "repository": {"commit": "c"},
            "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
            "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
            "adapters": [], "agents": {}, "first_run": True}
    expect_err("run_id parses as ISO", check_manifest, man3, "self:orun999_man")
    man4 = {"run_id": "orun-2026-08-28", "repository": {"commit": "c", "dirty": 0},
            "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
            "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
            "adapters": [], "agents": {}, "first_run": True}
    expect_err("dirty exact bool (int 0)", check_manifest, man4, "self:intdirty_man")
    man5 = {"run_id": "orun-2026-08-28", "repository": {"commit": "c"},
            "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
            "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
            "adapters": [], "agents": {}, "first_run": True,
            "prior_index": "work/dispositions.index.yaml",
            "prior_index_sha256_12": "a" * 12}
    expect_err("prior self-reference / grammar", check_manifest, man5, "self:selfprior_man")
    b = copy.deepcopy(good_dh)
    b["cq_warrants"] = "CQ-001"
    expect_err("scalar cq_warrants", check_dh, b, "self:scalarcq_dh")
    b = copy.deepcopy(good_dh)
    b["confidence"]["value"] = True
    expect_err("confidence.value bool-as-num", check_dh, b, "self:boolconf_dh")
    ic_int = copy.deepcopy(ic_full)
    ic_int["identity"]["identity_criterion"] = ("sameness is the enrollment "
                                                 "relationship itself, never the number")
    ic_int["temporality"]["exists_during_interval"] = 1
    expect_err("tri-state int", check_ic, ic_int, "self:triint_ic")
    b = copy.deepcopy(so)
    b["observed_facts"] = [{"predicate": "declares_field", "object": 7}]
    b["id"] = canonical_obs_id("so", b)
    expect_err("integer fact object", check_so, b, "self:intobj_so")
    b = copy.deepcopy(so)
    b["schema_version"] = True
    expect_err("schema_version bool", check_so, b, "self:boolver_so")
    b = copy.deepcopy(good_otp)
    b["operational_warrant"] = {"semantic_support_for": "otp:Ghost:999"}
    expect_err("scalar support edge", check_otp, b, "self:scalarsup_otp")
    b = copy.deepcopy(good_otp)
    b["ontoclean"]["identity"] = "unresolved"
    check_otp(b, "self:unresolved_id_otp")
    assert not errors, f"unresolved identity should be legal at record level: {errors}"
    assert not config_pair_occurs(
        "mode", "safe",
        strip_comments_config("mode: safe;strict\n", "a.yaml")), \
        "yaml semicolon payload truncation"
    assert not config_pair_occurs(
        "mode", "safe",
        strip_comments_config("prefix/*c*/mode: safe\nmode: strict\n", "a.yaml")), \
        "stripper-created key boundary"
    assert not config_pair_occurs("mode", "safe", "mode: safe,strict"), \
        "comma is not an unquoted terminator"
    assert not config_pair_occurs("mode", "safe", "cmd: run(mode: safe)"), \
        "paren opener removed"
    assert not config_pair_occurs("mode", "safe", "mode: safe\n  extra\n"), \
        "multiline plain scalar prefix"
    assert not config_pair_occurs("mode", "safe", 'mode="safe"strict'), \
        "quoted value needs a post-quote terminator"
    assert config_pair_occurs("mode", "safe", 'mode: safe\nnext: x\n'), \
        "honest yaml with following key"
    assert config_pair_occurs("mode", "safe", '<root mode="safe"/>', "a.xml"), \
        "honest xml attr post-quote slash"
    assert config_pair_occurs("mode", "safe", '{"mode": "safe", "x": 1}'), \
        "honest json comma after quote"
    man2 = {"run_id": "not-orun", "repository": {"commit": "c"},
            "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
            "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
            "adapters": [], "agents": {}, "first_run": True}
    expect_err("run_id grammar", check_manifest, man2, "self:runid_man")
    b = copy.deepcopy(rev)
    b["verdict"] = "FAIL"
    for a in b["attacks"]:
        a["outcome"] = "survived"
    expect_err("FAIL with zero landed", check_review, b, "self:fail_nolanded")
    b = copy.deepcopy(rev)
    b["attacks"][0].pop("counterexample")
    expect_err("attack needs counterexample", check_review, b, "self:noce_review")
    b = copy.deepcopy(rev)
    b.pop("evidence")
    expect_err("review needs evidence", check_review, b, "self:noev_review")
    assert not config_pair_occurs("mode", "safe", "foo-mode: safe"), "hyphen key bleed"
    assert not config_pair_occurs("mode", "safe", "database.mode: safe"), "dotted key bleed"
    assert not config_pair_occurs("mode", "safe", '"mode": "safe-mode"'), "hyphen value bleed"
    assert not config_pair_occurs("mode", "", '"mode": "strict"'), "empty value fallback"
    out, _, _ = cross_check_review_binding(
        [(P("w/otp-x-001.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "FAIL",
           "attacks": [{"surface": "warrant", "rule": "rule-one", "outcome": "landed"}]}),
         (P("w/otp-x-001-r2.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "a" * 64, "verdict": "FAIL",
           "attacks": [{"surface": "identity", "rule": "rule-two", "outcome": "landed"}]}),
         (P("w/otp-x-001-r3.review.yaml"),
          {"target": "otp:x:001", "target_sha256": "b" * 64, "verdict": "PASS"})],
        {"otp:x:001": (P("nonexistent"),
                       {"revision_log": [{"from_sha256": "a" * 64,
                                          "addressed": ["rule-two"]}]})})
    expect_out("landed rules UNION across FAILs", "does not address", out)


    # --- round-10 families ---------------------------------------------------
    def expect_msg(label, needle, fn, d, path):
        n = len(errors)
        fn(d, path)
        assert any(needle in e for e in errors[n:]), \
            f"{label}: expected {needle!r} to fire, got {errors[n:][:3]}"
        del errors[n:]

    b = copy.deepcopy(so)
    b["repository"]["path"] = 123
    b["id"] = canonical_obs_id("so", b)
    expect_msg("SO numeric path", "repository.path must be a non-blank STRING",
               check_so, b, "self:intpath_so")
    po_num = {"id": "", "schema_version": 1,
              "repository": {"commit": "c1", "path": 123},
              "source_span": {"start_line": 1, "end_line": 2},
              "quote": "a substantive verbatim quotation body",
              "epistemic_status": "quoted_prose"}
    po_num["id"] = canonical_obs_id("po", po_num)
    expect_msg("PO numeric path", "repository.path must be a non-blank STRING",
               check_po, po_num, "self:intpath_po")
    man_ad = {"run_id": "orun-2026-08-29", "repository": {"commit": "c"},
              "ontology": {"name": "x"}, "scope_doc": {"path": "docs/scope.md"},
              "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
              "adapters": [{"id": 71, "version": 100, "script": 123,
                             "script_sha256_12": "a" * 12,
                             "golden_fixture": 123}],
              "agents": {}, "first_run": True}
    expect_msg("manifest numeric adapter fields",
               "adapters entry id must be a non-blank STRING",
               check_manifest, man_ad, "self:intadapter_man")
    b = copy.deepcopy(good_otp)
    b["term"]["local_name"] = 777
    expect_msg("OTP numeric local_name",
               "term.local_name must be a non-blank STRING",
               check_otp, b, "self:intlocal_otp")
    b = copy.deepcopy(good_dh)
    b["null_hypothesis"]["discriminator"] = 4111111111111111111111111111111111111111
    expect_msg("DH numeric discriminator", "discriminator must be a STRING",
               check_dh, b, "self:intdisc_dh")
    fa_ne = {"id": "fa:x:001", "hypothesis_ref": "dh:x:001",
             "identity_card_ref": "ic:x:001",
             "tests": {"spec_vs_execution": "separated",
                        "world_vs_information": "separated",
                        "role_vs_bearer": "separated",
                        "context_reification_needed": False},
             "verdict": "analyzed", "needed_evidence": 12345,
             "strongest_counterexample": "a serialization twin was tried and failed"}
    expect_msg("FA numeric needed_evidence", "needed_evidence must be a STRING",
               check_fa, fa_ne, "self:intne_fa")
    b = copy.deepcopy(rev)
    b["verdict"] = "INDETERMINATE"
    b["needed_evidence"] = 999999999999999
    expect_msg("review numeric needed_evidence",
               "needed_evidence must be a STRING",
               check_review, b, "self:intne_review")
    b = copy.deepcopy(rev)
    b["surfaces"] = dict(b["surfaces"], taxonomy="no_surface")
    b["no_surface_reasons"] = {"taxonomy": 1234567890123}
    expect_msg("review numeric no_surface reason", "concrete STRING",
               check_review, b, "self:intreason_review")
    b = copy.deepcopy(rat)
    b["verbatim_decision"] = 7777777777
    expect_msg("rat numeric verbatim",
               "verbatim_decision must be a non-blank STRING",
               check_rat, b, "self:intverb_rat")
    rej_num = {"id": "rej:1", "proposal_ref": "otp:Lease:001",
               "rationale": 123456789012345678901234567890}
    expect_msg("rej numeric rationale", "rationale must be a substantive STRING",
               check_rej, rej_num, "self:intrat_rej")
    out = cross_check_index(
        [{"observation": "so:sha256:" + "8" * 64, "outcome": "irrelevant",
          "reason": 123456789012345}],
        "self:idx", {"so:sha256:" + "8" * 64}, [], [], set())
    expect_out("index numeric reason", "reason must be a STRING", out)

    b = copy.deepcopy(good_otp)
    b["reuse"] = {"searched": True, "exact_reuse_found": False,
                  "mappings": "not-a-list"}
    expect_msg("reuse.mappings shape on false branch",
               "reuse.mappings must be a list", check_otp, b, "self:mapshape_otp")
    b = copy.deepcopy(good_otp)
    b["review"] = "complete"
    expect_msg("inline review block shape", "review must be a MAPPING",
               check_otp, b, "self:revshape_otp")

    revs10 = [(P("w/otp-x-001.review.yaml"),
               {"target": "otp:x:001", "target_sha256": "a" * 64,
                "verdict": "FAIL",
                "attacks": [{"surface": "identity", "rule": "anti-rigid-superclass",
                             "outcome": "landed"}]}),
              (P("w/otp-x-001-r2.review.yaml"),
               {"target": "otp:x:001", "target_sha256": "b" * 64,
                "verdict": "INDETERMINATE"})]
    _, _, fmap = cross_check_review_binding(revs10, {})
    assert fmap["prior"].get("otp:x:001") == {"a" * 64}, \
        "prior-FAIL coverage set must be populated for a governing INDET"
    assert fmap["rules"].get(("otp:x:001", "a" * 64)) == {"anti-rigid-superclass"}, \
        "landed rules must join the prior digest"
    del errors[:]
    _, _, fmap = cross_check_review_binding(
        [(P("w/otp-y-001.review.yaml"),
          {"target": "otp:y:001", "target_sha256": "c" * 64,
           "verdict": "INDETERMINATE"})], {})
    assert not fmap["prior"].get("otp:y:001"), \
        "a first-round landed INDET has no prior digests to cover"
    del errors[:]

    b = copy.deepcopy(ic_full)
    b["identity"]["supplies_identity"] = []
    n = len(errors)
    check_ic(b, "self:unhashable_ic")   # must produce violations, NEVER raise
    assert len(errors) > n, "unhashable tri-state must be a violation"
    del errors[n:]

    dup_raised = False
    try:
        yload("a: 1\na: 2\n")
    except Exception:
        dup_raised = True
    assert dup_raised, "duplicate YAML keys must refuse to load"
    assert yload("a: 1\nb: 2\n") == {"a": 1, "b": 2}, "clean YAML loads"

    assert not config_pair_occurs(
        "mode", "safe", strip_comments_config("mode: safe#prod\n", "a.yaml")), \
        "yaml hash payload must be retained (no ws before #)"
    assert config_pair_occurs(
        "mode", "safe", strip_comments_config("mode: safe # note\n", "a.yaml")), \
        "yaml whitespace-# comment strips"
    assert not config_pair_occurs(
        "mode", "safe", strip_comments_config("mode=safe;prod\n", "a.properties")), \
        "properties inline ; is payload"
    assert not config_pair_occurs(
        "mode", "safe", strip_comments_config("mode=safe!prod\n", "a.properties")), \
        "properties inline ! is payload"
    assert not config_pair_occurs(
        "mode", "safe", strip_comments_config("; mode=safe\nlevel=x\n", "a.ini")), \
        "ini line-start comment is a mention"
    for glued in ("prefix{mode: safe\nmode: strict\n", "x,mode: safe\nmode: strict\n",
                  "x\"mode: safe\nmode: strict\n", "x'mode: safe\nmode: strict\n"):
        assert not config_pair_occurs("mode", "safe", glued), \
            f"glued opener must not authenticate: {glued[:12]!r}"
    assert not config_pair_occurs("mode", "safe", "level=strict ; mode=safe\n"), \
        "mid-line bare key with unquoted value is payload"
    assert not config_pair_occurs("mode", "safe", "mode: safe\n\n  extra\n"), \
        "blank-line continuation"
    assert not config_pair_occurs("mode", "safe", "mode: safe\n \n  extra\n"), \
        "whitespace-blank-line continuation"
    assert config_pair_occurs("mode", "safe", "mode: safe\n\nnext: x\n"), \
        "honest blank line before a new key"

    assert identity_expectation("unresolved", True) == "unresolved"
    assert identity_expectation(True, "unresolved") == "unresolved"
    assert identity_expectation(True, False) == "supplies"
    assert identity_expectation(False, True) == "carries"
    assert identity_expectation(False, False) == "none"

    import tempfile
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "real").mkdir()
        (td / "real" / "x.yaml").write_text("[]")
        (td / "runs").symlink_to(td / "real")
        assert lexical_symlink_violations(td, "runs/x.yaml") == ["runs"], \
            "symlinked parent component must be rejected"
        assert lexical_symlink_violations(td, "real/x.yaml") == [], \
            "regular components pass"
    import contextlib, io
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "work").mkdir()
        man_p = td / "work/run-manifest.yaml"
        man_p.write_bytes(b"run_id: 'orun-2026-08-29T00:00:00Z'\r\nfirst_run: true\r\n")
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = print_run_id(td)
        assert rc == 0 and buf.getvalue().strip() == "orun-2026-08-29T00:00:00Z", \
            "print-run-id must parse CRLF + single quotes cleanly"
        man_p.write_bytes(b"run_id: orun-2026-08-29T00:00:00Z\nrun_id: orun-2027-01-01T00:00:00Z\n")
        with contextlib.redirect_stdout(io.StringIO()):
            rc = print_run_id(td)
        assert rc == 1, "duplicate run_id must refuse rotation"
        man_p.write_bytes(b"run_id: !!str orun-2026-08-29T00:00:00Z\n")
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = print_run_id(td)
        assert rc == 0 and buf.getvalue().strip() == "orun-2026-08-29T00:00:00Z", \
            "tagged !!str run_id must parse"


    # --- round-11 families ---------------------------------------------------
    assert valid_run_id("orun-2026-08-29T00:00:00Z")
    assert valid_run_id("orun-2026-08-29T00:00:00.5+02:00")
    assert not valid_run_id("orun-2026-08-29/00:00:00"), "slash separator"
    assert not valid_run_id("orun-2026-08-29 00:00:00"), "space separator"
    assert not valid_run_id("orun-2026-08-29T00:00:00Z\t"), "edge whitespace"
    assert not valid_run_id(" orun-2026-08-29T00:00:00Z"), "edge whitespace"
    assert not valid_run_id("orun-2026-08-29T00:00:00Z\x80"), "C1 control"
    assert not valid_run_id("orun-2026-08-29"), "date-only (closed grammar)"
    assert not valid_run_id("orun-2026-99-99T00:00:00"), "shape, not a date"
    assert not valid_run_id(20260829), "non-string"
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "work").mkdir()
        (td / "work/run-manifest.yaml").write_bytes(
            b'run_id: "orun-2026-08-29T00:00:00Z\t"\n')
        with contextlib.redirect_stdout(io.StringIO()):
            assert print_run_id(td) == 1, \
                "print-run-id must refuse what the gate refuses (no strip)"

    man_hex = {"run_id": "orun-2026-08-29T00:00:00Z",
               "repository": {"commit": "c"}, "ontology": {"name": "x"},
               "scope_doc": {"path": "docs/scope.md"},
               "cq_suite": {"path": "docs/cqs.yaml", "cq_count": 1},
               "adapters": [{"id": "a", "version": "1", "script": "s",
                              "script_sha256_12": 449203194793,
                              "golden_fixture": "g"}],
               "agents": {}, "first_run": True}
    expect_msg("adapter numeric sha12", "script_sha256_12 must be a lowercase",
               check_manifest, man_hex, "self:intsha_man")
    expect_msg("scope sha12 missing", "scope_doc.sha256_12 is required",
               check_manifest, man_hex, "self:noscope_man")
    b = copy.deepcopy(so)
    b["source_span"]["content_sha256"] = int("9" * 64)
    b["id"] = canonical_obs_id("so", b)
    expect_msg("SO numeric content sha", "content_sha256 must be a lowercase",
               check_so, b, "self:intsha_so")
    b = copy.deepcopy(rev)
    b["target_sha256"] = int("8" * 64)
    expect_msg("review numeric target sha", "must be 64 hex",
               check_review, b, "self:intsha_review")

    assert not config_pair_occurs("alpha_mode", "safe", "alpha_mode\n=safe\n",
                                  "a.properties"), "cross-line separator (key)"
    assert not config_pair_occurs("alpha_mode", "safe", "alpha_mode=\nsafe\n",
                                  "a.properties"), "cross-line separator (value)"
    assert not config_pair_occurs("alpha_mode", "safe",
                                  'alpha_mode="safe";prod\n', "a.ini"), \
        "ini quoted-value ; is payload"
    assert not config_pair_occurs("alpha_mode", "safe",
                                  'alpha_mode="safe"#prod\n', "a.properties"), \
        "properties quoted-value # is payload"
    assert not config_pair_occurs("mode", "safe", 'mode="safe"\n', "a.ini"), \
        "ini quotes are payload; a bare claimed value cannot match quoted bytes"
    assert config_pair_occurs("mode", '"safe"', 'mode="safe"\n', "a.ini"), \
        "ini claim WITH quotes matches the raw bytes"
    assert config_pair_occurs("mode", "safe", 'mode="safe"\n', "a.yaml"), \
        "yaml quoted arm unaffected"
    assert not config_pair_occurs(
        "alpha_mode", "safe",
        strip_comments_config('x=1# "alpha_mode"="safe"\nalpha_mode="strict"\n',
                              "a.toml"), "a.toml"), \
        "toml hash needs no preceding whitespace"
    assert not config_pair_occurs(
        "alpha_mode", "safe",
        strip_comments_config('\ufeff# "alpha_mode": "safe"\nalpha_mode: strict\n',
                              "a.yaml"), "a.yaml"), \
        "BOM cannot shield a first-line comment"
    assert not config_pair_occurs(
        "alpha_mode", "safe",
        strip_comments_config('\f! "alpha_mode"="safe"\nalpha_mode=strict\n',
                              "a.properties"), "a.properties"), \
        "form feed is Properties leading whitespace"

    out = cross_check_index(
        [{"observation": [], "outcome": "proposed", "ref": "otp:Lease:001"}],
        "self:idx", set(), [], [], set())
    expect_out("unhashable index observation", "not a STRING id", out)
    out = cross_check_chain([], [("self:dh", {"id": "dh:x:001",
                             "observation_refs": [[]]})], [], [], set())
    expect_out("unhashable DH ref", "not a STRING", out)

    out, _, _ = cross_check_review_binding(
        [(P("w/otp-ghost-999.review.yaml"),
          {"target": "otp:ghost:999", "target_sha256": "a" * 64,
           "verdict": "PASS"})], {})
    expect_out("orphan review", "resolves to NO scanned proposal", out)
    out = cross_check_rejections(
        [], [("self:rej", {"id": "rej:1", "proposal_ref": "otp:ghost:999",
                            "rationale": "x" * 30})],
        otp_ids=set())
    expect_out("ghost rejection", "no such proposal is in the scan", out)
    expect_out("unauthored rejection", "NO decision: reject ratification", out)
    out = cross_check_rejections(
        [("self:rat", {"decision": "reject", "proposal_ref": "otp:Lease:001"})],
        [("self:rej1", {"proposal_ref": "otp:Lease:001", "rationale": "x" * 30}),
         ("self:rej2", {"proposal_ref": "otp:Lease:001", "rationale": "y" * 30})],
        otp_ids={"otp:Lease:001"})
    expect_out("duplicate rejection rows", "DUPLICATE rejection-ledger row", out)

    out = check_prior_rows(
        [{"observation": "so:sha256:" + "1" * 64, "outcome": "unresolved",
          "needed_evidence": "registrar SME interview needed", "since": "2026-08-01"},
         {"observation": "so:sha256:" + "1" * 64, "outcome": "proposed",
          "ref": "otp:X:001"},
         "scalar-row",
         {"observation": "so:sha256:" + "2" * 64, "outcome": "not-an-outcome",
          "carried_from_prior": "true", "reason": 123}], "self:prior")
    expect_out("prior duplicate row", "DUPLICATE row", out)
    expect_out("prior scalar row", "is not a mapping", out)
    expect_out("prior invalid outcome", "invalid/missing outcome", out)
    expect_out("prior string carried", "must be a BOOLEAN", out)
    expect_out("prior numeric reason", "reason must be a STRING", out)

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "runs").symlink_to(td / "runs")   # symlink loop
        n = len(errors)
        res = safe_join(td, "runs/x.yaml", "self:loop")
        assert res is None and len(errors) > n, \
            "symlink loop must be a violation, never a crash"
        del errors[n:]
        # strict-first resolution must not tighten the missing-tail case:
        # a merely-missing in-root path still resolves through the lenient
        # fallback with no violation (loops can never reach the fallback)
        n = len(errors)
        res = safe_join(td, "nope/missing.yaml", "self:missing")
        assert res is not None and len(errors) == n, \
            "a merely-missing path must still resolve via the lenient fallback"


    # --- round-12 families ---------------------------------------------------
    assert not valid_run_id("orun-2026-08-29T00:00:00." + "9" * 300 + "Z"), \
        "unbounded fraction is not archive-component-safe"
    assert valid_run_id("orun-2026-08-29T00:00:00.123456789Z"), \
        "9-digit fraction rotates"
    assert not config_pair_occurs(
        "alpha_mode", "safe",
        strip_comments_config('alpha_mode: strict\r# "alpha_mode": "safe"\r',
                              "a.yaml"), "a.yaml"), \
        "CR-only line breaks cannot shield a comment"
    assert config_pair_occurs(
        "alpha_mode", "strict",
        strip_comments_config("alpha_mode: strict\r", "a.yaml"), "a.yaml"), \
        "honest CR-only pairing normalizes"
    assert not config_pair_occurs(
        "alpha_mode", '"safe',
        strip_comments_config('alpha_mode = "safe#prod"\n', "a.toml"), "a.toml"), \
        "a stripped half-quote cannot ride the unquoted arm"
    assert config_pair_occurs(
        "alpha_mode", '"safe',
        'alpha_mode="safe\n', "a.properties"), \
        "ini/properties quote-initial claims still match raw payload bytes"

    so_l = copy.deepcopy(so)
    so_l["id"] = []
    n = len(errors)
    check_so(so_l, "self:listid_so")
    del errors[n:]
    obs_tbl = {d.get("id") for d in [so_l, so] if type(d.get("id")) is str}
    assert so["id"] in obs_tbl and len(obs_tbl) == 1, \
        "filtered join tables drop malformed ids silently after diagnosis"
    assert skey([]) is None and skey("x") == "x", "skey filter"

    out = check_prior_rows(
        [{"observation": "so:sha256:" + "3" * 64, "outcome": "unresolved",
          "needed_evidence": "registrar SME interview needed",
          "since": "2026-99-99"},
         {"observation": "so:sha256:" + "4" * 64, "outcome": "unresolved",
          "needed_evidence": "registrar SME interview needed",
          "since": "2099-01-01"},
         {"observation": "not-an-id", "outcome": "irrelevant",
          "reason": "a substantive concrete reason here"},
         {"observation": "so:sha256:" + "5" * 64, "outcome": "irrelevant",
          "reason": "out of scope"},
         {"observation": "so:sha256:" + "6" * 64, "outcome": "proposed",
          "ref": "otp:X:001", "carried_from_prior": True}], "self:prior12")
    expect_out("prior impossible date", "not a real date", out)
    expect_out("prior future date", "in the future", out)
    expect_out("prior id grammar", "does not match the", out)
    expect_out("prior trivial reason", "concrete", out)
    expect_out("prior carried-proposed", "carried row cannot be", out)

    assert safe_text("ok \x1b[2J\nFAKE") == "ok \\x1b[2J\\x0aFAKE", \
        "authority strings render controls as visible escapes"

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        overlong = "runs/" + "x" * 4000 + ".yaml"
        # crash-hardening: NO layer may raise on an unexaminable path — which
        # layer detects it is interpreter-dependent (newer pathlib swallows
        # lstat errors in is_symlink/resolve; the guarded read then reports
        # "prior_index unreadable"), but an uncaught OSError is never legal
        n = len(errors)
        lexical_symlink_violations(td, overlong)
        safe_join(td, overlong, "self:enametoolong")
        try:
            (td / overlong).read_bytes()
            assert False, "overlong path read should fail"
        except OSError:
            pass  # this is the guaranteed violation point inside validate_dir
        del errors[n:]


    # --- PR-review (codex connector) families --------------------------------
    b = copy.deepcopy(good_dh)
    b["proposed_referent"] = 1
    n = len(errors)
    check_dh(b, "self:scalarref_dh")   # must be a violation, never a crash
    assert any("proposed_referent must be a MAPPING" in e for e in errors[n:])
    del errors[n:]
    b = copy.deepcopy(rev)
    b["revision_requests"] = "fix it"
    expect_msg("revision_requests shape", "must be a LIST", check_review, b,
               "self:rrshape_review")
    b = copy.deepcopy(rev)
    b["revision_requests"] = ["tighten the identity criterion to enrollment"]
    n = len(errors)
    check_review(b, "self:rrok_review")
    assert not errors[n:], f"legal revision_requests must pass: {errors[n:]}"
    out = cross_check_rejections(
        [("self:rat", {"decision": "reject", "proposal_ref": "otp:Lease:001",
                        "rationale": "the steward's actual stated reason here"})],
        [("self:rej", {"proposal_ref": "otp:Lease:001",
                        "rationale": "a different substituted reason nobody gave"})],
        otp_ids={"otp:Lease:001"})
    expect_out("ledger rationale binding", "steward's OWN reason", out)
    revs_split = [(P("w/otp-x-001.review.yaml"),
                   {"target": "otp:x:001", "target_sha256": "a" * 64,
                    "verdict": "FAIL",
                    "attacks": [{"surface": "identity", "rule": "rule-a",
                                 "outcome": "landed"},
                                {"surface": "warrant", "rule": "rule-b",
                                 "outcome": "landed"}]}),
                  (P("w/otp-x-001-r2.review.yaml"),
                   {"target": "otp:x:001", "target_sha256": "b" * 64,
                    "verdict": "PASS"})]
    otp_split = {"otp:x:001": ("self:otp", {
        "revision_log": [{"from_sha256": "a" * 64, "addressed": ["rule-a"]},
                          {"from_sha256": "a" * 64, "addressed": ["rule-b"]}]})}
    out, _, _ = cross_check_review_binding(revs_split, otp_split)
    assert not any("does not address" in m for m in out), \
        "split revision_log entries for one digest must UNION, not last-win"

    # --- v14 field-amendment families ----------------------------------------
    # (auditor run 2 field defect: the scanner absorbed a rotated
    # predecessor's record files under runs/ as live evidence)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        (td / "runs/orun-r.observations").mkdir(parents=True)
        (td / "runs/orun-r.observations/so-poison.yaml").write_text("id: x\n")
        (td / "runs/orun-r.index.yaml").write_text("[]\n")
        (td / "runs/history").mkdir()
        (td / "runs/history/ratification.schema.yaml").write_text("a: 1\n")
        n = len(errors)
        validate_dir(td)
        msgs = errors[n:]
        assert any("NOT live evidence" in m and "so-poison" in m
                   for m in msgs), \
            "record-prefixed file under runs/ must be a LOUD violation"
        assert not any("orun-r.index.yaml" in m for m in msgs), \
            "rotation-ledger files under runs/ are not live records"
        assert not any("ratification.schema.yaml" in m for m in msgs), \
            "engine-history files under runs/ are not record-prefixed"
        del errors[n:]

    print("SELF-TEST PASS (157 rule families fire: canonical ids, nested closure, "
          "object grammar, mixed-unrep, discriminator, searched-true, warrant-XOR, "
          "parents grammar, id grammars incl. rat digits, crash-hardening, rat "
          "content binding + staleness + freshness, review edge-target/chain/"
          "history/continuity/revision_log incl. landed-rule join + duplicate "
          "rounds, chain cross-wire + verdict join, carried authentication + "
          "live-carried bypass, row-evidence join, since-exact, digest-fresh IRI, "
          "identifier pad + negation context + provider agreement incl. "
          "boolean-vs-unresolved, boolean pin_waived, ufo_category required, "
          "addressed-list shape, #-boundary, config pairing, vacuity-boolean, text exact-type sweep, container shapes, prior-FAIL coverage population, tri-state crash hardening, duplicate-key loader, syntax-aware pairing stripper, glued openers, mid-line bare keys, blank-line continuation, identity precedence, lexical component symlinks, run-id parser, closed shared run-id grammar + rotation parity, exact-hex digest locks, cross-line separator refusal, ini/properties quoted-payload, toml/BOM/form-feed comment boundaries, join quarantine, orphan review/rejection authority, predecessor-local row validation, symlink-loop fail-closed, bounded run-id fractions, CR line-break normalization, half-quote arm refusal, table-filter quarantine, predecessor date/grammar/reason/carried meters, control-escaped authority rendering, unexaminable-path fail-closed, referent-mapping guard, review revision-requests channel, ledger-rationale binding, revision-log digest union, closure-read fail-closed, runs-shelter poison guard)")


def print_run_id(ont_root):
    """Rotation's parser: exactly ONE duplicate-free YAML scalar, the same
    loader and ISO grammar the validator enforces, canonicalized — never a
    sed over raw bytes (CRLF residue, duplicate-key last-wins, and !!str
    tags are all validator-legal inputs a byte-level extractor mangles)."""
    man = Path(ont_root) / "work/run-manifest.yaml"
    try:
        d = yload(man.read_bytes())
    except Exception as ex:  # noqa: BLE001
        print(f"refusing: manifest unreadable ({ex})", file=sys.stderr)
        return 1
    rid = d.get("run_id") if isinstance(d, dict) else None
    if not valid_run_id(rid):
        # validate the EXACT loaded scalar — no strip, no normalization: a
        # run id the ordinary gate rejects must never rotate, and vice versa
        # (valid_run_id is the one shared grammar; its closed charset refuses
        # controls, whitespace, and separators structurally)
        print(f"refusing: run_id {rid!r} does not match the closed shared "
              "grammar orun-YYYY-MM-DDTHH:MM:SS[.f][Z|±HH:MM]", file=sys.stderr)
        return 1
    print(rid)
    return 0


if __name__ == "__main__":
    argv = sys.argv[1:]
    if argv and argv[0] == "--self-test":
        self_test()
        sys.exit(0)
    if argv and argv[0] == "--print-run-id":
        if len(argv) != 2:
            print("usage: --print-run-id <ontology-root>", file=sys.stderr)
            sys.exit(2)
        sys.exit(print_run_id(argv[1]))
    if not argv:
        print(__doc__)
        sys.exit(2)
    gate = "--gate" in argv
    repo = argv[argv.index("--repo") + 1] if "--repo" in argv else None
    validate_dir(Path(argv[0]), gate=gate, repo=repo)
    for fl in flags:
        print("FLAGGED -", fl)
    if errors:
        print(f"VIOLATIONS ({len(errors)}):")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print("ARTIFACTS VALID" + (" — GATE PASSED (flags above go to the steward)"
                               if gate else ""))
