import {
  inheritedCodemodDuplicationCountForTesting,
  reportInvariantDiagnosticsForTesting,
  workflowYamlValueForTesting,
} from "@beep/repo-cli/test/Quality";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

it("reports malformed Fallow failure attribution and exit invariants", () => {
  expect(
    reportInvariantDiagnosticsForTesting({
      attributionKinds: [],
      exitStatus: 1,
      findingAttributionSummary: {
        inheritedAdjacent: 2,
        introduced: 1,
        notApplicable: 3,
      },
      status: "tool-failed",
    })
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("introduced attribution count must be 0"),
      expect.stringContaining("inheritedAdjacent attribution count must be 0"),
      expect.stringContaining("notApplicable attribution count must be 0"),
      expect.stringContaining("attributionKinds"),
    ])
  );

  expect(
    reportInvariantDiagnosticsForTesting({
      attributionKinds: ["not-applicable"],
      exitStatus: 0,
      findingAttributionSummary: {
        inheritedAdjacent: 0,
        introduced: 0,
        notApplicable: 0,
      },
      status: "tool-failed",
    })
  ).toEqual(["Fallow tool-failed envelope exitStatus must be positive."]);
});

const cloneFile = "packages/example/src/Options.ts";
const renameSite = {
  ruleId: "exact-optional-keys",
  facet: "optional",
  filePath: cloneFile,
  line: 10,
  column: 3,
  before: "optional",
  after: "optionalKey",
};
const writeReport = {
  mode: "write",
  rules: ["exact-optional-keys"],
  paths: [cloneFile],
  filesScanned: 1,
  candidateFiles: 1,
  filesChanged: [cloneFile],
  facetCounts: [],
  sites: [renameSite],
  residue: [],
  quarantines: [],
};
const cloneDocument = {
  duplication: {
    clone_groups: [{ introduced: true, instances: [{ file: cloneFile, start_line: 8, end_line: 15 }] }],
  },
};
const renameDiff = A.join(
  [
    `diff --git a/${cloneFile} b/${cloneFile}`,
    `--- a/${cloneFile}`,
    `+++ b/${cloneFile}`,
    "@@ -10 +10 @@",
    "-S.optional(S.String)",
    "+S.optionalKey(S.String)",
  ],
  "\n"
);

it("attributes only identifier renames at sites recorded by registered write reports", () => {
  expect(inheritedCodemodDuplicationCountForTesting(cloneDocument, renameDiff, [writeReport])).toBe(1);
  expect(inheritedCodemodDuplicationCountForTesting(cloneDocument, renameDiff, [])).toBe(0);
  expect(
    inheritedCodemodDuplicationCountForTesting(cloneDocument, renameDiff, [{ ...writeReport, mode: "dry-run" }])
  ).toBe(0);
  expect(
    inheritedCodemodDuplicationCountForTesting(cloneDocument, renameDiff, [{ ...writeReport, rules: ["unknown"] }])
  ).toBe(0);
  expect(
    inheritedCodemodDuplicationCountForTesting(cloneDocument, renameDiff, [
      { ...writeReport, sites: [{ ...renameSite, column: 4 }] },
    ])
  ).toBe(0);
});

it("keeps mixed edits, additions, string changes and incomplete evidence introduced", () => {
  const mixed = Str.replace("+S.optionalKey(S.String)", "+S.optionalKey(S.Number)")(renameDiff);
  expect(inheritedCodemodDuplicationCountForTesting(cloneDocument, mixed, [writeReport])).toBe(0);
  const addition = Str.replace("@@ -10 +10 @@\n-S.optional(S.String)", "@@ -9,0 +10 @@")(renameDiff);
  expect(inheritedCodemodDuplicationCountForTesting(cloneDocument, addition, [writeReport])).toBe(0);
  const strings = Str.replace(
    "+S.optionalKey(S.String)",
    '+"optionalKey"'
  )(Str.replace("-S.optional(S.String)", '-"optional"')(renameDiff));
  expect(
    inheritedCodemodDuplicationCountForTesting(cloneDocument, strings, [
      { ...writeReport, sites: [{ ...renameSite, column: 2 }] },
    ])
  ).toBe(0);
  expect(inheritedCodemodDuplicationCountForTesting({}, renameDiff, [writeReport])).toBe(0);
  expect(inheritedCodemodDuplicationCountForTesting(cloneDocument, "", [writeReport])).toBe(0);
});

it("does not let a rename in one instance hide an unregistered edit in another", () => {
  const sibling = "packages/example/src/Sibling.ts";
  const document = {
    duplication: {
      clone_groups: [
        {
          introduced: true,
          instances: [
            { file: cloneFile, start_line: 8, end_line: 15 },
            { file: sibling, start_line: 8, end_line: 15 },
          ],
        },
      ],
    },
  };
  const siblingDiff = Str.replaceAll(cloneFile, sibling)(renameDiff);
  expect(inheritedCodemodDuplicationCountForTesting(document, `${renameDiff}\n${siblingDiff}`, [writeReport])).toBe(0);
});

it.effect("reads workflow YAML into a plain value", () =>
  Effect.gen(function* () {
    expect(yield* workflowYamlValueForTesting(".github/workflows/check.yml", "name: Check\non: [push]\n")).toEqual({
      name: "Check",
      on: ["push"],
    });
  })
);

it.effect("fails malformed workflow YAML with the file, the parser cause and exit code 1", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(workflowYamlValueForTesting(".github/workflows/bad.yml", "jobs: [unclosed\n"));
    expect(error.message).toMatch(/^Invalid workflow YAML \.github\/workflows\/bad\.yml: \S/);
    expect(error.exitCode).toBe(1);
  })
);
