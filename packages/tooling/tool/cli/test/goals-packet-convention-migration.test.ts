import {
  applyPacketGenesisSeed,
  foldPacketEvents,
  GoalPacketRecord,
  goalsMigrateConventionsCommand,
  goalsRepairForkCommand,
  isJsonRecord,
  lintGoalFleet,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketForkRepairApplier,
  PacketForkRepairApplierLive,
  PacketGenesisSeed,
  PacketStreamListing,
  PacketStreamLocator,
  packetEventDigest,
  packetEventFileName,
  parseGoalManifestText,
  planManifestTranslation,
  planPacketGenesisSeed,
  renderPacketEventFile,
  renderTranslationReport,
  TranslationAssumption,
  TranslationIssue,
  TranslationReport,
} from "@beep/repo-cli/test/Goals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { Context, Effect, Exit, FileSystem, Layer, Path, PlatformError, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
const runRepair = Command.runWith(goalsRepairForkCommand, { version: "0.0.0" });

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

const injectedFileSystemError = (method: string, path: string): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: "Unknown",
    module: "FileSystem",
    method,
    pathOrDescriptor: path,
    description: "injected failure",
  });

const makeGenesisRollbackSeed = Effect.fnUntraced(function* (root: string, label: string) {
  const fs = yield* FileSystem.FileSystem;
  const packetPath = `${root}/${label}`;
  const eventsDirectory = `${packetPath}/ops/events`;
  const eventFileName = "00001-owned.json";
  yield* fs.makeDirectory(`${packetPath}/ops`, { recursive: true });
  yield* fs.writeFileString(`${packetPath}/ops/trace-parent`, "blocks trace directory\n");
  return PacketGenesisSeed.make({
    slug: label,
    eventsDirectory,
    eventFileName,
    eventText: "owned\n",
    tracePath: `${packetPath}/ops/trace-parent/trace.json`,
    traceText: "trace\n",
  });
});

describe("manifest translation", () => {
  it("rejects missing, invalid, and non-object manifests", () => {
    const missing = planManifestTranslation(
      GoalPacketRecord.make({
        slug: "missing",
        packetPath: "goals/missing",
        manifestPath: "goals/missing/ops/manifest.json",
        readmePath: "goals/missing/README.md",
      })
    );
    expect(missing.issues[0]?.message).toContain("manifest is missing");
    const invalid = GoalPacketRecord.make({
      slug: "invalid",
      packetPath: "goals/invalid",
      manifestPath: "goals/invalid/ops/manifest.json",
      readmePath: "goals/invalid/README.md",
      manifestText: "{",
    });
    expect(planManifestTranslation(invalid).issues[0]?.message).toContain("does not parse as a JSON object");
    const primitive = GoalPacketRecord.make({
      slug: "primitive",
      packetPath: "goals/primitive",
      manifestPath: "goals/primitive/ops/manifest.json",
      readmePath: "goals/primitive/README.md",
      manifestText: "42\n",
    });
    expect(planManifestTranslation(primitive).issues[0]?.message).toContain("does not parse as a JSON object");
  });

  it("reports every required-field contradiction and phase shape", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "other" },
        lifecycle: "active",
        packetPath: "goals/other",
        phases: 1,
      })
    );
    const messages = A.map(plan.issues, (item) => item.message);
    expect(plan.probe.phaseShape).toBe("invalid");
    expect(messages).toContain("initiative.status is missing");
    expect(messages).toContain('initiative.id declares "other"');
    expect(messages).toContain("completionGate object is missing");
    expect(messages).toContain('packetPath declares "goals/other"');

    const missingInitiative = planManifestTranslation(
      record("demo", { schemaVersion: "initiative-manifest/v1", phases: { P0: "complete" } })
    );
    expect(missingInitiative.probe.phaseShape).toBe("record");
    expect(A.map(missingInitiative.issues, (item) => item.message)).toContain("initiative object is missing");
    expect(A.map(missingInitiative.issues, (item) => item.message)).toContain("initiative.id is missing");
  });

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

  it("preserves an existing v2 declaration while planning compatibility-field repairs", () => {
    const plan = planManifestTranslation(
      record("already-v2", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "already-v2", status: "active" },
        completionGate,
      })
    );
    expect(plan.issues).toStrictEqual([]);
    expect(O.isSome(plan.translation)).toBe(true);
    if (O.isNone(plan.translation)) return;
    expect(plan.translation.value.edits).not.toContain("schemaVersion -> initiative-manifest/v2");
    expect(plan.translation.value.drift).not.toContain("breaking");
  });

  it("reports an unreadable translated candidate that disappears after its shape probe", () => {
    const manifestText = `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "unreadable", status: "active" },
      lifecycle: "active",
      packetPath: "goals/unreadable",
      completionGate,
    })}\n`;
    const unreadable = record("unreadable", {
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "unreadable", status: "active" },
      lifecycle: "active",
      packetPath: "goals/unreadable",
      completionGate,
    });
    let reads = 0;
    expect(
      Reflect.defineProperty(unreadable, "manifestText", {
        configurable: true,
        get: () => {
          reads += 1;
          return reads < 3 ? manifestText : undefined;
        },
      })
    ).toBe(true);
    const plan = planManifestTranslation(unreadable);
    expect(O.isNone(plan.translation)).toBe(true);
    expect(plan.issues[0]?.message).toBe("translated candidate does not parse as a JSON object");
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

  it("preserves existing compatibility fields and normalizes a missing final newline", () => {
    const withLifecycle = planManifestTranslation(
      GoalPacketRecord.make({
        slug: "demo",
        packetPath: "goals/demo",
        manifestPath: "goals/demo/ops/manifest.json",
        readmePath: "goals/demo/README.md",
        manifestText: encodeJson({
          schemaVersion: "initiative-manifest/v1",
          initiative: { id: "demo", status: "active" },
          lifecycle: "active",
          completionGate,
        }),
      })
    );
    expect(O.isSome(withLifecycle.translation)).toBe(true);
    if (O.isNone(withLifecycle.translation)) return;
    expect(withLifecycle.translation.value.edits).not.toContain("add lifecycle from initiative.status");
    expect(withLifecycle.translation.value.edits).toContain("add packetPath from the scanned directory");
    expect(withLifecycle.translation.value.content.at(-1)).toBe("\n");

    const withPacketPath = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        packetPath: "goals/demo",
        completionGate,
      })
    );
    expect(O.isSome(withPacketPath.translation)).toBe(true);
    if (O.isNone(withPacketPath.translation)) return;
    expect(withPacketPath.translation.value.edits).toContain("add lifecycle from initiative.status");
    expect(withPacketPath.translation.value.edits).not.toContain("add packetPath from the scanned directory");
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

  it("ignores exploration edges and fully migrated references while skipping malformed records", () => {
    const records = [
      record("a", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "a", status: "active" },
        completionGate,
        blockedBy: ["goals/b#P1", "explorations/idea", 42],
      }),
      record("b", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "b", status: "active" },
        completionGate,
      }),
      GoalPacketRecord.make({
        slug: "missing",
        packetPath: "goals/missing",
        manifestPath: "goals/missing/ops/manifest.json",
        readmePath: "goals/missing/README.md",
      }),
      GoalPacketRecord.make({
        slug: "invalid",
        packetPath: "goals/invalid",
        manifestPath: "goals/invalid/ops/manifest.json",
        readmePath: "goals/invalid/README.md",
        manifestText: "null",
      }),
      record("missing-id", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { status: "active" },
        lifecycle: "active",
        packetPath: "goals/missing-id",
        completionGate,
      }),
    ];
    expect(lintGoalFleet(records)).toStrictEqual([]);
  });

  it("accepts bare packet references when the target exists", () => {
    expect(
      lintGoalFleet([
        record("a", {
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "a", status: "active" },
          completionGate,
          blockedBy: ["b"],
        }),
        record("b", {
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "b", status: "active" },
          completionGate,
        }),
      ])
    ).toStrictEqual([]);
  });

  it("excludes exploration-prefixed blockedBy references from dangling-reference findings", () => {
    const findings = lintGoalFleet([
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        completionGate,
        blockedBy: ["explorations/ungraduated-idea"],
      }),
    ]);
    expect(A.filter(findings, (finding) => finding.kind === "unreachable-packet")).toStrictEqual([]);
  });

  it("reports a blockedBy slug that is absent from the fleet", () => {
    const findings = lintGoalFleet([
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        completionGate,
        blockedBy: ["goals/absent"],
      }),
    ]);
    const dangling = A.filter(findings, (finding) => finding.kind === "unreachable-packet");
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.related).toStrictEqual(["absent"]);
  });

  it("emits one dependency-cycle finding when duplicate member edges rediscover the same cycle", () => {
    const findings = lintGoalFleet([
      record("a", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "a", status: "active" },
        completionGate,
        blockedBy: ["goals/b"],
      }),
      record("b", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "b", status: "active" },
        completionGate,
        blockedBy: ["goals/a", "goals/a"],
      }),
    ]);
    expect(A.filter(findings, (finding) => finding.kind === "dependency-cycle")).toHaveLength(1);
  });
});

describe("migration report rendering", () => {
  it("renders populated translations, issues, assumptions, and fleet findings", () => {
    const plan = planManifestTranslation(
      record("demo", {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        completionGate,
      })
    );
    expect(O.isSome(plan.translation)).toBe(true);
    if (O.isNone(plan.translation)) return;
    const report = TranslationReport.make({
      schemaVersion: "packet-convention-report/v1",
      mode: "preview",
      probes: [plan.probe],
      translations: [plan.translation.value],
      issues: [TranslationIssue.make({ slug: "demo", severity: "violation", message: "blocked" })],
      assumptions: [TranslationAssumption.make({ slug: "demo", message: "known shape" })],
      fleetFindings: lintGoalFleet([
        record("demo", {
          initiative: { id: "demo", status: "active" },
          completionGate,
          blockedBy: ["goals/missing"],
        }),
      ]),
      seeds: [],
    });
    const rendered = renderTranslationReport(report);
    expect(rendered).toContain("schemaVersion -> initiative-manifest/v2");
    expect(rendered).toContain("violation: `demo` — blocked");
    expect(rendered).toContain("known shape");
    expect(rendered).toContain("Unreachable packet references: 1");
  });
});

layer(testLayer, { timeout: 30_000 })("packet mutation", (it) => {
  it.effect(
    "rejects invalid genesis seed inputs through PacketStreamError",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-invalid-" });
      const makePacket = (slug: string) =>
        GoalPacketRecord.make({
          slug,
          packetPath: `${root}/${slug}`,
          manifestPath: `${root}/${slug}/ops/manifest.json`,
          readmePath: `${root}/${slug}/README.md`,
        });
      const validManifest = encodeJson({
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      });
      const invalidJson = yield* Effect.exit(
        planPacketGenesisSeed(makePacket("demo"), "{", "2026-08-26T00:00:00.000Z")
      );
      expect(Exit.isFailure(invalidJson) ? invalidJson.cause.toString() : "").toContain("invalid JSON");
      const invalidSlug = yield* Effect.exit(
        planPacketGenesisSeed(makePacket("Not Valid"), validManifest, "2026-08-26T00:00:00.000Z")
      );
      expect(Exit.isFailure(invalidSlug) ? invalidSlug.cause.toString() : "").toContain("not a valid packet slug");
      const invalidTimestamp = yield* Effect.exit(planPacketGenesisSeed(makePacket("demo"), validManifest, "nope"));
      expect(Exit.isFailure(invalidTimestamp) ? invalidTimestamp.cause.toString() : "").toContain(
        "not a full ISO-8601"
      );
      const invalidManifest = yield* Effect.exit(
        planPacketGenesisSeed(makePacket("demo"), "{}", "2026-08-26T00:00:00.000Z")
      );
      expect(Exit.isFailure(invalidManifest) ? invalidManifest.cause.toString() : "").toContain(
        "schema decoding failed"
      );
    })
  );

  it.effect(
    "maps genesis inspection and directory creation failures without touching existing bytes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-boundary-" });
      const eventsDirectory = `${root}/demo/ops/events`;
      const seed = PacketGenesisSeed.make({
        slug: "demo",
        eventsDirectory,
        eventFileName: "00001-owned.json",
        eventText: "owned\n",
        tracePath: `${root}/demo/ops/trace.json`,
        traceText: "trace\n",
      });
      yield* fs.makeDirectory(eventsDirectory, { recursive: true });
      const appeared = yield* Effect.exit(applyPacketGenesisSeed(seed));
      expect(Exit.isFailure(appeared) ? appeared.cause.toString() : "").toContain("appeared after preview");
      yield* fs.remove(eventsDirectory, { recursive: true });

      const inspectionFailure = yield* Effect.exit(
        applyPacketGenesisSeed(seed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            exists: (target) =>
              target === eventsDirectory ? Effect.fail(injectedFileSystemError("exists", target)) : fs.exists(target),
          })
        )
      );
      expect(Exit.isFailure(inspectionFailure) ? inspectionFailure.cause.toString() : "").toContain(
        "genesis stream inspection failed"
      );

      const directoryFailure = yield* Effect.exit(
        applyPacketGenesisSeed(seed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            makeDirectory: (target, options) =>
              target === eventsDirectory
                ? Effect.fail(injectedFileSystemError("makeDirectory", target))
                : fs.makeDirectory(target, options),
          })
        )
      );
      expect(Exit.isFailure(directoryFailure) ? directoryFailure.cause.toString() : "").toContain(
        "genesis directory write failed"
      );
    })
  );

  it.effect(
    "reports an event-write failure after rollback removes the empty events directory",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-event-failure-" });
      const eventsDirectory = `${root}/demo/ops/events`;
      yield* fs.makeDirectory(`${root}/demo/ops`, { recursive: true });
      const seed = PacketGenesisSeed.make({
        slug: "demo",
        eventsDirectory,
        eventFileName: "00001-owned.json",
        eventText: "owned\n",
        tracePath: `${root}/demo/ops/trace.json`,
        traceText: "trace\n",
      });
      const exit = yield* Effect.exit(
        applyPacketGenesisSeed(seed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            makeTempFileScoped: () => Effect.fail(injectedFileSystemError("makeTempFileScoped", eventsDirectory)),
          })
        )
      );
      expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain("genesis event write failed");
      expect(yield* fs.exists(eventsDirectory)).toBe(false);
    })
  );

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
    "maps fork-repair staging and survivor-copy failures",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* PacketEventStore;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-fork-failures-" });
      const makeApplier = (fileSystem: FileSystem.FileSystem) =>
        Layer.build(
          Layer.fresh(PacketForkRepairApplierLive).pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(PacketEventStore, store),
                Layer.succeed(FileSystem.FileSystem, fileSystem),
                Layer.succeed(Path.Path, path)
              )
            )
          )
        ).pipe(
          Effect.map((context) => Context.get(context, PacketForkRepairApplier)),
          Effect.scoped
        );

      const stagingPacketPath = `${root}/staging/forked`;
      yield* fs.makeDirectory(`${root}/staging`);
      yield* fs.copy(FORKED_PATH, stagingPacketPath);
      const stagingLocator = PacketStreamLocator.make({
        packet: "forked",
        root: "goals",
        packetPath: stagingPacketPath,
      });
      const stagingApplier = yield* makeApplier({
        ...fs,
        makeTempDirectory: () => Effect.fail(injectedFileSystemError("makeTempDirectory", stagingPacketPath)),
      });
      expect(O.isSome(yield* stagingApplier.preview(stagingLocator))).toBe(true);
      const stagingFailure = yield* Effect.exit(stagingApplier.apply(stagingLocator));
      expect(Exit.isFailure(stagingFailure) ? stagingFailure.cause.toString() : "").toContain("repair staging failed");

      const copyPacketPath = `${root}/copy/forked`;
      yield* fs.makeDirectory(`${root}/copy`);
      yield* fs.copy(FORKED_PATH, copyPacketPath);
      const copyLocator = PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath: copyPacketPath });
      const copyApplier = yield* makeApplier({
        ...fs,
        copyFile: (source, target) => Effect.fail(injectedFileSystemError("copyFile", `${source}:${target}`)),
      });
      const copyFailure = yield* Effect.exit(copyApplier.apply(copyLocator));
      expect(Exit.isFailure(copyFailure) ? copyFailure.cause.toString() : "").toContain("event copy failed");
    })
  );

  it.effect(
    "preserves the original fork-repair error when cleanup existence checks fail",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* PacketEventStore;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-fork-cleanup-exists-" });
      const packetPath = `${root}/forked`;
      yield* fs.copy(FORKED_PATH, packetPath);
      const locator = PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath });
      const failingFileSystem: FileSystem.FileSystem = {
        ...fs,
        copyFile: (_source, target) => Effect.fail(injectedFileSystemError("copyFile", target)),
        exists: (target) => Effect.fail(injectedFileSystemError("exists", target)),
      };
      const applier = yield* Layer.build(
        Layer.fresh(PacketForkRepairApplierLive).pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(PacketEventStore, store),
              Layer.succeed(FileSystem.FileSystem, failingFileSystem),
              Layer.succeed(Path.Path, path)
            )
          )
        )
      ).pipe(
        Effect.map((context) => Context.get(context, PacketForkRepairApplier)),
        Effect.scoped
      );
      const exit = yield* Effect.exit(applier.apply(locator));
      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain("event copy failed");
    })
  );

  it.effect(
    "rejects fork-repair integrity races and restores bytes after promotion failures",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* PacketEventStore;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-fork-boundaries-" });
      const makeFixture = Effect.fnUntraced(function* (label: string) {
        const packetPath = `${root}/${label}/forked`;
        yield* fs.makeDirectory(`${root}/${label}`);
        yield* fs.copy(FORKED_PATH, packetPath);
        return PacketStreamLocator.make({ packet: "forked", root: "goals", packetPath });
      });
      const makeApplier = (fileSystem: FileSystem.FileSystem, eventStore: typeof store = store) =>
        Layer.build(
          Layer.fresh(PacketForkRepairApplierLive).pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(PacketEventStore, eventStore),
                Layer.succeed(FileSystem.FileSystem, fileSystem),
                Layer.succeed(Path.Path, path)
              )
            )
          )
        ).pipe(
          Effect.map((context) => Context.get(context, PacketForkRepairApplier)),
          Effect.scoped
        );
      const failureMessage = (exit: Exit.Exit<unknown, unknown>): string =>
        Exit.isFailure(exit) ? exit.cause.toString() : "";

      const invalidLocator = yield* makeFixture("invalid-original");
      yield* fs.writeFileString(`${invalidLocator.packetPath}/ops/events/invalid.json`, "not json\n");
      const defaultApplier = yield* makeApplier(fs);
      expect(failureMessage(yield* Effect.exit(defaultApplier.preview(invalidLocator)))).toContain(
        "stream has integrity issues"
      );
      expect(failureMessage(yield* Effect.exit(defaultApplier.apply(invalidLocator)))).toContain(
        "stream has integrity issues"
      );

      const writeLocator = yield* makeFixture("draft-write");
      const writeApplier = yield* makeApplier({
        ...fs,
        writeFileString: (target) => Effect.fail(injectedFileSystemError("writeFileString", target)),
      });
      expect(failureMessage(yield* Effect.exit(writeApplier.apply(writeLocator)))).toContain(
        "rebased event write failed"
      );

      const directoryLocator = yield* makeFixture("staged-directory");
      const directoryApplier = yield* makeApplier({
        ...fs,
        makeDirectory: (target) => Effect.fail(injectedFileSystemError("makeDirectory", target)),
      });
      expect(failureMessage(yield* Effect.exit(directoryApplier.apply(directoryLocator)))).toContain(
        "repair staging failed"
      );

      const stagedIntegrityLocator = yield* makeFixture("staged-integrity");
      const stagedIntegrityApplier = yield* makeApplier({
        ...fs,
        writeFileString: (target, _content, options) => fs.writeFileString(target, "not json\n", options),
      });
      expect(failureMessage(yield* Effect.exit(stagedIntegrityApplier.apply(stagedIntegrityLocator)))).toContain(
        "staged repair does not pass event integrity checks"
      );

      const noProgressLocator = yield* makeFixture("no-progress");
      const noProgressListing = yield* store.list(noProgressLocator);
      const noProgressStore = {
        ...store,
        list: (locator: PacketStreamLocator) =>
          locator.packetPath === noProgressLocator.packetPath
            ? store.list(locator)
            : Effect.succeed(
                PacketStreamListing.make({ events: noProgressListing.events, issues: noProgressListing.issues })
              ),
      };
      const noProgressApplier = yield* makeApplier(fs, noProgressStore);
      expect(failureMessage(yield* Effect.exit(noProgressApplier.apply(noProgressLocator)))).toContain(
        "staged repair did not remove the targeted fork"
      );

      const raceLocator = yield* makeFixture("stream-race");
      const raceEvents = `${raceLocator.packetPath}/ops/events`;
      const raceApplier = yield* makeApplier({
        ...fs,
        copyFile: (source, target) =>
          fs
            .copyFile(source, target)
            .pipe(Effect.tap(() => fs.writeFileString(`${raceEvents}/concurrent.json`, "not json\n"))),
      });
      expect(failureMessage(yield* Effect.exit(raceApplier.apply(raceLocator)))).toContain(
        "stream changed during repair staging"
      );

      const moveLocator = yield* makeFixture("move-failure");
      const moveEvents = `${moveLocator.packetPath}/ops/events`;
      const moveApplier = yield* makeApplier({
        ...fs,
        rename: (source, target) =>
          source === moveEvents ? Effect.fail(injectedFileSystemError("rename", source)) : fs.rename(source, target),
      });
      expect(failureMessage(yield* Effect.exit(moveApplier.apply(moveLocator)))).toContain(
        "existing stream move failed"
      );

      const promotionLocator = yield* makeFixture("promotion-failure");
      const promotionEvents = `${promotionLocator.packetPath}/ops/events`;
      const promotionApplier = yield* makeApplier({
        ...fs,
        rename: (source, target) =>
          target === promotionEvents && source !== promotionEvents
            ? Effect.fail(injectedFileSystemError("rename", source))
            : fs.rename(source, target),
      });
      expect(failureMessage(yield* Effect.exit(promotionApplier.apply(promotionLocator)))).toContain(
        "staged stream promotion failed"
      );
      expect((yield* store.list(promotionLocator)).issues).toStrictEqual([]);

      const verificationLocator = yield* makeFixture("verification-failure");
      const verificationEvents = `${verificationLocator.packetPath}/ops/events`;
      let verificationPromotions = 0;
      const verificationApplier = yield* makeApplier({
        ...fs,
        rename: (source, target) =>
          fs.rename(source, target).pipe(
            Effect.tap(() =>
              target !== verificationEvents
                ? Effect.void
                : Effect.sync(() => {
                    verificationPromotions += 1;
                    return verificationPromotions;
                  }).pipe(
                    Effect.flatMap((promotions) =>
                      promotions === 1
                        ? fs.writeFileString(`${verificationEvents}/invalid.json`, "not json\n")
                        : Effect.void
                    )
                  )
            )
          ),
      });
      expect(failureMessage(yield* Effect.exit(verificationApplier.apply(verificationLocator)))).toContain(
        "promoted stream failed verification"
      );
      expect(yield* fs.readFileString(`${verificationEvents}/invalid.json`)).toBe("not json\n");

      const traceLocator = yield* makeFixture("trace-write-failure");
      const tracePath = `${traceLocator.packetPath}/ops/trace.json`;
      const traceEvents = `${traceLocator.packetPath}/ops/events`;
      const concurrentEventPath = `${traceEvents}/concurrent.json`;
      yield* fs.writeFileString(tracePath, "previous trace\n");
      const traceApplier = yield* makeApplier({
        ...fs,
        writeFileString: (target, content, options) =>
          target === tracePath
            ? fs
                .writeFileString(concurrentEventPath, "concurrent event\n")
                .pipe(Effect.andThen(Effect.fail(injectedFileSystemError("writeFileString", target))))
            : fs.writeFileString(target, content, options),
      });
      expect(failureMessage(yield* Effect.exit(traceApplier.apply(traceLocator)))).toContain(
        "repaired trace write failed"
      );
      expect(yield* fs.readFileString(tracePath)).toBe("previous trace\n");
      expect(yield* fs.readFileString(concurrentEventPath)).toBe("concurrent event\n");
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
    "repairs an exact owned genesis event when its trace is missing",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-recovery-" });
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
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      });
      const planned = yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z");
      expect(O.isSome(planned)).toBe(true);
      if (O.isNone(planned)) return;
      yield* fs.makeDirectory(planned.value.eventsDirectory);
      yield* fs.writeFileString(
        `${planned.value.eventsDirectory}/${planned.value.eventFileName}`,
        planned.value.eventText
      );

      const recovery = yield* planPacketGenesisSeed(packet, manifest, "2026-08-27T00:00:00.000Z");
      expect(O.isSome(recovery)).toBe(true);
      if (O.isNone(recovery)) return;
      yield* applyPacketGenesisSeed(recovery.value);
      expect(yield* fs.readFileString(recovery.value.tracePath)).toBe(recovery.value.traceText);
      expect(O.isNone(yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z"))).toBe(true);
    })
  );

  it.effect(
    "repairs owned trace prefixes while preserving nonmatching foreign traces",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-partial-trace-" });
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
        initiative: { id: "demo", status: "active" },
        lifecycle: "active",
        packetPath: "goals/demo",
        completionGate,
      });
      const planned = yield* planPacketGenesisSeed(packet, manifest, "2026-08-25T00:00:00.000Z");
      expect(O.isSome(planned)).toBe(true);
      if (O.isNone(planned)) return;
      yield* fs.makeDirectory(planned.value.eventsDirectory);
      yield* fs.writeFileString(
        `${planned.value.eventsDirectory}/${planned.value.eventFileName}`,
        planned.value.eventText
      );

      const recovery = yield* planPacketGenesisSeed(packet, manifest, "2026-08-26T00:00:00.000Z");
      expect(O.isSome(recovery)).toBe(true);
      if (O.isNone(recovery)) return;
      let interrupted = false;
      const interruptedExit = yield* Effect.exit(
        applyPacketGenesisSeed(recovery.value).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            writeFileString: (target, content, options) => {
              if (!interrupted && content === recovery.value.traceText) {
                interrupted = true;
                return fs
                  .writeFileString(target, "partial trace\n", options)
                  .pipe(Effect.andThen(Effect.fail(injectedFileSystemError("writeFileString", target))));
              }
              return fs.writeFileString(target, content, options);
            },
          })
        )
      );
      expect(Exit.isFailure(interruptedExit)).toBe(true);
      expect(yield* fs.exists(recovery.value.tracePath)).toBe(false);

      yield* fs.writeFileString(recovery.value.tracePath, Str.takeLeft(32)(recovery.value.traceText));
      const retry = yield* planPacketGenesisSeed(packet, manifest, "2026-08-27T00:00:00.000Z");
      expect(O.isSome(retry)).toBe(true);
      if (O.isNone(retry)) return;
      yield* applyPacketGenesisSeed(retry.value).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          rename: (source, target) =>
            source === retry.value.tracePath
              ? fs.rename(source, target).pipe(Effect.andThen(fs.writeFileString(source, retry.value.traceText)))
              : fs.rename(source, target),
        })
      );
      expect(yield* fs.readFileString(retry.value.tracePath)).toBe(retry.value.traceText);
      expect(O.isNone(yield* planPacketGenesisSeed(packet, manifest, "2026-08-28T00:00:00.000Z"))).toBe(true);

      const foreignTrace = '{"foreign":true}\n';
      yield* fs.writeFileString(retry.value.tracePath, foreignTrace);
      const foreignRecovery = yield* planPacketGenesisSeed(packet, manifest, "2026-08-29T00:00:00.000Z");
      expect(O.isSome(foreignRecovery)).toBe(true);
      if (O.isNone(foreignRecovery)) return;
      const foreignExit = yield* Effect.exit(applyPacketGenesisSeed(foreignRecovery.value));
      expect(Exit.isFailure(foreignExit) ? foreignExit.cause.toString() : "").toContain(
        "genesis trace recovery conflict"
      );
      expect(yield* fs.readFileString(foreignRecovery.value.tracePath)).toBe(foreignTrace);

      yield* fs.writeFileString(retry.value.tracePath, Str.takeLeft(32)(retry.value.traceText));
      const racedRecovery = yield* planPacketGenesisSeed(packet, manifest, "2026-08-30T00:00:00.000Z");
      expect(O.isSome(racedRecovery)).toBe(true);
      if (O.isNone(racedRecovery)) return;
      const displacedTrace = '{"concurrent":true}\n';
      const racedExit = yield* Effect.exit(
        applyPacketGenesisSeed(racedRecovery.value).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) =>
              source === racedRecovery.value.tracePath
                ? fs.writeFileString(source, displacedTrace).pipe(Effect.andThen(fs.rename(source, target)))
                : fs.rename(source, target),
          })
        )
      );
      expect(Exit.isFailure(racedExit) ? racedExit.cause.toString() : "").toContain(
        "genesis trace quarantine conflict"
      );
      expect(yield* fs.readFileString(racedRecovery.value.tracePath)).toBe(displacedTrace);
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

  it.effect(
    "preserves a concurrent event that arrives after rollback validation",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-race-" });
      const packetPath = `${root}/demo`;
      const eventsDirectory = `${packetPath}/ops/events`;
      const eventFileName = "00001-packet-created-owned.json";
      const eventPath = `${eventsDirectory}/${eventFileName}`;
      const foreignPath = `${eventsDirectory}/00002-concurrent.json`;
      const foreignBytes = "concurrent event bytes\n";
      yield* fs.makeDirectory(`${packetPath}/ops`, { recursive: true });
      yield* fs.writeFileString(`${packetPath}/ops/trace-parent`, "blocks trace directory\n");
      const seed = PacketGenesisSeed.make({
        slug: "demo",
        eventsDirectory,
        eventFileName,
        eventText: "owned event bytes\n",
        tracePath: `${packetPath}/ops/trace-parent/trace.json`,
        traceText: "trace bytes\n",
      });
      const rename: FileSystem.FileSystem["rename"] = (source, target) =>
        source === eventsDirectory
          ? fs
              .rename(source, target)
              .pipe(
                Effect.andThen(fs.makeDirectory(eventsDirectory, { recursive: true })),
                Effect.andThen(fs.writeFileString(foreignPath, foreignBytes))
              )
          : fs.rename(source, target);
      const exit = yield* Effect.exit(
        applyPacketGenesisSeed(seed).pipe(Effect.provideService(FileSystem.FileSystem, { ...fs, rename }))
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain("genesis trace write failed");
      expect(yield* fs.exists(eventPath)).toBe(false);
      expect(yield* fs.readFileString(foreignPath)).toBe(foreignBytes);
    })
  );

  it.effect(
    "reports rollback setup, quarantine, rescan, and read failures",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-rollback-setup-errors-" });
      const scanSeed = yield* makeGenesisRollbackSeed(root, "scan-failure");
      const scanFailure = yield* Effect.exit(
        applyPacketGenesisSeed(scanSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readDirectory: (target, options) =>
              target === scanSeed.eventsDirectory
                ? Effect.fail(injectedFileSystemError("readDirectory", target))
                : fs.readDirectory(target, options),
          })
        )
      );
      expect(Exit.isFailure(scanFailure) ? scanFailure.cause.toString() : "").toContain("genesis rollback scan failed");

      const quarantineCreateSeed = yield* makeGenesisRollbackSeed(root, "quarantine-create-failure");
      const quarantineCreateFailure = yield* Effect.exit(
        applyPacketGenesisSeed(quarantineCreateSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            makeTempDirectory: (options) =>
              options?.directory === path.dirname(quarantineCreateSeed.eventsDirectory)
                ? Effect.fail(injectedFileSystemError("makeTempDirectory", options.directory))
                : fs.makeTempDirectory(options),
          })
        )
      );
      expect(Exit.isFailure(quarantineCreateFailure) ? quarantineCreateFailure.cause.toString() : "").toContain(
        "genesis rollback quarantine failed"
      );
      expect(yield* fs.exists(`${quarantineCreateSeed.eventsDirectory}/${quarantineCreateSeed.eventFileName}`)).toBe(
        true
      );
      yield* fs.remove(path.dirname(quarantineCreateSeed.tracePath));
      yield* fs.makeDirectory(path.dirname(quarantineCreateSeed.tracePath));
      yield* applyPacketGenesisSeed(quarantineCreateSeed);
      expect(yield* fs.readFileString(quarantineCreateSeed.tracePath)).toBe(quarantineCreateSeed.traceText);

      const quarantineRenameSeed = yield* makeGenesisRollbackSeed(root, "quarantine-rename-failure");
      const quarantineRenameFailure = yield* Effect.exit(
        applyPacketGenesisSeed(quarantineRenameSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) =>
              source === quarantineRenameSeed.eventsDirectory
                ? Effect.fail(injectedFileSystemError("rename", target))
                : fs.rename(source, target),
          })
        )
      );
      expect(Exit.isFailure(quarantineRenameFailure) ? quarantineRenameFailure.cause.toString() : "").toContain(
        "genesis rollback quarantine failed"
      );

      const rescanSeed = yield* makeGenesisRollbackSeed(root, "rescan-failure");
      let rescanCalls = 0;
      const rescanFailure = yield* Effect.exit(
        applyPacketGenesisSeed(rescanSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readDirectory: (target, options) => {
              rescanCalls += 1;
              return rescanCalls === 1
                ? fs.readDirectory(target, options)
                : Effect.fail(injectedFileSystemError("readDirectory", target));
            },
          })
        )
      );
      expect(Exit.isFailure(rescanFailure) ? rescanFailure.cause.toString() : "").toContain(
        "genesis rollback rescan failed"
      );

      const readSeed = yield* makeGenesisRollbackSeed(root, "read-failure");
      let readEventPath = "";
      const readFailure = yield* Effect.exit(
        applyPacketGenesisSeed(readSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) => {
              if (source === readSeed.eventsDirectory) readEventPath = `${target}/${readSeed.eventFileName}`;
              return fs.rename(source, target);
            },
            readFileString: (target, encoding) =>
              target === readEventPath
                ? Effect.fail(injectedFileSystemError("readFileString", target))
                : fs.readFileString(target, encoding),
          })
        )
      );
      expect(Exit.isFailure(readFailure) ? readFailure.cause.toString() : "").toContain(
        "genesis rollback event read failed"
      );
    })
  );

  it.effect(
    "preserves foreign events found before and during quarantine",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-rollback-foreign-" });
      const foreignSeed = yield* makeGenesisRollbackSeed(root, "foreign-conflict");
      const foreignPath = `${foreignSeed.eventsDirectory}/00002-foreign.json`;
      const foreignFailure = yield* Effect.exit(
        applyPacketGenesisSeed(foreignSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readDirectory: (target, options) =>
              target === foreignSeed.eventsDirectory
                ? fs.writeFileString(foreignPath, "foreign\n").pipe(Effect.andThen(fs.readDirectory(target, options)))
                : fs.readDirectory(target, options),
          })
        )
      );
      expect(Exit.isFailure(foreignFailure) ? foreignFailure.cause.toString() : "").toContain(
        "genesis rollback conflict: event directory contains foreign bytes"
      );
      expect(yield* fs.readFileString(foreignPath)).toBe("foreign\n");
      expect(yield* fs.exists(`${foreignSeed.eventsDirectory}/${foreignSeed.eventFileName}`)).toBe(true);

      const racedSeed = yield* makeGenesisRollbackSeed(root, "foreign-race");
      const racedFileName = "00002-raced.json";
      const racedPath = `${racedSeed.eventsDirectory}/${racedFileName}`;
      let racedQuarantine = "";
      const racedFailure = yield* Effect.exit(
        applyPacketGenesisSeed(racedSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readDirectory: (target, options) =>
              target === racedSeed.eventsDirectory
                ? fs.readDirectory(target, options).pipe(Effect.tap(() => fs.writeFileString(racedPath, "raced\n")))
                : fs.readDirectory(target, options),
            rename: (source, target) => {
              if (source === racedSeed.eventsDirectory) racedQuarantine = target;
              return fs.rename(source, target);
            },
          })
        )
      );
      expect(Exit.isFailure(racedFailure) ? racedFailure.cause.toString() : "").toContain(
        "genesis rollback conflict: foreign bytes preserved at"
      );
      expect(yield* fs.readFileString(`${racedQuarantine}/${racedFileName}`)).toBe("raced\n");
    })
  );

  it.effect(
    "preserves late foreign bytes and changed owned bytes in quarantine",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-rollback-late-" });
      const lateSeed = yield* makeGenesisRollbackSeed(root, "late-foreign-race");
      const lateFileName = "00002-late.json";
      let lateEventPath = "";
      let lateForeignPath = "";
      const lateFailure = yield* Effect.exit(
        applyPacketGenesisSeed(lateSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) => {
              if (source === lateSeed.eventsDirectory) {
                lateEventPath = `${target}/${lateSeed.eventFileName}`;
                lateForeignPath = `${target}/${lateFileName}`;
              }
              return fs.rename(source, target);
            },
            remove: (target, options) =>
              target === lateEventPath
                ? fs.remove(target, options).pipe(Effect.andThen(fs.writeFileString(lateForeignPath, "late\n")))
                : fs.remove(target, options),
          })
        )
      );
      expect(Exit.isFailure(lateFailure) ? lateFailure.cause.toString() : "").toContain(
        "genesis rollback conflict: foreign bytes preserved at"
      );
      expect(yield* fs.readFileString(lateForeignPath)).toBe("late\n");

      const changedSeed = yield* makeGenesisRollbackSeed(root, "changed-conflict");
      const changedPath = `${changedSeed.eventsDirectory}/${changedSeed.eventFileName}`;
      let changedQuarantine = "";
      const changedFailure = yield* Effect.exit(
        applyPacketGenesisSeed(changedSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readDirectory: (target, options) =>
              target === changedSeed.eventsDirectory
                ? fs
                    .readDirectory(target, options)
                    .pipe(Effect.tap(() => fs.writeFileString(changedPath, "concurrent replacement\n")))
                : fs.readDirectory(target, options),
            rename: (source, target) => {
              if (source === changedSeed.eventsDirectory) changedQuarantine = target;
              return fs.rename(source, target);
            },
          })
        )
      );
      expect(Exit.isFailure(changedFailure) ? changedFailure.cause.toString() : "").toContain(
        "genesis rollback conflict: changed event bytes preserved at"
      );
      expect(yield* fs.readFileString(`${changedQuarantine}/${changedSeed.eventFileName}`)).toBe(
        "concurrent replacement\n"
      );
    })
  );

  it.effect(
    "reports owned-event and quarantine-directory removal failures",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "packet-genesis-rollback-remove-errors-" });
      const eventRemoveSeed = yield* makeGenesisRollbackSeed(root, "event-remove-failure");
      let eventRemovePath = "";
      const eventRemoveFailure = yield* Effect.exit(
        applyPacketGenesisSeed(eventRemoveSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) => {
              if (source === eventRemoveSeed.eventsDirectory) {
                eventRemovePath = `${target}/${eventRemoveSeed.eventFileName}`;
              }
              return fs.rename(source, target);
            },
            remove: (target, options) =>
              target === eventRemovePath
                ? Effect.fail(injectedFileSystemError("remove", target))
                : fs.remove(target, options),
          })
        )
      );
      expect(Exit.isFailure(eventRemoveFailure) ? eventRemoveFailure.cause.toString() : "").toContain(
        "genesis rollback event remove failed"
      );

      const directoryRemoveSeed = yield* makeGenesisRollbackSeed(root, "directory-remove-failure");
      let rollbackRoot = "";
      const directoryRemoveFailure = yield* Effect.exit(
        applyPacketGenesisSeed(directoryRemoveSeed).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: (source, target) => {
              if (source === directoryRemoveSeed.eventsDirectory) rollbackRoot = path.dirname(target);
              return fs.rename(source, target);
            },
            remove: (target, options) =>
              target === rollbackRoot
                ? Effect.fail(injectedFileSystemError("remove", target))
                : fs.remove(target, options),
          })
        )
      );
      expect(Exit.isFailure(directoryRemoveFailure) ? directoryRemoveFailure.cause.toString() : "").toContain(
        "genesis rollback event remove failed"
      );
      expect(yield* fs.exists(`${directoryRemoveSeed.eventsDirectory}/${directoryRemoveSeed.eventFileName}`)).toBe(
        false
      );
    })
  );
});

layer(testLayer, { timeout: 30_000 })("migration command boundaries", (it) => {
  it.effect(
    "previews, applies, and reports no-op fork repairs through the command boundary",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals", { recursive: true });
          yield* fs.copy(FORKED_PATH, "goals/forked");
          expect(Exit.isSuccess(yield* Effect.exit(runRepair(["forked", "--preview"])))).toBe(true);
          expect(Exit.isSuccess(yield* Effect.exit(runRepair(["forked", "--apply"])))).toBe(true);
          expect(Exit.isSuccess(yield* Effect.exit(runRepair(["forked", "--preview"])))).toBe(true);
          expect(Exit.isSuccess(yield* Effect.exit(runRepair(["forked", "--apply"])))).toBe(true);
          yield* fs.writeFileString("goals/forked/ops/events/invalid.json", "not json\n");
          expectReportedExit(yield* Effect.exit(runRepair(["forked", "--preview"])));
        })
      );
    })
  );

  it.effect(
    "previews with the clock timestamp and preserves an already conforming fleet",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile(
            "goals/demo/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v2",
              initiative: { id: "demo", status: "active" },
              lifecycle: "active",
              packetPath: "goals/demo",
              completionGate,
            })}\n`
          );
          expect(Exit.isSuccess(yield* Effect.exit(runMigration(["--preview"])))).toBe(true);
          expect(
            Exit.isSuccess(
              yield* Effect.exit(
                runMigration([
                  "--apply",
                  "--at",
                  "2026-08-26T00:00:00.000Z",
                  "--report",
                  "goals/packet-convention-migration/history/report.md",
                ])
              )
            )
          ).toBe(true);
        })
      );
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile(
            "goals/demo/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v1",
              initiative: { id: "demo", status: "active" },
              completionGate,
            })}\n`
          );
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals/demo/ops/events", { recursive: true });
          expect(
            Exit.isSuccess(yield* Effect.exit(runMigration(["--preview", "--at", "2026-08-26T00:00:00.000Z"])))
          ).toBe(true);
        })
      );
    })
  );

  it.effect(
    "rejects invalid fleet directories and violation-bearing apply reports",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile(
            "goals/Not Valid/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v2",
              initiative: { id: "Not Valid", status: "active" },
              lifecycle: "active",
              packetPath: "goals/Not Valid",
              completionGate,
            })}\n`
          );
          expectReportedExit(yield* Effect.exit(runMigration(["--preview", "--at", "2026-08-26T00:00:00.000Z"])));
        })
      );
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectFile(
            "goals/demo/ops/manifest.json",
            `${encodeJson({
              schemaVersion: "initiative-manifest/v1",
              initiative: { id: "demo", status: "active" },
            })}\n`
          );
          expectReportedExit(
            yield* Effect.exit(
              runMigration([
                "--apply",
                "--at",
                "2026-08-26T00:00:00.000Z",
                "--report",
                "goals/packet-convention-migration/history/report.md",
              ])
            )
          );
        })
      );
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          for (const slug of ["a", "b"] as const) {
            yield* writeProjectFile(
              `goals/${slug}/ops/manifest.json`,
              `${encodeJson({
                schemaVersion: "initiative-manifest/v2",
                initiative: { id: slug, status: "active" },
                lifecycle: "active",
                packetPath: `goals/${slug}`,
                completionGate,
                blockedBy: [slug === "a" ? "goals/b" : "goals/a"],
              })}\n`
            );
          }
          expectReportedExit(
            yield* Effect.exit(
              runMigration([
                "--apply",
                "--at",
                "2026-08-26T00:00:00.000Z",
                "--report",
                "goals/packet-convention-migration/history/report.md",
              ])
            )
          );
        })
      );
    })
  );

  it.effect(
    "maps migration snapshot and promotion filesystem failures",
    Effect.fnUntraced(function* () {
      const manifestText = `${encodeJson({
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        completionGate,
      })}\n`;
      const args = [
        "--apply",
        "--at",
        "2026-08-26T00:00:00.000Z",
        "--report",
        "goals/packet-convention-migration/history/report.md",
      ];
      const exercise = (makeFileSystem: (fs: FileSystem.FileSystem, path: Path.Path) => FileSystem.FileSystem) =>
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* writeProjectFile("goals/demo/ops/manifest.json", manifestText);
            return yield* Effect.exit(
              runMigration(args).pipe(Effect.provideService(FileSystem.FileSystem, makeFileSystem(fs, path)))
            );
          })
        );

      let reads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.readFileString(target, encoding);
            }
            reads += 1;
            return reads === 2
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding);
          },
        }))
      );

      reads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.readFileString(target, encoding);
            }
            reads += 1;
            return reads === 2 ? Effect.succeed("changed after planning\n") : fs.readFileString(target, encoding);
          },
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) =>
            path.resolve(target) === path.resolve("goals/demo/ops/trace.json")
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding),
        }))
      );

      let inspections = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          exists: (target) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/events")) return fs.exists(target);
            inspections += 1;
            return inspections === 2 ? Effect.fail(injectedFileSystemError("exists", target)) : fs.exists(target);
          },
        }))
      );

      inspections = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          exists: (target) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/events")) return fs.exists(target);
            inspections += 1;
            return inspections === 2 ? Effect.succeed(true) : fs.exists(target);
          },
        }))
      );

      reads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.readFileString(target, encoding);
            }
            reads += 1;
            return reads === 3
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding);
          },
        }))
      );

      reads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.readFileString(target, encoding);
            }
            reads += 1;
            return reads === 3 ? Effect.succeed("changed before promotion\n") : fs.readFileString(target, encoding);
          },
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          rename: (source, target) =>
            path.resolve(target) === path.resolve("goals/demo/ops/manifest.json")
              ? Effect.fail(injectedFileSystemError("rename", target))
              : fs.rename(source, target),
        }))
      );
    })
  );

  it.effect(
    "maps fleet rollback conflicts and filesystem failures",
    Effect.fnUntraced(function* () {
      const manifestText = `${encodeJson({
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "demo", status: "active" },
        completionGate,
      })}\n`;
      const args = [
        "--apply",
        "--at",
        "2026-08-26T00:00:00.000Z",
        "--report",
        "goals/packet-convention-migration/history/report-parent/report.md",
      ];
      const exercise = (
        makeFileSystem: (fs: FileSystem.FileSystem, path: Path.Path) => FileSystem.FileSystem,
        previousTrace = false
      ) =>
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* writeProjectFile("goals/demo/ops/manifest.json", manifestText);
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
            if (previousTrace) yield* writeProjectFile("goals/demo/ops/trace.json", "previous trace\n");
            return yield* Effect.exit(
              runMigration(args).pipe(Effect.provideService(FileSystem.FileSystem, makeFileSystem(fs, path)))
            );
          })
        );
      const expectRollbackFailure = (exit: Exit.Exit<unknown, unknown>, message: string): void => {
        expectReportedExit(exit);
        expect(Exit.isFailure(exit) ? exit.cause.toString() : "").toContain(message);
      };

      let manifestReads = 0;
      expectRollbackFailure(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.readFileString(target, encoding);
            }
            manifestReads += 1;
            return manifestReads === 5
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding);
          },
        })),
        "manifest rollback read failed"
      );

      let manifestWrites = 0;
      expectRollbackFailure(
        yield* exercise((fs, path) => ({
          ...fs,
          rename: (source, target) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/manifest.json")) {
              return fs.rename(source, target);
            }
            manifestWrites += 1;
            return manifestWrites === 2
              ? Effect.fail(injectedFileSystemError("rename", target))
              : fs.rename(source, target);
          },
        })),
        "manifest rollback restore failed"
      );

      expectRollbackFailure(
        yield* exercise((fs, path) => ({
          ...fs,
          readDirectory: (target, options) =>
            path.resolve(target) === path.resolve("goals/demo/ops/events")
              ? Effect.fail(injectedFileSystemError("readDirectory", target))
              : fs.readDirectory(target, options),
        })),
        "seed rollback scan failed"
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readDirectory: (target, options) =>
            path.resolve(target) === path.resolve("goals/demo/ops/events")
              ? fs
                  .writeFileString(path.join(target, "foreign.json"), "foreign\n")
                  .pipe(Effect.andThen(fs.readDirectory(target, options)))
              : fs.readDirectory(target, options),
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) =>
            path.resolve(path.dirname(target)) === path.resolve("goals/demo/ops/events")
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding),
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) =>
            path.resolve(path.dirname(target)) === path.resolve("goals/demo/ops/events")
              ? Effect.succeed("changed event bytes\n")
              : fs.readFileString(target, encoding),
        }))
      );

      let traceReads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/trace.json")) {
              return fs.readFileString(target, encoding);
            }
            traceReads += 1;
            return traceReads === 2
              ? Effect.fail(injectedFileSystemError("readFileString", target))
              : fs.readFileString(target, encoding);
          },
        }))
      );

      traceReads = 0;
      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          readFileString: (target, encoding) => {
            if (path.resolve(target) !== path.resolve("goals/demo/ops/trace.json")) {
              return fs.readFileString(target, encoding);
            }
            traceReads += 1;
            return traceReads === 2 ? Effect.succeed("changed trace bytes\n") : fs.readFileString(target, encoding);
          },
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => ({
          ...fs,
          remove: (target, options) =>
            path.resolve(target) === path.resolve("goals/demo/ops/trace.json")
              ? Effect.fail(injectedFileSystemError("remove", target))
              : fs.remove(target, options),
        }))
      );

      expectReportedExit(
        yield* exercise((fs, path) => {
          let traceWrites = 0;
          return {
            ...fs,
            link: (source, target) => {
              if (path.resolve(target) !== path.resolve("goals/demo/ops/trace.json")) {
                return fs.link(source, target);
              }
              traceWrites += 1;
              return traceWrites === 2 ? Effect.fail(injectedFileSystemError("link", target)) : fs.link(source, target);
            },
          };
        }, true)
      );

      expectRollbackFailure(
        yield* exercise((fs, path) => {
          let rollbackRoot = "";
          return {
            ...fs,
            rename: (source, target) => {
              if (path.resolve(source) === path.resolve("goals/demo/ops/events")) {
                rollbackRoot = path.dirname(target);
              }
              return fs.rename(source, target);
            },
            remove: (target, options) =>
              target === rollbackRoot
                ? Effect.fail(injectedFileSystemError("remove", target))
                : fs.remove(target, options),
          };
        }),
        "seed rollback event remove failed"
      );
    })
  );

  it.effect(
    "rejects ambiguous modes and missing repair targets",
    Effect.fnUntraced(function* () {
      expectReportedExit(yield* Effect.exit(runMigration([])));
      expectReportedExit(yield* Effect.exit(runMigration(["--preview", "--apply"])));
      expectReportedExit(yield* Effect.exit(runRepair(["--preview"])));
      expectReportedExit(yield* Effect.exit(runRepair(["not valid", "--preview"])));
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          expectReportedExit(yield* Effect.exit(runRepair(["missing", "--preview"])));
        })
      );
    })
  );
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
    "recovers an existing v2 genesis across timestamps and rolls back only its repaired trace",
    Effect.fnUntraced(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const manifest = `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "demo", status: "active" },
            lifecycle: "active",
            packetPath: "goals/demo",
            completionGate,
          })}\n`;
          yield* writeProjectFile("goals/demo/ops/manifest.json", manifest);
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
          const packet = GoalPacketRecord.make({
            slug: "demo",
            packetPath: "goals/demo",
            manifestPath: "goals/demo/ops/manifest.json",
            readmePath: "goals/demo/README.md",
            manifestText: manifest,
          });
          const seed = yield* planPacketGenesisSeed(packet, manifest, "2026-08-25T00:00:00.000Z");
          expect(O.isSome(seed)).toBe(true);
          if (O.isNone(seed)) return;
          const fs = yield* FileSystem.FileSystem;
          const eventPath = `${seed.value.eventsDirectory}/${seed.value.eventFileName}`;
          yield* fs.makeDirectory(seed.value.eventsDirectory, { recursive: true });
          yield* fs.writeFileString(eventPath, seed.value.eventText);
          const blockedReportRoot = "goals/packet-convention-migration/history/report-parent";
          yield* writeProjectFile(blockedReportRoot, "blocks report directory\n");

          const failed = yield* Effect.exit(
            runMigration([
              "--apply",
              "--at",
              "2026-08-26T00:00:00.000Z",
              "--report",
              `${blockedReportRoot}/migration.md`,
            ])
          );
          expectReportedExit(failed);
          expect(yield* fs.readFileString(eventPath)).toBe(seed.value.eventText);
          expect(yield* fs.exists(seed.value.tracePath)).toBe(false);

          yield* fs.remove(blockedReportRoot);
          yield* fs.makeDirectory(blockedReportRoot);
          const applied = yield* Effect.exit(
            runMigration([
              "--apply",
              "--at",
              "2026-08-27T00:00:00.000Z",
              "--report",
              `${blockedReportRoot}/migration.md`,
            ])
          );
          expect(Exit.isSuccess(applied)).toBe(true);
          expect(yield* fs.readFileString(eventPath)).toBe(seed.value.eventText);
          expect(yield* fs.readFileString(seed.value.tracePath)).toBe(seed.value.traceText);
        })
      );
    })
  );

  it.effect(
    "preserves a concurrent fleet event after rollback quarantines its owned stream",
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

          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const eventsDirectory = path.resolve("goals/demo/ops/events");
          const foreignPath = path.join(eventsDirectory, "00002-concurrent.json");
          const foreignBytes = "concurrent fleet event\n";
          const racingFileSystem = {
            ...fs,
            rename: (source: string, target: string) =>
              path.resolve(source) === eventsDirectory
                ? fs
                    .rename(source, target)
                    .pipe(
                      Effect.andThen(fs.makeDirectory(eventsDirectory, { recursive: true })),
                      Effect.andThen(fs.writeFileString(foreignPath, foreignBytes))
                    )
                : fs.rename(source, target),
          };
          const exit = yield* Effect.exit(
            runMigration([
              "--apply",
              "--at",
              "2026-08-26T00:00:00.000Z",
              "--report",
              "goals/packet-convention-migration/history/report-parent/migration.md",
            ]).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem))
          );
          expectReportedExit(exit);
          expect(yield* fs.readFileString(foreignPath)).toBe(foreignBytes);
          expect(yield* fs.readFileString("goals/demo/ops/manifest.json")).toBe(original);
          expect(yield* fs.exists("goals/demo/ops/trace.json")).toBe(false);
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
