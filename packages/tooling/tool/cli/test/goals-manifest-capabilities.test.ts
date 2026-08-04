import {
  buildPortfolioIndexContent,
  decodeGoalManifest,
  GoalManifest,
  isCapabilitySlug,
  parseGoalManifestText,
  runGoalsDoctor,
} from "@beep/repo-cli/commands/Goals";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem, Layer, Order, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess } from "effect/unstable/process";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const encodeGoalManifest = S.encodeUnknownEffect(GoalManifest);
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: true,
};

const minimumManifest = () => ({
  initiative: { id: "legacy-minimum", status: "active" },
  completionGate: COMPLETION_GATE,
});

const manifestFixture = (
  slug: string,
  provides?: ReadonlyArray<string>,
  requires?: ReadonlyArray<string>
): unknown => ({
  schemaVersion: "initiative-manifest/v2",
  initiative: { id: slug, title: slug, status: "active", updated: "2026-08-01" },
  lifecycle: "active",
  mission: `Ship ${slug}.`,
  completionGate: COMPLETION_GATE,
  phases: [
    { id: "P0", status: "complete" },
    { id: "P1", status: "pending" },
  ],
  ...(provides === undefined ? {} : { provides }),
  ...(requires === undefined ? {} : { requires }),
});

const pipeManifestPaths = (output: string): ReadonlyArray<string> =>
  A.sort(A.filter(Str.split("\0")(output), Str.isNonEmpty), Order.String);

const trackedManifestPaths = Effect.fn("GoalsManifestCapabilitiesTest.trackedManifestPaths")(function* () {
  const repoRoot = yield* findRepoRoot();
  const handle = yield* ChildProcess.make("git", ["ls-files", "-z", "--", ":(glob)goals/*/ops/manifest.json"], {
    cwd: repoRoot,
    stdin: "ignore",
    stderr: "ignore",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  expect(yield* handle.exitCode).toBe(0);
  return pipeManifestPaths(output);
});

const readTrackedManifests = Effect.fn("GoalsManifestCapabilitiesTest.readTrackedManifests")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const manifestPaths = yield* trackedManifestPaths();
  return yield* Effect.forEach(
    manifestPaths,
    (manifestPath) =>
      fs.readFileString(path.join(repoRoot, manifestPath)).pipe(Effect.map((text) => ({ manifestPath, text }))),
    { concurrency: 1 }
  );
});

const writeSyntheticPacket = Effect.fn("GoalsManifestCapabilitiesTest.writeSyntheticPacket")(function* (packet: {
  readonly slug: string;
  readonly manifest: unknown;
}) {
  yield* writeProjectFile(`goals/${packet.slug}/ops/manifest.json`, `${yield* encodeJson(packet.manifest)}\n`);
  yield* writeProjectFile(`goals/${packet.slug}/README.md`, `# ${packet.slug}\n\nLifecycle: \`active\`\n`);
  yield* writeProjectFile(`goals/${packet.slug}/GOAL.md`, `# ${packet.slug}\n`);
});

const currentConsumerOutputs = Effect.fn("GoalsManifestCapabilitiesTest.currentConsumerOutputs")(function* (
  packets: ReadonlyArray<{ readonly slug: string; readonly manifest: unknown }>
) {
  return yield* withTempWorkingDirectory(
    Effect.gen(function* () {
      yield* writeProjectFile("bun.lock", "");
      yield* writeProjectFile(
        "goals/goals-doctor.baseline.jsonc",
        `${yield* encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: [] })}\n`
      );
      for (const packet of packets) {
        yield* writeSyntheticPacket(packet);
      }

      const index = yield* buildPortfolioIndexContent();
      const doctor = yield* Effect.gen(function* () {
        yield* runGoalsDoctor({ writeBaseline: false });
        return {
          logs: yield* TestConsole.logLines,
          errors: yield* TestConsole.errorLines,
        };
      }).pipe(provideScopedLayer(Layer.fresh(TestConsole.layer)));

      return { index, doctor };
    })
  );
});

layer(NodeServices.layer)("GoalManifest capability fields", (it) => {
  it.effect(
    "1. decodes every tracked goal manifest, including _template",
    Effect.fn("GoalsManifestCapabilitiesTest.census")(function* () {
      const entries = yield* readTrackedManifests();
      let failures = A.empty<string>();

      for (const entry of entries) {
        const parsed = parseGoalManifestText(entry.text);
        if (O.isNone(parsed)) {
          failures = A.append(failures, `${entry.manifestPath}: JSONC parse failed`);
          continue;
        }
        const decoded = yield* Effect.exit(decodeGoalManifest(parsed.value));
        if (Exit.isFailure(decoded)) {
          failures = A.append(failures, `${entry.manifestPath}: ${Cause.pretty(decoded.cause)}`);
        }
      }

      expect(A.map(entries, (entry) => entry.manifestPath)).toContain("goals/_template/ops/manifest.json");
      expect(failures, A.join(failures, "\n")).toEqual([]);
    })
  );

  it.effect(
    "2. defaults capability fields while decoding the legacy minimum",
    Effect.fn("GoalsManifestCapabilitiesTest.legacyMinimum")(function* () {
      const manifest = yield* decodeGoalManifest(minimumManifest());
      expect(manifest.provides).toEqual([]);
      expect(manifest.requires).toEqual([]);
    })
  );

  it.effect(
    "3. applies capability defaults through GoalManifest.make",
    Effect.fn("GoalsManifestCapabilitiesTest.constructorDefaults")(function* () {
      const manifest = GoalManifest.make({
        initiative: { id: "constructor-defaults", status: "active" },
        completionGate: COMPLETION_GATE,
      });
      expect(manifest.provides).toEqual([]);
      expect(manifest.requires).toEqual([]);
    })
  );

  it.effect(
    "4. retains decoded capability declarations",
    Effect.fn("GoalsManifestCapabilitiesTest.retention")(function* () {
      const manifest = yield* decodeGoalManifest(manifestFixture("retention", ["knowledge/doctor"]));
      expect(manifest.provides).toEqual(["knowledge/doctor"]);
      expect(manifest.requires).toEqual([]);
      expect(isCapabilitySlug(manifest.provides[0])).toBe(true);
    })
  );

  it.effect(
    "5. preserves capability fields across decode, encode, and decode",
    Effect.fn("GoalsManifestCapabilitiesTest.roundTrip")(function* () {
      const decoded = yield* decodeGoalManifest(manifestFixture("round-trip", ["knowledge/doctor"]));
      const encoded = yield* encodeGoalManifest(decoded);
      expect(encoded).toMatchObject({ provides: ["knowledge/doctor"], requires: [] });

      const decodedAgain = yield* decodeGoalManifest(encoded);
      expect(decodedAgain.provides).toEqual(decoded.provides);
      expect(decodedAgain.requires).toEqual(decoded.requires);
    })
  );

  it.effect(
    "6. rejects wrong types, malformed slugs, overlength slugs, and self-cycles while stripping unknown keys",
    Effect.fn("GoalsManifestCapabilitiesTest.rejection")(function* () {
      const maxLengthSlug = `${Str.repeat(32)("a")}/${Str.repeat(31)("b")}`;
      const overlengthSlug = `${Str.repeat(32)("a")}/${Str.repeat(32)("b")}`;
      expect(isCapabilitySlug(maxLengthSlug)).toBe(true);
      expect(isCapabilitySlug(overlengthSlug)).toBe(false);

      const invalidInputs: ReadonlyArray<unknown> = [
        { ...minimumManifest(), provides: "knowledge/doctor" },
        { ...minimumManifest(), provides: ["knowledge/doctor", 1] },
        { ...minimumManifest(), provides: ["knowledge"] },
        { ...minimumManifest(), provides: ["knowledge/doctor/extra"] },
        { ...minimumManifest(), provides: ["Knowledge/doctor"] },
        { ...minimumManifest(), provides: ["knowledge/doc--tor"] },
        { ...minimumManifest(), provides: ["knowledge/doctor-"] },
        { ...minimumManifest(), provides: [`${Str.repeat(33)("a")}/doctor`] },
        { ...minimumManifest(), provides: [overlengthSlug] },
      ];

      for (const input of invalidInputs) {
        expect(Exit.isFailure(yield* Effect.exit(decodeGoalManifest(input)))).toBe(true);
      }

      const selfCycleError = yield* decodeGoalManifest({
        ...minimumManifest(),
        provides: ["knowledge/doctor"],
        requires: ["knowledge/doctor"],
      }).pipe(Effect.flip);
      expect(selfCycleError.message).toContain(
        "A goal manifest cannot list the same capability in both provides and requires (self-cycle)"
      );

      const normalized = yield* decodeGoalManifest({
        ...minimumManifest(),
        bespokeProjectionInput: { retainedOnlyInRawJson: true },
      }).pipe(Effect.flatMap(encodeGoalManifest));
      expect(normalized).not.toHaveProperty("bespokeProjectionInput");
      expect(normalized).toMatchObject({ provides: [], requires: [] });
    })
  );

  it.effect(
    "7. performs the tracked census and codec proof without mutating manifests",
    Effect.fn("GoalsManifestCapabilitiesTest.noMutation")(function* () {
      const before = yield* readTrackedManifests();
      for (const entry of before) {
        const parsed = parseGoalManifestText(entry.text);
        expect(O.isSome(parsed), entry.manifestPath).toBe(true);
        if (O.isSome(parsed)) {
          yield* decodeGoalManifest(parsed.value).pipe(Effect.flatMap(encodeGoalManifest));
        }
      }
      const after = yield* readTrackedManifests();
      expect(after).toEqual(before);
    })
  );

  it.effect(
    "8. produces identical doctor findings with and without capabilities",
    Effect.fn("GoalsManifestCapabilitiesTest.doctorParity")(function* () {
      const legacy = yield* currentConsumerOutputs([
        { slug: "doctor-parity", manifest: manifestFixture("doctor-parity") },
      ]);
      const capability = yield* currentConsumerOutputs([
        {
          slug: "doctor-parity",
          manifest: manifestFixture("doctor-parity", ["knowledge/doctor"], ["goals/graph"]),
        },
      ]);
      expect(capability.doctor).toEqual(legacy.doctor);
    })
  );

  it.effect(
    "9. renders a byte-identical portfolio index with and without capabilities",
    Effect.fn("GoalsManifestCapabilitiesTest.indexParity")(function* () {
      const legacy = yield* currentConsumerOutputs([
        { slug: "index-parity", manifest: manifestFixture("index-parity") },
      ]);
      const capability = yield* currentConsumerOutputs([
        {
          slug: "index-parity",
          manifest: manifestFixture("index-parity", ["knowledge/doctor"], ["goals/graph"]),
        },
      ]);
      expect(capability.index).toBe(legacy.index);
    })
  );

  it.effect(
    "10. keeps current production consumer output independent of packet and capability declaration order",
    Effect.fn("GoalsManifestCapabilitiesTest.orderIndependence")(function* () {
      const forward = yield* currentConsumerOutputs([
        {
          slug: "alpha",
          manifest: manifestFixture("alpha", ["knowledge/doctor", "skills/warehouse"], ["goals/graph"]),
        },
        {
          slug: "zeta",
          manifest: manifestFixture("zeta", ["goals/bootstrap"], ["knowledge/doctor", "skills/warehouse"]),
        },
      ]);
      const reversed = yield* currentConsumerOutputs([
        {
          slug: "zeta",
          manifest: manifestFixture("zeta", ["goals/bootstrap"], ["skills/warehouse", "knowledge/doctor"]),
        },
        {
          slug: "alpha",
          manifest: manifestFixture("alpha", ["skills/warehouse", "knowledge/doctor"], ["goals/graph"]),
        },
      ]);
      expect(reversed).toEqual(forward);
    })
  );
});
