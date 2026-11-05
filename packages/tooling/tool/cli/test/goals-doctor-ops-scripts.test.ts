import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  GoalExplorationPathState,
  goalPacketFindings,
  makeGoalPacketFilesystemReader,
} from "@beep/repo-cli/commands/Goals/Doctor";
import { GoalOpsScript, GoalOpsScriptPath } from "@beep/repo-cli/commands/Goals/Goals.schemas";
import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory";
import { makeKnowledgeDoctorMemoryTree, makeKnowledgeGoalPacketReader } from "@beep/repo-cli/commands/Knowledge";
import { it } from "@beep/test-runner";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GoalPacketReader } from "@beep/repo-cli/commands/Goals/Doctor";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const memoryLayer = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const manifestText = (extra: Readonly<Record<string, unknown>>): string =>
  encodeJson({
    schemaVersion: "initiative-manifest/v2",
    initiative: { id: "demo", status: "active" },
    lifecycle: "active",
    completionGate: COMPLETION_GATE,
    ...extra,
  });

const record = (text: string): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug: "demo",
    packetPath: "goals/demo",
    manifestPath: "goals/demo/ops/manifest.json",
    readmePath: "goals/demo/README.md",
    manifestText: text,
  });

/** A reader over fixed ops files that counts how often the ops tree is listed. */
const stubReader = (files: ReadonlyArray<string>) => {
  const reads = { ops: 0 };
  const reader: GoalPacketReader<never, never> = {
    decisionFiles: () => Effect.succeed(A.empty<string>()),
    readDecision: () => Effect.succeed(""),
    readDocument: () => Effect.succeedNone,
    explorationPath: () => Effect.succeed(GoalExplorationPathState.Enum.present),
    opsFiles: () =>
      Effect.sync(() => {
        reads.ops += 1;
        return files;
      }),
    readReflection: () => Effect.succeed(""),
    reflectionFiles: () => Effect.succeed(A.empty<string>()),
  };
  return { reader, reads };
};

const opsKeys = (findings: ReadonlyArray<{ readonly key: string }>): ReadonlyArray<string> =>
  A.filter(
    A.map(findings, (finding) => finding.key),
    (key) => Str.includes(" ops-script-")(key)
  );

describe("goal ops script registration", () => {
  it("accepts packet-relative paths under ops/ and refuses escapes", () => {
    for (const path of ["ops/bench.ts", "ops/nested/x-1.ts", "ops/run_all.sh"]) {
      assertTrue(S.is(GoalOpsScriptPath)(path));
    }
    for (const path of [
      "bench.ts",
      "ops/",
      "ops/../SPEC.md",
      "ops/.hidden.ts",
      "/ops/x.ts",
      "ops//x.ts",
      "research/x.ts",
    ]) {
      assertFalse(S.is(GoalOpsScriptPath)(path));
    }
    assertFalse(S.is(GoalOpsScript)({ path: "ops/bench.ts", purpose: "" }));
    assertTrue(S.is(GoalOpsScript)({ path: "ops/bench.ts", purpose: "Bench." }));
  });

  it.effect("is opt-in: a manifest without opsScripts never lists its ops tree", () =>
    Effect.gen(function* () {
      const { reader, reads } = stubReader(["ops/unlisted.ts"]);
      const { findings } = yield* goalPacketFindings(record(manifestText({})), reader);
      assert.deepStrictEqual(opsKeys(findings), []);
      assert.strictEqual(reads.ops, 0);
    })
  );

  it.effect("skips ts files under dot-leading segments, which are hidden scratch space", () =>
    Effect.gen(function* () {
      const { reader } = stubReader(["ops/.scratch/probe.ts", "ops/.hidden.ts", "ops/listed.ts"]);
      const text = manifestText({ opsScripts: [{ path: "ops/listed.ts", purpose: "Listed and present." }] });
      const { findings } = yield* goalPacketFindings(record(text), reader);
      assert.deepStrictEqual(opsKeys(findings), []);
    })
  );

  it.effect("reports unlisted ts files the entry pattern rejects as unregistrable, not as unregistered", () =>
    Effect.gen(function* () {
      const { reader } = stubReader(["ops/my probe.ts", "ops/a+b.ts", "ops/listed.ts"]);
      const text = manifestText({ opsScripts: [{ path: "ops/listed.ts", purpose: "Listed and present." }] });
      const { findings } = yield* goalPacketFindings(record(text), reader);
      assert.deepStrictEqual(opsKeys(findings), [
        "demo ops-script-unregistrable ops/my probe.ts",
        "demo ops-script-unregistrable ops/a+b.ts",
      ]);
      assertTrue(
        A.every(
          A.filter(findings, (finding) => Str.includes("ops-script-")(finding.kind)),
          (finding) => finding.severity === "blocking"
        )
      );
    })
  );

  it.effect("reports listed paths that are missing and ts files that are unlisted", () =>
    Effect.gen(function* () {
      const { reader, reads } = stubReader([
        "ops/listed.ts",
        "ops/manifest.json",
        "ops/nested/unlisted.ts",
        "ops/run.sh",
        "ops/unlisted.ts",
      ]);
      const text = manifestText({
        opsScripts: [
          { path: "ops/listed.ts", purpose: "Listed and present." },
          { path: "ops/gone.ts", purpose: "Listed and absent." },
        ],
      });
      const { findings } = yield* goalPacketFindings(record(text), reader);
      assert.deepStrictEqual(opsKeys(findings), [
        "demo ops-script-missing ops/gone.ts",
        "demo ops-script-unregistered ops/nested/unlisted.ts",
        "demo ops-script-unregistered ops/unlisted.ts",
      ]);
      assertTrue(
        A.every(
          A.filter(findings, (finding) => Str.includes("ops-script-")(finding.kind)),
          (finding) => finding.severity === "blocking"
        )
      );
      assert.strictEqual(reads.ops, 1);
    })
  );

  it.effect("a fully registered ops tree is clean", () =>
    Effect.gen(function* () {
      const { reader } = stubReader(["ops/a.ts", "ops/manifest.json"]);
      const text = manifestText({ opsScripts: [{ path: "ops/a.ts", purpose: "A." }] });
      const { findings } = yield* goalPacketFindings(record(text), reader);
      assert.deepStrictEqual(opsKeys(findings), []);
    })
  );

  it.effect("reports a path listed more than once, once", () =>
    Effect.gen(function* () {
      const { reader } = stubReader(["ops/a.ts", "ops/b.ts"]);
      const text = manifestText({
        opsScripts: [
          { path: "ops/a.ts", purpose: "A." },
          { path: "ops/b.ts", purpose: "B." },
          { path: "ops/a.ts", purpose: "A again." },
          { path: "ops/a.ts", purpose: "A a third time." },
        ],
      });
      const { findings } = yield* goalPacketFindings(record(text), reader);
      assert.deepStrictEqual(opsKeys(findings), ["demo ops-script-duplicate ops/a.ts"]);
    })
  );

  it.effect("the tree reader lists every tracked file under one packet's ops/", () =>
    Effect.gen(function* () {
      const tree = makeKnowledgeDoctorMemoryTree({
        files: {
          "goals/demo/ops/manifest.json": "{}",
          "goals/demo/ops/nested/b.ts": "",
          "goals/demo/ops/a.ts": "",
          "goals/demo/SPEC.md": "",
          "goals/demo-two/ops/c.ts": "",
        },
      });
      const reader = makeKnowledgeGoalPacketReader(tree);
      const opsFiles1 = yield* reader.opsFiles("goals/demo");
      assert.deepStrictEqual(opsFiles1, ["ops/a.ts", "ops/manifest.json", "ops/nested/b.ts"]);
      const opsFiles2 = yield* reader.opsFiles("goals/demo-two");
      assert.deepStrictEqual(opsFiles2, ["ops/c.ts"]);
      const opsFiles3 = yield* reader.opsFiles("goals/absent");
      assert.deepStrictEqual(opsFiles3, []);
    })
  );

  it.layer(memoryLayer, { timeout: "30 seconds" })((it) => {
    it.effect("the filesystem reader lists files, not directories, at any depth", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const packet = "/repo/goals/demo";
        yield* fs.makeDirectory(path.join(packet, "ops", "nested", "empty"), { recursive: true });
        yield* fs.writeFileString(path.join(packet, "ops", "a.ts"), "");
        yield* fs.writeFileString(path.join(packet, "ops", "nested", "b.ts"), "");
        const reader = makeGoalPacketFilesystemReader();
        const opsFiles4 = yield* reader.opsFiles(packet);
        assert.deepStrictEqual(opsFiles4, ["ops/a.ts", "ops/nested/b.ts"]);
        const opsFiles5 = yield* reader.opsFiles(path.join(packet, "absent"));
        assert.deepStrictEqual(opsFiles5, []);
      })
    );
  });
});
