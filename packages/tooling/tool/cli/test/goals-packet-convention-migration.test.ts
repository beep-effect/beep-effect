import {
  applyPacketGenesisSeed,
  foldPacketEvents,
  GoalPacketRecord,
  isJsonRecord,
  lintGoalFleet,
  PacketEventStore,
  PacketEventStoreLive,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  PacketStreamLocator,
  parseGoalManifestText,
  planManifestTranslation,
  planPacketGenesisSeed,
} from "@beep/repo-cli/test/Goals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

const mutationLayer = PacketForkRepairApplierLive.pipe(Layer.provideMerge(PacketEventStoreLive));
const testLayer = Layer.mergeAll(NodeServices.layer, mutationLayer.pipe(Layer.provideMerge(NodeServices.layer)));
const FORKED_PATH = new URL("./fixtures/packet-core/forked", import.meta.url).pathname;
const encodeJson = S.encodeSync(S.fromJsonString(S.Unknown));

const record = (slug: string, manifest: Readonly<Record<string, unknown>>): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug,
    packetPath: `goals/${slug}`,
    manifestPath: `goals/${slug}/ops/manifest.json`,
    readmePath: `goals/${slug}/README.md`,
    manifestText: `${encodeJson(manifest)}\n`,
  });

const completionGate = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

describe("manifest translation", () => {
  it("probes a versionless half-migrated manifest and preserves bespoke keys", () => {
    const plan = planManifestTranslation(
      record("demo", {
        initiative: { id: "demo", status: "active" },
        completionGate,
        bespoke: { preserved: true },
      })
    );
    expect(plan.probe.declaredVersion).toBeUndefined();
    expect(plan.probe.hasLifecycle).toBe(false);
    expect(plan.issues).toStrictEqual([]);
    expect(A.length(plan.assumptions)).toBeGreaterThan(0);
    expect(O.isSome(plan.translation)).toBe(true);
    if (O.isNone(plan.translation)) return;
    const parsed = parseGoalManifestText(plan.translation.value.content);
    expect(O.isSome(parsed)).toBe(true);
    if (O.isSome(parsed) && isJsonRecord(parsed.value)) {
      expect(parsed.value.schemaVersion).toBe("initiative-manifest/v2");
      expect(parsed.value.lifecycle).toBe("active");
      expect(parsed.value.packetPath).toBe("goals/demo");
      expect(parsed.value.bespoke).toStrictEqual({ preserved: true });
    }
    expect(plan.translation.value.drift).toContain("breaking");
    expect(plan.translation.value.drift).toContain("additive");
  });

  it("blocks contradictory lifecycle instead of inventing a resolution", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        lifecycle: "paused",
        completionGate,
      })
    );
    expect(O.isNone(plan.translation)).toBe(true);
    expect(plan.issues[0]?.message).toContain("disagrees");
  });
});

describe("fleet lint", () => {
  it("reports duplicate identities, dependency cycles, and unreachable references", () => {
    const records = [
      record("a", {
        initiative: { id: "same", status: "active" },
        completionGate,
        blockedBy: ["goals/b", "goals/missing"],
      }),
      record("b", {
        initiative: { id: "same", status: "active" },
        completionGate,
        blockedBy: ["goals/a"],
      }),
    ];
    const kinds = A.map(lintGoalFleet(records), (finding) => finding.kind);
    expect(kinds).toContain("duplicate-slug");
    expect(kinds).toContain("dependency-cycle");
    expect(kinds).toContain("unreachable-packet");
    expect(kinds).toContain("unmigrated-reference");
    expect(
      O.getOrUndefined(A.findFirst(lintGoalFleet(records), (finding) => finding.kind === "unmigrated-reference"))
        ?.severity
    ).toBe("warning");
  });
});

describe("packet mutation", () => {
  it(
    "stages and applies the committed fork fixture, then becomes idempotent",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-fork-repair-" });
          const packetPath = `${root}/forked`;
          yield* fs.copy(FORKED_PATH, packetPath);
          const locator = PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath });
          const applier = yield* PacketForkRepairApplier;
          expect(O.isSome(yield* applier.preview(locator))).toBe(true);
          const outcome = yield* applier.apply(locator);
          expect(O.isSome(outcome)).toBe(true);
          expect(O.getOrUndefined(outcome)?.revision).toBe(4);
          const store = yield* PacketEventStore;
          const listing = yield* store.list(locator);
          const derived = foldPacketEvents({ packet: "forked", root: "goals", events: listing.events });
          expect(listing.issues).toStrictEqual([]);
          expect(derived.forks).toStrictEqual([]);
          expect(derived.revision).toBe(4);
          expect(yield* fs.exists(`${packetPath}/ops/trace.json`)).toBe(true);
          expect(O.isNone(yield* applier.apply(locator))).toBe(true);
        }).pipe(Effect.scoped, provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "seeds exactly one honest current-snapshot event and trace",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-seed-" });
          const packetPath = `${root}/demo`;
          yield* fs.makeDirectory(`${packetPath}/ops`, { recursive: true });
          const packet = GoalPacketRecord.make({
            slug: "demo",
            packetPath,
            manifestPath: `${packetPath}/ops/manifest.json`,
            readmePath: `${packetPath}/README.md`,
          });
          const manifest = encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "demo", status: "completed-retained" },
            completionGate,
            phases: [
              { id: "P0", status: "complete" },
              { id: "P1", status: "complete" },
            ],
          });
          const seed = yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z");
          expect(O.isSome(seed)).toBe(true);
          if (O.isNone(seed)) return;
          yield* applyPacketGenesisSeed(seed.value);
          const store = yield* PacketEventStore;
          const listing = yield* store.list(PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath }));
          expect(A.length(listing.events)).toBe(1);
          const body = listing.events[0]?.event.body;
          expect(body?.type).toBe("packet-created");
          if (body?.type === "packet-created") {
            expect(body.status).toBe("completed-retained");
            expect(body.stage).toBe("P1");
            expect(body.ordinal).toBe(1);
          }
          expect(yield* fs.exists(`${packetPath}/ops/trace.json`)).toBe(true);
          expect(O.isNone(yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z"))).toBe(true);
        }).pipe(Effect.scoped, provideScopedLayer(testLayer))
      ),
    20_000
  );
});
