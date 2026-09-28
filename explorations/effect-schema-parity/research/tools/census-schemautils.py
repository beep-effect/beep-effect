#!/usr/bin/env python3
"""SchemaUtils consumer census (effect-schema-parity reopen, Lane B, D9).

Usage (from any directory):
    python3 explorations/effect-schema-parity/research/tools/census-schemautils.py [ROOT] [--scope SCOPE] [--files NAME]

ROOT defaults to the checkout that contains this script. SCOPE is one of:
    prod        packages apps tools scripts, excluding tests, dtslint and the
                @beep/schema package itself (the census scope, default)
    test        packages apps tools scripts, tests only (outside @beep/schema)
    scratchpad  the tracked scratchpad/ tree, same exclusions as prod
    intra       packages/foundation/modeling/schema/src (the package's own
                source), excluding the file that defines the export
    intratest   packages/foundation/modeling/schema/{test,dtslint}
    all         every scope above, one table each

Counting rule (identical to the 2026-09-28 grounding census.py, which this
file generalises): a file is scanned when it mentions `@beep/schema` (intra
scopes: when it mentions `SchemaUtils`). Per export name it counts
  * `<ns>.<name>` for every namespace binding of SchemaUtils
    (`{ SchemaUtils }` / `{ SchemaUtils as X }` from "@beep/schema",
    `import * as X from "@beep/schema/SchemaUtils[/...]"`, and inside the
    package `import * as X from "../SchemaUtils/index.ts"`), and
  * bare `<name>` outside import statements when the name is imported by
    name from a SchemaUtils subpath (or a relative SchemaUtils file).
Occurrences are textual (JSDoc and comments count), so bare-name rows for
common words (optional, split, pluck) are upper bounds.
Read-only: the script never writes.
"""

import collections
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
SU_DIR = "packages/foundation/modeling/schema/src/SchemaUtils/"
PKG = "packages/foundation/modeling/schema/"

# export name -> defining file (relative to SU_DIR)
EXPORTS = collections.OrderedDict(
    [
        ("collectAnnotationsAt", "collectAnnotationsAt.ts"),
        ("encodeEffect", "encoders.ts"),
        ("encodeUnknownEffect", "encoders.ts"),
        ("encodeUnknownExit", "encoders.ts"),
        ("encodeExit", "encoders.ts"),
        ("encodeUnknownOption", "encoders.ts"),
        ("encodeOption", "encoders.ts"),
        ("encodeUnknownResult", "encoders.ts"),
        ("encodeResult", "encoders.ts"),
        ("encodeUnknownPromise", "encoders.ts"),
        ("encodePromise", "encoders.ts"),
        ("isCodecDataFirst", "isCodecDataFirst.ts"),
        ("optional", "optional.ts"),
        ("optionalKeyWithDefault", "optionalKeyWithDefaults.ts"),
        ("pluck", "pluck.ts"),
        ("split", "split.ts"),
        ("toEquivalence", "toEquivalence.ts"),
        ("DualEquivalence", "toEquivalence.ts"),
        ("withCodecStatics", "withCodecStatics.ts"),
        ("classStatics", "withCodecStatics.ts"),
        ("CodecStaticRegistry", "withCodecStatics.ts"),
        ("CodecStaticKey", "withCodecStatics.ts"),
        ("CodecStaticKeys", "withCodecStatics.ts"),
        ("SelectedCodecStatics", "withCodecStatics.ts"),
        ("CodecStaticSelectionError", "withCodecStatics.ts"),
        ("withNoneDefault", "withConstructorDefaults.ts"),
        ("withConstantDefault", "withConstructorDefaults.ts"),
        ("withEncodeDefault", "withEncodeDefault.ts"),
        ("boolWithDefault", "withEncodeDefault.ts"),
        ("BoolDefaultFalse", "withEncodeDefault.ts"),
        ("BoolDefaultTrue", "withEncodeDefault.ts"),
        ("withKeyDefaults", "withKeyDefaults.ts"),
        ("withEmptyArrayDefaults", "withKeyDefaults.ts"),
        ("boolKeyWithDefault", "withKeyDefaults.ts"),
        ("BoolKeyDefaultFalse", "withKeyDefaults.ts"),
        ("BoolKeyDefaultTrue", "withKeyDefaults.ts"),
        ("withLiteralKitStatics", "withLiteralKitStatics.ts"),
        ("withStatics", "withStatics.ts"),
        ("staticDescriptorInstaller", "internal/staticDescriptors.ts"),
    ]
)
GROUPS = {
    "encode* (all 10)": [n for n, f in EXPORTS.items() if f == "encoders.ts"],
    "CodecStatic* (Registry, Key, Keys, SelectionError)": [
        "CodecStaticRegistry",
        "CodecStaticKey",
        "CodecStaticKeys",
        "CodecStaticSelectionError",
    ],
}

SU_SPEC = r'(?:@beep/schema/SchemaUtils[^"]*|[^"]*SchemaUtils/[^"]*)'


def is_test(f):
    return bool(
        "/test/" in f
        or f.startswith("test/")
        or re.search(r"\.test\.tsx?$", f)
        or "/dtslint/" in f
        or "/__tests__/" in f
        or ".spec." in f
    )


def in_scope(scope, f):
    if scope == "prod":
        return not is_test(f) and not f.startswith(PKG)
    if scope == "test":
        return is_test(f) and not f.startswith(PKG)
    if scope == "scratchpad":
        return f.startswith("scratchpad/") and not is_test(f)
    if scope == "intra":
        return f.startswith(PKG + "src/")
    if scope == "intratest":
        return f.startswith(PKG) and not f.startswith(PKG + "src/")
    raise SystemExit(f"unknown scope {scope}")


SCOPE_DIRS = {
    "prod": ["packages", "apps", "tools", "scripts"],
    "test": ["packages", "apps", "tools", "scripts"],
    "scratchpad": ["scratchpad"],
    "intra": [PKG + "src"],
    "intratest": [PKG],
}


def list_files(root, scope):
    dirs = [d for d in SCOPE_DIRS[scope] if os.path.isdir(os.path.join(root, d))]
    if not dirs:
        return []
    out = subprocess.run(
        [
            "rg", "-l", r"SchemaUtils" if scope.startswith("intra") else r"@beep/schema",
            "-g", "*.ts", "-g", "*.tsx", "-g", "*.mts", "-g", "*.cts",
            "-g", "!**/node_modules/**", "-g", "!**/dist/**",
            "-g", "!**/.repos/**", "-g", "!graft/**",
            *dirs,
        ],
        capture_output=True, text=True, cwd=root,
    ).stdout.split()
    return sorted(f for f in out if in_scope(scope, f))


def namespaces(src):
    ns = {"SchemaUtils"} if re.search(r"\bSchemaUtils\b", src) else set()
    for alias in re.findall(
        r'import\s+(?:type\s+)?\{[^}]*\bSchemaUtils(?:\s+as\s+(\w+))?[^}]*\}\s+from\s+"@beep/schema"', src
    ):
        if alias:
            ns.add(alias)
    ns.update(re.findall(r'import\s+(?:type\s+)?\*\s+as\s+(\w+)\s+from\s+"' + SU_SPEC + '"', src))
    return ns


def named_imports(src, f):
    spec = SU_SPEC
    if f.startswith(SU_DIR):  # sibling files inside SchemaUtils import "./x.ts"
        spec = r'(?:' + SU_SPEC + r'|\.{1,2}/[^"]*)'
    return re.findall(r'import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"' + spec + '"', src)


def count(root, scope, name_filter=None):
    files = list_files(root, scope)
    rows = collections.OrderedDict()
    for name, deffile in EXPORTS.items():
        rows[name] = [0, 0, []]
    cache = {}
    for f in files:
        src = open(os.path.join(root, f), encoding="utf-8").read()
        ns = namespaces(src)
        direct = named_imports(src, f)
        body = None
        for name, deffile in EXPORTS.items():
            if f == SU_DIR + deffile:
                continue  # never count the defining file
            c = 0
            for n in ns:
                c += len(re.findall(r"\b" + re.escape(n) + r"\." + name + r"\b", src))
            if any(re.search(r"\b" + name + r"\b", d) for d in direct):
                if body is None:
                    body = re.sub(r'import\s+(?:type\s+)?\{[^}]*\}\s+from\s+"[^"]*";?', "", src)
                c += len(re.findall(r"(?<![.\w])" + name + r"\b", body))
            if c:
                r = rows[name]
                r[0] += 1
                r[1] += c
                r[2].append(f)
    return rows


def group_row(rows, members):
    files = set()
    occ = 0
    for m in members:
        files.update(rows[m][2])
        occ += rows[m][1]
    return len(files), occ, sorted(files)


def main():
    args = sys.argv[1:]
    root = DEFAULT_ROOT
    scope = "prod"
    show = None
    i = 0
    while i < len(args):
        if args[i] == "--scope":
            scope = args[i + 1]
            i += 2
        elif args[i] == "--files":
            show = args[i + 1]
            i += 2
        else:
            root = os.path.abspath(args[i])
            i += 1
    scopes = ["prod", "test", "scratchpad", "intra", "intratest"] if scope == "all" else [scope]
    print(f"root: {root}")
    head = subprocess.run(["git", "rev-parse", "--short=10", "HEAD"], capture_output=True, text=True, cwd=root).stdout.strip()
    print(f"HEAD: {head}")
    for sc in scopes:
        rows = count(root, sc)
        if show:
            print(f"\n## {sc}: files for {show}")
            for f in rows[show][2]:
                print(f"- {f}")
            continue
        print(f"\n## scope={sc}\n")
        print("| Export | Files | Occ. | First consumers |")
        print("| --- | ---: | ---: | --- |")
        for name, (nf, no, fl) in rows.items():
            print(f"| {name} | {nf} | {no} | {'; '.join(fl[:3])} |")
        for label, members in GROUPS.items():
            nf, no, fl = group_row(rows, members)
            print(f"| {label} | {nf} | {no} | {'; '.join(fl[:3])} |")


if __name__ == "__main__":
    main()
