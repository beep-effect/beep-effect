import { it } from "@beep/test-runner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";

// Bun imports the standalone skill script, then calls only its pure argument
// and rendering boundaries with inert consumers. No ontology artifact is read.
const argumentBoundaryProbe = `
import { strict as assert } from "node:assert";
const { runArgumentBoundary } = await import(process.argv[1]);
function runArgs(args) {
  const calls = [];
  let stderr = "";
  const status = runArgumentBoundary(args, "synthetic usage", {
    validate: (root, options) => { calls.push([root, options]); },
    selfTest: () => assert.fail("self-test must not execute"),
    printRunId: () => assert.fail("rotation must not execute"),
    writeUsage: (message, isStderr) => { if (isStderr) stderr += message + "\\n"; },
  });
  return status === undefined ? ["validation-boundary", calls] : ["exit", status, stderr, calls];
}
const missing = runArgs(["synthetic-root", "--repo"]);
assert.deepEqual(missing.slice(0, 2), ["exit", 2]);
assert.ok(missing[2].includes("--repo requires a repository path"));
assert.deepEqual(missing[3], []);
assert.deepEqual(runArgs(["synthetic-root"]), [
  "validation-boundary", [["synthetic-root", { gate: false, repo: null }]],
]);
assert.deepEqual(runArgs(["synthetic-root", "--repo", "synthetic-repo", "--gate"]), [
  "validation-boundary", [["synthetic-root", { gate: true, repo: "synthetic-repo" }]],
]);
console.log("argument boundary passed; artifact validation never executed");
`;

const flagRenderingProbe = `
import { strict as assert } from "node:assert";
const { renderFlag } = await import(process.argv[1]);
const samples = ["ordinary evidence", "needs evidence" + String.fromCharCode(27) + "[2J" + String.fromCharCode(10) + "FORGED",
  String.fromCharCode(127, 133), "literal " + String.fromCharCode(92) + "x1b"];
const rendered = samples.map(sample => {
  const line = renderFlag(sample);
  assert.ok(line.startsWith("FLAGGED - "));
  return line.slice("FLAGGED - ".length);
});
assert.equal(rendered.length, samples.length);
assert.ok(rendered.every(value => !/[\\x00-\\x1f\\x7f-\\x9f]/.test(value)));
assert.equal(rendered[0], samples[0]);
assert.equal(rendered[1], "needs evidence" + String.fromCharCode(92) + "x1b[2J" + String.fromCharCode(92) + "x0aFORGED");
assert.equal(rendered[2], String.fromCharCode(92) + "x7f" + String.fromCharCode(92) + "x85");
assert.equal(rendered[3], samples[3]);
console.log("flag boundary passed; controls escaped without artifact validation");
`;

const diagnosticRenderingProbe = `
import { strict as assert } from "node:assert";
const { renderDiagnostic, reportUnreadableManifest } = await import(process.argv[1]);
const samples = ["ordinary diagnostic", "synthetic-path" + String.fromCharCode(27) + "[2J" + String.fromCharCode(10) + "FORGED",
  String.fromCharCode(127, 133), "literal " + String.fromCharCode(92) + "x1b"];
const rendered = samples.map(sample => {
  const line = renderDiagnostic(sample);
  assert.ok(line.startsWith(" - "));
  return line.slice(" - ".length);
});
assert.equal(rendered.length, samples.length);
const controlFree = value => !/[\\x00-\\x1f\\x7f-\\x9f]/.test(value);
assert.ok(rendered.every(controlFree));
assert.equal(rendered[0], samples[0]);
assert.equal(rendered[3], samples[3]);
assert.equal(rendered[1], "synthetic-path" + String.fromCharCode(92) + "x1b[2J" + String.fromCharCode(92) + "x0aFORGED");
const exceptions = samples.map(sample => {
  const rows = [];
  reportUnreadableManifest(sample, (message, stderr) => { rows.push({ message, stderr }); });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stderr, true);
  return rows[0].message;
});
assert.ok(exceptions.every(controlFree));
assert.equal(exceptions[0], "refusing: manifest unreadable (ordinary diagnostic)");
console.log("diagnostic boundaries passed; no artifact validation");
`;

const runBoundaryProbe = Effect.fnUntraced(function* (probe: string) {
  const path = yield* Path.Path;
  const source = yield* path.fromFileUrl(
    new URL(
      "../../../../../.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.ts",
      import.meta.url
    )
  );
  const handle = yield* ChildProcess.make("bun", ["--no-env-file", "--eval", probe, source], {
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
    { concurrency: 3 }
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
  it.effect("escapes violation and unreadable-manifest diagnostics without changing ordinary text", () =>
    Effect.gen(function* () {
      const [exitCode, stdout, stderr] = yield* runBoundaryProbe(diagnosticRenderingProbe);
      expect(exitCode, stderr).toBe(0);
      expect(stdout).toContain("diagnostic boundaries passed; no artifact validation");
    })
  );
});
