import { makeCitationTokenObjects } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { loadCitationTokenObjectsControls } from "./CitationTokenObjects.fixtures.ts";

it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "native token objects",
  (it) => {
    it.effect("matches all nine source constructors and distinct merge identity/truth results", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenObjectsControls();
        const objects = yield* makeCitationTokenObjects((yield* defaultCitationEnginePolicy).limits, []);
        for (const row of controls.constructors) {
          const id = yield* objects.fromCapture(row.input, row.offset);
          expect(yield* objects.snapshot(id), `constructor ${row.id}`).toEqual(row.expected);
        }
        const checkMerge = Effect.fn("TokenTest.checkMerge")(function* (row: (typeof controls.merges)[number]) {
          const left = yield* objects.create(row.left);
          const right = yield* objects.create(row.right);
          if (row.outcome === "error")
            expect(yield* objects.merge(left, right).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
          else if (row.outcome === "left") assertSome(yield* objects.merge(left, right), left);
          else assertNone(yield* objects.merge(left, right));
          if (row.truth === null)
            expect(yield* objects.mergeTruthy(left, right).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
          else expect(yield* objects.mergeTruthy(left, right)).toBe(row.truth);
        });
        for (const row of controls.merges) yield* checkMerge(row);
      })
    );
    it.effect("owns native inputs and snapshots and captures aggregate token-store ceilings", () =>
      Effect.gen(function* () {
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, candidates: 2, producedTextUtf16: 2 };
        const objects = yield* makeCitationTokenObjects(limits, []);
        limits.candidates = 100;
        limits.producedTextUtf16 = 100;
        const seed = {
          kind: "Token",
          data: { width: 1, bytes: new Uint8Array([120]) },
          start: 0,
          end: 1,
          groups: {},
          exact: [],
          variation: [],
          short: false,
        };
        const first = yield* objects.create(seed);
        seed.data.bytes[0] = 121;
        const snapshot = yield* objects.snapshot(first);
        expect(snapshot.data?.bytes).toEqual(new Uint8Array([120]));
        if (snapshot.data !== null) snapshot.data.bytes.fill(122);
        expect((yield* objects.snapshot(first)).data?.bytes).toEqual(new Uint8Array([120]));
        yield* objects.create(seed);
        expect(yield* objects.create(seed).pipe(Effect.flip)).toMatchObject({ limit: "candidates" });
        const textBounded = yield* makeCitationTokenObjects({ ...limits, producedTextUtf16: 1 }, []);
        yield* textBounded.create(seed);
        expect(yield* textBounded.create(seed).pipe(Effect.flip)).toMatchObject({ limit: "producedTextUtf16" });
        expect(yield* textBounded.snapshot(1).pipe(Effect.flip)).toMatchObject({ reason: "host-failed" });
      })
    );
    it.effect("retains the captured object-operation deadline against a disabled caller Clock", () =>
      Effect.gen(function* () {
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const objects = yield* makeCitationTokenObjects(
          { ...(yield* defaultCitationEnginePolicy).limits, extractDeadline: Duration.millis(997) },
          []
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const pending = yield* objects
          .create({
            kind: "Token",
            data: { width: 1, bytes: new Uint8Array(65536).fill(97) },
            start: 0,
            end: 1,
            groups: {},
            exact: [],
            variation: [],
            short: false,
          })
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({ limit: "extractDeadline" });
      })
    );
  }
);
