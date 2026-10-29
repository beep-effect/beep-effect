import { fileURLToPath } from "node:url";
import { citationAuthorityMembers } from "@beep/law-practice-domain/values";
import {
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/CallbackSession";
import {
  makeDefaultCitationResolutionCallbacks,
  runDefaultCitationCallbackSession,
} from "@beep/law-practice-server/_test/Citation/DefaultCallbacks";
import { prepareCitationResolution } from "@beep/law-practice-server/_test/Citation/ResolutionInput";
import { resolveCitationMentions } from "@beep/law-practice-server/_test/Citation/Resolve";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { CitationResolutionContext, prepareCitationResolutionContext as prepare } from "./CitationResolve.fixtures.ts";
import { loadResolutionOperationContexts } from "./CitationResolve.operations.ts";

const cases = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/default-resolution-cases.json", import.meta.url))
  );
  return yield* S.decodeEffect(S.fromJsonString(S.Struct({ cases: S.Array(CitationResolutionContext) })))(raw);
});
const selected = Effect.gen(function* () {
  return yield* Effect.fromOption(A.findFirst((yield* cases).cases, (row) => row.name === "short-unique"));
});

it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer))("production default callback sessions", (it) => {
  it.effect("matches all 46 focused source scenes and the existing default document memberships", () =>
    Effect.gen(function* () {
      const data = yield* cases;
      expect(A.length(data.cases)).toBe(46);
      for (const row of data.cases) {
        const input = yield* prepare(row);
        if (row.outcome.status === "error") {
          const failed = yield* Effect.flip(runDefaultCitationCallbackSession(input));
          expect(["invalid-input", "identity-failed", "callback-failed"]).toContain(failed.reason);
          expect("cause" in failed).toBe(false);
        } else {
          const result = yield* runDefaultCitationCallbackSession(input);
          const indices = HashMap.fromIterable(
            A.map(result.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(result.groups, (group) =>
            A.map(group.members, (id) => O.getOrElse(HashMap.get(indices, id), () => -1))
          );
          expect(groups, row.name).toEqual(row.outcome.groups);
          const document = yield* resolveCitationMentions(input);
          expect(
            A.map(document.authorities, (authority) =>
              A.map(citationAuthorityMembers(document, authority.id), (id) =>
                O.getOrElse(HashMap.get(indices, id), () => -1)
              )
            ),
            row.name
          ).toEqual(groups);
        }
      }
    })
  );

  it.effect(
    "matches every committed default operation observation through production callbacks",
    () =>
      Effect.gen(function* () {
        const data = yield* loadResolutionOperationContexts;
        expect(data.corpusSha256).toBe("ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
        expect(A.length(data.contexts)).toBe(30);
        expect(A.reduce(data.contexts, 0, (count, row) => count + A.length(row.context.mentions))).toBe(94);
        for (const row of data.contexts) {
          const result = yield* runDefaultCitationCallbackSession(yield* prepare(row.context));
          const indices = HashMap.fromIterable(
            A.map(result.mentions, (mention, index) => Tuple.make(mention.id, index))
          );
          const groups = A.map(result.groups, (group) =>
            A.map(group.members, (id) => O.getOrElse(HashMap.get(indices, id), () => -1))
          );
          if (row.context.outcome.status !== "value") return yield* Effect.die("Expected source groups");
          expect(groups, row.context.name).toEqual(row.context.outcome.groups);
        }
      }),
    { timeout: 30_000 }
  );

  it.effect("shares the work budget between dispatch and matching while isolating concurrent operations", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const two = {
        ...input,
        mentions: A.take(input.mentions, 2),
        limits: { ...input.limits, resolutionIterations: 6 },
      };
      const results = yield* Effect.all(
        [runDefaultCitationCallbackSession(two), runDefaultCitationCallbackSession(two)],
        { concurrency: 2 }
      );
      expect(A.map(results, (result) => A.length(A.getUnsafe(result.groups, 0).members))).toEqual([2, 2]);
      const failed = yield* Effect.flip(
        runDefaultCitationCallbackSession({ ...two, limits: { ...two.limits, resolutionIterations: 4 } })
      );
      expect(failed.reason).toBe("limit-exceeded");
    })
  );

  it.effect("captures the budget ceiling and rejects a counter from a different operation policy", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const limits = { ...input.limits, resolutionIterations: 2 };
      const work = yield* makeCitationResolutionWork(limits);
      Reflect.set(limits, "resolutionIterations", 99);
      yield* work.step;
      yield* work.step;
      expect((yield* Effect.flip(work.step)).reason).toBe("limit-exceeded");
      expect(work.maximum).toBe(2);
      const prepared = yield* prepareCitationResolution(input);
      const mismatch = yield* makeCitationResolutionWork({
        ...prepared.limits,
        resolutionIterations: prepared.limits.resolutionIterations - 1,
      });
      const callbacks = yield* makeDefaultCitationResolutionCallbacks(prepared).pipe(
        Effect.provideService(CitationResolutionWork, mismatch)
      );
      const failed = yield* Effect.flip(
        runPreparedCitationCallbackSession(prepared).pipe(
          Effect.provideService(CitationResolutionWork, mismatch),
          Effect.provideService(CitationResolutionCallbacks, callbacks)
        )
      );
      expect(failed.reason).toBe("invalid-input");
    })
  );

  it.effect("prepares each occurrence once before constructing its default resource", () =>
    Effect.gen(function* () {
      const input = yield* prepare(yield* selected);
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const result = yield* runDefaultCitationCallbackSession({ ...input, mentions: A.take(input.mentions, 1) }).pipe(
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      expect(A.length(result.groups)).toBe(1);
      expect(hashes).toBe(2);
    })
  );
});
