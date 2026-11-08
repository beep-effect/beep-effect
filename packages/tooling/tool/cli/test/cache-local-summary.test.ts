import { CacheLocalPilotSummary } from "@beep/repo-cli/commands/Cache";
import {
  CACHE_LOCAL_SUMMARY_LIMIT,
  CACHE_LOCAL_SUMMARY_REFUSAL,
  readBoundedRegularFile,
  summarizeCacheLocalObservation,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Ported from the retired ci-cache-local-summary.test.py. Its preparation
// controls (both request layouts, the exit-64 refusals and foreign-input
// cleanup) live in ci-cache-pilot.test.ts with the commands they cover.

const LocalPilotSummaryJson = S.fromJsonString(CacheLocalPilotSummary);
const decodeSummary = S.decodeEffect(LocalPilotSummaryJson);
const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const MAIN_ENTRY = "packages/tooling/tool/cli/src/bin.ts";
const REVISION = Str.repeat(40)("a");
const SYNTHETIC = "SYNTHETIC_NOT_A_REAL_SECRET_7351";
const CLIENT = { version: "2.11.10", sha256: Str.repeat(64)("b"), namespace: "team_beep_local_observation_v1" };
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const fixture = (): { report: Record<string, unknown>; request: Record<string, unknown> } => ({
  request: { channel: "stable", client: CLIENT, selection: "full" },
  report: {
    schemaVersion: "cache-pilot-local/v5",
    authority: "local-observation-only",
    sourceRevision: REVISION,
    channel: "stable",
    client: CLIENT,
    key: { computation: "@beep/types#lint" },
    selection: "full",
    checks: [{ name: "bounded-control", passed: true }],
    runs: [{}],
    mutations: [{}],
    nonExecutions: [{}],
  },
});

const sha256Hex = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  const hash = yield* digest.digest(Digest.sha256, bytes);
  return Hex.encode(hash);
});

const summarize = Effect.fnUntraced(function* (report: unknown, request: unknown) {
  const reportText = yield* encodeJson(report);
  const requestText = yield* encodeJson(request);
  const raw = encoder.encode(reportText);
  const summary = yield* summarizeCacheLocalObservation(
    raw,
    encoder.encode(requestText),
    REVISION,
    "stable",
    "@beep/types#lint"
  );
  return { raw, text: decoder.decode(summary), summary: yield* decodeSummary(decoder.decode(summary)) };
});

// The real Bun executable, not a version-manager wrapper on PATH.
const bunExecutable = (): string => {
  const result = Bun.spawnSync(["bun", "-e", "console.log(process.execPath)"], { stdout: "pipe", stderr: "pipe" });
  assert.strictEqual(result.exitCode, 0, result.stderr.toString());
  return Str.trim(result.stdout.toString());
};

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "60 seconds" })(
  "hosted local observation summary",
  (it) => {
    it.effect("projects a synthetic payload onto redacted digests and counts", () =>
      Effect.gen(function* () {
        const { report, request } = fixture();
        report.privatePath = `/private/${SYNTHETIC}`;
        report.runs = [{ stdout: SYNTHETIC }];
        report.checks = [{ name: SYNTHETIC, passed: false }];
        const projected = yield* summarize(report, request);
        expect(projected.text).not.toContain(SYNTHETIC);
        expect(projected.text).not.toContain("/private/");
        expect(projected.summary.allChecksPassed).toBe(false);
        expect(projected.summary.qualificationGranted).toBe(false);
        expect(projected.summary.failedLabelSha256).toEqual([yield* sha256Hex(encoder.encode(SYNTHETIC))]);
        const receiptSha256 = yield* sha256Hex(projected.raw);
        expect(projected.summary.privateReceipt.sha256).toBe(receiptSha256);
      })
    );

    it.effect("refuses a wrong source, authority, selection or client and non-boolean results", () =>
      Effect.gen(function* () {
        const { report: original, request } = fixture();
        for (const [field, value] of [
          ["sourceRevision", Str.repeat(40)("c")],
          ["authority", "qualified"],
          ["selection", "controls"],
          ["client", { ...CLIENT, sha256: Str.repeat(64)("c") }],
          ["checks", [{ name: "fixture", passed: "true" }]],
          ["runs", []],
        ] as const) {
          const refused = yield* summarize({ ...original, [field]: value }, request).pipe(Effect.flip);
          expect(refused, field).toBe("refused");
        }
      })
    );

    it.effect("bounds the fan-out and the published failure labels", () =>
      Effect.gen(function* () {
        const { report, request } = fixture();
        const checks = A.makeBy(100, (n) => ({ name: `control-${n}`, passed: false }));
        const projected = yield* summarize({ ...report, checks }, request);
        expect(A.length(projected.summary.failedLabelSha256)).toBe(64);
        expect(projected.summary.omittedFailedLabels).toBe(36);
        const fanout = A.flatten(A.replicate(checks, 11));
        const observed1 = yield* summarize({ ...report, checks: fanout }, request).pipe(Effect.flip);
        expect(observed1).toBe("refused");
      })
    );

    it.effect("reads bounded regular files and refuses aliases, FIFOs and overflow", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cache-local-summary-reader-" });
        const file = path.join(directory, "receipt");
        yield* fs.writeFileString(file, "fixture");
        const bounded = yield* readBoundedRegularFile(file, 7);
        expect(decoder.decode(bounded)).toBe("fixture");
        const observed2 = yield* readBoundedRegularFile(file, 6).pipe(Effect.flip);
        expect(observed2).toBe("refused");
        const alias = path.join(directory, "alias");
        yield* fs.symlink(file, alias);
        const observed3 = yield* readBoundedRegularFile(alias, 7).pipe(Effect.flip);
        expect(observed3).toBe("refused");
        const fifo = path.join(directory, "fifo");
        const made = Bun.spawnSync(["mkfifo", fifo], { stdout: "pipe", stderr: "pipe" });
        assert.strictEqual(made.exitCode, 0, made.stderr.toString());
        const observed4 = yield* readBoundedRegularFile(fifo, 7).pipe(Effect.flip);
        expect(observed4).toBe("refused");
        const empty = path.join(directory, "empty");
        yield* fs.writeFileString(empty, "");
        const observed5 = yield* readBoundedRegularFile(empty, 7).pipe(Effect.flip);
        expect(observed5).toBe("refused");
      })
    );

    it.effect("publishes exclusively, with the adapter's bytes and no private values", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const directory = yield* fs
          .makeTempDirectoryScoped({ prefix: "cache-local-summary-" })
          .pipe(Effect.flatMap(fs.realPath));
        const { report, request } = fixture();
        // The golden fixture: one passing and one failing (non-ASCII) label,
        // captured from the retired Python adapter on 2026-11-07.
        const golden = {
          ...report,
          checks: [
            { name: "bounded-control", passed: true },
            { name: "failing-ü", passed: false },
          ],
          mutations: [{}, {}],
          privatePayload: "SECRET",
        };
        const goldenJson = yield* encodeJson(golden);
        // `json.dumps` framing: spaced separators and an escaped non-ASCII label.
        const pythonFraming = Str.replaceAll(
          "\u00fc",
          "\\u00fc"
        )(Str.replaceAll(",", ", ")(Str.replaceAll(":", ": ")(goldenJson)));
        const source = path.join(directory, "report.json");
        yield* fs.writeFileString(source, pythonFraming);
        const input = path.join(directory, "request.json");
        const requestJson = yield* encodeJson(request);
        yield* fs.writeFileString(input, requestJson);
        const output = path.join(directory, "public.json");
        const command = [
          bunExecutable(),
          path.join(root, MAIN_ENTRY),
          "ci",
          "cache-local-summary",
          "--report",
          source,
          "--request",
          input,
          "--output",
          output,
          "--revision",
          REVISION,
          "--channel",
          "stable",
          "--computation",
          "@beep/types#lint",
        ];
        const env = { PATH: yield* Config.String("PATH"), HOME: yield* Config.String("HOME") };
        const first = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
        expect(first.exitCode, first.stderr.toString()).toBe(0);
        const published = yield* fs.readFileString(output);
        expect(published).toBe(
          '{"allChecksPassed":false,"authority":"local-observation-only","channel":"stable","client":{"sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","version":"2.11.10"},"computation":"@beep/types#lint","counts":{"checks":2,"failedChecks":1,"mutations":2,"nonExecutions":1,"runs":1},"failedLabelSha256":["2d9b6e44b0e054d1b0efb5b32e8d71087036a11b1171e0e32e161f2bfcf783d4"],"omittedFailedLabels":0,"privateReceipt":{"bytes":577,"sha256":"5ecf1d2930beaf7ad80c13ea5760eddcbb6a796f0b16459a35308fc2899ead54"},"qualificationGranted":false,"schemaVersion":"cache-local-observation-summary/v1","sourceRevision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n'
        );
        expect(`${published}${first.stdout.toString()}${first.stderr.toString()}`).not.toContain("SECRET");
        expect(encoder.encode(published).byteLength).toBeLessThanOrEqual(CACHE_LOCAL_SUMMARY_LIMIT);
        expect((yield* fs.stat(output)).mode & 0o777).toBe(0o600);
        const decoded = yield* decodeSummary(published);
        expect(decoded.qualificationGranted).toBe(false);
        expect(decoded.authority).toBe("local-observation-only");
        const observed6 = yield* decodeJson(published);
        expect(observed6).toBeTruthy();
        const second = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
        expect(second.exitCode).toBe(1);
        expect(second.stdout.toString()).toBe("");
        expect(second.stderr.toString()).toBe(`${CACHE_LOCAL_SUMMARY_REFUSAL}\n`);
        const observed7 = yield* fs.readFileString(output);
        expect(observed7).toBe(published);
      })
    );
  }
);
