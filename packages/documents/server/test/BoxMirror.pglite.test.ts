import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  BoxMirrorEvidence,
  BoxMirrorLive,
  DmsMirrorFixtureHandle,
  DmsMirrorFixtureLayer,
  VaultSyncRoot,
} from "@beep/documents-server/aggregates/Sync";
import { BoxMirror } from "@beep/documents-use-cases/aggregates/VaultSync";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const infrastructure = Layer.mergeAll(PgliteTestLayer, BunServices.layer, DmsMirrorFixtureLayer);
describe("BoxMirror durable intent receipts", () => {
  layer(infrastructure, { timeout: "20 seconds", excludeTestServices: true, concurrent: false })("adapter", (it) => {
    for (const outcome of ["completed", "stale", "uncertain"]) {
      it.effect(outcome, () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped();
          const content = new TextEncoder().encode("synthetic adapter payload");
          yield* fs.writeFile(path.join(root, "file.txt"), content);
          const fixture = yield* DmsMirrorFixtureHandle;
          const before = yield* fixture.counts;
          const args = {
            destinationId: V.DestinationId.make("documents_sync_destination_aadapter"),
            operationId: V.OperationId.make(`documents_sync_operation_a${outcome}`),
            passId: "first",
            generation: 1,
            path: V.VaultRelPath.make("file.txt"),
            digest: outcome === "stale" ? "wrong" : bytesToHex(sha256(content)),
            parentRemoteId: V.RemoteItemId.make("fx-root"),
          };
          if (outcome === "uncertain") yield* fixture.failNext("uploadFile", true);
          const context = yield* Layer.build(
            BoxMirrorLive.pipe(
              Layer.provide(
                Layer.mergeAll(
                  Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture.root")(() => Effect.succeed(root)) }),
                  Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("fixture.evidence")(() => Effect.succeedNone) })
                )
              )
            )
          );
          const mirror = Context.get(context, BoxMirror);
          const retried = { ...args, passId: "another-runtime" };
          if (outcome === "completed") {
            const first = yield* mirror.uploadFile(args);
            const second = yield* mirror.uploadFile(retried);
            expect(second).toEqual(first);
          } else {
            // The call name stays in `operation`; the adapter stage says where it stopped.
            const expected = {
              operation: "uploadFile",
              stage: outcome === "stale" ? "stale-input" : "uncertain-outcome-held",
            };
            const first = yield* Effect.flip(mirror.uploadFile(args));
            const second = yield* Effect.flip(mirror.uploadFile(retried));
            expect({ operation: first.operation, stage: first.stage }).toEqual(expected);
            expect({ operation: second.operation, stage: second.stage }).toEqual(expected);
          }
          const counts = yield* fixture.counts;
          expect(counts.uploadFile - before.uploadFile).toBe(outcome === "stale" ? 0 : 1);
          if (outcome === "uncertain") {
            const evidence = {
              remoteId: V.RemoteItemId.make("verified-remote"),
              name: "file.txt",
              parentRemoteId: null,
            };
            const recovered = yield* Layer.build(
              BoxMirrorLive.pipe(
                Layer.provide(
                  Layer.mergeAll(
                    Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture.root")(() => Effect.succeed(root)) }),
                    Layer.succeed(BoxMirrorEvidence, {
                      lookup: Effect.fn("fixture.evidence")(() => Effect.succeedSome(evidence)),
                    })
                  )
                )
              )
            );
            const receipt = yield* Context.get(recovered, BoxMirror).uploadFile(args);
            expect(receipt).toEqual(evidence);
            const after = yield* fixture.counts;
            expect(after.uploadFile).toBe(counts.uploadFile);
          }
        })
      );
    }
    it.effect("probe refreshes provider availability without a Box mutation", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const fixture = yield* DmsMirrorFixtureHandle;
        const before = yield* fixture.counts;
        const context = yield* Layer.build(
          BoxMirrorLive.pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture.root")(() => Effect.succeed(root)) }),
                Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("fixture.evidence")(() => Effect.succeedNone) })
              )
            )
          )
        );
        const result = yield* Context.get(context, BoxMirror).probe({
          destinationId: V.DestinationId.make("documents_sync_destination_aadapter"),
        });
        expect(result).toEqual({ connected: true });
        const after = yield* fixture.counts;
        expect(after.uploadFile).toBe(before.uploadFile);
      })
    );
  });
});
