import * as NodeURL from "node:url";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationRegexWorker } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";

const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const pointWords = (points: ReadonlyArray<number>) => {
  const bytes = new Uint8Array(points.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < points.length; index++) view.setUint32(index * 4, points[index] ?? 0, true);
  return { width: 4, bytes };
};
const pattern = native("(?P<maybe>a)?(b)");
const descriptor = {
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
};
const setup = Effect.fn("RegexWorkerTest.setup")(function* (bindings: unknown) {
  const limits = { ...(yield* defaultCitationEnginePolicy).limits, regexDeadline: Duration.seconds(1) };
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const runtime = {
    executable: process.execPath,
    cwd: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "citation-regex-worker-" }),
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.entry.ts", import.meta.url)),
  };
  const worker = yield* makeCitationRegexWorker(limits, runtime, bindings).pipe(
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { worker, admission, observed };
});

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })("owned native regex", (it) => {
  it.effect("executes real matching and returns native captures only after confirmed retirement", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      const completed = yield* worker.evaluate(pattern, native("b ab"), 0);
      expect(completed.result.matches).toBe(2);
      expect(completed.result.groups).toBe(2);
      expect(yield* completed.result.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 1 });
      expect(yield* completed.result.capture(0, 1)).toEqual({ _tag: "Unmatched" });
      expect(yield* completed.result.capture(1, 1)).toEqual({ _tag: "Range", start: 2, end: 3 });
      expect(yield* completed.source.project({ start: 2, end: 4 })).toEqual({
        _tag: "Range",
        startChar: 2,
        endChar: 4,
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
    })
  );

  it.effect("distinguishes a scalar from literal surrogate words before projecting captures", () =>
    Effect.gen(function* () {
      const scalar = pointWords([0x1d7ce]);
      const pair = { width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) };
      const profile = { groups: 0, names: {}, repeatedCaptures: false, nullableMultiRepeat: false };
      const { worker, admission, observed } = yield* setup([
        {
          flags: 0,
          patternSha256: "e9f8cb189ba1a0fb007b2bae7be8968860b00b0f5a291f55e359a3ba19a96bf7",
          profile: { ...profile, minimumWidthFloor: 1 },
        },
        {
          flags: 0,
          patternSha256: "6b0cc71a808904081ff51cc3266650d2eca776b7050405ddc8a93f1f1278212f",
          profile: { ...profile, minimumWidthFloor: 2 },
        },
      ]);
      const source = pointWords([0x1d7ce, 0xd835, 0xdfce, 48, 0x1d7ce]);
      const scalarResult = yield* worker.evaluate(scalar, source, 0);
      const pairResult = yield* worker.evaluate(pair, source, 0);
      expect(scalarResult.result.matches).toBe(2);
      expect(pairResult.result.matches).toBe(1);
      expect(yield* scalarResult.result.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 1 });
      expect(yield* scalarResult.result.capture(1, 0)).toEqual({ _tag: "Range", start: 4, end: 5 });
      expect(yield* pairResult.result.capture(0, 0)).toEqual({ _tag: "Range", start: 1, end: 3 });
      expect(yield* pairResult.source.project({ start: 1, end: 3 })).toEqual({
        _tag: "Range",
        startChar: 2,
        endChar: 4,
      });
      expect(yield* scalarResult.source.project({ start: 4, end: 5 })).toEqual({
        _tag: "Range",
        startChar: 5,
        endChar: 7,
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 2, confirmed: 2 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("allows zero remaining matches only for a complete no-match result", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      expect((yield* worker.evaluate(pattern, native("zzz"), 0, 0)).result.matches).toBe(0);
      expect(yield* worker.evaluate(pattern, native("b"), 0, 0).pipe(Effect.flip)).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "patternMatches",
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 2, confirmed: 2 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("rejects uninstalled native patterns before spawning and returns their reservation", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      expect(yield* worker.evaluate(native("c"), native("c"), 0).pipe(Effect.flip)).toMatchObject({
        _tag: "CitationRegexDescriptorFailure",
        reason: "unknown-pattern",
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 0, confirmed: 0 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );
});
