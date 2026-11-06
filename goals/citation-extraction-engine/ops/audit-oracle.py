#!/usr/bin/env python3
"""Audit the pinned oracle without changing its source or trusting method counts.

This is P0 discovery evidence, not the portable parity gate. Assertion events
identify dynamic expansions of independently inventoried source declarations.
They do not establish target implementation parity or normalized stage outputs.
"""

import argparse
import ast
import functools
import hashlib
import inspect
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import NonCallableMock


PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
VERSION = "citation-oracle-audit/v1"


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(root):
    rows = []
    files = []
    for path in sorted([*root.glob("eyecite/*.py"), *root.glob("tests/test_*.py")]):
        relative = path.relative_to(root).as_posix()
        raw = path.read_bytes()
        files.append({"path": relative, "sha256": digest(raw)})
        tree = ast.parse(raw, filename=relative)

        class Walk(ast.NodeVisitor):
            def __init__(self):
                self.scope = []

            def emit(self, kind, node, symbol):
                rows.append({
                    "id": f"{relative}:{node.lineno}:{node.col_offset}:{kind}",
                    "kind": kind,
                    "path": relative,
                    "line": node.lineno,
                    "column": node.col_offset,
                    "symbol": symbol,
                    "sourceSha256": digest(raw),
                })

            def visit_ClassDef(self, node):
                if relative.startswith("eyecite/"):
                    self.emit("modelFamily", node, ".".join([*self.scope, node.name]))
                self.scope.append(node.name)
                self.generic_visit(node)
                self.scope.pop()

            def visit_FunctionDef(self, node):
                symbol = ".".join([*self.scope, node.name])
                if relative.startswith("eyecite/"):
                    self.emit("helperFamily", node, symbol)
                elif node.name.startswith("test_"):
                    self.emit("testMethod", node, symbol)
                self.scope.append(node.name)
                self.generic_visit(node)
                self.scope.pop()

            def visit_Call(self, node):
                func = node.func
                if (relative.startswith("tests/") and isinstance(func, ast.Attribute)
                        and func.attr.startswith("assert")):
                    self.emit("caseDeclaration", node, ".".join([*self.scope, func.attr]))
                self.generic_visit(node)

            def visit_Assign(self, node):
                # Candidate regex declarations require subsequent family review;
                # neither this spelling heuristic nor the count proves coverage.
                if relative == "eyecite/regexes.py":
                    for target in node.targets:
                        if isinstance(target, ast.Name):
                            self.emit("regexCandidate", node, target.id)
                self.generic_visit(node)

            def visit_ImportFrom(self, node):
                if relative == "eyecite/__init__.py":
                    for alias in node.names:
                        self.emit("publicOperation", node, alias.asname or alias.name)
                self.generic_visit(node)

        Walk().visit(tree)

    for path in sorted((root / "tests/assets").rglob("*")):
        if path.is_file():
            relative = path.relative_to(root).as_posix()
            rows.append({"id": relative, "kind": "fixture", "path": relative,
                         "sourceSha256": digest(path.read_bytes())})
    # Several import aliases can share a source location: symbol is part of ID.
    for row in rows:
        if row["kind"] == "publicOperation":
            row["id"] += ":" + row["symbol"]
    ids = [row["id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise RuntimeError("duplicate source-inventory IDs")
    return files, rows


def runtime(root, rows):
    os.chdir(root)
    sys.path.insert(0, str(root))
    suite = unittest.defaultTestLoader.discover(str(root / "tests"), pattern="test_*.py", top_level_dir=str(root))
    events = []
    counts = {}
    current = {"test": None}
    declarations = {}
    for row in rows:
        if row["kind"] == "caseDeclaration":
            key = (row["path"], row["line"])
            if key in declarations:
                raise RuntimeError(f"multiple assertions on one line require column instrumentation: {key}")
            declarations[key] = row

    def instrument(original):
        @functools.wraps(original)
        def wrapped(self, *args, **kwargs):
            frame = inspect.currentframe().f_back
            try:
                path = Path(frame.f_code.co_filename).resolve().relative_to(root).as_posix()
            except ValueError:
                return original(self, *args, **kwargs)
            key = (path, frame.f_lineno)
            if path.startswith("tests/"):
                declaration = declarations.get(key)
                if declaration is None:
                    raise RuntimeError(f"runtime assertion lacks static source declaration: {key}")
                event_key = (current["test"], declaration["id"])
                ordinal = counts.get(event_key, 0) + 1
                counts[event_key] = ordinal
                events.append({
                    "id": f"{current['test']}::{declaration['id']}::{ordinal}",
                    "test": current["test"], "declarationId": declaration["id"],
                    "ordinal": ordinal, "assertion": original.__name__,
                })
            return original(self, *args, **kwargs)
        return wrapped

    # Patch only for this isolated audit process. Retain and restore all originals.
    patches = []
    classes = {unittest.TestCase, NonCallableMock}

    def collect(node):
        if isinstance(node, unittest.TestSuite):
            for child in node:
                collect(child)
        else:
            classes.add(type(node))

    collect(suite)
    for cls in classes:
        for name, value in list(vars(cls).items()):
            if name.startswith("assert") and callable(value):
                patches.append((cls, name, value))
                setattr(cls, name, instrument(value))

    class Result(unittest.TextTestResult):
        def startTest(self, test):
            current["test"] = test.id()
            super().startTest(test)

    try:
        result = unittest.TextTestRunner(verbosity=1, resultclass=Result).run(suite)
    finally:
        for cls, name, value in patches:
            setattr(cls, name, value)
    observed = {event["declarationId"] for event in events}
    missing = [row["id"] for row in rows
               if row["kind"] == "caseDeclaration" and row["id"] not in observed]
    return {
        "successful": result.wasSuccessful(), "testsRun": result.testsRun,
        "failures": len(result.failures), "errors": len(result.errors),
        "skipped": len(result.skipped), "assertionEvents": events,
        "unobservedDeclarations": missing,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    output = args.output.resolve()
    if git(root, "rev-parse", "HEAD") != PIN or git(root, "rev-parse", "HEAD^{tree}") != TREE:
        raise SystemExit("oracle pin/tree mismatch; refusing audit")
    if git(root, "status", "--porcelain"):
        raise SystemExit("oracle tracked/untracked source is dirty; refusing audit")
    if sys.version_info[:2] != (3, 11):
        raise SystemExit("oracle audit requires Python 3.11")
    files, rows = inventory(root)
    run = runtime(root, rows)
    if git(root, "status", "--porcelain"):
        raise SystemExit("oracle source changed during execution; refusing evidence")
    report = {
        "schemaVersion": VERSION,
        "scope": "source-and-runtime-assertion-discovery; not normalized parity proof",
        "commit": PIN, "tree": TREE, "python": sys.version.split()[0],
        "license": "BSD-2-Clause", "licenseSha256": digest((root / "LICENSE").read_bytes()),
        "exporterSha256": digest(Path(__file__).read_bytes()),
        "sourceFiles": files, "sourceRows": rows, "runtime": run,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"source rows={len(rows)}; methods={run['testsRun']}; assertion events={len(run['assertionEvents'])}; unobserved declarations={len(run['unobservedDeclarations'])}")
    if not run["successful"] or run["unobservedDeclarations"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
