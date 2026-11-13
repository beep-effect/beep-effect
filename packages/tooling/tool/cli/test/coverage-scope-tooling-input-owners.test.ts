import {
  COVERAGE_SCANNED_OWNER_ROWS,
  COVERAGE_TOOLING_INPUT_OWNER_ROWS,
  CoverageReaderSource,
  CoverageScopeOwner,
  coverageOwnerDriftRows,
  coverageSourceReadsPath,
  planCoverageAffectedScope,
} from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import { rowFixtureOwners, rowFixtureReaders } from "./support/CoverageOwnerRows.ts";

// TURB-01 slice 1b (goals/hosted-setup-tax): root tooling inputs that fell through to the
// "no current workspace owner" fallback select their scanned readers instead of the full
// Test Unit matrix. The live drift check over these rows is in
// coverage-scope-standards-owners.test.ts and `beep lint coverage-owners`.

const CLAUDE_READERS = [
  "@beep/ai-sync",
  "@beep/infra",
  "@beep/palantiri",
  "@beep/repo-ai-metrics",
  "@beep/repo-cli",
  "@beep/repo-cli-kit",
  "@beep/repo-configs",
];
const LEDGER_READERS = ["@beep/infra", "@beep/palantiri", "@beep/repo-ai-metrics", "@beep/repo-cli"];
const REPO_CLI = ["@beep/repo-cli"];

const unrelated = CoverageScopeOwner.make({
  packageName: "@beep/unrelated",
  packagePath: "packages/unrelated",
  hasCoverage: true,
});
const dependent = CoverageScopeOwner.make({
  packageName: "@beep/dependent",
  packagePath: "packages/dependent",
  hasCoverage: true,
  workspaceDependencies: ["@beep/unrelated"],
});
const owners = [...rowFixtureOwners(COVERAGE_SCANNED_OWNER_ROWS), unrelated, dependent];

const source = (filePath: string, text: string) => CoverageReaderSource.make({ filePath, text });
const selected = (packageNames: ReadonlyArray<string>) => ({
  _tag: "selected",
  packageNames,
  dependentPackageNames: [],
});

describe("coverage owners for root tooling inputs", () => {
  describe("planner fixtures", () => {
    it.each([
      [".claude/skills/explore/SKILL.md", CLAUDE_READERS],
      [".claude/skills/yeet/references/merge-loop.md", CLAUDE_READERS],
      // A narrower hand-written row unions with the tree's scanned readers.
      [".claude/skills/yeet/SKILL.md", CLAUDE_READERS],
      [".claude/skills/effect-first-development/SKILL.md", CLAUDE_READERS],
      ["skills-lock.json", REPO_CLI],
      ["harness-ledger/rows/2026-11.jsonl", LEDGER_READERS],
      ["harness-ledger/README.md", LEDGER_READERS],
      ["biome.identity.jsonc", REPO_CLI],
    ] as const)("selects exactly the scanned readers for %s", (file, readers) => {
      expect(planCoverageAffectedScope(owners, [file])).toEqual(selected(readers));
    });

    it("selects the union for a skill edit and its lock refresh", () => {
      expect(planCoverageAffectedScope(owners, ["skills-lock.json", ".claude/skills/explore/SKILL.md"])).toEqual(
        selected(CLAUDE_READERS)
      );
    });

    it.each([
      ".claude/settings.json",
      ".claude/skills-archive/explore/SKILL.md",
      "skills-lock.json.bak",
      "harness-ledger.md",
      "biome.identity.jsonc.orig",
      "beep-effect.iml",
    ])("keeps the unmapped look-alike %s on the full fallback", (file) => {
      expect(planCoverageAffectedScope(owners, [file])).toEqual({
        _tag: "full",
        reasons: [`${file}: no current workspace owner`],
      });
    });

    it("stays full when a mapped file travels with an unmapped one", () => {
      expect(planCoverageAffectedScope(owners, ["skills-lock.json", ".claude/settings.json"])).toEqual({
        _tag: "full",
        reasons: [".claude/settings.json: no current workspace owner"],
      });
    });

    it("falls back to full when a scanned reader cannot measure coverage", () => {
      const unmeasured = A.map(owners, (owner) =>
        owner.packageName === "@beep/repo-ai-metrics"
          ? CoverageScopeOwner.make({ ...owner, hasCoverage: false })
          : owner
      );
      expect(planCoverageAffectedScope(unmeasured, ["harness-ledger/rows/2026-11.jsonl"])).toEqual({
        _tag: "full",
        reasons: ["harness-ledger/rows/2026-11.jsonl: configured repository fixture coverage owner is unavailable"],
      });
    });
  });

  describe("reader scan", () => {
    it("reads the skill tree through its .claude segment, split or whole", () => {
      const joined = 'const p = path.join(repoRoot, ".claude", "skills", "explore", "SKILL.md");';
      const url =
        'const u = new URL("../../../../../.claude/skills/effect-first-development/SKILL.md", import.meta.url);';
      expect(coverageSourceReadsPath(source("a.ts", joined), ".claude")).toBe(true);
      expect(coverageSourceReadsPath(source("a.ts", url), ".claude")).toBe(true);
    });

    it.each([
      'const skill = new URL("../plugin/skills/practice-onboarding/SKILL.md", import.meta.url);',
      'const plugin = path.join(appRoot, ".claude-plugin", "skills");',
      'const domain = "skills";',
      "// reads .claude/skills/explore/SKILL.md",
    ])("does not read the skill tree from %s", (text) => {
      expect(coverageSourceReadsPath(source("a.ts", text), ".claude")).toBe(false);
    });

    it("would count a bare skills word by the tree's own basename", () => {
      expect(coverageSourceReadsPath(source("a.ts", 'const domain = "skills";'), ".claude/skills")).toBe(true);
    });

    it("reads the lock, the ledger and the Biome identity config by whole segment", () => {
      expect(
        coverageSourceReadsPath(source("a.ts", 'path.join(repoRoot, "skills-lock.json")'), "skills-lock.json")
      ).toBe(true);
      expect(
        coverageSourceReadsPath(source("a.ts", 'path.join(repoRoot, "skills-lock.json.staging-t")'), "skills-lock.json")
      ).toBe(false);
      expect(coverageSourceReadsPath(source("a.ts", 'const tag = "skills-lock/v2";'), "skills-lock.json")).toBe(false);
      expect(
        coverageSourceReadsPath(source("a.ts", 'path.join(root, "harness-ledger", "rows")'), "harness-ledger")
      ).toBe(true);
      expect(
        coverageSourceReadsPath(source("a.ts", 'path.resolve(root, "biome.identity.jsonc")'), "biome.identity.jsonc")
      ).toBe(true);
      expect(coverageSourceReadsPath(source("a.ts", 'path.resolve(root, "biome.jsonc")'), "biome.identity.jsonc")).toBe(
        false
      );
    });
  });

  describe("owner drift rows", () => {
    const readers = rowFixtureReaders(COVERAGE_SCANNED_OWNER_ROWS);

    it("maps every tooling input row to an owner with a fixture reader", () => {
      expect(A.length(COVERAGE_TOOLING_INPUT_OWNER_ROWS)).toBeGreaterThan(0);
      expect(coverageOwnerDriftRows(owners, readers)).toEqual([]);
    });

    it("fails closed on a seeded path.join reader of the lock in another package", () => {
      const seeded = source(
        "packages/unrelated/test/Lock.test.ts",
        'import * as path from "node:path";\nconst lock = path.join(repoRoot, "skills-lock.json");\n'
      );
      expect(coverageOwnerDriftRows(owners, [...readers, seeded])).toEqual([
        { readerPath: "skills-lock.json", rowOwners: REPO_CLI, scannedOwners: ["@beep/repo-cli", "@beep/unrelated"] },
      ]);
    });

    it("adds the coverage dependents of a seeded source-tree reader of the skill tree", () => {
      const seeded = source(
        "packages/unrelated/src/Skills.ts",
        'export const skillsRoot = (repoRoot: string) => path.join(repoRoot, ".claude", "skills");\n'
      );
      expect(coverageOwnerDriftRows(owners, [...readers, seeded])).toEqual([
        {
          readerPath: ".claude",
          rowOwners: CLAUDE_READERS,
          scannedOwners: A.sort([...CLAUDE_READERS, "@beep/dependent", "@beep/unrelated"], Order.String),
        },
      ]);
    });

    it("reports a row whose reader is gone", () => {
      const withoutLedger = A.map(readers, (reader) =>
        reader.filePath === "packages/repo-ai-metrics/test/readers.test.ts"
          ? source(reader.filePath, 'export const readers = [".claude"];\n')
          : reader
      );
      expect(coverageOwnerDriftRows(owners, withoutLedger)).toEqual([
        {
          readerPath: "harness-ledger",
          rowOwners: LEDGER_READERS,
          scannedOwners: ["@beep/infra", "@beep/palantiri", "@beep/repo-cli"],
        },
      ]);
    });
  });
});
