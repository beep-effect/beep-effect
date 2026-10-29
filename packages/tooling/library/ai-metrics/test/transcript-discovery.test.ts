import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import {
  makeTranscriptDiscovery,
  runDiscoveredTranscriptSweep,
  TranscriptDiscoveryInput,
  TranscriptDiscoveryReadPolicy,
  TranscriptDiscoveryReport,
} from "@beep/repo-ai-metrics/transcript-discovery";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const layer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver }), NodeServices.layer);
const line = '{"type":"response_item","payload":{"type":"message","content":"synthetic-private-discovery"}}\n';
const policy = TranscriptDiscoveryReadPolicy.make({ maxBytes: 512, maxLineBytes: 256, maxFrames: 1 });
const fixture = Effect.fn("TranscriptDiscoveryTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const salt = "synthetic-discovery-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 64,
    maxPayloadBytes: 1048576,
    maxDatabasePages: 256,
  });
  const input = (paths: ReadonlyArray<string>) =>
    TranscriptDiscoveryInput.make({
      roots: A.map(paths, (path) => ({ path, source: "codex", retired: false })),
      hashSalt: Redacted.make(salt),
      maxDepth: 4,
      maxEntries: 3,
      maxFiles: 1,
      maxCycleEntries: 4096,
    });
  return { fs, dir, config, input };
});
const encodeTranscriptDiscoveryReportJson = S.encodeEffect(S.fromJsonString(TranscriptDiscoveryReport));

it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "discovers N+1 files across roots, skips retired roots and admits metadata fairly despite a missing root",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const roots = [`${f.dir}/one`, `${f.dir}/two`, `${f.dir}/missing`];
        yield* f.fs.makeDirectory(`${roots[0]}/nested`, { recursive: true });
        yield* f.fs.makeDirectory(roots[1] ?? "");
        for (const file of [
          `${roots[0]}/rollout-a.jsonl`,
          `${roots[0]}/nested/rollout-b.jsonl`,
          `${roots[1]}/rollout-c.jsonl`,
        ])
          yield* f.fs.writeFileString(file, line);
        const input = f.input(roots);
        const discovery = yield* makeTranscriptDiscovery(
          TranscriptDiscoveryInput.make({
            ...input,
            roots: [...input.roots, { path: `${f.dir}/retired`, source: "claude", retired: true }],
          })
        );
        const reports = yield* Effect.forEach(A.range(1, 28), () =>
          runDiscoveredTranscriptSweep(f.config, discovery, policy)
        );
        expect(
          A.filter(
            A.flatMap(reports, (r) => r.sweep.outcomes),
            (o) => o._tag === "Accepted"
          )
        ).toHaveLength(3);
        expect((yield* (yield* makeTranscriptIntakeJournal(f.config)).stats).pages).toBe(3);
        expect(A.some(reports, (r) => A.some(r.discovery.roots, (root) => root.state === "unavailable"))).toBe(true);
        for (const report of reports) {
          expect(report.discovery.operations).toBeLessThanOrEqual(3);
          expect(report.discovery.candidates).toBeLessThanOrEqual(1);
          expect(report.discovery.activeHelpers).toBeLessThanOrEqual(3);
          expect(report.discovery.roots[3]).toMatchObject({ state: "retired", cycle: 0, entries: 0 });
          const encoded = yield* encodeTranscriptDiscoveryReportJson(report.discovery);
          expect(encoded).not.toContain(f.dir);
          expect(encoded).not.toContain("synthetic-discovery-salt");
          expect(encoded).not.toContain("synthetic-private-discovery");
        }
      })
  )
);
it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "restarts discovery without losing accepted offsets and finds appended, copied and newly created files",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const path = `${f.dir}/rollout-first.jsonl`;
        yield* f.fs.writeFileString(path, Str.slice(0, -1)(line));
        const input = TranscriptDiscoveryInput.make({ ...f.input([f.dir]), maxEntries: 32, maxFiles: 32 });
        yield* Effect.scoped(
          Effect.gen(function* () {
            const d = yield* makeTranscriptDiscovery(input);
            expect((yield* runDiscoveredTranscriptSweep(f.config, d, policy)).sweep.outcomes[0]?._tag).toBe("Idle");
            yield* f.fs.writeFileString(path, "\n", { flag: "a" });
            expect((yield* runDiscoveredTranscriptSweep(f.config, d, policy)).sweep.outcomes[0]?._tag).toBe("Accepted");
          })
        );
        yield* f.fs.copyFile(path, `${f.dir}/rollout-copy.jsonl`);
        yield* f.fs.writeFileString(`${f.dir}/rollout-new.jsonl`, line);
        const restarted = yield* makeTranscriptDiscovery(input);
        const next = yield* runDiscoveredTranscriptSweep(f.config, restarted, policy);
        expect(
          A.sort(
            A.map(next.sweep.outcomes, (o) => o._tag),
            Str.Order
          )
        ).toEqual(["Accepted", "Accepted", "Idle"]);
        yield* f.fs.writeFileString(path, "");
        const truncated = yield* runDiscoveredTranscriptSweep(f.config, restarted, policy);
        expect(A.some(truncated.sweep.outcomes, (o) => o._tag === "Accepted" && o.reset === "truncated")).toBe(true);
        const wrong = TranscriptIntakeConfig.make({ ...f.config, namespaceId: Sha256Hex.make(Str.repeat(64)("b")) });
        expect(yield* runDiscoveredTranscriptSweep(wrong, restarted, policy).pipe(Effect.flip)).toMatchObject({
          reason: "namespace",
        });
      })
  )
);
it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reports depth and entry overflow, excludes symlinks, and never follows a symlink root", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.makeDirectory(`${f.dir}/deep/a/b`, { recursive: true });
      yield* f.fs.makeDirectory(`${f.dir}/wide`);
      yield* f.fs.makeDirectory(`${f.dir}/links`);
      yield* f.fs.writeFileString(`${f.dir}/deep/a/b/rollout-hidden.jsonl`, line);
      for (const n of A.range(1, 3)) yield* f.fs.writeFileString(`${f.dir}/wide/rollout-${n}.jsonl`, line);
      yield* f.fs.symlink(`${f.dir}/wide`, `${f.dir}/linked-root`);
      yield* f.fs.symlink(`${f.dir}/wide/rollout-1.jsonl`, `${f.dir}/links/rollout-link.jsonl`);
      const d = yield* makeTranscriptDiscovery(
        TranscriptDiscoveryInput.make({
          ...f.input([`${f.dir}/deep`, `${f.dir}/wide`, `${f.dir}/links`, `${f.dir}/linked-root`]),
          maxDepth: 2,
          maxEntries: 64,
          maxFiles: 32,
          maxCycleEntries: 2,
        })
      );
      const result = yield* d.next;
      expect(A.map(result.report.roots, (r) => r.state)).toEqual(["overflow", "overflow", "complete", "changed"]);
      expect(result.report.roots[2]?.excludedLinks).toBe(1);
      expect(result.sources).toHaveLength(2);
      expect(result.report.activeHelpers).toBe(0);
    })
  )
);
it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reports real permission failures and recovers after access is restored", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.makeDirectory(`${f.dir}/blocked`);
      yield* f.fs.writeFileString(`${f.dir}/blocked/rollout-a.jsonl`, line);
      const d = yield* makeTranscriptDiscovery(
        TranscriptDiscoveryInput.make({ ...f.input([`${f.dir}/blocked`]), maxEntries: 32 })
      );
      yield* Effect.acquireUseRelease(
        f.fs.chmod(`${f.dir}/blocked`, 0),
        () =>
          Effect.gen(function* () {
            const report = yield* d.next;
            expect(report.report.roots[0]?.state).toBe("unavailable");
            expect(report.sources).toHaveLength(0);
          }),
        () => f.fs.chmod(`${f.dir}/blocked`, 0o700)
      );
      expect((yield* d.next).sources).toHaveLength(1);
    })
  )
);
it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("closes owned helper processes with its scope and rejects reopening", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const handles = yield* Ref.make<ReadonlyArray<ChildProcessSpawner.ChildProcessHandle>>([]);
      const tracked = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(Effect.tap((handle) => Ref.update(handles, A.append(handle))))
      );
      const d = yield* Effect.scoped(
        Effect.gen(function* () {
          const scanner = yield* makeTranscriptDiscovery(
            TranscriptDiscoveryInput.make({ ...f.input([f.dir]), maxEntries: 1 })
          );
          expect((yield* scanner.next).report.activeHelpers).toBe(1);
          yield* scanner.suspend;
          expect((yield* scanner.next).report.roots[0]?.cycle).toBe(2);
          return scanner;
        }).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, tracked))
      );
      expect((yield* Ref.get(handles)).length).toBe(2);
      for (const handle of yield* Ref.get(handles)) expect(yield* handle.isRunning).toBe(false);
      expect(yield* d.next.pipe(Effect.flip)).toMatchObject({ reason: "closed" });
    })
  )
);
it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rejects overlapping or relative declarations before creating helper processes", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      for (const paths of [[f.dir, `${f.dir}/nested`], [f.dir, `${f.dir}/./`], ["relative"], ["/"]])
        expect(yield* makeTranscriptDiscovery(f.input(paths)).pipe(Effect.flip)).toMatchObject({
          reason: "configuration",
        });
    })
  )
);

it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses concurrent discovery and closes owned helpers when an active read is interrupted", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const reading = yield* Deferred.make<void>();
      const handles = yield* Ref.make<ReadonlyArray<ChildProcessSpawner.ChildProcessHandle>>([]);
      const stalled = ChildProcessSpawner.make((command) =>
        spawner.spawn(command).pipe(
          Effect.map((handle) => {
            const stdout = Stream.fromEffect(
              Deferred.succeed(reading, undefined).pipe(Effect.andThen(Effect.never))
            ).pipe(Stream.flatMap(() => handle.stdout));
            return ChildProcessSpawner.makeHandle({ ...handle, stdout });
          }),
          Effect.tap((handle) => Ref.update(handles, A.append(handle)))
        )
      );
      const d = yield* makeTranscriptDiscovery(
        TranscriptDiscoveryInput.make({ ...f.input([f.dir]), maxEntries: 32 })
      ).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, stalled));
      const running = yield* d.next.pipe(Effect.forkChild);
      yield* Deferred.await(reading);
      expect(yield* d.next.pipe(Effect.flip)).toMatchObject({ reason: "busy" });
      yield* Fiber.interrupt(running);
      for (const handle of yield* Ref.get(handles)) expect(yield* handle.isRunning).toBe(false);
    })
  )
);

it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("retains partial and unread file evidence through later directory-only pages", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.writeFileString(`${f.dir}/rollout-partial.jsonl`, '{"type":"response_item"');
      const scanner = yield* makeTranscriptDiscovery(f.input([f.dir]));
      let sawPartial = false;
      let completed = false;
      for (const _ of A.range(1, 10)) {
        const pass = yield* runDiscoveredTranscriptSweep(f.config, scanner, policy);
        const root = pass.discovery.roots[0];
        if (root?.read.partial === 1) sawPartial = true;
        if (root?.state === "complete") {
          expect(root.read).toMatchObject({ assessed: 1, pending: 0, partial: 1, idle: 0 });
          completed = true;
          break;
        }
      }
      expect(sawPartial && completed).toBe(true);
      const raw = yield* scanner.next;
      // An unrecorded page is not silently declared assessed.
      if (raw.sources.length > 0) expect(raw.report.roots[0]?.read.pending).toBeGreaterThan(0);
      expect((yield* (yield* makeTranscriptIntakeJournal(f.config)).stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.fresh(layer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reports unread backlog and mixed accepted/partial tails through the end of traversal", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const file = `${f.dir}/rollout-pages.jsonl`;
      yield* f.fs.writeFileString(file, line + line);
      const scanner = yield* makeTranscriptDiscovery(f.input([f.dir]));
      let sawBacklog = false;
      for (const _ of A.range(1, 6)) {
        const pass = yield* runDiscoveredTranscriptSweep(f.config, scanner, policy);
        if (pass.discovery.roots[0]?.read.backlogged === 1) sawBacklog = true;
        if (pass.discovery.roots[0]?.state === "complete") break;
      }
      expect(sawBacklog).toBe(true);
      const mixed = `${f.dir}/mixed`;
      yield* f.fs.makeDirectory(mixed);
      yield* f.fs.writeFileString(`${mixed}/rollout-partial.jsonl`, `${line}{"type":`);
      const other = yield* makeTranscriptDiscovery(f.input([mixed]));
      const mixedPolicy = TranscriptDiscoveryReadPolicy.make({ maxBytes: 512, maxLineBytes: 256, maxFrames: 4 });
      let completed = false;
      for (const _ of A.range(1, 6)) {
        const pass = yield* runDiscoveredTranscriptSweep(f.config, other, mixedPolicy);
        if (pass.discovery.roots[0]?.state === "complete") {
          expect(pass.discovery.roots[0].read).toMatchObject({ assessed: 1, accepted: 1, partial: 1, backlogged: 0 });
          completed = true;
          break;
        }
      }
      expect(completed).toBe(true);
    })
  )
);
