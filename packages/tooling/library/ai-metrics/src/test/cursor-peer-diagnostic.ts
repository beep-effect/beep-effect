/**
 * Synthetic-only helper instrumentation. Never used by the production receiver.
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Wrap the exact hash-pinned helper AST without changing its predicate values or short-circuit order.
 * Suppress its projected callback/peer output; report only closed diagnostic metadata.
 * Additional observation changes timing, so this is predicate evidence for this diagnostic occurrence.
 * **Example** (Inspect the offline bootstrap)
 * ```ts
 * import { cursorPeerDiagnosticBootstrap } from "@beep/repo-ai-metrics/test/cursor-peer-diagnostic"
 * console.log(cursorPeerDiagnosticBootstrap.length > 0)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const cursorPeerDiagnosticBootstrap = String.raw`
import ast
import copy
import hashlib
import json
import sys

_closed_checks = {}
_closed_allowed = set()
_closed_phase = "bootstrap"
_closed_last = "bootstrap"
_closed_role = "unknown"
_closed_emitted = False
_closed_hash_matches = False
_closed_ast_matches = True
_closed_order_matches = True
_closed_prints_suppressed = 0

def _closed_probe(key, evaluate):
    global _closed_phase, _closed_last
    if key.startswith("public_digest."):
        key = _closed_role + "." + key
    _closed_phase = "public_digest" if ".public_digest." in key else key.split(".")[0]
    _closed_last = key
    value = evaluate()
    if type(value) not in (bool, int):
        raise ValueError()
    row = _closed_checks.setdefault(key, {"observedTrue": False, "observedFalse": False})
    row["observedTrue" if bool(value) else "observedFalse"] = True
    return value

def _closed_digest(role, *args):
    global _closed_role
    _closed_role = role
    return public_digest(*args)

def _closed_reject(key):
    global _closed_phase, _closed_last
    if key.startswith("public_digest."):
        key = _closed_role + "." + key
    _closed_phase = "public_digest" if ".public_digest." in key else key.split(".")[0]
    _closed_last = key
    _closed_checks[key] = {"observedTrue": True, "observedFalse": False}
    return reject()

def _closed_enter(name):
    global _closed_phase, _closed_last
    _closed_phase = name
    _closed_last = (_closed_role + "." if name == "public_digest" else "") + name + ".enter"
    _closed_allowed.add(_closed_last)

def _closed_finish(ok, error):
    global _closed_emitted
    if _closed_emitted:
        return
    _closed_emitted = True
    names = {"ValueError", "PermissionError", "FileNotFoundError", "ProcessLookupError",
             "TimeoutError", "OSError", "JSONDecodeError", "UnicodeDecodeError",
             "AttributeError", "KeyError", "StopIteration", "ConnectionResetError", "BrokenPipeError"}
    name = "None" if error is None else type(error).__name__
    if name not in names and name != "None":
        name = "Unknown"
    known = {key: value for key, value in _closed_checks.items() if key in _closed_allowed}
    phase = "complete" if ok else _closed_phase
    if phase not in {"bootstrap", "bounded_json", "public_digest", "process", "observe", "serve", "complete"}:
        phase = "bootstrap"
    predicate = _closed_last if _closed_last in _closed_allowed else "bootstrap"
    print(json.dumps({"diagnostic": "cursor-peer-diagnostic/v1", "ok": bool(ok),
          "phase": phase, "predicate": predicate, "exceptionClass": name,
          "sourceHashMatches": _closed_hash_matches,
          "predicateAstPreserved": _closed_ast_matches,
          "shortCircuitOrderPreserved": _closed_order_matches,
          "projectedPrintSuppressed": _closed_prints_suppressed == 1,
          "checks": known}, separators=(",", ":")), flush=True)

class _ClosedUnwrap(ast.NodeTransformer):
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id == "_closed_probe":
            return self.visit(node.args[1].body)
        if isinstance(node.func, ast.Name) and node.func.id == "_closed_digest":
            return ast.copy_location(ast.Call(func=ast.Name(id="public_digest", ctx=ast.Load()),
                   args=[self.visit(a) for a in node.args[1:]], keywords=node.keywords), node)
        if isinstance(node.func, ast.Name) and node.func.id == "_closed_reject":
            return ast.copy_location(ast.Call(func=ast.Name(id="reject", ctx=ast.Load()), args=[], keywords=[]), node)
        return self.generic_visit(node)

class _ClosedInstrument(ast.NodeTransformer):
    def __init__(self):
        self.function = "bootstrap"

    def _wrap(self, key, expression):
        global _closed_ast_matches
        unwrapped = _ClosedUnwrap().visit(copy.deepcopy(expression))
        result = ast.Call(func=ast.Name(id="_closed_probe", ctx=ast.Load()),
                 args=[ast.Constant(key), ast.Lambda(args=ast.arguments(posonlyargs=[], args=[], vararg=None, kwonlyargs=[], kw_defaults=[], kwarg=None, defaults=[]), body=expression)], keywords=[])
        restored = _ClosedUnwrap().visit(copy.deepcopy(result))
        _closed_ast_matches = _closed_ast_matches and ast.dump(restored) == ast.dump(unwrapped)
        roles = ("source.", "runtime.", "unknown.") if key.startswith("public_digest.") else ("",)
        for role in roles:
            _closed_allowed.add(role + key)
        return ast.copy_location(result, expression)

    def visit_FunctionDef(self, node):
        previous = self.function
        self.function = node.name
        result = self.generic_visit(node)
        if node.name in {"bounded_json", "public_digest", "process", "observe", "serve"}:
            result.body.insert(0, ast.Expr(value=ast.Call(func=ast.Name(id="_closed_enter", ctx=ast.Load()), args=[ast.Constant(node.name)], keywords=[])))
        self.function = previous
        return result

    def visit_BoolOp(self, node):
        original = copy.deepcopy(node)
        node = self.generic_visit(node)
        node.values = [self._wrap(self.function + ".b" + str(node.lineno) + "." + str(i), value)
                       for i, value in enumerate(node.values)]
        global _closed_ast_matches
        _closed_ast_matches = _closed_ast_matches and ast.dump(original) == ast.dump(_ClosedUnwrap().visit(copy.deepcopy(node)))
        return node

    def visit_If(self, node):
        original = copy.deepcopy(node.test)
        node = self.generic_visit(node)
        node.test = self._wrap(self.function + ".i" + str(node.lineno), node.test)
        global _closed_ast_matches
        _closed_ast_matches = _closed_ast_matches and ast.dump(original) == ast.dump(_ClosedUnwrap().visit(copy.deepcopy(node.test)))
        return node

    def visit_Call(self, node):
        node = self.generic_visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == "reject":
            if node.args or node.keywords:
                raise ValueError()
            key = self.function + ".r" + str(node.lineno)
            roles = ("source.", "runtime.", "unknown.") if self.function == "public_digest" else ("",)
            for role in roles:
                _closed_allowed.add(role + key)
            return ast.copy_location(ast.Call(func=ast.Name(id="_closed_reject", ctx=ast.Load()), args=[ast.Constant(key)], keywords=[]), node)
        if isinstance(node.func, ast.Name) and node.func.id == "public_digest":
            maximum = node.args[1]
            if not isinstance(maximum, ast.Constant) or maximum.value not in (8388608, 268435456):
                raise ValueError()
            role = "source" if maximum.value == 8388608 else "runtime"
            node = ast.copy_location(ast.Call(func=ast.Name(id="_closed_digest", ctx=ast.Load()),
                   args=[ast.Constant(role)] + node.args, keywords=node.keywords), node)
        return node

    def visit_Expr(self, node):
        global _closed_prints_suppressed
        value = node.value
        if isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id == "print":
            if len(value.args) == 1 and isinstance(value.args[0], ast.Constant) and value.args[0].value == '{"ready":true}':
                return node
            if self.function != "serve":
                raise ValueError()
            _closed_prints_suppressed += 1
            return ast.copy_location(ast.Pass(), node)
        return self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        if self.function == "bootstrap":
            if not isinstance(node.type, ast.Name) or node.type.id != "Exception":
                raise ValueError()
            node.name = "_closed_exception"
            node.body = ast.parse("_closed_finish(False, _closed_exception)\nsys.exit(2)").body
            return node
        return self.generic_visit(node)

def _closed_self_check():
    global _closed_order_matches, _closed_phase, _closed_last
    events = []
    def value(label, result):
        events.append(label)
        return result
    for operator in ("and", "or"):
        for left in (False, True):
            for right in (False, True):
                expression = ast.parse("value('left', left) " + operator + " value('right', right)", mode="eval")
                original = compile(expression, "<closed-semantic-check>", "eval")
                transformed = copy.deepcopy(expression)
                transformed.body = _ClosedInstrument().visit_BoolOp(transformed.body)
                transformed = ast.fix_missing_locations(transformed)
                events.clear()
                environment = {"value": value, "left": left, "right": right, "_closed_probe": _closed_probe}
                expected = eval(original, environment)
                expected_order = tuple(events)
                events.clear()
                actual = eval(compile(transformed, "<closed-semantic-check>", "eval"), environment)
                _closed_order_matches = _closed_order_matches and actual == expected and tuple(events) == expected_order
    _closed_checks.clear()
    _closed_allowed.clear()
    _closed_phase = "bootstrap"
    _closed_last = "bootstrap"

try:
    _closed_self_check()
    header = json.loads(sys.stdin.buffer.readline(32769))
    source = header["source"]
    expected = "51c439c4d3f37f571a66127058e607ecedc762922b5bd57ae7b76e26d64422c3"
    _closed_hash_matches = (hashlib.sha256(source.encode("utf-8")).hexdigest() == expected and
                            header["sha256"] == expected)
    if not _closed_hash_matches or len(source.encode("utf-8")) > 16384:
        raise ValueError()
    tree = ast.parse(source)
    transformed = ast.fix_missing_locations(_ClosedInstrument().visit(tree))
    if not _closed_ast_matches or not _closed_order_matches or _closed_prints_suppressed != 1:
        raise ValueError()
    exec(compile(transformed, "<closed-helper-diagnostic>", "exec"), globals())
    _closed_finish(True, None)
except SystemExit:
    raise
except BaseException as error:
    _closed_finish(False, error)
    sys.exit(2)
`;
