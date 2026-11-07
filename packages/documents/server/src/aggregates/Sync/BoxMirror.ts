/**
 * Event-sourced vault sync hosting; no legacy writer is activated here.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as D from "@beep/documents-use-cases/aggregates/Sync/server";
import { BoxMirror, BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as SqlClient from "effect/sql/SqlClient";
import { makeVaultSyncFileStore } from "./VaultSync.file-store.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/BoxMirror");
const Receipt = S.Struct({ remoteId: V.RemoteItemId, name: S.String, parentRemoteId: S.NullOr(V.RemoteItemId) }).pipe(
  $I.annoteSchema("BoxMirrorReceipt", { description: "Durable remote acknowledgement without local bytes." })
);
const Stored = S.Array(S.Struct({ fingerprint: S.String, result: S.NullOr(S.String) })).pipe(
  $I.annoteSchema("StoredBoxReceipt", { description: "Persisted intent fingerprint and optional acknowledged result." })
);
const localOperations = ["local-root", "stale-input"];
const isLocalFailure = (error: D.DmsMirrorUnavailable | BoxMirrorUnavailable): error is BoxMirrorUnavailable =>
  error._tag === "BoxMirrorUnavailable" && A.contains(localOperations, error.operation);
const unavailable = (operation: string) =>
  BoxMirrorUnavailable.make({
    retryable: false,
    disconnectReason: null,
    operation,
  });
/**
 * Resolves the authorized local vault root for a destination at call time.
 *
 * **Example** (Inspect the adapter)
 * ```ts
 * import { VaultSyncRoot } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncRoot;
 * ```
 * @category adapters
 * @since 0.0.0
 */
export class VaultSyncRoot extends Context.Service<
  VaultSyncRoot,
  {
    readonly resolve: (destinationId: V.DestinationId) => Effect.Effect<string, BoxMirrorUnavailable>;
  }
>()($I`VaultSyncRoot`) {}

/**
 * Looks up authoritative remote evidence for an interrupted mutation; absence holds it.
 *
 * **Example** (Inspect the adapter)
 * ```ts
 * import { BoxMirrorEvidence } from "@beep/documents-server/aggregates/Sync";
 * void BoxMirrorEvidence;
 * ```
 * @category adapters
 * @since 0.0.0
 */
export class BoxMirrorEvidence extends Context.Service<
  BoxMirrorEvidence,
  {
    readonly lookup: (intent: {
      readonly operationId: V.OperationId;
      readonly fingerprint: string;
    }) => Effect.Effect<O.Option<typeof Receipt.Type>, BoxMirrorUnavailable>;
  }
>()($I`BoxMirrorEvidence`) {}

/**
 * Production {@link BoxMirrorEvidence} while the provider cannot prove an interrupted outcome.
 *
 * **Details**
 *
 * It always answers no evidence, so an interrupted upload stays held instead
 * of being sent again. Replace it once Box offers verified version or digest
 * lookup.
 *
 * **Example** (Inspect the layer)
 * ```ts
 * import { BoxMirrorNoEvidenceLive } from "@beep/documents-server/aggregates/Sync";
 * void BoxMirrorNoEvidenceLive;
 * ```
 * @category adapters
 * @since 0.0.0
 */
export const BoxMirrorNoEvidenceLive = Layer.succeed(BoxMirrorEvidence, {
  lookup: Effect.fn("BoxMirrorEvidence.none")(() => Effect.succeedNone),
});

/**
 * Adapts a destination-scoped DmsMirrorBox or DmsMirrorFixture with durable mutation receipts.
 *
 * **Example** (Inspect the adapter)
 * ```ts
 * import { BoxMirrorLive } from "@beep/documents-server/aggregates/Sync";
 * void BoxMirrorLive;
 * ```
 * @category adapters
 * @since 0.0.0
 */
export const BoxMirrorLive = BoxMirror.toLayer(
  Effect.gen(function* () {
    const mirror = yield* D.DmsMirror;
    const availability = yield* D.DmsMirrorAvailability;
    const roots = yield* VaultSyncRoot;
    const evidence = yield* BoxMirrorEvidence;
    const sql = yield* SqlClient.SqlClient;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const files = yield* makeVaultSyncFileStore();
    yield* sql`CREATE TABLE IF NOT EXISTS documents_sync_box_receipt (
    operation_id text PRIMARY KEY, fingerprint text NOT NULL, result text
  )`.pipe(Effect.orDie);
    const encode = S.encodeEffect(S.fromJsonString(Receipt));
    const decode = S.decodeUnknownEffect(S.fromJsonString(Receipt));
    const rootId = Effect.gen(function* () {
      const probe = yield* availability.probe;
      return yield* Effect.fromOption(probe.rootRemoteId).pipe(Effect.mapError(() => unavailable("resolveRoot")));
    });
    const parent = Effect.fnUntraced(function* (id: V.RemoteItemId) {
      return id === (yield* rootId) ? O.none<V.RemoteItemId>() : O.some(id);
    });
    const read = Effect.fnUntraced(function* (destinationId: V.DestinationId, relPath: V.VaultRelPath, digest: string) {
      const configured = yield* roots.resolve(destinationId);
      const root = yield* fs.realPath(configured).pipe(Effect.mapError(() => unavailable("local-root")));
      const bytes = yield* files.read(root, relPath).pipe(Effect.mapError(() => unavailable("stale-input")));
      if (bytesToHex(sha256(bytes)) !== digest) return yield* unavailable("stale-input");
      return bytes;
    });
    const mutation = Effect.fnUntraced(function* (
      operationId: V.OperationId,
      generation: number,
      fingerprint: string,
      call: Effect.Effect<D.DmsRemoteItem, D.DmsMirrorUnavailable | BoxMirrorUnavailable>
    ) {
      const receiptId = `${operationId}/${generation}`;
      // Claim is committed before calling Box. A second caller can only inspect evidence.
      const claimed = yield* sql`INSERT INTO documents_sync_box_receipt (operation_id, fingerprint)
      VALUES (${receiptId}, ${fingerprint}) ON CONFLICT DO NOTHING RETURNING operation_id`.pipe(Effect.orDie);
      if (A.isReadonlyArrayEmpty(claimed)) {
        const rows = yield* sql`SELECT fingerprint, result FROM documents_sync_box_receipt
        WHERE operation_id = ${receiptId}`.pipe(Effect.flatMap(S.decodeUnknownEffect(Stored)), Effect.orDie);
        const stored = yield* Effect.fromOption(A.head(rows)).pipe(Effect.orDie);
        if (stored.fingerprint !== fingerprint) return yield* unavailable("intent-mismatch");
        if (stored.result !== null) return yield* decode(stored.result).pipe(Effect.orDie);
        const found = yield* evidence.lookup({ operationId, fingerprint });
        if (O.isNone(found)) return yield* unavailable("uncertain-outcome-held");
        const result = yield* encode(found.value).pipe(Effect.orDie);
        yield* sql`UPDATE documents_sync_box_receipt SET result = ${result} WHERE operation_id = ${receiptId}`.pipe(
          Effect.orDie
        );
        return found.value;
      }
      const item = yield* call.pipe(
        Effect.catch((error) =>
          // A local read failure happens before any Box request, so nothing can be in doubt:
          // release the claim and report it. Anything else may have reached Box and stays held.
          isLocalFailure(error)
            ? sql`DELETE FROM documents_sync_box_receipt WHERE operation_id = ${receiptId}`.pipe(
                Effect.orDie,
                Effect.andThen(Effect.fail(error))
              )
            : Effect.fail(unavailable("uncertain-outcome-held"))
        )
      );
      const receipt = { remoteId: item.remoteId, name: item.name, parentRemoteId: O.getOrNull(item.parentRemoteId) };
      const result = yield* encode(receipt).pipe(Effect.orDie);
      yield* sql`UPDATE documents_sync_box_receipt SET result = ${result} WHERE operation_id = ${receiptId}`.pipe(
        Effect.orDie
      );
      return receipt;
    });
    // Fingerprints contain only reference metadata, never bytes or credentials.
    const fingerprint = S.encodeEffect(S.fromJsonString(S.Unknown));
    const run = Effect.fnUntraced(function* (
      verb: string,
      args: { readonly operationId: V.OperationId; readonly passId: string; readonly generation: number },
      call: Effect.Effect<D.DmsRemoteItem, D.DmsMirrorUnavailable | BoxMirrorUnavailable>
    ) {
      const encoded = yield* fingerprint({ verb, args: Struct.omit(args, ["passId"]) }).pipe(Effect.orDie);
      return yield* mutation(args.operationId, args.generation, encoded, call);
    });
    const implementation: Context.Service.Shape<typeof BoxMirror> = {
      probe: () => Effect.map(availability.refresh, (result) => ({ connected: result.connected })),
      resolveRoot: () => Effect.map(rootId, (remoteId) => ({ remoteId })),
      ensureFolder: Effect.fnUntraced(function* (args) {
        const parentRemoteId = yield* parent(args.parentRemoteId);
        return yield* run(
          "ensureFolder",
          args,
          mirror.ensureFolder(
            D.EnsureFolderInput.make({
              name: path.basename(args.path),
              parentRemoteId,
            })
          )
        );
      }),
      uploadFile: Effect.fnUntraced(function* (args) {
        const parentRemoteId = yield* parent(args.parentRemoteId);
        const call = Effect.gen(function* () {
          const content = yield* read(args.destinationId, args.path, args.digest);
          return yield* mirror.uploadFile(
            D.UploadFileInput.make({ name: path.basename(args.path), parentRemoteId, content })
          );
        });
        return yield* run("uploadFile", args, call);
      }),
      uploadFileVersion: (args) =>
        run(
          "uploadFileVersion",
          args,
          Effect.gen(function* () {
            const content = yield* read(args.destinationId, args.path, args.digest);
            return yield* mirror.uploadFileVersion(
              D.UploadFileVersionInput.make({
                name: path.basename(args.path),
                remoteId: args.remoteId,
                content,
              })
            );
          })
        ),
      moveItem: Effect.fnUntraced(function* (args) {
        const newParentRemoteId = yield* parent(args.parentRemoteId);
        return yield* run(
          "moveItem",
          args,
          mirror.moveItem(
            D.MoveItemInput.make({
              itemKind: args.itemKind,
              remoteId: args.remoteId,
              newParentRemoteId,
            })
          )
        );
      }),
      renameItem: (args) =>
        run(
          "renameItem",
          args,
          mirror.renameItem(
            D.RenameItemInput.make({
              itemKind: args.itemKind,
              remoteId: args.remoteId,
              newName: args.name,
            })
          )
        ),
      pollEvents: Effect.fnUntraced(function* (args) {
        const page = yield* mirror
          .pollEvents(
            D.PollEventsInput.make({
              streamPosition: O.fromNullishOr(args.position),
            })
          )
          .pipe(
            Effect.mapError((error) =>
              BoxMirrorUnavailable.make({
                retryable: error.retryable,
                disconnectReason: null,
                operation: "pollEvents",
              })
            )
          );
        return {
          position: page.nextStreamPosition,
          events: A.map(page.entries, (event) => ({
            remoteEventId: event.eventId,
            remoteId: O.getOrNull(event.remoteId),
            name: O.getOrNull(event.name),
            parentRemoteId: O.getOrNull(event.parentRemoteId),
            kind: event.eventType,
            evidence: V.RemoteEvidence.make(Str.takeLeft(event.eventType, 100)),
          })),
        };
      }),
    };
    return implementation;
  })
);
