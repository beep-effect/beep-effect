import * as NodeURL from "node:url";
import {
  CitationCleanerFailure,
  CitationCleanerObject,
  CitationCleanerProduced,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationCleanerWork } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";

const StringJson = S.fromJsonString(S.String);

const fail = () => CitationCleanerFailure.make({ reason: "callback-failed" });
const owned = (
  worker: Effect.Success<ReturnType<typeof makeCitationHtmlWorker>>,
  units: number,
  build: () => string | Uint8Array
) => {
  const values = new WeakMap<CitationCleanerObject, string | Uint8Array>();
  let slot = 0;
  let lastWork = O.none<CitationCleanerWork>();
  const own = (text: string | Uint8Array) => {
    const ref = CitationCleanerObject.make({ slot: slot++ });
    values.set(ref, text);
    return ref;
  };
  const expand = CitationCleanerObject.make({ slot: slot++ });
  const html = CitationCleanerObject.make({ slot: slot++ });
  const readAny = Effect.fn("HtmlStageTest.readAny")((ref: CitationCleanerObject) =>
    Effect.fromOption(O.fromUndefinedOr(values.get(ref)), fail)
  );
  const read = Effect.fn("HtmlStageTest.read")((ref: CitationCleanerObject) =>
    readAny(ref).pipe(Effect.filterOrFail((value): value is string => typeof value === "string", fail))
  );
  const runtime = CitationCleanerRuntime.of({
    fromText: Effect.fn("HtmlStageTest.fromText")((text) => Effect.sync(() => own(text))),
    assertOwned: Effect.fn("HtmlStageTest.assertOwned")(
      (ref): Effect.Effect<void, CitationCleanerFailure> =>
        values.has(ref) || ref === expand || ref === html ? Effect.void : Effect.fail(fail())
    ),
    textUnits: Effect.fn("HtmlStageTest.textUnits")((ref) =>
      readAny(ref).pipe(Effect.map((value) => (typeof value === "string" ? O.some(Str.length(value)) : O.none())))
    ),
    open: Effect.fn("HtmlStageTest.open")((_plan, _initial, work) =>
      Effect.sync(() => {
        lastWork = O.some(work);
        let index = 0;
        const steps = [expand, html];
        return { next: Effect.sync(() => O.fromUndefinedOr(steps[index++])) };
      })
    ),
    contains: Effect.fn("HtmlStageTest.contains")(() => Effect.succeed(false)),
    get: Effect.fn("HtmlStageTest.get")(() => Effect.fail(fail())),
    callable: Effect.fn("HtmlStageTest.callable")(() => Effect.succeed(true)),
    invoke: Effect.fn("HtmlStageTest.invoke")((step, ref, work: CitationCleanerWork) =>
      step === expand
        ? Effect.gen(function* () {
            const charges = units === 0 ? [] : [yield* work.reserveText(units)];
            return CitationCleanerProduced.make({ value: own(build()), charges });
          })
        : readAny(ref).pipe(
            Effect.flatMap((value) =>
              typeof value === "string" ? worker.stage(value, work) : worker.stageBytes(value, work)
            ),
            Effect.mapBoth({
              onSuccess: ({ text, charges }) => CitationCleanerProduced.make({ value: own(text), charges }),
              onFailure: (error) => (error._tag === "CitationSafetyLimitExceeded" ? error : fail()),
            })
          )
    ),
  });
  return { runtime, read, work: Effect.suspend(() => Effect.fromOption(lastWork, fail)) };
};
it.layer(BunServices.layer, { excludeTestServices: true })("native cleaner stage composition", (it) => {
  it.effect(
    "shares cumulative production, widens intermediate input and retires each native child before return",
    () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const paths = {
          executable: process.execPath,
          cwd: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "citation-html-stage-" }),
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
        };
        const policy = {
          ...limits,
          sourceUtf16: 1,
          producedTextUtf16: 2_000_006,
          cleanDeadline: Duration.seconds(30),
          operationDeadline: Duration.seconds(60),
        };
        const real = yield* ChildProcessSpawner;
        let exits = 0;
        const worker = yield* makeCitationHtmlWorker(policy, paths).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  let acknowledged = false;
                  return {
                    ...handle,
                    isRunning: handle.isRunning.pipe(
                      Effect.tap((running) =>
                        Effect.sync(() => {
                          if (!running && !acknowledged) {
                            expect(() => process.kill(handle.pid, 0)).toThrow();
                            acknowledged = true;
                            exits++;
                          }
                        })
                      )
                    ),
                  };
                })
              ),
          })
        );
        // UTF-32 input is 4,000,008 bytes, exceeding the retired raw-source ABI cap.
        const units = 1_000_003;
        const h = owned(worker, units, () => `${Str.repeat(1_000_001)("A")}😀`);
        const pipeline = yield* makeCitationCleanerPipeline(policy).pipe(
          Effect.provideService(CitationCleanerRuntime, h.runtime)
        );
        const result = yield* pipeline.run({ text: "x", plan: "expand-html" });
        expect(Str.length(yield* h.read(result.value))).toBe(units);
        expect(yield* h.read(result.value)).toBe(`${Str.repeat(1_000_001)("A")}😀`);
        expect(result.producedTextUtf16).toBe(units * 2);
        expect(exits).toBe(1);
        const zeroUnits = 1_000_028;
        const zeroPolicy = { ...policy, producedTextUtf16: zeroUnits };
        const zeroWorker = yield* makeCitationHtmlWorker(zeroPolicy, paths);
        const empty = owned(zeroWorker, zeroUnits, () => `<div><script>${Str.repeat(1_000_000)("A")}</script></div>`);
        const zeroPipeline = yield* makeCitationCleanerPipeline(zeroPolicy).pipe(
          Effect.provideService(CitationCleanerRuntime, empty.runtime)
        );
        const zero = yield* zeroPipeline.run({ text: "x", plan: "zero-html" });
        expect(yield* empty.read(zero.value)).toBe("");
        expect(zero.producedTextUtf16).toBe(zeroUnits);
        expect(yield* zeroWorker.snapshot).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
        const fullPolicy = { ...policy, producedTextUtf16: 1 };
        const fullWorker = yield* makeCitationHtmlWorker(fullPolicy, paths);
        const full = owned(fullWorker, 1, () => "A");
        const fullPipeline = yield* makeCitationCleanerPipeline(fullPolicy).pipe(
          Effect.provideService(CitationCleanerRuntime, full.runtime)
        );
        expect(yield* Effect.flip(fullPipeline.run({ text: "x", plan: "full-html" }))).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "producedTextUtf16",
        });
        expect(yield* fullWorker.snapshot).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
        expect(yield* Effect.flip(worker.clean("AB"))).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "sourceUtf16",
        });
        expect(yield* worker.snapshot).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
      }),
    { timeout: 90_000 }
  );
  it.effect(
    "closes the shared ledger only after cancelling and retiring an active native stage",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-stage-cancel-" });
        const marker = `${cwd}/started`;
        const markerLiteral = yield* S.encodeEffect(StringJson)(marker);
        const workerFile = `${cwd}/worker.mjs`;
        yield* fs.writeFileString(
          workerFile,
          `import {writeFileSync} from 'node:fs';process.stdout.write('{"_tag":"Ready","version":"citation-html-worker/v1"}\\n');process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('{"_tag":"Started","version":"citation-html-worker/v1"}\\n',()=>{writeFileSync(${markerLiteral},'entered');while(true){}}));`
        );
        const limits = {
          ...(yield* defaultCitationEnginePolicy).limits,
          cleanDeadline: Duration.seconds(30),
          operationDeadline: Duration.seconds(60),
        };
        const real = yield* ChildProcessSpawner;
        let childPid = O.none<number>();
        const worker = yield* makeCitationHtmlWorker(limits, { executable: process.execPath, cwd, workerFile }).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.tap((handle) =>
                  Effect.sync(() => {
                    childPid = O.some(handle.pid);
                  })
                )
              ),
          })
        );
        const h = owned(worker, 1, () => "x");
        const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
          Effect.provideService(CitationCleanerRuntime, h.runtime)
        );
        const running = yield* pipeline.run({ text: "x", plan: "cancel-html" }).pipe(Effect.forkChild);
        const observed = yield* fs
          .exists(marker)
          .pipe(
            Effect.repeat({ times: 2999, until: (exists) => exists, schedule: Schedule.spaced(Duration.millis(10)) })
          );
        expect(observed).toBe(true);
        expect((yield* (yield* h.work).snapshot).closed).toBe(false);
        yield* Fiber.interrupt(running);
        expect(Exit.hasInterrupts(yield* Fiber.await(running))).toBe(true);
        expect((yield* (yield* h.work).snapshot).closed).toBe(true);
        expect(yield* worker.snapshot).toMatchObject({ active: 0, queued: 0, processes: 0, quarantined: 0 });
        const pid = yield* Effect.fromOption(childPid, fail);
        expect(() => process.kill(pid, 0)).toThrow();
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "passes owned callback bytes through native detection and charges only produced Unicode text",
    () =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 1, producedTextUtf16: 1 };
        const worker = yield* makeCitationHtmlWorker(limits, {
          executable: process.execPath,
          cwd: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "citation-byte-stage-" }),
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
        });
        const h = owned(worker, 0, () => new TextEncoder().encode("<div>A</div>"));
        const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
          Effect.provideService(CitationCleanerRuntime, h.runtime)
        );
        const result = yield* pipeline.run({ text: "x", plan: "bytes-html" });
        expect(yield* h.read(result.value)).toBe("A");
        expect(result.producedTextUtf16).toBe(1);
        const wide = owned(worker, 0, () => new TextEncoder().encode('<meta charset="utf-8"><div>😀</div>'));
        const widePipeline = yield* makeCitationCleanerPipeline(limits).pipe(
          Effect.provideService(CitationCleanerRuntime, wide.runtime)
        );
        expect(yield* Effect.flip(widePipeline.run({ text: "x", plan: "bytes-html" }))).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "producedTextUtf16",
        });
        expect(yield* worker.snapshot).toMatchObject({ active: 0, queued: 0, processes: 0, quarantined: 0 });
      }),
    { timeout: 30_000 }
  );
});
