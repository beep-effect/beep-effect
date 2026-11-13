import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgres } from "@beep/alchemy-postgres";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  BoxMirrorEvidence,
  BoxMirrorLive,
  DmsMirrorFixtureLayer,
  VaultSyncPassLive,
  VaultSyncRoot,
} from "@beep/documents-server/aggregates/Sync";
import * as U from "@beep/documents-use-cases/aggregates/VaultSync";
import { VaultSyncPass, VaultSyncPassModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";

class TracedPass extends Domain.Model("VaultSync", {
  aggregates: VaultSyncPassModel.aggregates,
  views: VaultSyncPassModel.views,
  policies: [
    U.ConflictRegistration,
    U.ConflictReviews,
    U.DestinationNames,
    U.DestinationRecovery,
    U.ItemHealing,
    U.ItemOperations,
    U.OperationDeadlines,
    U.OperationFailures,
  ],
  sagas: [VaultSyncPass],
}) {}

/** Every span the runtime started, in start order. */
const spans: Array<Tracer.NativeSpan> = [];
const tracer = Tracer.make({
  span: (options) => {
    const span = new Tracer.NativeSpan(options);
    spans.push(span);
    return span;
  },
});

const named = (name: string) => A.filter(spans, (span) => span.name === name);
const byId = () => R.fromEntries(A.map(spans, (span) => [span.spanId, span] as const));
// Span ids from a span up to its root, following parents by id.
const ancestorIds = (span: Tracer.NativeSpan): ReadonlyArray<string> => {
  const index = byId();
  const up = (current: Tracer.NativeSpan): ReadonlyArray<string> =>
    O.match(
      O.flatMap(current.parent, (parent) => R.get(index, parent.spanId)),
      { onNone: () => [], onSome: (parent) => [parent.spanId, ...up(parent)] }
    );
  return up(span);
};
const stringValues = (span: Tracer.NativeSpan) => A.filter(A.fromIterable(span.attributes.values()), P.isString);

// Names that would identify a client or matter if they reached telemetry.
const folderName = "matter-acme-holdings";
const fileName = "privileged-brief.txt";

// An in-memory vault: the pass reads it through the FileSystem service only.
const infrastructure = Layer.mergeAll(PgliteTestLayer, MemoryFileSystem.layer, Path.layer);

describe("VaultSyncPass tracing (D17)", () => {
  layer(infrastructure, { timeout: "60 seconds", excludeTestServices: true })("fixture vault", (it) => {
    it.effect("nests each activity step under VaultSyncPass.run and keeps fixture path segments off spans", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixtures = yield* DmsMirrorFixtureLayer.pipe(Layer.fresh, Layer.build);
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.makeDirectory(path.join(root, folderName));
        yield* fs.writeFileString(path.join(root, folderName, fileName), "synthetic privileged text");
        const rootLayer = Layer.succeed(VaultSyncRoot, { resolve: Effect.fn("fixture")(() => Effect.succeed(root)) });
        const adapters = BoxMirrorLive.pipe(
          Layer.provide(Layer.succeedContext(fixtures)),
          Layer.provide(
            Layer.mergeAll(
              rootLayer,
              Layer.succeed(BoxMirrorEvidence, { lookup: Effect.fn("fixture")(() => Effect.succeedNone) })
            )
          )
        );
        const runtime = yield* TracedPass.layer(Layer.mergeAll(VaultSyncPolicies, VaultSyncPassLive)).pipe(
          Layer.provide(adapters),
          Layer.provide(rootLayer),
          Layer.provide(SecureRandom.layerWebCrypto),
          Layer.provide(AlchemyPostgres.layer()),
          Layer.provideMerge(Layer.succeed(Tracer.Tracer, tracer)),
          Layer.fresh,
          Layer.build
        );
        const destinationId = V.DestinationId.make("documents_sync_destination_atraced");
        yield* Context.get(runtime, V.SyncDestination).send(
          destinationId,
          V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "traced" })
        );
        const pass = yield* Context.get(runtime, VaultSyncPass).start("traced-pass", { destinationId });
        const result = yield* pass.result.pipe(Effect.timeout("20 seconds"));
        expect(result).toEqual({ operationsSucceeded: 2, conflicts: 0 });

        const runs = named("VaultSyncPass.run");
        expect(runs.length).toBeGreaterThan(0);
        const runIds = A.map(runs, (span) => span.spanId);
        const steps = named("VaultSyncPass.step");
        const stepNames = A.dedupe(
          A.filter(
            A.map(steps, (span) => span.attributes.get("documents.vault_sync.pass_step")),
            P.isString
          )
        );
        expect(A.sort(stepNames, Str.Order)).toEqual(
          A.sort(["plan", "poll", "pollStart", "probe", "pump", "scan"], Str.Order)
        );
        for (const step of steps) expect(A.some(ancestorIds(step), (id) => A.contains(runIds, id))).toBe(true);
        const scan = yield* Effect.fromOption(
          A.findFirst(steps, (span) => span.attributes.get("documents.vault_sync.pass_step") === "scan")
        );
        expect(scan.attributes.get("documents.vault_sync.items_observed")).toBe(2);
        const run = yield* Effect.fromOption(
          A.findFirst(runs, (span) => span.attributes.get("documents.vault_sync.outcome") === "accepted")
        );
        expect(run.attributes.get("documents.vault_sync.destination_id")).toBe(destinationId);
        expect(run.attributes.get("documents.vault_sync.operations_succeeded")).toBe(2);
        // Each Box call is a client span under its pump step, labelled by operation only.
        const calls = named("BoxMirror.call");
        expect(A.map(calls, (span) => span.kind)).toContain("client");
        expect(
          A.sort(
            A.dedupe(
              A.filter(
                A.map(calls, (span) => span.attributes.get("documents.vault_sync.box_operation")),
                P.isString
              )
            ),
            Str.Order
          )
        ).toEqual(A.sort(["ensureFolder", "pollEvents", "resolveRoot", "uploadFile"], Str.Order));

        // D17 R1: no span name or attribute carries a vault path, a path segment or the vault root.
        const leaked = A.filter(spans, (span) =>
          A.some([span.name, ...stringValues(span)], (text) =>
            A.some([folderName, fileName, root], (segment) => Str.includes(segment)(text))
          )
        );
        expect(A.map(leaked, (span) => span.name)).toEqual([]);
      })
    );
  });
});
