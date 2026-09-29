/**
 * Exact desktop-sidecar contradiction registration proof.
 *
 * The focused contradiction handler tests exercise their group in isolation.
 * This test binds the side-effect-free merged contract exported by the sidecar
 * to the app's complete fixture runtime, so omitting contradiction triage from
 * either production composition surface fails locally.
 */

import { ContradictionListPayload } from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Number";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { RpcTest } from "effect/rpc";
import * as S from "effect/Schema";
import { RuntimeTest } from "@/runtime/Layer";
import { fcDeepSweepActive, vitestCoverageRunActive } from "../../../../vitest.shared.ts";
import { DesktopRpcs } from "../../server/DesktopRpcs.ts";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const fixtureTimeout = vitestCoverageRunActive || fcDeepSweepActive ? "5 minutes" : "10 seconds";
const instant = Result.getOrThrow(S.decodeResult(S.DateTimeUtcFromMillis)(2_000));

const RuntimeFixtureLive = Layer.unwrap(
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const ontologyWorkspaceRoot = yield* fileSystem.makeTempDirectoryScoped({
      prefix: "contradiction-sidecar-contract-",
    });
    return RuntimeTest.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            ONTOLOGY_WORKSPACE_ROOT: ontologyWorkspaceRoot,
          })
        )
      )
    );
  })
).pipe(Layer.provide(BunFileSystem.layer));

it.layer(RuntimeFixtureLive, { timeout: fixtureTimeout })("@beep/professional-desktop desktop rpc contract", (it) => {
  it.effect(
    "serves contradiction triage through the exact merged group and fixture runtime",
    Effect.fnUntraced(function* () {
      const client = yield* RpcTest.makeClient(DesktopRpcs);
      const page = yield* client.ListContradictionCandidates(
        ContradictionListPayload.make({
          disposition: "open",
          knownAt: instant,
          limit: PosInt.make(20),
          offset: NonNegativeInt.make(0),
          validAt: instant,
        })
      );
      expect(page.total).toBe(0);
    })
  );
});
