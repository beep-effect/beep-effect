/**
 * Boundary contract for the immutable observation-proof digest exception in `.gitleaks.toml`.
 *
 * Every scan uses a disposable directory with synthetic inputs, the repository's actual scanner
 * configuration, and redacted JSON findings. No Git history, ignore fingerprints, or operator
 * credentials participate. The scan cases need the CI-pinned Gitleaks (8.30.1) on PATH and skip
 * without it; the configuration case always runs.
 */
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Toml from "effect/encoding/Toml";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const CONFIG = new URL("../../../../../.gitleaks.toml", import.meta.url);
const RECEIPT = "goals/agent-observability-foundation/ops/history/" + "integrated-package-proof-20261102.json";
const SOURCE_KEY = "packages/tooling/library/ai-metrics/test/" + "CredentialBank.test.ts";
const PUBLIC_DIGEST = "ca09bb72ba118d3a521f469c5e4c4898f0904421a180b9d83fdea1ab93ce0793";
const SYNTHETIC_GITHUB_VALUE = "ghp_" + "7Hh2vK9mR4sT6wY8zB3dF5jL1nP0qXcVUaEe";

// Deliberately generated from a public, deterministic test label, never a key.
const syntheticValue = Effect.gen(function* () {
  const digest = yield* Digest.Digest;
  const bytes = yield* digest.digest(
    Digest.sha256,
    new TextEncoder().encode("public observation scanner boundary fixture")
  );
  return Base64.encode(bytes);
});

const digestLine = (key: string = SOURCE_KEY, value: string = PUBLIC_DIGEST): string => `    "${key}": "${value}",`;

const document = (...lines: ReadonlyArray<string>): string => `{\n${A.join(lines, "\n")}\n    "fixture": true\n}\n`;

// Gitleaks patterns are RE2; these use only syntax JavaScript reads the same way outside `u` mode.
const fullMatch = (pattern: string, input: string): boolean => new RegExp(`^(?:${pattern})$`).test(input);

const GitleaksAllowlist = S.Struct({
  description: S.optionalKey(S.String),
  targetRules: S.String.pipe(S.Array, S.optionalKey),
  condition: S.optionalKey(S.String),
  regexTarget: S.optionalKey(S.String),
  paths: S.String.pipe(S.Array, S.optionalKey),
  regexes: S.String.pipe(S.Array, S.optionalKey),
});
const GitleaksConfig = S.Struct({ allowlists: S.Array(GitleaksAllowlist) });
const GitleaksReport = S.Struct({ RuleID: S.String }).pipe(S.Array, S.fromJsonString);

const runGitleaks = Effect.fn("GitleaksObservationDigestTest.run")(function* (
  args: ReadonlyArray<string>,
  cwd: string
) {
  const handle = yield* ChildProcess.make("gitleaks", args, { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  // Drain both streams so the scanner never blocks; never echo them, they may carry findings.
  const [exitCode] = yield* Effect.all(
    [handle.exitCode, handle.stdout.pipe(Stream.runDrain), handle.stderr.pipe(Stream.runDrain)],
    { concurrency: "unbounded" }
  );
  return exitCode;
}, Effect.scoped);

const gitleaksOnPath = await Effect.runPromise(
  runGitleaks(["version"], ".").pipe(
    Effect.map((exitCode) => exitCode === 0),
    Effect.orElseSucceed(() => false),
    Effect.provide(NodeServices.layer)
  )
);

const scan = Effect.fn("GitleaksObservationDigestTest.scan")(function* (target: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* path.fromFileUrl(CONFIG);
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-gitleaks-boundary-" });
  const source = path.join(root, "source");
  const file = path.join(source, target);
  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* fs.writeFileString(file, content);
  const report = path.join(root, "report.json");
  const exitCode = yield* runGitleaks(
    ["dir", ".", "--config", config, "--report-format", "json", "--report-path", report, "--redact", "--no-banner"],
    source
  ).pipe(Effect.timeout("30 seconds"));
  expect(A.contains([0, 1], exitCode), "Gitleaks did not complete a scan").toBe(true);
  const reported = yield* fs.exists(report);
  expect(reported, "Gitleaks did not create a JSON report").toBe(true);
  const reportText = yield* fs.readFileString(report);
  const findings = yield* S.decodeEffect(GitleaksReport)(reportText);
  expect(exitCode).toBe(A.isReadonlyArrayNonEmpty(findings) ? 1 : 0);
  return A.map(findings, (finding) => finding.RuleID);
}, Effect.scoped);

it.layer(TestLayer, { timeout: "120 seconds" })("gitleaks observation digest allowlist", (it) => {
  it.effect("exception pins rule, path and complete line", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const configPath = yield* path.fromFileUrl(CONFIG);
      const text = yield* fs.readFileString(configPath);
      const parsed = yield* Effect.fromResult(Toml.parse(text));
      const config = yield* S.decodeUnknownEffect(GitleaksConfig)(parsed);
      const matches = A.filter(config.allowlists, (item) =>
        A.some(item.paths ?? [], (allowedPath) => Str.includes("integrated")(allowedPath))
      );
      expect(A.length(matches)).toBe(1);
      const exception = O.getOrThrow(A.head(matches));
      expect(exception.targetRules).toEqual(["generic-api-key"]);
      expect(exception.condition).toBe("AND");
      expect(exception.regexTarget).toBe("line");
      expect(exception.paths).toHaveLength(1);
      expect(exception.regexes).toHaveLength(1);
      const pathPattern = O.getOrThrow(A.head(exception.paths ?? []));
      const linePattern = O.getOrThrow(A.head(exception.regexes ?? []));
      for (const allowed of [RECEIPT, `/repo/${RECEIPT}`]) {
        expect(fullMatch(pathPattern, allowed), allowed).toBe(true);
      }
      for (const rejected of [`other/${RECEIPT}`, `${RECEIPT}.bak`, Str.replace("20261102", "20261103")(RECEIPT)]) {
        expect(fullMatch(pathPattern, rejected), rejected).toBe(false);
      }
      expect(fullMatch(linePattern, digestLine())).toBe(true);
      expect(fullMatch(linePattern, `${digestLine()} "api_key": "extra",`)).toBe(false);
    })
  );

  it.effect.skipIf(!gitleaksOnPath)("known public digest is allowed at only the receipt path", () =>
    Effect.gen(function* () {
      const atReceipt = yield* scan(RECEIPT, document(digestLine()));
      expect(atReceipt).toEqual([]);
      const elsewhere = yield* scan("outside/receipt.json", document(digestLine()));
      expect(elsewhere).toContain("generic-api-key");
    })
  );

  it.effect.skipIf(!gitleaksOnPath)("changed digest, changed key and synthetic token remain detected", () =>
    Effect.gen(function* () {
      const synthetic = yield* syntheticValue;
      const cases = [
        digestLine(SOURCE_KEY, `d${Str.slice(1)(PUBLIC_DIGEST)}`),
        digestLine(Str.replace(".test.ts", ".changed.test.ts")(SOURCE_KEY)),
        digestLine(SOURCE_KEY, synthetic),
      ];
      for (const [index, line] of A.map(cases, (line, index) => [index, line] as const)) {
        const rules = yield* scan(RECEIPT, document(line));
        expect(rules, `case ${index}`).toContain("generic-api-key");
      }
    })
  );

  it.effect.skipIf(!gitleaksOnPath)("another detector on the same line or another line remains detected", () =>
    Effect.gen(function* () {
      const other = `    "github_token": "${SYNTHETIC_GITHUB_VALUE}",`;
      const cases: ReadonlyArray<ReadonlyArray<string>> = [[digestLine() + other], [digestLine(), other]];
      for (const [index, lines] of A.map(cases, (lines, index) => [index, lines] as const)) {
        const rules = yield* scan(RECEIPT, document(...lines));
        expect(rules, `case ${index}`).toContain("github-pat");
      }
    })
  );
});
