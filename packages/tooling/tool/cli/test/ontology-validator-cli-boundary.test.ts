import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";

// Only the main argument boundary is compiled. Imports, validator functions,
// self-tests and ontology artifacts are never executed or constructed.
const argumentBoundaryProbe = `
import ast
import io
import sys
from pathlib import Path
from types import SimpleNamespace

source = Path(sys.argv[1]).read_text(encoding="utf-8")
tree = ast.parse(source)
main = next(node for node in tree.body
            if isinstance(node, ast.If)
            and isinstance(node.test, ast.Compare)
            and isinstance(node.test.left, ast.Name)
            and node.test.left.id == "__name__"
            and any(isinstance(value, ast.Constant) and value.value == "__main__"
                    for value in node.test.comparators))
code = compile(ast.Module(body=main.body, type_ignores=[]), "argument-boundary", "exec")

class ReachedValidationBoundary(Exception):
    pass

def run_args(args):
    calls = []
    def stop_at_validation(root, **options):
        calls.append((str(root), options))
        raise ReachedValidationBoundary()
    def stop_at_exit(status):
        raise SystemExit(status)
    fake_sys = SimpleNamespace(argv=["validate_artifacts.py", *args],
                               stderr=io.StringIO(), exit=stop_at_exit)
    namespace = {"sys": fake_sys, "Path": Path,
                 "validate_dir": stop_at_validation, "__doc__": "synthetic usage"}
    try:
        exec(code, namespace)
    except ReachedValidationBoundary:
        return ("validation-boundary", calls)
    except SystemExit as error:
        return ("exit", error.code, fake_sys.stderr.getvalue(), calls)
    raise AssertionError("argument boundary returned unexpectedly")

missing = run_args(["synthetic-root", "--repo"])
assert missing[0:2] == ("exit", 2), missing
assert "--repo requires a repository path" in missing[2], missing
assert missing[3] == [], missing
assert run_args(["synthetic-root"]) == (
    "validation-boundary", [("synthetic-root", {"gate": False, "repo": None})])
assert run_args(["synthetic-root", "--repo", "synthetic-repo", "--gate"]) == (
    "validation-boundary", [("synthetic-root", {"gate": True, "repo": "synthetic-repo"})])
print("argument boundary passed; artifact validation never executed")
`;

// Only the pure formatter and final flag loop run, using an inert print sink.
const flagRenderingProbe = `
import ast
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text(encoding="utf-8")
tree = ast.parse(source)
safe_text = next(node for node in tree.body
                 if isinstance(node, ast.FunctionDef) and node.name == "safe_text")
main = next(node for node in tree.body
            if isinstance(node, ast.If)
            and isinstance(node.test, ast.Compare)
            and isinstance(node.test.left, ast.Name)
            and node.test.left.id == "__name__")
loops = [node for node in main.body
         if isinstance(node, ast.For)
         and isinstance(node.iter, ast.Name) and node.iter.id == "flags"]
assert len(loops) == 1
rendered = []
samples = ["ordinary evidence", "needs evidence" + chr(27) + "[2J" + chr(10) + "FORGED",
           chr(127) + chr(133), "literal " + chr(92) + "x1b"]
namespace = {"flags": samples, "print": lambda *args: rendered.append(args)}
module = ast.Module(body=[safe_text, loops[0]], type_ignores=[])
exec(compile(module, "isolated-flag-rendering", "exec"), namespace)
assert len(rendered) == len(samples), repr(rendered)
assert all(row[0] == "FLAGGED -" for row in rendered), repr(rendered)
assert all(not any(ord(c) < 32 or 127 <= ord(c) <= 159 for c in row[1])
           for row in rendered), repr(rendered)
assert rendered[0][1] == samples[0]
assert rendered[1][1] == "needs evidence" + chr(92) + "x1b[2J" + chr(92) + "x0aFORGED", repr(rendered[1])
assert rendered[2][1] == chr(92) + "x7f" + chr(92) + "x85", repr(rendered[2])
assert rendered[3][1] == samples[3], repr(rendered[3])
print("flag boundary passed; controls escaped without artifact validation")
`;

const runBoundaryProbe = Effect.fnUntraced(function* (probe: string) {
  const path = yield* Path.Path;
  const source = yield* path.fromFileUrl(
    new URL(
      "../../../../../.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py",
      import.meta.url
    )
  );
  const handle = yield* ChildProcess.make("python3", ["-c", probe, source], {
    env: { PYTHONDONTWRITEBYTECODE: "1", PYTHONHASHSEED: "0" },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  return yield* Effect.all(
    [
      handle.exitCode,
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
    ],
    { concurrency: "unbounded" }
  );
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
  it.effect("refuses a missing --repo operand before artifact validation and preserves valid arguments", () =>
    Effect.gen(function* () {
      const [exitCode, stdout, stderr] = yield* runBoundaryProbe(argumentBoundaryProbe);
      expect(exitCode, stderr).toBe(0);
      expect(stdout).toContain("argument boundary passed; artifact validation never executed");
    })
  );
  it.effect("escapes flag control bytes while preserving ordinary and already-escaped evidence", () =>
    Effect.gen(function* () {
      const [exitCode, stdout, stderr] = yield* runBoundaryProbe(flagRenderingProbe);
      expect(exitCode, stderr).toBe(0);
      expect(stdout).toContain("flag boundary passed; controls escaped without artifact validation");
    })
  );
});
