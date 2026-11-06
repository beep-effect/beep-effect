#!/usr/bin/env python3
"""Capture every assertion expansion with independent AST and loop evidence.

No successful upstream assertion is target parity proof. This exports operands,
producer context, loop bindings and expected failures so the Effect-native
implementation can be checked without the Python environment.
"""
import argparse
import ast
import builtins
from datetime import datetime
import functools
import hashlib
import importlib.metadata
import importlib.util
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
CLOCK = "2026-10-28"
BAGS = ("all_editions", "exact_editions", "variation_editions")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha(value):
    return hashlib.sha256(value).hexdigest()


def load_tool(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def local_nodes(node):
    """Do not confuse assignments in a nested function with its parent's dataflow."""
    for child in ast.iter_child_nodes(node):
        yield child
        if not isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
            yield from local_nodes(child)


def names(node):
    return {item.id for item in ast.walk(node) if isinstance(item, ast.Name)}


def source_inventory(root):
    declarations, functions, loops, parameters, guards = [], [], [], [], []
    nodes, function_nodes, loop_nodes = {}, {}, {}
    for path in sorted((root / "tests").glob("test_*.py")):
        relative = path.relative_to(root).as_posix()
        text = path.read_text()
        content_hash = sha(path.read_bytes())

        class Walk(ast.NodeVisitor):
            def __init__(self):
                self.scope = []
                self.function = None

            def base(self, node, kind):
                return {"id": f"{relative}:{node.lineno}:{node.col_offset}:{kind}",
                        "path": relative, "line": node.lineno, "column": node.col_offset,
                        "sourceSha256": content_hash}

            def visit_ClassDef(self, node):
                self.scope.append(node.name)
                self.generic_visit(node)
                self.scope.pop()

            def visit_FunctionDef(self, node):
                previous = self.function
                symbol = ".".join([*self.scope, node.name])
                row = {**self.base(node, "testFunction"), "symbol": symbol,
                       "entryLine": min([node.lineno, *[decorator.lineno for decorator in node.decorator_list]]),
                       "endLine": node.end_lineno}
                functions.append(row)
                function_nodes[row["id"]] = node
                self.function = row
                self.scope.append(node.name)
                self.generic_visit(node)
                self.scope.pop()
                self.function = previous

            def visit_For(self, node):
                row = {**self.base(node, "loopDeclaration"), "functionId": self.function["id"],
                       "bodyLine": node.body[0].lineno, "endLine": node.end_lineno,
                       "targets": sorted(names(node.target)),
                       "iterableExpression": ast.get_source_segment(text, node.iter)}
                loops.append(row)
                loop_nodes[row["id"]] = node
                if isinstance(node.iter, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                    row["literalParameterId"] = self.parameter(node.iter, [], "iterable")["id"]
                self.generic_visit(node)

            def parameter(self, node, targets, role, **extra):
                items = node.keys if isinstance(node, ast.Dict) else node.elts
                row = {**self.base(node, "literalParameters"),
                       "functionId": self.function["id"] if self.function is not None else f"module:{relative}",
                       "targets": targets, "role": role, "collectionKind": type(node).__name__,
                       "itemCount": len(items), "items": [
                           {"ordinal": index + 1, "expression": ast.get_source_segment(text, item),
                            "expressionSha256": sha(ast.get_source_segment(text, item).encode())}
                           for index, item in enumerate(items) if item is not None], **extra}
                if len(row["items"]) != row["itemCount"]:
                    raise RuntimeError("dynamic dictionary unpacking needs explicit parameter accounting")
                parameters.append(row)
                return row

            def visit_Assign(self, node):
                if isinstance(node.value, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                    self.parameter(node.value, sorted(set().union(*(names(target) for target in node.targets))), "assigned")
                self.generic_visit(node)

            def visit_Call(self, node):
                callee = node.func.attr if isinstance(node.func, ast.Attribute) else (
                    node.func.id if isinstance(node.func, ast.Name) else None)
                if callee is not None:
                    if node.args and all(isinstance(value, (ast.List, ast.Tuple, ast.Set, ast.Dict, ast.Constant)) for value in node.args):
                        parameters.append({**self.base(node, "literalCallVector"),
                            "functionId": self.function["id"] if self.function is not None else f"module:{relative}",
                            "targets": [], "role": "call-vector", "collectionKind": "ArgumentVector",
                            "callee": callee, "callLine": node.lineno, "itemCount": len(node.args),
                            "items": [{"ordinal": index + 1, "expression": ast.get_source_segment(text, value),
                                       "expressionSha256": sha(ast.get_source_segment(text, value).encode())}
                                      for index, value in enumerate(node.args)]})
                    for index, value in enumerate(node.args):
                        if isinstance(value, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                            self.parameter(value, [], "positional", callLine=node.lineno, callee=callee, argumentIndex=index)
                    for keyword in node.keywords:
                        if keyword.arg is not None and isinstance(keyword.value, (ast.List, ast.Tuple, ast.Set, ast.Dict)):
                            self.parameter(keyword.value, [keyword.arg], "keyword", callLine=node.lineno, callee=callee)
                if isinstance(node.func, ast.Attribute):
                    method = node.func.attr
                    if method.startswith("assert"):
                        row = {**self.base(node, "caseDeclaration"), "functionId": self.function["id"],
                               "symbol": ".".join([*self.scope, method]), "assertion": method,
                               "expression": ast.get_source_segment(text, node)}
                        declarations.append(row)
                        nodes[row["id"]] = node
                    elif method == "fail" and isinstance(node.func.value, ast.Name) and node.func.value.id == "self":
                        guards.append({**self.base(node, "fixtureGuard"), "functionId": self.function["id"],
                                       "expression": ast.get_source_segment(text, node),
                                       "reason": "Rejects an invalid test-fixture construction; not a citation-engine operation."})
                self.generic_visit(node)

        Walk().visit(ast.parse(text))
    return {"declarations": declarations, "functions": functions, "loops": loops,
            "literalParameters": parameters, "fixtureGuards": guards}, nodes, function_nodes, loop_nodes


def capture(root, source, nodes, function_nodes, loop_nodes, operation_tool):
    from eyecite.models import CaseCitation, IdCitation, Resource, UnknownCitation
    import eyecite.helpers as helpers
    import eyecite.models as models

    normal, artifacts = operation_tool.make_normalizer(root)

    class OracleDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            value = cls.fromisoformat(CLOCK + "T12:00:00")
            return value if tz is None else value.replace(tzinfo=tz)

    models.datetime = OracleDatetime
    helpers._highest_valid_year = int(CLOCK[:4]) + 1
    suite = unittest.defaultTestLoader.discover(str(root / "tests"), pattern="test_*.py", top_level_dir=str(root))
    for name, module in list(sys.modules.items()):
        if name.startswith("tests.") and getattr(module, "datetime", None) is datetime:
            module.datetime = OracleDatetime

    declarations = {(row["path"], row["line"]): row for row in source["declarations"]}
    functions = {(row["path"], row["symbol"], row["entryLine"]): row for row in source["functions"]}
    loop_by_function = {}
    for row in source["loops"]:
        loop_by_function.setdefault(row["functionId"], []).append(row)
    current = {"test": None, "identities": {}}
    frames, invocations, assertion_counts = {}, {}, {}
    events, iterations = [], []
    path_cache = {}
    parameters = {row["id"]: row for row in source["literalParameters"]}

    def relative_path(frame):
        filename = frame.f_code.co_filename
        if filename not in path_cache:
            path = Path(filename).resolve()
            path_cache[filename] = path.relative_to(root).as_posix() if path.is_relative_to(root / "tests") else None
        return path_cache[filename]

    def context_value(name, value):
        if name == "__file__":
            return {"sourceFile": Path(value).resolve().relative_to(root).as_posix()}
        if inspect.ismodule(value):
            return {"pythonModule": value.__name__}
        return normal(value)

    def tracer(frame, event, arg):
        path = relative_path(frame)
        if path is None:
            return None
        if event == "call":
            symbol = frame.f_code.co_qualname.replace(".<locals>.", ".")
            function = functions.get((path, symbol, frame.f_code.co_firstlineno))
            if function is None:
                return None
            key = (current["test"], function["id"])
            ordinal = invocations.get(key, 0) + 1
            invocations[key] = ordinal
            frames[id(frame)] = {"functionId": function["id"], "invocationOrdinal": ordinal,
                                 "active": {}, "counts": {}, "parentCounts": {}, "parameterBindings": {}, "ready": set()}
            caller = frame.f_back
            parent = frames.get(id(caller))
            if parent is not None:
                formal = function_nodes[function["id"]].args
                argument_names = [arg.arg for arg in formal.args if arg.arg not in ("self", "cls")]
                for parameter in source["literalParameters"]:
                    if parameter["functionId"] == parent["functionId"]:
                        if parameter["role"] == "assigned":
                            for target in parameter["targets"]:
                                value = caller.f_locals.get(target)
                                if isinstance(value, (tuple, list, set, dict)):
                                    for name in argument_names:
                                        if frame.f_locals.get(name) is value:
                                            frames[id(frame)]["parameterBindings"][name] = parameter["id"]
                        if parameter.get("callLine") == caller.f_lineno and parameter.get("callee") == frame.f_code.co_name:
                            name = None
                            if parameter["role"] == "keyword":
                                name = parameter["targets"][0]
                            elif parameter["role"] == "call-vector" and formal.vararg is not None:
                                name = formal.vararg.arg
                            elif parameter["role"] == "positional" and parameter["argumentIndex"] < len(argument_names):
                                name = argument_names[parameter["argumentIndex"]]
                            if name is not None:
                                frames[id(frame)]["parameterBindings"][name] = parameter["id"]
        record = frames.get(id(frame))
        if record is None:
            return None
        if event == "line":
            active = record["active"]
            for loop in loop_by_function.get(record["functionId"], []):
                if frame.f_lineno == loop["line"]:
                    record["ready"].add(loop["id"])
            for loop_id in list(active):
                row = active[loop_id]["source"]
                if not row["bodyLine"] <= frame.f_lineno <= row["endLine"]:
                    del active[loop_id]
            for loop in loop_by_function.get(record["functionId"], []):
                if frame.f_lineno == loop["bodyLine"] and loop["id"] in record["ready"]:
                    record["ready"].remove(loop["id"])
                    ordinal = record["counts"].get(loop["id"], 0) + 1
                    record["counts"][loop["id"]] = ordinal
                    parents = [item["event"]["id"] for item in active.values()
                               if item["source"]["line"] < loop["line"] and item["source"]["endLine"] >= loop["endLine"]]
                    parent_key = (loop["id"], *parents)
                    child_ordinal = record["parentCounts"].get(parent_key, 0) + 1
                    record["parentCounts"][parent_key] = child_ordinal
                    item = {"id": f"{current['test']}::{record['functionId']}::{record['invocationOrdinal']}::{loop['id']}::{ordinal}",
                            "test": current["test"], "functionId": record["functionId"],
                            "invocationOrdinal": record["invocationOrdinal"], "loopId": loop["id"],
                            "ordinal": ordinal, "indexWithinParent": child_ordinal,
                            "parentIterationIds": parents,
                            "bindings": {name: context_value(name, frame.f_locals[name]) for name in loop["targets"]}}
                    parameter_id = loop.get("literalParameterId")
                    iterable = loop_nodes[loop["id"]].iter
                    if parameter_id is None and isinstance(iterable, ast.Name):
                        parameter_id = record["parameterBindings"].get(iterable.id)
                        if parameter_id is None:
                            value = frame.f_locals.get(iterable.id, frame.f_globals.get(iterable.id))
                            for parameter in source["literalParameters"]:
                                if parameter["role"] == "assigned":
                                    owner = frame.f_locals if parameter["functionId"] == record["functionId"] else (
                                        frame.f_globals if parameter["functionId"] == f"module:{path}" else {})
                                    if any(owner.get(target) is value and value is not None for target in parameter["targets"]):
                                        parameter_id = parameter["id"]
                                        break
                    if parameter_id is not None:
                        item["literalParameterId"] = parameter_id
                        if child_ordinal > parameters[parameter_id]["itemCount"]:
                            raise RuntimeError("loop expanded beyond its independent literal declaration")
                    iterations.append(item)
                    active[loop["id"]] = {"source": loop, "event": item}
        if event == "return":
            frames.pop(id(frame), None)
        return tracer

    def object_value(node, frame):
        if isinstance(node, ast.Name):
            if node.id in frame.f_locals:
                return frame.f_locals[node.id]
            return frame.f_globals[node.id] if node.id in frame.f_globals else getattr(builtins, node.id)
        if isinstance(node, ast.Subscript):
            index = object_value(node.slice, frame) if isinstance(node.slice, ast.Name) else ast.literal_eval(node.slice)
            return object_value(node.value, frame)[index]
        if isinstance(node, ast.Attribute):
            return getattr(object_value(node.value, frame), node.attr)
        raise TypeError("hash target needs an explicitly supported source path")

    def identity_base(value):
        base = value.citation if isinstance(value, Resource) else value
        return base if isinstance(base, (IdCitation, UnknownCitation)) or (
            isinstance(base, CaseCitation) and base.groups.get("page") is None) else None

    def identity_slot(value):
        table = current["identities"]
        if id(value) not in table:
            table[id(value)] = (value, len(table))
        return table[id(value)][1]

    def operand(expression, value, frame):
        target = None
        if isinstance(expression, ast.Call):
            if isinstance(expression.func, ast.Name) and expression.func.id == "hash":
                target = object_value(expression.args[0], frame)
            elif isinstance(expression.func, ast.Attribute) and expression.func.attr == "__hash__":
                target = object_value(expression.func.value, frame)
        base = identity_base(target if target is not None else value)
        if base is not None:
            return {"kind": "identity-hash" if target is not None else "identity-value",
                    "identitySlot": identity_slot(base), "target": normal(target if target is not None else value)}
        return {"kind": "value", "value": normal(value)}

    def producer_context(frame, declaration):
        function = function_nodes[declaration["functionId"]]
        dependencies, stops = {}, set()
        for node in local_nodes(function):
            if isinstance(node, ast.For):
                stops.update(names(node.target))
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if node.value is not None:
                    for target in targets:
                        for name in names(target):
                            dependencies.setdefault(name, set()).update(names(node.value))
        wanted = names(nodes[declaration["id"]]) - {"self"}
        frame_record = frames.get(id(frame))
        if frame_record is not None:
            for item in frame_record["active"].values():
                wanted.update(item["source"]["targets"])
        pending, seen = list(wanted), set()
        while pending:
            name = pending.pop()
            if name in seen or name == "self":
                continue
            seen.add(name)
            if name not in stops:
                pending.extend(dependencies.get(name, set()) - seen)
        values = {}
        for name in sorted(seen):
            if name in frame.f_locals:
                values[name] = context_value(name, frame.f_locals[name])
            elif name in frame.f_globals:
                values[name] = context_value(name, frame.f_globals[name])
            elif hasattr(builtins, name):
                values[name] = context_value(name, getattr(builtins, name))
        stack, cursor = [], frame
        while cursor is not None:
            record = frames.get(id(cursor))
            if record is not None:
                stack.append({"functionId": record["functionId"], "invocationOrdinal": record["invocationOrdinal"],
                              "iterationIds": [item["event"]["id"] for item in record["active"].values()]})
            cursor = cursor.f_back
        return {"values": values, "frames": stack}

    def relation(name, args, receiver):
        if name in ("assertEqual", "assertNotEqual", "assertListEqual"):
            return {"kind": "comparison", "equal": args[0] == args[1]}
        if name in ("assertTrue", "assertFalse"):
            return {"kind": "truth", "truth": bool(args[0])}
        if name == "assertIsNone":
            return {"kind": "none", "isNone": args[0] is None}
        if name == "assertIn":
            return {"kind": "membership", "contains": args[0] in args[1]}
        if name == "assert_not_called":
            return {"kind": "mock", "callCount": receiver.call_count}
        if name == "assertResolution":
            return {"kind": "helper-invocation"}
        if name == "assertRaises":
            return {"kind": "raises", "expectedType": normal(args[0])}
        raise RuntimeError(f"unclassified assertion: {name}")

    def instrument(original):
        @functools.wraps(original)
        def wrapped(receiver, *args, **kwargs):
            frame = inspect.currentframe().f_back
            path = relative_path(frame)
            if path is None:
                return original(receiver, *args, **kwargs)
            declaration = declarations.get((path, frame.f_lineno))
            if declaration is None:
                raise RuntimeError(f"assertion lacks static declaration: {path}:{frame.f_lineno}")
            key = (current["test"], declaration["id"])
            ordinal = assertion_counts.get(key, 0) + 1
            assertion_counts[key] = ordinal
            expression = nodes[declaration["id"]]
            item = {"id": f"{current['test']}::{declaration['id']}::{ordinal}", "test": current["test"],
                    "declarationId": declaration["id"], "ordinal": ordinal, "assertion": original.__name__,
                    "operands": [operand(node, value, frame) for node, value in zip(expression.args, args)],
                    "keywordArguments": normal(kwargs), "context": producer_context(frame, declaration),
                    "relation": relation(original.__name__, args, receiver)}
            if len(item["operands"]) != len(args):
                raise RuntimeError("dynamic positional assertion expansion needs an explicit source adapter")
            events.append(item)
            if original.__name__ == "assertRaises":
                context = original(receiver, *args, **kwargs)

                class RaisedContext:
                    def __enter__(self):
                        return context.__enter__()

                    def __exit__(self, kind, value, traceback):
                        result = context.__exit__(kind, value, traceback)
                        item["relation"].update({"actualType": normal(kind), "actualMessage": str(value)})
                        item["passed"] = True
                        return result
                return RaisedContext()
            result = original(receiver, *args, **kwargs)
            item["passed"] = True
            return result
        return wrapped

    classes = {unittest.TestCase, NonCallableMock}
    def collect(node):
        if isinstance(node, unittest.TestSuite):
            for child in node:
                collect(child)
        else:
            classes.add(type(node))
    collect(suite)
    patches = []
    for cls in classes:
        for name, value in list(vars(cls).items()):
            if name.startswith("assert") and callable(value):
                patches.append((cls, name, value))
                setattr(cls, name, instrument(value))

    class Result(unittest.TextTestResult):
        def startTest(self, test):
            current.update({"test": test.id(), "identities": {}})
            super().startTest(test)

    try:
        sys.settrace(tracer)
        result = unittest.TextTestRunner(verbosity=1, resultclass=Result).run(suite)
    finally:
        sys.settrace(None)
        for cls, name, value in patches:
            setattr(cls, name, value)
    if not result.wasSuccessful() or any(not row.get("passed") for row in events):
        raise RuntimeError("instrumented assertion suite did not pass")
    observed = {item["declarationId"] for item in events}
    if observed != {row["id"] for row in source["declarations"]}:
        raise RuntimeError("static assertion declarations and observed expansions do not reconcile")
    return events, iterations, artifacts, result.testsRun


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root, output = args.oracle_root.resolve(), args.output.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if sys.version_info[:2] != (3, 11) or os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("Python 3.11 and interpreter-startup PYTHONHASHSEED=0 required")
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness gate failed")
    source, nodes, function_nodes, loop_nodes = source_inventory(root)
    os.chdir(root)
    sys.path.insert(0, str(root))
    operation_tool = load_tool("citation_operation_exporter", "export-operations.py")
    events, iterations, artifacts, tests_run = capture(root, source, nodes, function_nodes, loop_nodes, operation_tool)
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed during export")
    encoded_events = []
    for event in events:
        payload = canonical({key: value for key, value in event.items() if key not in
                             ("id", "test", "declarationId", "ordinal", "assertion")})
        encoded_events.append({key: event[key] for key in ("id", "test", "declarationId", "ordinal", "assertion")} |
                              {"payload": payload, "normalizedSha256": sha(payload.encode())})
    report = {"schemaVersion": "citation-oracle-assertions/v1", "scope": "assertion/iteration observations; not target parity proof",
              "commit": PIN, "tree": TREE, "python": sys.version.split()[0], "clockDate": CLOCK, "hashSeed": "0",
              "normalizationVersion": "assertion-values/v1", "testsRun": tests_run,
              "license": "BSD-2-Clause", "licenseSha256": sha((root / "LICENSE").read_bytes()),
              "lockSha256": sha((root / "uv.lock").read_bytes()), "exporterSha256": sha(Path(__file__).read_bytes()),
              "normalizerSha256": sha(Path(operation_tool.__file__).read_bytes()),
              "source": source, "iterations": iterations, "events": encoded_events,
              "artifacts": {key: {"kind": value["kind"], "payload": canonical(value["value"])}
                            for key, value in artifacts.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    head = {key: value for key, value in report.items() if key not in ("iterations", "events", "artifacts")}
    text = json.dumps(head, ensure_ascii=False, indent=2)[:-2] + ',\n  "iterations": [\n'
    text += ",\n".join("    " + canonical(row) for row in iterations)
    text += '\n  ],\n  "events": [\n'
    text += ",\n".join("    " + canonical(row) for row in encoded_events)
    text += '\n  ],\n  "artifacts": {\n'
    text += ",\n".join("    " + canonical(key) + ":" + canonical(value) for key, value in sorted(report["artifacts"].items()))
    text += "\n  }\n}\n"
    output.write_text(text)
    print(f"declarations={len(source['declarations'])}; assertions={len(events)}; iterations={len(iterations)}; artifacts={len(artifacts)}; methods={tests_run}")


if __name__ == "__main__":
    main()
