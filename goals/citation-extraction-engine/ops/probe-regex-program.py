#!/usr/bin/env python3
"""Observe the pinned tokenizer's complete parsed regex feature domain."""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unicodedata
from re import _parser

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle source pin mismatch")
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0":
        raise SystemExit("Python/Unicode version mismatch")
    source_path = Path(__file__).with_name("probe-regex-compatibility.py")
    spec = importlib.util.spec_from_file_location("regex_source_inventory", source_path)
    source = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(source)
    entries, hashes = source.source_entries()
    counts = collections.Counter()
    flags = collections.Counter()
    maximum_groups = 0
    vector = []
    widths = collections.Counter()
    profile_vector = []
    descriptor_vector = []
    repeated_capture_instances = 0
    nullable_repeat_instances = 0

    def walk(tree, observed, profile, in_repeat=False):
        for op, arg in tree:
            name = str(op)
            observed[name] += 1
            if name == "SUBPATTERN":
                observed[f"SUBPATTERN/flags/{arg[1]}/{arg[2]}"] += 1
                if in_repeat:
                    profile["capturesUnderMultiRepeat"] += 1
                walk(arg[3], observed, profile, in_repeat)
            elif name == "BRANCH":
                for branch in arg[1]:
                    walk(branch, observed, profile, in_repeat)
            elif name in ("MAX_REPEAT", "MIN_REPEAT", "POSSESSIVE_REPEAT"):
                multiple = arg[1] > 1
                if multiple and arg[2].getwidth()[0] == 0:
                    profile["nullableMultiRepeatBodies"] += 1
                walk(arg[2], observed, profile, in_repeat or multiple)
            elif name in ("ASSERT", "ASSERT_NOT"):
                walk(arg[1], observed, profile, in_repeat)
            elif name == "IN":
                for sub, operand in arg:
                    observed["IN/" + str(sub)] += 1
                    if str(sub) == "CATEGORY":
                        observed["CATEGORY/" + str(operand)] += 1
            elif name == "AT":
                observed["AT/" + str(arg)] += 1

    for identity, fields in entries:
        tree = _parser.parse(fields["regex"], fields["flags"])
        observed = collections.Counter()
        profile = collections.Counter()
        walk(tree, observed, profile)
        counts.update(observed)
        width = tree.getwidth()[0]
        widths[str(width)] += 1
        repeated_capture_instances += profile["capturesUnderMultiRepeat"] > 0
        nullable_repeat_instances += profile["nullableMultiRepeatBodies"] > 0
        profile_vector.append([identity, width, dict(sorted(profile.items()))])
        descriptor_vector.append([identity, tree.state.groups - 1, sorted(tree.state.groupdict.items()), width])
        flags[str(fields["flags"])] += 1
        groups = tree.state.groups - 1
        maximum_groups = max(maximum_groups, groups)
        vector.append([identity, groups, sorted(tree.state.groupdict.items()), dict(sorted(observed.items()))])
    sha = lambda raw: hashlib.sha256(raw).hexdigest()
    report = {
        "schemaVersion": "citation-regex-program-facts/v1",
        "scope": "Complete parsed feature inventory; not target matching or family safety proof.",
        "oracleCommit": PIN, "oracleTree": TREE,
        "pythonVersion": "3.11.15", "unicodeVersion": "14.0.0",
        "producerSha256": sha(Path(__file__).read_bytes()),
        "sourceReaderSha256": sha(source_path.read_bytes()),
        "sources": hashes,
        "instances": len(entries), "flags": dict(sorted(flags.items())),
        "maximumCaptureGroups": maximum_groups,
        "features": dict(sorted(counts.items())),
        "minimumWidthCounts": dict(sorted(widths.items())),
        "zeroWidthInstances": widths["0"],
        "instancesWithRepeatedCaptures": repeated_capture_instances,
        "instancesWithNullableMultiRepeats": nullable_repeat_instances,
        "instanceProfileVectorSha256": sha(json.dumps(profile_vector, sort_keys=True, separators=(",", ":")).encode()),
        "instanceDescriptorVectorSha256": sha(json.dumps(descriptor_vector, sort_keys=True, separators=(",", ":")).encode()),
        "instanceFeatureVectorSha256": sha(json.dumps(vector, sort_keys=True, separators=(",", ":")).encode()),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=True, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"instances": len(entries), "maximumCaptureGroups": maximum_groups, "features": report["features"]}, sort_keys=True))


if __name__ == "__main__":
    main()
