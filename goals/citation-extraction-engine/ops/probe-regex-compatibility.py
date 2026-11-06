#!/usr/bin/env python3
"""Compile-only survey of every captured extractor; never approves regex parity."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
ROOT = Path(__file__).resolve().parents[3]
FIXTURES = ROOT / "packages/law-practice/use-cases/test/fixtures/eyecite"
CHILD = Path(__file__).with_name("regex-compatibility-probe.child.mjs")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode()


def translate_candidate(pattern, syntax):
    """Lexical candidate only: names, escaped ASCII punctuation, omitted minima.

    Preserve classes and escaped backslashes. No Unicode/flag/anchor semantics
    are changed or qualified. The result is deliberately not a production port.
    """
    result = []
    index = 0
    in_class = False
    features = collections.Counter()
    while index < len(pattern):
        char = pattern[index]
        if char == "\\" and index + 1 < len(pattern):
            escaped = pattern[index + 1]
            if escaped in "dDsSwWbB":
                features["escape-" + escaped] += 1
            if syntax and ord(escaped) < 128 and not escaped.isalnum() and escaped != "\\":
                result.append("\\x" + format(ord(escaped), "02x"))
                features["escaped-ascii-literal"] += 1
            else:
                result.append(pattern[index:index + 2])
            index += 2
            continue
        if char == "[" and not in_class:
            in_class = True
        elif syntax and char == "]" and not in_class:
            # Python accepts a closing bracket outside a class as a literal;
            # Unicode-mode JavaScript requires an explicit literal escape.
            result.append("\\x5d")
            features["literal-unmatched-closing-bracket"] += 1
            index += 1
            continue
        elif char == "]" and in_class:
            in_class = False
        if not in_class and pattern.startswith("(?P<", index):
            result.append("(?<")
            features["python-named-group"] += 1
            index += 4
            continue
        if syntax and not in_class and pattern.startswith("{,", index):
            end = index + 2
            while end < len(pattern) and pattern[end].isascii() and pattern[end].isdigit():
                end += 1
            if end > index + 2 and end < len(pattern) and pattern[end] == "}":
                result.append("{0," + pattern[index + 2:end] + "}")
                features["omitted-minimum-quantifier"] += 1
                index = end + 1
                continue
        result.append(char)
        index += 1
    return "".join(result), features


def source_entries():
    operation_bytes = (FIXTURES / "operation-cases.json").read_bytes()
    inventory_bytes = (FIXTURES / "regex-inventory.json").read_bytes()
    operations = json.loads(operation_bytes)
    inventory = json.loads(inventory_bytes)
    if (operations["commit"], operations["tree"]) != (PIN, TREE):
        raise ValueError("operation source pin mismatch")
    if (inventory["source"]["commit"], inventory["source"]["tree"]) != (PIN, TREE):
        raise ValueError("inventory source pin mismatch")
    entries = {}
    for artifact_id, artifact in operations["artifacts"].items():
        if artifact["kind"] != "tokenizer-extractors":
            continue
        if sha(artifact["payload"].encode()) != artifact_id:
            raise ValueError("extractor artifact digest mismatch")
        for index, value in enumerate(json.loads(artifact["payload"])):
            fields = value["fields"]
            entries[f"{artifact_id}::{index}"] = fields
    ordered = []
    seen = set()
    for row in inventory["extractorInstances"]:
        identity = row["id"]
        if identity in seen or identity != f"{row['artifactSha256']}::{row['index']}":
            raise ValueError("duplicate or inconsistent instance identity")
        seen.add(identity)
        fields = entries[identity]
        if (sha(fields["regex"].encode()), fields["flags"], fields["constructor"]["callable"]) != (
                row["patternSha256"], row["flags"], row["constructor"]):
            raise ValueError("extractor descriptor mismatch")
        if fields["flags"] not in (0, 2):
            raise ValueError("unreviewed flag set")
        ordered.append((identity, fields))
    if seen != entries.keys() or len(ordered) != 13610:
        raise ValueError("incomplete extractor coverage")
    return ordered, {"operationsSha256": sha(operation_bytes), "inventorySha256": sha(inventory_bytes)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    entries, sources = source_entries()
    candidates = []
    features = collections.Counter()
    for _, fields in entries:
        baseline, _ = translate_candidate(fields["regex"], False)
        syntax, observed = translate_candidate(fields["regex"], True)
        features.update(observed.keys())  # Instance presence, not occurrences.
        candidates.append([baseline, syntax, fields["flags"]])
    results = []
    for executable in args.runtime:
        requested = shutil.which(executable)
        if requested is None:
            raise ValueError("requested runtime is unavailable")
        # Vite+ and version-manager shims dispatch by argv[0]. Resolving the
        # shim symlink can select the manager instead of the requested runtime.
        resolved = subprocess.run([requested, "-p", "process.execPath"], capture_output=True,
                                  text=True, timeout=10, check=True).stdout.strip()
        if not Path(resolved).is_file():
            raise ValueError("runtime did not identify its executable")
        resolved = str(Path(resolved).resolve())
        version = subprocess.run([resolved, "--version"], capture_output=True, text=True, timeout=10, check=True).stdout.strip()
        prefix = ["--no-env-file", "--no-install"] if Path(resolved).name.startswith("bun") else []
        completed = subprocess.run([resolved, *prefix, str(CHILD)], input=canonical(candidates),
                                   capture_output=True, timeout=30, check=True, env={})
        result = json.loads(completed.stdout)
        codes = result["codes"]
        if len(codes) != len(entries) or any(len(row) != 2 or any(code not in ("C", "S") for code in row) for row in codes):
            raise ValueError("incomplete compile response")
        stages = []
        for index, name in enumerate(("named-groups-only", "lexical-syntax-candidate")):
            vector = "".join(row[index] for row in codes)
            stages.append({"stage": name, "compiled": vector.count("C"), "syntaxRejected": vector.count("S"),
                           "vector": vector, "vectorSha256": sha(vector.encode())})
        results.append({"executable": resolved, "version": version, "versions": result["versions"], "stages": stages})
    output = {
        "schemaVersion": "citation-regex-compile-survey/v1", "oracleCommit": PIN, "oracleTree": TREE,
        "scope": "Compile-only candidates for every captured extractor. No matching, family approval, Unicode equivalence, routing or timing proof.",
        "sources": sources, "producerSha256": sha(Path(__file__).read_bytes()), "childSha256": sha(CHILD.read_bytes()),
        "instanceOrderSha256": sha(canonical([identity for identity, _ in entries])),
        "candidateProjectionSha256": sha(canonical(candidates)), "instances": len(entries),
        "uniquePatternBodies": len({fields["regex"] for _, fields in entries}),
        "flags": dict(collections.Counter(str(fields["flags"]) for _, fields in entries)),
        "featureInstanceCounts": dict(sorted(features.items())), "runtimes": results,
        "vectorLegend": {"C": "compilation succeeded only", "S": "SyntaxError; raw pattern/error text is not retained"},
    }
    args.output.write_text(json.dumps(output, ensure_ascii=True, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"instances": len(entries), "runtimes": [{"version": row["version"], "stages": [
        {key: stage[key] for key in ("stage", "compiled", "syntaxRejected")} for stage in row["stages"]]} for row in results]}))


if __name__ == "__main__":
    main()
