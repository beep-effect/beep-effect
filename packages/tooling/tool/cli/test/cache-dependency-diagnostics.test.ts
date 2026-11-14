import {
  CacheDependencyDiagnosticLimits,
  CacheDependencyDiagnosticRefusalReport,
  CacheDependencyDiagnosticReport,
  CacheDependencyPublicationPlan,
} from "@beep/repo-cli/commands/Cache";
import {
  compareCacheDiagnosticSource,
  encodeCacheDiagnosticJson,
  inspectCacheDependencyTree,
  observeCacheDependencies,
  planCacheDiagnosticPublication,
  readCacheDiagnosticSource,
  snapshotCacheDependencies,
  writeCacheDependencyDiagnostic,
} from "@beep/repo-cli/test/Cache";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeSpawner } from "./helpers/cache-host-fakes.ts";
import type { CacheDependencyDiagnosticCode } from "@beep/repo-cli/commands/Cache";

const revision = A.join(A.replicate("a", 40), "");
const otherRevision = A.join(A.replicate("b", 40), "");
const defaults = CacheDependencyDiagnosticLimits.make({});
const utf8 = new TextEncoder();
const text = new TextDecoder();
const hexDigest = (bytes: Uint8Array) => Hex.encode(sha256(bytes));
const encodeSource = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(CacheDependencyDiagnosticReport));
const decodeRefusal = S.decodeUnknownEffect(S.fromJsonString(CacheDependencyDiagnosticRefusalReport));

const run = (command: ReadonlyArray<string>, cwd: string) => {
  const result = Bun.spawnSync([...command], { cwd, stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/bin:/bin" } });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

const fixture = Effect.fn("CacheDependencyDiagnosticsTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "dependency-diagnostic-test-" });
  yield* fs.makeDirectory(path.join(root, "node_modules/example"), { recursive: true });
  const payload = path.join(root, "node_modules/example/index.js");
  yield* fs.writeFileString(payload, "PRIVATE_PAYLOAD_SENTINEL_001");
  return { fs, path, root, payload, source: path.join(root, "source.json") };
});
type Fixture = Effect.Success<ReturnType<typeof fixture>>;

const deadlineIn = (millis: number) => Effect.map(Clock.currentTimeMillis, (now) => now + millis);
const snapshot = (f: Fixture, limits = defaults) =>
  Effect.flatMap(deadlineIn(10_000), (deadline) => snapshotCacheDependencies(f.root, deadline, limits));
const fileDigest = (f: Fixture, file: string) => Effect.map(f.fs.readFile(file), hexDigest);
const fileMode = (f: Fixture, file: string) => Effect.map(f.fs.stat(file), (info) => Number(info.mode) & 0o777);

const writeSource = Effect.fn("CacheDependencyDiagnosticsTest.writeSource")(function* (f: Fixture, digest?: string) {
  const observed = yield* snapshot(f);
  const body = yield* encodeSource({
    schemaVersion: "cache-producer-workflow/v2",
    revision,
    toolchain: { installedDependencies: { format: "canonical-gnu-tar/v1", sha256: digest ?? observed.sha256 } },
  });
  yield* f.fs.writeFileString(f.source, body);
});

const observe = Effect.fn("CacheDependencyDiagnosticsTest.observe")(function* (f: Fixture) {
  yield* writeSource(f);
  const [bytes, status] = yield* observeCacheDependencies(f.root, f.source, revision, defaults);
  const body = text.decode(bytes);
  expect(status).toBe(0);
  expect(body).not.toContain("PRIVATE_PAYLOAD_SENTINEL");
  expect(body).not.toContain(f.root);
  const source = yield* f.fs.readFile(f.source);
  expect(bytes.length + source.length).toBeLessThanOrEqual(defaults.artifactBytes);
  const report = yield* decodeReport(body);
  return { report, body };
});

const refusalCode = <A, R>(effect: Effect.Effect<A, { readonly code: string }, R>) =>
  Effect.map(Effect.flip(effect), ({ code }) => code);

const exampleRow = (report: CacheDependencyDiagnosticReport) => O.getOrThrow(A.get(report.first.groups, 1));

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))("installed dependency drift diagnostics", (it) => {
  it.effect("binds the production digest and never replaces private evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const dependencies = yield* inspectCacheDependencyTree(f.root, []);
      yield* writeSource(f, dependencies.sha256);
      const output = f.path.join(f.root, "diagnostic.json");
      const status = yield* writeCacheDependencyDiagnostic(f.root, f.source, output, revision, defaults);
      assertSome(status, 0);
      const original = yield* f.fs.readFile(output);
      const report = yield* decodeReport(text.decode(original));
      const sourceDigest = yield* fileDigest(f, f.source);
      const mode = yield* fileMode(f, output);
      expect(report.status).toBe("stable-match");
      assertTrue(report.snapshotsEqual);
      assertTrue(report.declaredDigestMatches);
      expect(report.revision).toBe(revision);
      expect(report.sourceReportSha256).toBe(sourceDigest);
      expect(report.second.changedCount).toBe(0);
      expect(mode).toBe(0o600);
      const rerun = yield* writeCacheDependencyDiagnostic(f.root, f.source, output, revision, defaults);
      assertNone(rerun);
      const after = yield* f.fs.readFile(output);
      expect(after).toEqual(original);
    })
  );

  it.effect("distinguishes same-size content, modes and link targets", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const before = (yield* observe(f)).report;
      yield* f.fs.writeFileString(f.payload, "PRIVATE_PAYLOAD_SENTINEL_002");
      const changed = (yield* observe(f)).report;
      expect(before.first.sha256).not.toBe(changed.first.sha256);
      expect(exampleRow(before).slice(1, 4)).toEqual(exampleRow(changed).slice(1, 4));
      expect(exampleRow(before)[4]).not.toBe(exampleRow(changed)[4]);
      expect(exampleRow(before).slice(5)).toEqual(exampleRow(changed).slice(5));
      yield* f.fs.chmod(f.payload, 0o700);
      const mode = (yield* observe(f)).report;
      expect(exampleRow(changed)[4]).toBe(exampleRow(mode)[4]);
      expect(exampleRow(changed)[5]).not.toBe(exampleRow(mode)[5]);
      const link = f.path.join(f.root, "node_modules/example/link");
      yield* f.fs.symlink("index.js", link);
      const firstLink = (yield* observe(f)).report;
      yield* f.fs.remove(link);
      yield* f.fs.symlink("missing", link);
      const secondLink = (yield* observe(f)).report;
      expect(exampleRow(firstLink).slice(4, 6)).toEqual(exampleRow(secondLink).slice(4, 6));
      expect(exampleRow(firstLink)[6]).not.toBe(exampleRow(secondLink)[6]);
    })
  );

  it.effect("hashes selected node-gyp files without retaining names or payloads", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const directory = f.path.join(f.root, "node_modules/node-gyp");
      yield* f.fs.makeDirectory(directory);
      const source = f.path.join(directory, "PRIVATE_FILENAME_SENTINEL.py");
      const bytecode = f.path.join(directory, "PRIVATE_BYTECODE_FILENAME_SENTINEL.pyc");
      yield* f.fs.writeFileString(source, "PRIVATE_SOURCE_PAYLOAD_SENTINEL");
      yield* f.fs.writeFileString(bytecode, "PRIVATE_BYTECODE_PAYLOAD_001");
      yield* f.fs.symlink("/etc/passwd", f.path.join(directory, "outside"));
      const { report: before, body } = yield* observe(f);
      const details = O.getOrThrow(O.fromUndefinedOr(before.first.fileDetails));
      expect(details.group).toBe("node-gyp");
      expect(details.columns).toEqual(["nameSha256", "kind", "bytes", "contentSha256"]);
      expect(details.rows).toHaveLength(2);
      const sourceKey = hexDigest(utf8.encode("node_modules/node-gyp/PRIVATE_FILENAME_SENTINEL.py"));
      const bytecodeKey = hexDigest(utf8.encode("node_modules/node-gyp/PRIVATE_BYTECODE_FILENAME_SENTINEL.pyc"));
      const rowFor = (rows: typeof details.rows, key: string) =>
        O.getOrThrow(A.findFirst(rows, (row) => row[0] === key));
      const sourceDigest = yield* fileDigest(f, source);
      expect(rowFor(details.rows, sourceKey).slice(1)).toEqual(["python-source", 31, sourceDigest]);
      expect(rowFor(details.rows, bytecodeKey)[1]).toBe("python-bytecode");
      for (const secret of [
        "PRIVATE_FILENAME_SENTINEL.py",
        "PRIVATE_BYTECODE_FILENAME_SENTINEL.pyc",
        "PRIVATE_SOURCE_PAYLOAD_SENTINEL",
        "PRIVATE_BYTECODE_PAYLOAD_001",
        "/etc/passwd",
      ])
        expect(body).not.toContain(secret);
      yield* f.fs.writeFileString(bytecode, "PRIVATE_BYTECODE_PAYLOAD_002");
      const after = (yield* observe(f)).report;
      const afterRows = O.getOrThrow(O.fromUndefinedOr(after.first.fileDetails)).rows;
      expect(rowFor(afterRows, sourceKey)).toEqual(rowFor(details.rows, sourceKey));
      expect(rowFor(afterRows, bytecodeKey).slice(0, 3)).toEqual(rowFor(details.rows, bytecodeKey).slice(0, 3));
      expect(rowFor(afterRows, bytecodeKey)[3]).not.toBe(rowFor(details.rows, bytecodeKey)[3]);
      expect(before.first.sha256).not.toBe(after.first.sha256);
      expect(encodeCacheDiagnosticJson(details.rows).length).toBeLessThanOrEqual(defaults.fileDetailBytes);
    })
  );

  it.effect("refuses selected file-detail entry and byte overflow", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const directory = f.path.join(f.root, "node_modules/node-gyp");
      yield* f.fs.makeDirectory(directory);
      yield* f.fs.writeFileString(f.path.join(directory, "one.pyc"), "first");
      yield* f.fs.writeFileString(f.path.join(directory, "two.pyc"), "other");
      const entries = yield* refusalCode(snapshot(f, CacheDependencyDiagnosticLimits.make({ fileDetailEntries: 1 })));
      const bytes = yield* refusalCode(snapshot(f, CacheDependencyDiagnosticLimits.make({ fileDetailBytes: 1 })));
      expect(entries).toBe("file-detail-entry-bound");
      expect(bytes).toBe("file-detail-byte-bound");
    })
  );

  it.effect("keeps a written bytecode cache visible in the raw digest", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const directory = f.path.join(f.root, "node_modules/node-gyp");
      yield* f.fs.makeDirectory(f.path.join(directory, "__pycache__"), { recursive: true });
      const source = f.path.join(directory, "sample.py");
      yield* f.fs.writeFileString(source, "VALUE = 42\n");
      const sourceDigest = yield* fileDigest(f, source);
      const before = yield* snapshot(f);
      const repeated = yield* snapshot(f);
      expect(repeated.sha256).toBe(before.sha256);
      yield* f.fs.writeFileString(f.path.join(directory, "__pycache__/sample.cpython-314.pyc"), "BYTECODE");
      const sourceAfter = yield* fileDigest(f, source);
      const after = yield* snapshot(f);
      expect(sourceAfter).toBe(sourceDigest);
      expect(after.sha256).not.toBe(before.sha256);
    })
  );

  it.effect("normalizes timestamps out of the digest", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const before = (yield* observe(f)).report;
      yield* f.fs.utimes(f.payload, 1, 1);
      const after = (yield* observe(f)).report;
      expect(after.first).toEqual(before.first);
    })
  );

  it.effect("retains and refuses drift between the two passes", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* writeSource(f);
      const [bytes, status] = yield* observeCacheDependencies(f.root, f.source, revision, defaults, {
        afterFirstPass: Effect.orDie(f.fs.writeFileString(f.payload, "PRIVATE_PAYLOAD_SENTINEL_002")),
      });
      const report = yield* decodeReport(text.decode(bytes));
      expect(status).toBe(1);
      expect(report.status).toBe("refused-drift");
      assertTrue(report.declaredDigestMatches);
      expect(report.snapshotsEqual).toBe(false);
      expect(report.second.changedCount).toBe(1);
    })
  );

  it.effect("refuses a stale revision or digest and a replaced source report", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* writeSource(f);
      const mismatch = yield* refusalCode(observeCacheDependencies(f.root, f.source, otherRevision, defaults));
      expect(mismatch).toBe("source-revision-mismatch");
      yield* f.fs.writeFileString(f.payload, "PRIVATE_PAYLOAD_SENTINEL_002");
      const [stale, staleStatus] = yield* observeCacheDependencies(f.root, f.source, revision, defaults);
      const staleReport = yield* decodeReport(text.decode(stale));
      expect(staleStatus).toBe(1);
      expect(staleReport.declaredDigestMatches).toBe(false);
      yield* writeSource(f);
      const [replaced, replacedStatus] = yield* observeCacheDependencies(f.root, f.source, revision, defaults, {
        afterSecondPass: Effect.orDie(
          Effect.flatMap(f.fs.readFileString(f.source), (body) => f.fs.writeFileString(f.source, `${body} `))
        ),
      });
      const replacedReport = yield* decodeReport(text.decode(replaced));
      expect(replacedStatus).toBe(1);
      expect(replacedReport.sourceUnchanged).toBe(false);
    })
  );

  it.effect("refuses a linked root, special entries and aggregate artifact overflow", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* writeSource(f);
      const modules = f.path.join(f.root, "node_modules");
      const actual = f.path.join(f.root, "actual");
      yield* f.fs.rename(modules, actual);
      yield* f.fs.symlink("actual", modules);
      const linked = yield* refusalCode(observeCacheDependencies(f.root, f.source, revision, defaults));
      expect(linked).toBe("dependency-root-not-physical");
      yield* f.fs.remove(modules);
      yield* f.fs.rename(actual, modules);
      expect(run(["mkfifo", f.path.join(modules, "special")], f.root).exitCode).toBe(0);
      const special = yield* refusalCode(observeCacheDependencies(f.root, f.source, revision, defaults));
      expect(special).toBe("archive-entry-type");
      yield* f.fs.remove(f.path.join(modules, "special"));
      const source = yield* f.fs.readFile(f.source);
      const tight = CacheDependencyDiagnosticLimits.make({ artifactBytes: source.length + 100 });
      const overflow = yield* refusalCode(observeCacheDependencies(f.root, f.source, revision, tight));
      expect(overflow).toBe("aggregate-artifact-bound");
    })
  );

  it.effect("groups packages, redacts unusual names and never follows links", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.makeDirectory(f.path.join(f.root, "node_modules/.bun/pkg@1.0/node_modules/pkg"), { recursive: true });
      yield* f.fs.writeFileString(f.path.join(f.root, "node_modules/.bun/pkg@1.0/node_modules/pkg/x.js"), "x");
      yield* f.fs.makeDirectory(f.path.join(f.root, "node_modules/@scope/pkg"), { recursive: true });
      yield* f.fs.makeDirectory(f.path.join(f.root, "node_modules/SECRET NAME"));
      yield* f.fs.symlink("/etc/passwd", f.path.join(f.root, "node_modules/example/absolute"));
      const report = (yield* observe(f)).report;
      const labels = A.map(report.first.groups, (row) => row[0]);
      expect(labels).toContain(".bun/pkg@1.0");
      expect(labels).toContain("@scope/pkg");
      expect(labels).not.toContain("SECRET NAME");
      assertTrue(A.some(labels, Str.startsWith("opaque:")));
      expect(A.reduce(report.first.groups, 0, (total, row) => total + row[2])).toBe(2);
    })
  );

  it.effect("refuses stream, group and deadline overflow", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const stream = yield* refusalCode(snapshot(f, CacheDependencyDiagnosticLimits.make({ streamBytes: 64 })));
      const groups = yield* refusalCode(snapshot(f, CacheDependencyDiagnosticLimits.make({ groups: 1 })));
      const past = yield* deadlineIn(-1);
      const deadline = yield* refusalCode(snapshotCacheDependencies(f.root, past, defaults));
      expect(stream).toBe("archive-stream-bound");
      expect(groups).toBe("group-bound");
      expect(deadline).toBe("deadline");
    })
  );

  it.effect("does not read symlinked or FIFO source reports", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* writeSource(f);
      const alias = f.path.join(f.root, "alias.json");
      yield* f.fs.symlink(f.source, alias);
      const linked = yield* refusalCode(readCacheDiagnosticSource(alias, defaults));
      expect(linked).toBe("filesystem-or-process-failed");
      const fifo = f.path.join(f.root, "fifo.json");
      expect(run(["mkfifo", fifo], f.root).exitCode).toBe(0);
      const special = yield* refusalCode(readCacheDiagnosticSource(fifo, defaults));
      expect(special).toBe("source-not-regular");
    })
  );

  it.effect("compares every source byte and the length in chunks", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const original = new Uint8Array(128 * 1024 + 4).fill(0x61);
      original.set(utf8.encode("tail"), 128 * 1024);
      yield* f.fs.writeFile(f.source, original);
      const read = yield* readCacheDiagnosticSource(f.source, defaults);
      expect(read).toEqual(original);
      const same = yield* compareCacheDiagnosticSource(f.source, original, defaults);
      assertTrue(same);
      for (const index of [0, 64 * 1024, original.length - 1]) {
        const changed = original.slice();
        changed[index] = (changed[index] ?? 0) ^ 1;
        yield* f.fs.writeFile(f.source, changed);
        const equal = yield* compareCacheDiagnosticSource(f.source, original, defaults);
        expect(equal).toBe(false);
      }
      for (const changed of [original.slice(0, -1), new Uint8Array([...original, ...utf8.encode("extra")])]) {
        yield* f.fs.writeFile(f.source, changed);
        const equal = yield* compareCacheDiagnosticSource(f.source, original, defaults);
        expect(equal).toBe(false);
      }
    })
  );

  it.effect("retains only a fixed refusal code for each failure class", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const cases: ReadonlyArray<readonly [string, string | undefined, CacheDependencyDiagnosticCode]> = [
        ["missing", undefined, "filesystem-or-process-failed"],
        ["not-json", "PRIVATE_EXCEPTION_PAYLOAD_SENTINEL", "invalid-value-or-shape"],
        ["list", "[1]", "invalid-value-or-shape"],
        [
          "no-toolchain",
          `{"schemaVersion":"cache-producer-workflow/v2","revision":"${revision}"}`,
          "invalid-value-or-shape",
        ],
        ["version", `{"schemaVersion":"v1"}`, "source-version"],
      ];
      for (const [name, body, code] of cases) {
        yield* f.fs.remove(f.source, { force: true });
        if (body !== undefined) yield* f.fs.writeFileString(f.source, body);
        const output = f.path.join(f.root, `refusal-${name}.json`);
        const status = yield* writeCacheDependencyDiagnostic(f.root, f.source, output, revision, defaults);
        assertSome(status, 1);
        const raw = yield* f.fs.readFile(output);
        const decoded = yield* decodeRefusal(text.decode(raw));
        const mode = yield* fileMode(f, output);
        expect(decoded).toEqual(
          CacheDependencyDiagnosticRefusalReport.make({
            schemaVersion: "cache-dependency-diagnostics/v1",
            status: "refused",
            code,
          })
        );
        expect(text.decode(raw)).toBe(
          `{"code":"${code}","schemaVersion":"cache-dependency-diagnostics/v1","status":"refused"}\n`
        );
        expect(text.decode(raw)).not.toContain("PRIVATE_EXCEPTION_PAYLOAD_SENTINEL");
        expect(text.decode(raw)).not.toContain(f.root);
        expect(mode).toBe(0o600);
        expect(raw.length).toBeLessThanOrEqual(256);
      }
    })
  );

  it.effect("caps publication on combined size and refuses special paths", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const source = f.path.join(f.root, "publication-source.json");
      const diagnostic = f.path.join(f.root, "publication-diagnostic.json");
      const tight = CacheDependencyDiagnosticLimits.make({ artifactBytes: 12 });
      const cases: ReadonlyArray<readonly [number, number, boolean, boolean]> = [
        [3, 8, true, true],
        [4, 8, true, true],
        [5, 8, false, true],
        [12, 1, false, true],
        [13, 1, false, true],
        [4, 13, true, false],
        [13, 13, false, false],
      ];
      for (const [sourceSize, diagnosticSize, sourceExpected, diagnosticExpected] of cases) {
        yield* f.fs.writeFileString(source, A.join(A.replicate("s", sourceSize), ""));
        yield* f.fs.writeFileString(diagnostic, A.join(A.replicate("d", diagnosticSize), ""));
        const plan = yield* planCacheDiagnosticPublication(source, diagnostic, tight);
        expect(plan).toEqual(
          CacheDependencyPublicationPlan.make({ source: sourceExpected, diagnostic: diagnosticExpected })
        );
        const retained = (plan.source ? sourceSize : 0) + (plan.diagnostic ? diagnosticSize : 0);
        expect(retained).toBeLessThanOrEqual(12);
      }
      yield* f.fs.writeFileString(source, "source");
      yield* f.fs.remove(diagnostic);
      const missing = yield* planCacheDiagnosticPublication(source, diagnostic, defaults);
      expect(missing).toEqual(CacheDependencyPublicationPlan.make({ source: true, diagnostic: false }));
      const alias = f.path.join(f.root, "publication-link");
      yield* f.fs.symlink(source, alias);
      const linked = yield* planCacheDiagnosticPublication(alias, source, defaults);
      expect(linked).toEqual(CacheDependencyPublicationPlan.make({ source: false, diagnostic: true }));
      const fifo = f.path.join(f.root, "publication-fifo");
      expect(run(["mkfifo", fifo], f.root).exitCode).toBe(0);
      const special = yield* planCacheDiagnosticPublication(fifo, source, defaults);
      expect(special).toEqual(CacheDependencyPublicationPlan.make({ source: false, diagnostic: true }));
    })
  );

  it.effect("prints only fixed publication flags from the real CLI and writes nothing", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const repoRoot = yield* findRepoRoot();
      const bin = f.path.join(repoRoot, "packages/tooling/tool/cli/src/bin.ts");
      const source = f.path.join(f.root, "publication-source.json");
      const diagnostic = f.path.join(f.root, "publication-diagnostic.json");
      yield* f.fs.writeFileString(source, "PRIVATE_SOURCE_SENTINEL");
      yield* f.fs.writeFileString(diagnostic, "PRIVATE_DIAGNOSTIC_SENTINEL");
      // The CLI entry reads `Bun.argv`, so it always runs under bun, whichever runtime hosts vitest;
      // `run` isolates PATH, so resolve bun's absolute path from the inherited PATH first.
      const bunExecutable = Str.trim(
        Bun.spawnSync(["bun", "-e", "console.log(process.execPath)"], { stdout: "pipe" }).stdout.toString()
      );
      const command = [
        bunExecutable,
        bin,
        "cache",
        "producer-diagnose",
        "--publication-only",
        "--source-report",
        source,
        "--output",
        diagnostic,
        "--revision",
        revision,
      ];
      const complete = run(command, f.root);
      expect(complete.exitCode, complete.stderr).toBe(0);
      expect(complete.stdout).toBe("source=true\ndiagnostic=true\n");
      const sourceText = yield* f.fs.readFileString(source);
      const diagnosticText = yield* f.fs.readFileString(diagnostic);
      expect(sourceText).toBe("PRIVATE_SOURCE_SENTINEL");
      expect(diagnosticText).toBe("PRIVATE_DIAGNOSTIC_SENTINEL");
      yield* f.fs.remove(diagnostic);
      const missing = run(command, f.root);
      expect(missing.exitCode).toBe(1);
      expect(missing.stdout).toBe("source=true\ndiagnostic=false\n");
      const sourceAfter = yield* f.fs.readFileString(source);
      const recreated = yield* f.fs.exists(diagnostic);
      expect(sourceAfter).toBe("PRIVATE_SOURCE_SENTINEL");
      expect(recreated).toBe(false);
    })
  );
});

// ---------------------------------------------------------------------------
// Synthetic tar streams served by a faked `tar` child.
// ---------------------------------------------------------------------------

interface TarEntry {
  readonly body?: string;
  readonly corrupt?: boolean;
  readonly fields?: Readonly<Record<number, Uint8Array>>;
  readonly linkname?: string;
  readonly name: string;
  readonly nameBytes?: Uint8Array;
  readonly prefix?: string;
  readonly size?: number;
  readonly type?: string;
}

const putField = (block: Uint8Array, offset: number, value: Uint8Array | string) =>
  block.set(P.isString(value) ? utf8.encode(value) : value, offset);
const octalField = (value: number, width: number) => `${Str.padStart(width - 1, "0")(value.toString(8))}\0`;

const tarHeader = (entry: TarEntry, size: number) => {
  const block = new Uint8Array(512);
  putField(block, 0, entry.nameBytes ?? entry.name);
  putField(block, 100, octalField(0o644, 8));
  putField(block, 108, octalField(0, 8));
  putField(block, 116, octalField(0, 8));
  putField(block, 124, octalField(size, 12));
  putField(block, 136, octalField(0, 12));
  putField(block, 148, "        ");
  putField(block, 156, entry.type ?? "0");
  putField(block, 157, entry.linkname ?? "");
  putField(block, 257, "ustar\u000000");
  putField(block, 345, entry.prefix ?? "");
  for (const [offset, value] of R.toEntries(entry.fields ?? {})) putField(block, Number(offset), value);
  const sum = A.reduce(block, entry.corrupt === true ? 1 : 0, (total, byte) => total + byte);
  putField(block, 148, `${Str.padStart(6, "0")(sum.toString(8))}\0 `);
  return block;
};

const tarEntry = (entry: TarEntry): ReadonlyArray<Uint8Array> => {
  const body = utf8.encode(entry.body ?? "");
  const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
  padded.set(body);
  return [tarHeader(entry, entry.size ?? body.length), padded];
};

const tarArchive = (entries: ReadonlyArray<TarEntry>, end = true) =>
  A.appendAll(A.flatMap(entries, tarEntry), end ? [new Uint8Array(1024)] : []);

const paxLine = ([key, value]: readonly [string, string]) => {
  const tail = ` ${key}=${value}\n`;
  const length = utf8.encode(tail).length;
  return `${length + `${length + `${length}`.length}`.length}${tail}`;
};
const paxEntry = (records: ReadonlyArray<readonly [string, string]>, type = "x"): TarEntry => ({
  name: "PaxHeaders/entry",
  type,
  body: A.join(A.map(records, paxLine), ""),
});
const base256 = (...bytes: ReadonlyArray<number>) => Uint8Array.from(bytes);

const tarRoot = Effect.fn("CacheDependencyDiagnosticsTest.tarRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "dependency-diagnostic-tar-" });
  yield* fs.makeDirectory(path.join(root, "node_modules"));
  return root;
}, Effect.orDie);

const snapshotTar = Effect.fn("CacheDependencyDiagnosticsTest.snapshotTar")(function* (
  chunks: ReadonlyArray<Uint8Array>,
  limits = defaults,
  exitCode = 0
) {
  const root = yield* tarRoot();
  const deadline = yield* deadlineIn(10_000);
  return yield* snapshotCacheDependencies(root, deadline, limits).pipe(
    Effect.provideService(
      ChildProcessSpawner.ChildProcessSpawner,
      fakeSpawner(() => Effect.succeed({ chunks, exitCode }))
    )
  );
});

const richArchive = [
  ...tarArchive(
    [
      { name: "node_modules/", type: "5" },
      paxEntry([["comment", "global"]], "g"),
      paxEntry([
        ["path", "node_modules/renamed"],
        ["path", "node_modules/pax/file.js/"],
        ["uname", "alice"],
        ["gname", "staff"],
        ["uid", "1_000"],
        ["gid", "not-a-number"],
        ["mtime", "12.5"],
        ["size", "5"],
        ["linkpath", "unused"],
        ["comment", "local"],
      ]),
      { name: "ignored", body: "hello" },
      { name: "././@LongLink", type: "L", body: `node_modules/long/${Str.repeat(120)("n")}\0` },
      { name: "placeholder", body: "x" },
      { name: "././@LongLink", type: "K", body: Str.repeat(120)("t") },
      { name: "node_modules/long/link", type: "2" },
      { name: "././@LongLink", type: "L", body: "node_modules/long/dir/" },
      { name: "dir", type: "5" },
      { name: "file.js", prefix: "node_modules/prefixed", body: "p" },
      {
        name: "node_modules/numeric/file",
        body: "n",
        fields: {
          108: base256(0x80, 0, 0, 0, 0, 0, 0x03, 0xe8),
          116: base256(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe),
        },
      },
      { name: "node_modules/node-gyp/Makefile", body: "all:" },
    ],
    false
  ),
  new Uint8Array(0),
  new Uint8Array(1024),
  utf8.encode("bytes after the archive end"),
];

const V7_DIRECTORY = tarArchive([{ name: "node_modules/v7dir/", type: "\0" }]);

const refusals: ReadonlyArray<
  readonly [string, ReadonlyArray<Uint8Array>, CacheDependencyDiagnosticLimits, CacheDependencyDiagnosticCode]
> = [
  ["an empty stream", [], defaults, "archive-read-failed"],
  ["a truncated header", [new Uint8Array(100)], defaults, "archive-read-failed"],
  ["a corrupt first header", tarArchive([{ name: "node_modules/a", corrupt: true }]), defaults, "archive-read-failed"],
  [
    "a non-ASCII number",
    tarArchive([{ name: "node_modules/a", fields: { 100: base256(0x37, 0xc0) } }]),
    defaults,
    "archive-read-failed",
  ],
  [
    "a non-octal number",
    tarArchive([{ name: "node_modules/a", fields: { 100: utf8.encode("9999999\0") } }]),
    defaults,
    "archive-read-failed",
  ],
  ["a non-UTF-8 name", tarArchive([{ name: "", nameBytes: base256(0x6e, 0xff) }]), defaults, "invalid-value-or-shape"],
  [
    "an oversized pax header",
    tarArchive([paxEntry([["comment", Str.repeat(100)("x")]])]),
    CacheDependencyDiagnosticLimits.make({ headerBytes: 64 }),
    "archive-header-bound",
  ],
  ["a truncated pax header", tarArchive([{ ...paxEntry([]), size: 600 }], false), defaults, "archive-read-failed"],
  ["a pax record without a length", tarArchive([{ ...paxEntry([]), body: "a=b\n" }]), defaults, "archive-read-failed"],
  ["a short pax record", tarArchive([{ ...paxEntry([]), body: "3 a\n" }]), defaults, "archive-read-failed"],
  [
    "a pax record without a keyword",
    tarArchive([{ ...paxEntry([]), body: "6 =ab\n" }]),
    defaults,
    "archive-read-failed",
  ],
  ["a pax header at the archive end", tarArchive([paxEntry([["comment", "x"]])]), defaults, "archive-read-failed"],
  [
    "a GNU sparse size",
    tarArchive([
      paxEntry([
        ["GNU.sparse.name", "node_modules/sparse/file"],
        ["GNU.sparse.realsize", "1"],
        ["GNU.sparse.size", "1"],
      ]),
      { name: "placeholder", body: "s" },
    ]),
    defaults,
    "archive-entry-bound",
  ],
  [
    "a sparse 1.0 member",
    tarArchive([
      paxEntry([
        ["GNU.sparse.major", "1"],
        ["GNU.sparse.minor", "0"],
      ]),
      { name: "node_modules/s", body: "s" },
    ]),
    defaults,
    "archive-entry-bound",
  ],
  [
    "a sparse map",
    tarArchive([paxEntry([["GNU.sparse.map", "0,1"]]), { name: "node_modules/s", body: "s" }]),
    defaults,
    "archive-entry-bound",
  ],
  [
    "an invalid sparse size",
    tarArchive([paxEntry([["GNU.sparse.size", "five"]]), { name: "node_modules/s", body: "s" }]),
    defaults,
    "invalid-value-or-shape",
  ],
  [
    "too many entries",
    tarArchive([
      { name: "node_modules/a", body: "a" },
      { name: "node_modules/b", body: "b" },
    ]),
    CacheDependencyDiagnosticLimits.make({ entries: 1 }),
    "entry-bound",
  ],
  [
    "a long link target",
    tarArchive([{ name: "node_modules/a", type: "2", linkname: Str.repeat(90)("t") }]),
    CacheDependencyDiagnosticLimits.make({ headerBytes: 64 }),
    "archive-link-bound",
  ],
  [
    "an oversized pax mapping",
    tarArchive([paxEntry([["comment", Str.repeat(20)("x")]]), { name: "node_modules/a", body: "a" }]),
    CacheDependencyDiagnosticLimits.make({ headerBytes: 33 }),
    "archive-header-bound",
  ],
  ["a path outside node_modules", tarArchive([{ name: "other/file", body: "x" }]), defaults, "archive-path"],
  ["a parent traversal", tarArchive([{ name: "node_modules/../x", body: "x" }]), defaults, "archive-path"],
  [
    "an oversized path",
    tarArchive([{ name: `node_modules/${Str.repeat(80)("a")}`, body: "x" }]),
    CacheDependencyDiagnosticLimits.make({ headerBytes: 64 }),
    "archive-path-bound",
  ],
  ["a truncated payload", tarArchive([{ name: "node_modules/a", size: 600 }], false), defaults, "archive-read-failed"],
  [
    "truncated padding",
    [tarHeader({ name: "node_modules/a" }, 5), utf8.encode("hello")],
    defaults,
    "archive-read-failed",
  ],
  [
    "an unsupported entry type",
    tarArchive([{ name: "node_modules/device", type: "3" }]),
    defaults,
    "archive-entry-type",
  ],
];

const sourceDeclaration = (revisionValue: unknown, format: string, digest: string) => ({
  schemaVersion: "cache-producer-workflow/v2",
  revision: revisionValue,
  toolchain: { installedDependencies: { format, sha256: digest } },
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))("synthetic dependency archives", (it) => {
  it.effect("reads pax, GNU long-name, prefixed, base-256 and V7 members like tarfile", () =>
    Effect.gen(function* () {
      const observed = yield* snapshotTar(richArchive);
      expect(A.map(observed.groups, (row) => row[0])).toEqual([".", "long", "node-gyp", "numeric", "pax", "prefixed"]);
      const pax = O.getOrThrow(A.findFirst(observed.groups, (row) => row[0] === "pax"));
      expect([pax[1], pax[2], pax[3]]).toEqual([1, 1, 5]);
      const long = O.getOrThrow(A.findFirst(observed.groups, (row) => row[0] === "long"));
      expect([long[1], long[2]]).toEqual([3, 1]);
      const details = O.getOrThrow(O.fromUndefinedOr(observed.fileDetails));
      expect(A.map(details.rows, (row) => row[1])).toEqual(["other"]);
      const v7 = yield* snapshotTar(V7_DIRECTORY);
      expect(A.map(v7.groups, (row) => [row[0], row[1], row[2]])).toEqual([["v7dir", 1, 0]]);
    })
  );

  it.effect("ends at a later malformed header and drains the rest", () =>
    Effect.gen(function* () {
      const observed = yield* snapshotTar(
        tarArchive([
          { name: "node_modules/a/file", body: "a" },
          { name: "node_modules/b/file", corrupt: true },
        ])
      );
      expect(A.map(observed.groups, (row) => row[0])).toEqual(["a"]);
    })
  );

  it.effect.each(refusals)("refuses %s", ([, chunks, limits, code]) =>
    Effect.gen(function* () {
      const refused = yield* refusalCode(snapshotTar(chunks, limits));
      expect(refused).toBe(code);
    })
  );

  it.effect("refuses a failing archive command and a spawn failure", () =>
    Effect.gen(function* () {
      const failed = yield* refusalCode(snapshotTar(tarArchive([]), defaults, 2));
      const root = yield* tarRoot();
      const deadline = yield* deadlineIn(10_000);
      const unspawned = yield* refusalCode(
        snapshotCacheDependencies(root, deadline, defaults).pipe(
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            fakeSpawner(() =>
              Effect.fail(PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" }))
            )
          )
        )
      );
      expect([failed, unspawned]).toEqual(["archive-command-failed", "filesystem-or-process-failed"]);
    })
  );

  it.effect.each([
    [
      "a non-string revision",
      sourceDeclaration(5, "canonical-gnu-tar/v1", Str.repeat(64)("a")),
      "invalid-value-or-shape",
    ],
    ["a malformed revision", sourceDeclaration("zz", "canonical-gnu-tar/v1", Str.repeat(64)("a")), "source-revision"],
    ["another dependency format", sourceDeclaration(revision, "zip/v1", Str.repeat(64)("a")), "dependency-format"],
    [
      "a malformed dependency digest",
      sourceDeclaration(revision, "canonical-gnu-tar/v1", "short"),
      "dependency-digest",
    ],
  ] as const)("refuses a source report with %s", ([, declaration, code]) =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const body = yield* encodeSource(declaration);
      yield* f.fs.writeFileString(f.source, body);
      const refused = yield* refusalCode(observeCacheDependencies(f.root, f.source, revision, defaults));
      expect(refused).toBe(code);
    })
  );

  it.effect("refuses empty or missing source reports and never publishes empty files", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.writeFileString(f.source, "");
      const empty = yield* refusalCode(readCacheDiagnosticSource(f.source, defaults));
      const missing = yield* refusalCode(
        compareCacheDiagnosticSource(f.path.join(f.root, "missing.json"), utf8.encode("{}"), defaults)
      );
      const diagnostic = f.path.join(f.root, "diagnostic.json");
      yield* f.fs.writeFileString(diagnostic, "");
      const plan = yield* planCacheDiagnosticPublication(f.source, diagnostic, defaults);
      expect([empty, missing]).toEqual(["source-size-bound", "filesystem-or-process-failed"]);
      expect([plan.source, plan.diagnostic]).toEqual([false, false]);
    })
  );
});
