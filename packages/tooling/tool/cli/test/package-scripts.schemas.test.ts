import {
  implScriptDefaults,
  PackageKind,
  PackageScriptsReportFromWire,
  ScriptsBlock,
  scriptsBlockFromRecord,
  TaskScriptName,
  TaskScriptRule,
  taskScriptRules,
} from "@beep/repo-cli/test/PackageScripts";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const presenceRows = [
  ["build", "required required required required required required optional"],
  ["check", "required required required required required required optional"],
  ["lint", "required required required required required required optional"],
  ["test", "required required required required required required optional"],
  ["lint:fix", "required required optional required required required optional"],
  ["test:property", "optional optional absent optional absent absent optional"],
  ["test:integration", "optional absent required optional absent absent optional"],
  ["test:integration:parallel", "optional absent optional optional absent absent optional"],
  ["coverage", "required required required optional absent required optional"],
  ["docgen", "required required required optional absent required optional"],
  ["audit", "required required required required required required optional"],
  ["package-test-typecheck", "required required required required required required optional"],
  ["codegen", "derived derived derived derived derived derived optional"],
  ["lint:deprecated-apis", "required required required required required required absent"],
  ["lint:jsdoc", "required required required required absent required absent"],
  ["lint:laws", "required required required required required required absent"],
  ["doctest", "derived derived derived derived derived absent absent"],
];

describe("canonical package scripts schemas", () => {
  it.effect(
    "round trips implementation text and extras without interpretation",
    Effect.fnUntraced(function* () {
      const codec = scriptsBlockFromRecord("app");
      const input = { build: "bun run beep:build", "beep:build": "custom $BUILD", dev: "vite", "beep:custom": "owned" };
      const block = yield* S.decodeUnknownEffect(codec)(input);
      expect(HashMap.get(block.tasks, "build")).toEqual(O.some("bun run beep:build"));
      expect(HashMap.size(block.impls)).toBe(1);
      expect(HashMap.size(block.extras)).toBe(2);
      expect(yield* S.encodeEffect(codec)(block)).toEqual(input);
    })
  );
  it.effect(
    "rejects tier overlap and non-string script values with typed schema errors",
    Effect.fnUntraced(function* () {
      expect(
        yield* S.decodeUnknownEffect(ScriptsBlock)({
          kind: "app",
          tasks: HashMap.empty(),
          impls: HashMap.empty(),
          extras: HashMap.make(["build", "bad"]),
        }).pipe(Effect.isFailure)
      ).toBe(true);
      expect(yield* S.decodeUnknownEffect(scriptsBlockFromRecord("app"))({ build: 1 }).pipe(Effect.isFailure)).toBe(
        true
      );
    })
  );
  it.effect(
    "decodes every rule row and matches the ratified presence matrix literally",
    Effect.fnUntraced(function* () {
      expect(taskScriptRules).toHaveLength(119);
      yield* Effect.forEach(taskScriptRules, S.decodeUnknownEffect(TaskScriptRule));
      for (const [name, expected] of presenceRows) {
        const actual = A.map(PackageKind.Options, (kind) =>
          A.findFirst(taskScriptRules, (row) => row.kind === kind && row.name === name)
        );
        expect(A.map(actual, (row) => (row._tag === "Some" ? row.value.presence._tag : "missing")).join(" ")).toBe(
          expected
        );
      }
      expect(TaskScriptName.Options).toHaveLength(17);
      expect(implScriptDefaults).toHaveLength(54);
    })
  );
  it.effect(
    "round trips report JSON data through the collection view",
    Effect.fnUntraced(function* () {
      const wire = {
        schemaVersion: "package-scripts-report/v1",
        rules: "package-scripts-rules/v1",
        manifests: 2,
        drift: { "apps/a/package.json": [{ _tag: "missing-task", name: "lint:laws" }] },
        written: ["apps/a/package.json"],
      };
      const report = yield* S.decodeUnknownEffect(PackageScriptsReportFromWire)(wire);
      expect(HashSet.has(report.written, "apps/a/package.json")).toBe(true);
      expect(yield* S.encodeEffect(PackageScriptsReportFromWire)(report)).toEqual(wire);
    })
  );
});
