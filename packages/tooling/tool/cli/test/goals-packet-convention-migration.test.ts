import {
  applyPacketGenesisSeed,
  foldPacketEvents,
  GoalPacketRecord,
  goalsMigrateConventionsCommand,
  isJsonRecord,
  lintGoalFleet,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  PacketGenesisSeed,
  PacketStreamLocator,
  packetEventDigest,
  packetEventFileName,
  parseGoalManifestText,
  planManifestTranslation,
  planPacketGenesisSeed,
  renderPacketEventFile,
} from "@beep/repo-cli/test/Goals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import {
  expectReportedExit,
  readProjectFile,
  withTempWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

const mutationLayer = PacketForkRepairApplierLive.pipe(Layer.provideMerge(PacketEventStoreLive));
const testLayer = Layer.mergeAll(NodeServices.layer, mutationLayer.pipe(Layer.provideMerge(NodeServices.layer)));
const FORKED_PATH = new URL("./fixtures/packet-core/forked", import.meta.url).pathname;
const encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const encodeJson = (value: unknown): string => Result.getOrThrow(encodeJsonResult(value));
const runMigration = Command.runWith(goalsMigrateConventionsCommand, { version: "0.0.0" });

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

  for (const schemaVersion of ["initiative-manifest/v1", "1.0.0"] as const) {
    it(`translates the supported ${schemaVersion} declaration`, () => {
      const plan = planManifestTranslation(
        record("demo", {
          schemaVersion,
          initiative: { id: "demo", status: "active" },
          completionGate,
          bespoke: { preserved: true },
        })
      );
      expect(plan.issues).toStrictEqual([]);
      expect(O.isSome(plan.translation)).toBe(true);
      if (O.isNone(plan.translation)) return;
      expect(plan.translation.value.beforeVersion).toBe(schemaVersion);
      expect(plan.translation.value.drift).toContain("breaking");
      expect(plan.translation.value.drift).toContain("additive");
      const parsed = parseGoalManifestText(plan.translation.value.content);
      expect(O.isSome(parsed) && isJsonRecord(parsed.value) ? parsed.value.bespoke : undefined).toStrictEqual({
        preserved: true,
      });
    });
  }

  it("repairs an incomplete v2 shape without classifying a version downgrade", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        completionGate,
      })
    );
    expect(plan.issues).toStrictEqual([]);
    expect(O.isSome(plan.translation)).toBe(true);
    if (O.isNone(plan.translation)) return;
    expect(plan.translation.value.drift).not.toContain("breaking");
    expect(plan.translation.value.drift).toContain("additive");
    expect(plan.translation.value.edits).not.toContain("schemaVersion -> initiative-manifest/v2");
  });

  it("leaves a complete v2 manifest untouched", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      })
    );
    expect(plan.issues).toStrictEqual([]);
    expect(O.isNone(plan.translation)).toBe(true);
  });

  it("blocks unknown future declarations instead of downgrading them", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v999",
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      })
    );
    expect(O.isNone(plan.translation)).toBe(true);
    expect(plan.issues[0]?.message).toContain("not a recognized string migration source");
  });

  for (const schemaVersion of [999, null, {}, ["initiative-manifest/v3"]] as const) {
    it(`blocks a malformed schemaVersion value (${JSON.stringify(schemaVersion)})`, () => {
      const plan = planManifestTranslation(
        record("demo", {
          schemaVersion,
          initiative: { id: "demo", status: "active" },
          completionGate,
        })
      );
      expect(O.isNone(plan.translation)).toBe(true);
      expect(plan.issues[0]?.message).toContain("not a recognized string migration source");
    });
  }

  it("reports an invalid lifecycle status as a violation", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "not-a-goal-status" },
        completionGate,
      })
    );
    expect(O.isNone(plan.translation)).toBe(true);
    expect(plan.issues[0]?.message).toContain("not a canonical goal status");
  });

  it("reports malformed completion-gate and phase shapes before seed planning", () => {
    const malformedGate = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        completionGate: {},
      })
    );
    expect(O.isNone(malformedGate.translation)).toBe(true);
    expect(malformedGate.issues[0]?.message).toContain("does not decode as GoalManifest");

    const malformedPhase = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        completionGate,
        phases: [{ id: "P0", status: "not-a-phase-status" }],
      })
    );
    expect(O.isNone(malformedPhase.translation)).toBe(true);
    expect(malformedPhase.issues[0]?.message).toContain("does not decode as GoalManifest");
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

layer(testLayer, { timeout: 30_000 })("packet mutation", (it) => {
  it.effect(
    "stages and applies the committed fork fixture, then becomes idempotent",
    Effect.fnUntraced(function* () {
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
    })
  );

  it.effect(
    "commits one innermost repair at a time until a multi-fork stream is linear",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-multi-fork-repair-" });
      const packetPath = `${root}/forked`;
      yield* fs.copy(FORKED_PATH, packetPath);
      const locator = PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath });
      const store = yield* PacketEventStore;
      const original = yield* store.list(locator);
      const nestedParent = A.findFirst(original.events, (stored) => stored.event.seq === 3);
      expect(O.isSome(nestedParent)).toBe(true);
      if (O.isNone(nestedParent)) return;

      for (const [at, status] of [
        ["2026-08-17T01:00:00.000Z", "paused"],
        ["2026-08-17T02:00:00.000Z", "active"],
      ] as const) {
        const event = PacketEvent.make({
          schemaVersion: "packet-event/v1",
          packet: "forked",
          root: "goals",
          seq: 4,
          parent: nestedParent.value.id,
          expectedRevision: 3,
          at,
          actor: "test",
          body: { type: "status-set", status, previous: "active" },
        });
        const id = yield* packetEventDigest(event);
        const content = yield* renderPacketEventFile(event);
        yield* fs.writeFileString(`${packetPath}/ops/events/${packetEventFileName(event, id)}`, content);
      }

      const before = yield* store.list(locator);
      expect(foldPacketEvents({ packet: "forked", root: "goals", events: before.events }).forks).toHaveLength(2);

      const applier = yield* PacketForkRepairApplier;
      expect(O.isSome(yield* applier.apply(locator))).toBe(true);
      const intermediate = yield* store.list(locator);
      expect(foldPacketEvents({ packet: "forked", root: "goals", events: intermediate.events }).forks).toHaveLength(1);

      expect(O.isSome(yield* applier.apply(locator))).toBe(true);
      const repaired = yield* store.list(locator);
      const derived = foldPacketEvents({ packet: "forked", root: "goals", events: repaired.events });
      expect(repaired.issues).toStrictEqual([]);
      expect(derived.forks).toStrictEqual([]);
      expect(O.isNone(yield* applier.apply(locator))).toBe(true);
    })
  );

  it.effect(
    "seeds exactly one honest current-snapshot event and trace",
    Effect.fnUntraced(function* () {
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
          { id: "P1", status: "in-progress" },
          { id: "P2", status: "in-progress" },
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
        expect(body.stage).toBe("P2");
        expect(body.ordinal).toBe(2);
      }
      expect(yield* fs.exists(`${packetPath}/ops/trace.json`)).toBe(true);
      expect(O.isNone(yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z"))).toBe(true);
    })
  );

  it.effect(
    "rolls back a newly created genesis stream when the trace write fails",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-rollback-" });
      const packetPath = `${root}/demo`;
      yield* fs.makeDirectory(`${packetPath}/ops`, { recursive: true });
      yield* fs.writeFileString(`${packetPath}/ops/trace-parent`, "blocks trace directory\n");
      const packet = GoalPacketRecord.make({
        slug: "demo",
        packetPath,
        manifestPath: `${packetPath}/ops/manifest.json`,
        readmePath: `${packetPath}/README.md`,
      });
      const manifest = encodeJson({
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      });
      const seed = yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z");
      expect(O.isSome(seed)).toBe(true);
      if (O.isNone(seed)) return;
      const failingSeed = PacketGenesisSeed.make({
        ...seed.value,
        tracePath: `${packetPath}/ops/trace-parent/trace.json`,
      });
      const exit = yield* Effect.exit(applyPacketGenesisSeed(failingSeed));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(yield* fs.exists(seed.value.eventsDirectory)).toBe(false);
      expect(yield* fs.readFileString(`${packetPath}/ops/trace-parent`)).toBe("blocks trace directory\n");
    })
  );
});

layer(testLayer, { timeout: 30_000 })("migration command boundaries", (it) => {
  it.effect(
    "rejects an invalid adoption timestamp through the controlled CLI error path",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(runMigration(["--preview", "--at", "not-iso"]));
      expectReportedExit(exit);
    })
  );

  it.effect(
    "fails closed when the goal fleet cannot be inventoried",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const exit = yield* Effect.exit(runMigration(["--preview", "--at", "2026-08-26T00:00:00.000Z"]));
          expectReportedExit(exit);
        })
      );
    })
  );

  it.effect(
    "rejects report paths that could overwrite packet manifests or traces",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile("goals/demo/ops/manifest.json", "manifest bytes\n");
          yield* writeProjectFile("goals/demo/ops/trace.json", "trace bytes\n");
          for (const reportPath of [
            "goals/demo/ops/manifest.json",
            "goals/demo/ops/trace.json",
            "goals/new/ops/manifest.json",
          ]) {
            const exit = yield* Effect.exit(
              runMigration(["--apply", "--at", "2026-08-26T00:00:00.000Z", "--report", reportPath])
            );
            expectReportedExit(exit);
          }
          expect(yield* readProjectFile("goals/demo/ops/manifest.json")).toBe("manifest bytes\n");
          expect(yield* readProjectFile("goals/demo/ops/trace.json")).toBe("trace bytes\n");
          const fs = yield* FileSystem.FileSystem;
          expect(yield* fs.exists("goals/new/ops/manifest.json")).toBe(false);
        })
      );
    })
  );

  it.effect(
    "rolls back the fleet on a late report failure and preserves a clean rerun report",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const original = `${encodeJson({
            schemaVersion: "initiative-manifest/v1",
            initiative: { id: "demo", status: "active" },
            completionGate,
          })}\n`;
          yield* writeProjectFile("goals/demo/ops/manifest.json", original);
          yield* writeProjectFile(
            "goals/packet-convention-migration/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v2",
              initiative: { id: "packet-convention-migration", status: "active" },
              lifecycle: "active",
              packetPath: "goals/packet-convention-migration",
              completionGate,
            })}\n`
          );
          yield* writeProjectFile(
            "goals/packet-convention-migration/history/report-parent",
            "blocks report directory\n"
          );
          const failed = yield* Effect.exit(
            runMigration([
              "--apply",
              "--at",
              "2026-08-26T00:00:00.000Z",
              "--report",
              "goals/packet-convention-migration/history/report-parent/migration.md",
            ])
          );
          expectReportedExit(failed);
          expect(yield* readProjectFile("goals/demo/ops/manifest.json")).toBe(original);
          const fs = yield* FileSystem.FileSystem;
          expect(yield* fs.exists("goals/demo/ops/events")).toBe(false);
          expect(yield* fs.exists("goals/demo/ops/trace.json")).toBe(false);

          const reportPath = "goals/packet-convention-migration/history/migration-report.md";
          const applied = yield* Effect.exit(
            runMigration(["--apply", "--at", "2026-08-26T00:00:00.000Z", "--report", reportPath])
          );
          expect(Exit.isSuccess(applied)).toBe(true);
          const report = yield* readProjectFile(reportPath);
          expect(report).toContain("remaining translations: 0");
          expect(report).toContain("remaining genesis seeds: 0");

          const noOp = yield* Effect.exit(
            runMigration(["--apply", "--at", "2026-08-26T00:00:00.000Z", "--report", reportPath])
          );
          expect(Exit.isSuccess(noOp)).toBe(true);
          expect(yield* readProjectFile(reportPath)).toBe(report);
        })
      );
    })
  );

  it.effect(
    "preserves a concurrent manifest edit and reports the rollback conflict",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const original = `${encodeJson({
            schemaVersion: "initiative-manifest/v1",
            initiative: { id: "demo", status: "active" },
            completionGate,
          })}\n`;
          yield* writeProjectFile("goals/demo/ops/manifest.json", original);
          yield* writeProjectFile(
            "goals/packet-convention-migration/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v2",
              initiative: { id: "packet-convention-migration", status: "active" },
              lifecycle: "active",
              packetPath: "goals/packet-convention-migration",
              completionGate,
            })}\n`
          );
          yield* writeProjectFile("goals/packet-convention-migration/history/.gitkeep", "");

          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const manifestPath = path.resolve("goals/demo/ops/manifest.json");
          const foreignBytes = "concurrent manifest edit\n";
          const racingFileSystem = {
            ...fs,
            rename: (source: string, target: string) =>
              fs
                .rename(source, target)
                .pipe(
                  Effect.tap(() => (target === manifestPath ? fs.writeFileString(target, foreignBytes) : Effect.void))
                ),
          };
          const exit = yield* Effect.exit(
            runMigration([
              "--apply",
              "--at",
              "2026-08-26T00:00:00.000Z",
              "--report",
              "goals/packet-convention-migration/history/migration-report.md",
            ]).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem))
          );
          expectReportedExit(exit);
          expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain("rollback failed");
          expect(yield* fs.readFileString(manifestPath)).toBe(foreignBytes);
          expect(yield* fs.exists("goals/demo/ops/events")).toBe(false);
        })
      );
    })
  );
});
