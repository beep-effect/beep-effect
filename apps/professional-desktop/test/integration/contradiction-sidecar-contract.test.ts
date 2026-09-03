/**
 * Exact desktop-sidecar contradiction registration proof.
 *
 * The focused contradiction handler tests exercise their group in isolation.
 * This test binds the side-effect-free merged contract exported by the sidecar
 * to the app's complete fixture runtime, so omitting contradiction triage from
 * either production composition surface fails locally.
 */

import { ContradictionListPayload } from "@beep/epistemic-use-cases/public";
import { PosInt } from "@beep/schema/Int";
import { NonNegativeInt } from "@beep/schema/Number";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { RpcTest } from "effect/unstable/rpc";
import { RuntimeTest } from "@/runtime/Layer";
import { DesktopRpcs } from "../../server/DesktopRpcs.ts";

const instant = Result.getOrThrow(S.decodeResult(S.DateTimeUtcFromMillis)(2_000));

describe("@beep/professional-desktop desktop rpc contract", () => {
  it.effect(
    "serves contradiction triage through the exact merged group and fixture runtime",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const ontologyWorkspaceRoot = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "contradiction-sidecar-contract-",
      });
      const runtime = RuntimeTest.pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              ONTOLOGY_WORKSPACE_ROOT: ontologyWorkspaceRoot,
            })
          )
        )
      );
      const page = yield* Effect.gen(function* () {
        const client = yield* RpcTest.makeClient(DesktopRpcs);
        return yield* client.ListContradictionCandidates(
          ContradictionListPayload.make({
            disposition: "open",
            knownAt: instant,
            limit: PosInt.make(20),
            offset: NonNegativeInt.make(0),
            validAt: instant,
          })
        );
      }).pipe(provideScopedLayer(runtime));

      expect(page.total).toBe(0);
    }, provideScopedLayer(BunFileSystem.layer))
  );
});
