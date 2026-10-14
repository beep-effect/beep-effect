import { listGoalPackets } from "@beep/repo-cli/commands/Goals/Inventory";
import {
  ExportWitness,
  evaluateSkillsLocal,
  extractKnowledgeDocumentSpans,
  KNOWLEDGE_DOCTOR_EVALUATORS,
  KnowledgeSkillsLocalEvaluator,
  knowledgeCounterfactualVerdicts,
  knowledgeDomainLineSpans,
  LockEntryWitness,
  ManifestFieldWitness,
  makeKnowledgeDoctorMemoryTree,
  makeKnowledgeDoctorTree,
  overlayWithout,
  readKnowledgeGoalPacketRecords,
  scanKnowledgeDoctorTree,
  scanKnowledgeFileExports,
} from "@beep/repo-cli/commands/Knowledge";
import { findRepoRoot } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import type {
  KnowledgeCounterfactualVerdict,
  KnowledgeDoctorReport,
  KnowledgeDoctorTree,
  KnowledgeFindingKind,
  KnowledgeSpan,
} from "@beep/repo-cli/commands/Knowledge";
import type { HttpClient } from "effect/http";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const doc = (...lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const subjects = (report: KnowledgeDoctorReport, kind: KnowledgeFindingKind): ReadonlyArray<string> =>
  A.sort(
    A.map(
      A.filter(report.findings, (row) => row.finding.kind === kind),
      (row) => row.finding.subject
    ),
    Str.Order
  );

const spansOf = (documentPath: string, text: string): ReadonlyArray<KnowledgeSpan> =>
  extractKnowledgeDocumentSpans(documentPath, text, HashSet.empty()).spans;

const notFailed = (verdicts: ReadonlyArray<KnowledgeCounterfactualVerdict>): ReadonlyArray<string> =>
  A.map(
    A.filter(verdicts, (verdict) => verdict.verdict !== "failed"),
    (verdict) => `${verdict.verdict} ${verdict.span.raw} ${verdict.witness._tag}`
  );

const manifest = (slug: string, status: string, phases: ReadonlyArray<string>): string =>
  doc(
    "{",
    `  "schemaVersion": "initiative-manifest/v2",`,
    `  "initiative": { "id": "${slug}", "status": "${status}" },`,
    `  "lifecycle": "${status}",`,
    `  "completionGate": { "operator": "yeet", "requiresPullRequest": true, "requiresMergeable": true, "statement": "Ship.", "grandfathered": false },`,
    `  "phases": [${A.join(
      A.map(phases, (id) => `{ "id": "${id}", "status": "pending" }`),
      ", "
    )}]`,
    "}"
  );

const PACKET_FILES = {
  "goals/demo/ops/manifest.json": manifest("demo", "active", ["P0", "P1"]),
  "goals/demo/README.md": doc("# Demo", "", "## Current Phase", "", "P1 Implement."),
  "goals/stale/ops/manifest.json": manifest("stale", "paused", ["P0"]),
  "goals/stale/README.md": doc("# Stale", "", "## Current Phase", "", "`P4 Close` is next."),
  "goals/broken/ops/manifest.json": "{ not json",
  "goals/_template/ops/manifest.json": manifest("_template", "active", []),
};

const PACKAGE_FILES = {
  "package.json": `{ "name": "@beep/root", "workspaces": ["packages/*"] }`,
  "packages/a/package.json": doc(
    "{",
    `  "name": "@beep/a",`,
    `  "exports": {`,
    `    ".": "./src/index.ts",`,
    `    "./Sub": { "types": "./src/Sub.d.ts", "import": "./src/Sub.ts" },`,
    `    "./internal/*": "./src/internal/*.ts",`,
    `    "./internal/hidden": null,`,
    `    "./Gone": "./src/Gone.ts"`,
    "  }",
    "}"
  ),
  "packages/a/src/index.ts": doc(
    "/**",
    " * export const NotReal = 1",
    " */",
    "export const Direct = 1",
    'export * from "./Thing.ts"'
  ),
  "packages/a/src/Thing.ts": "export class Thing {}",
  "packages/a/src/Sub.ts": doc("const a = 1", "export { a as Renamed, type a as Typed }"),
  "packages/a/src/internal/x.ts": "export const x = 1",
  "packages/a/src/internal/hidden.ts": "export const hidden = 1",
  "packages/a/test/Kit.ts": "export const kit = 1",
  "fixtures/package.json": `{ "name": "@beep/outside" }`,
  "docs/root.md": "`@beep/root#lint`",
  "tsconfig.json": doc(
    "{",
    "  // aliases",
    `  "compilerOptions": { "paths": { "@beep/a/test/Kit": ["./packages/a/test/Kit.ts"] } }`,
    "}"
  ),
};

const SYMBOL_DOC = doc(
  "`@beep/a` `@beep/a#build` `@beep/*` `@beep/a/Sub` `@beep/a/internal/x`",
  "`@beep/a/internal/hidden` `@beep/a/Missing` `@beep/a/Gone` `@beep/ghost` `@beep/outside` `@beep/a/test/Kit`",
  "Use `Thing` from `@beep/a`, `Direct` from `@beep/a`, `Renamed` from `@beep/a/Sub`.",
  "Not `NotReal` from `@beep/a` and not `Nope` from `@beep/a`."
);

describe("knowledge doctor domain span readers", () => {
  it.effect(
    "reads status claims only through connective text, and reads an imported symbol's specifier once",
    Effect.fnUntraced(function* () {
      assert.deepStrictEqual(
        knowledgeDomainLineSpans(
          "`goals/a` (`active`), `goals/b` is `paused`, `goals/c` was `active`, `goals/d` (both `reference`), `goals/e` → `completed-retained`"
        ),
        [
          ["packet-status", "goals/a active", 1],
          ["packet-status", "goals/b paused", 23],
          ["packet-status", "goals/e completed-retained", 100],
        ]
      );
      assert.deepStrictEqual(knowledgeDomainLineSpans("`goals/a` (`legacy-phase`)"), []);
      assert.deepStrictEqual(knowledgeDomainLineSpans("`X` from `@beep/a/Sub` and `@beep/a` and `@beep/*`"), [
        ["symbol-export", "X from @beep/a/Sub", 1],
        ["symbol", "@beep/a", 28],
      ]);
    })
  );

  it.effect(
    "reads a current-phase claim only from a packet README, and never from a fence",
    Effect.fnUntraced(function* () {
      const readme = doc("# Demo", "## Current Phase", "", "P2 Implement.");
      assert.deepStrictEqual(
        A.map(spansOf("goals/demo/README.md", readme), (span) => [span.form, span.raw]),
        [["packet-phase", "P2"]]
      );
      assert.deepStrictEqual(spansOf("docs/README.md", readme), []);
      assert.deepStrictEqual(spansOf("goals/demo/README.md", doc("## Current Phase", "```", "P2", "```")), []);
    })
  );
});

describe("knowledge doctor domain evaluators", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "checks lifecycle and phase claims against the manifests read through the tree",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            ...PACKET_FILES,
            "docs/status.md": doc(
              "`goals/demo` (`active`) and `goals/demo` is `paused`.",
              "`goals/ghost` (`active`) and `goals/broken` (`active`) and `goals/stale` (`paused`)."
            ),
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "packet-status-claim-drift"), [
          "packet-phase:stale:P4",
          "packet-status:broken:active",
          "packet-status:demo:paused",
          "packet-status:ghost:active",
        ]);
        const causes = A.map(
          A.filter(report.findings, (row) => row.finding.kind === "packet-status-claim-drift"),
          (row) => row.causeKey
        );
        assert.include(causes, "goals-doctor:manifest-invalid:broken");
      })
    );

    it.effect(
      "reads record-form phase keys as phase ids when an entry has no explicit id",
      Effect.fnUntraced(function* () {
        // Record-form phases are keyed by phase id (e.g. goals/nlp-adjunct-port); the key stands in.
        const keyed = doc(
          "{",
          `  "schemaVersion": "initiative-manifest/v2",`,
          `  "initiative": { "id": "keyed", "status": "active" },`,
          `  "lifecycle": "active",`,
          `  "completionGate": { "operator": "yeet", "requiresPullRequest": true, "requiresMergeable": true, "statement": "Ship.", "grandfathered": false },`,
          `  "phases": { "p1": { "status": "complete" }, "p2": { "status": "pending" } }`,
          "}"
        );
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "goals/keyed/ops/manifest.json": keyed,
            // A lowercase record key matches an uppercase claim, under a titled lowercase heading.
            "goals/keyed/README.md": doc("# Keyed", "", "## Current phase — Build out", "", "P2 Implement."),
            "goals/lower/ops/manifest.json": manifest("lower", "active", ["P0"]),
            // The lowercase heading is read, so a wrong phase still drifts.
            "goals/lower/README.md": doc("# Lower", "", "## Current phase", "", "P9 Ship."),
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "packet-status-claim-drift"), ["packet-phase:lower:P9"]);
      })
    );

    it.effect(
      "ignores export declarations inside block comments",
      Effect.fnUntraced(function* () {
        const exports = scanKnowledgeFileExports(
          "packages/a/src/index.ts",
          ["/*", "export const Hidden = 1", "*/", "export const Real = 2"].join("\n"),
          HashSet.empty<string>()
        );
        assert.deepStrictEqual(exports.names, ["Real"]);
        // A `/*` inside a string, a line comment, or a regex literal opens no comment (#1702).
        const decoys = scanKnowledgeFileExports(
          "packages/a/src/index.ts",
          [
            'const glob = "src/*";',
            "export const AfterString = 1;",
            "// see src/*.ts",
            "export const AfterLineComment = 2;",
            "const pattern = /a\\/*b/;",
            "export const AfterRegex = 3;",
            "const sum = a+/a\\/*b/;",
            "export const AfterBinaryRegex = 4;",
            "const kind = typeof /c\\/*d/;",
            "export const AfterKeywordRegex = 5;",
            "const half = total / 2 /* trailing */;",
            "export const AfterDivision = 6;",
            "/* real",
            "export const Hidden = 7;",
            "*/",
          ].join("\n"),
          HashSet.empty<string>()
        );
        assert.deepStrictEqual(decoys.names, [
          "AfterString",
          "AfterLineComment",
          "AfterRegex",
          "AfterBinaryRegex",
          "AfterKeywordRegex",
          "AfterDivision",
        ]);
      })
    );

    it.effect(
      "reports the v2 decode error for a broken v2 lock instead of the v1 fallback's",
      Effect.fnUntraced(function* () {
        // The lock is v2 since #1679; a broken v2 lock must not surface a v1 complaint (#1702).
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "skills-lock.json": `{ "version": 2, "skills": { "alpha": { "_tag": "vendored", "sourceType": "github" } } }`,
            ".claude/skills/alpha/SKILL.md": "# alpha",
          },
        });
        const error = yield* Effect.flip(scanKnowledgeDoctorTree(tree));
        const detail = String(error.cause);
        // v2 fails on the vendored entry's missing `upstream`; the v1 fallback would fail on `source`.
        assert.include(detail, '["upstream"]');
      })
    );

    it.effect(
      "resolves packages, subpaths, aliases, and exported identifiers through manifests and barrels",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({ files: { ...PACKAGE_FILES, "docs/symbols.md": SYMBOL_DOC } });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "unknown-beep-symbol"), [
          "beep-export:@beep/a Nope",
          "beep-export:@beep/a NotReal",
          "beep-package:@beep/ghost",
          "beep-package:@beep/outside",
          "beep-subpath:@beep/a/Gone",
          "beep-subpath:@beep/a/Missing",
          "beep-subpath:@beep/a/internal/hidden",
        ]);
      })
    );

    it.effect(
      "evaluates v1 skills hermetically: coverage, floating sources, and missing licenses",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "skills-lock.json": doc(
              "{",
              '  "version": 1,',
              '  "skills": {',
              '    "alpha": { "source": "repo-local", "sourceType": "local", "computedHash": "h" },',
              '    "beta": { "source": "owner/repo", "sourceType": "github", "computedHash": "h", "ref": "main", "skillPath": "skills/beta" },',
              '    "gamma": { "source": "repo-local", "sourceType": "local", "computedHash": "h" }',
              "  }",
              "}"
            ),
            ".claude/skills/alpha/SKILL.md": "# alpha",
            ".claude/skills/beta/SKILL.md": "# beta",
            ".claude/skills/delta/SKILL.md": "# delta",
            ".claude/skills/_shared/notes.md": "shared",
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(
          A.sort(
            A.map(
              A.filter(report.findings, (row) => O.exists(row.evaluator, (id) => id === "skills-local")),
              (row) =>
                `${row.finding.kind} ${row.finding.subject} ${row.finding.location.path}:${row.finding.location.line}`
            ),
            Str.Order
          ),
          [
            "floating-github-skill-source skill:beta:revision skills-lock.json:5",
            "skill-license-unrecorded skill:beta:license skills-lock.json:5",
            "skill-lock-coverage-drift skill:delta:unlocked .claude/skills/delta/SKILL.md:1",
            "skill-lock-coverage-drift skill:gamma:uninstalled skills-lock.json:6",
          ]
        );
      })
    );

    it.effect(
      "reads a v2 lock: a pinned, licensed vendored skill and a local skill both resolve",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* fs.readFileString(
          path.join(import.meta.dirname, "fixtures", "skills-provenance", "oracle-lock-v2.json")
        );
        const withLocal = Str.replace(
          '"skills": {',
          '"skills": {\n    "yeet": { "_tag": "local", "installedTargets": [".claude/skills/yeet"], "installedTreeHash": "7777777777777777777777777777777777777777777777777777777777777777" },'
        )(fixture);
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "skills-lock.json": withLocal,
            ".claude/skills/oracle/SKILL.md": "# oracle",
            ".claude/skills/yeet/SKILL.md": "# yeet",
          },
        });
        const outcomes = yield* evaluateSkillsLocal(tree);
        assert.deepStrictEqual(
          A.map(outcomes, ([span, outcome]) => `${span.raw} ${outcome._tag}`),
          ["oracle Resolved", "yeet Resolved"]
        );
      })
    );

    it.effect(
      "every witness of every resolved domain span is load-bearing",
      Effect.fnUntraced(function* () {
        const statusDoc = "`goals/demo` (`active`) and `goals/stale` is `paused`.";
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            ...PACKET_FILES,
            ...PACKAGE_FILES,
            "docs/status.md": statusDoc,
            "docs/symbols.md": SYMBOL_DOC,
            "skills-lock.json": `{ "version": 1, "skills": { "alpha": { "source": "repo-local", "sourceType": "local", "computedHash": "h" } } }`,
            ".claude/skills/alpha/SKILL.md": "# alpha",
          },
        });
        const skillSpans = O.match(O.fromUndefinedOr(KnowledgeSkillsLocalEvaluator.treeSpans), {
          onNone: () => Effect.succeed(A.empty<KnowledgeSpan>()),
          onSome: (treeSpans) => treeSpans(tree),
        });
        const spans = A.appendAll(
          A.appendAll(
            A.appendAll(spansOf("docs/status.md", statusDoc), spansOf("docs/symbols.md", SYMBOL_DOC)),
            spansOf("goals/demo/README.md", PACKET_FILES["goals/demo/README.md"])
          ),
          yield* skillSpans
        );
        const verdicts = yield* knowledgeCounterfactualVerdicts(tree, spans, KNOWLEDGE_DOCTOR_EVALUATORS);
        assert.deepStrictEqual(notFailed(verdicts), []);
        const witnessTags = HashSet.fromIterable(A.map(verdicts, (verdict) => verdict.witness._tag));
        assert.isTrue(HashSet.has(witnessTags, "ManifestFieldWitness"));
        assert.isTrue(HashSet.has(witnessTags, "ExportWitness"));
        assert.isTrue(HashSet.has(witnessTags, "LockEntryWitness"));
        assert.isAbove(A.length(verdicts), 25);
      })
    );

    it.effect(
      "overlays remove exactly the witnessed domain fact",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({ files: { ...PACKET_FILES, ...PACKAGE_FILES } });
        const withoutPhase = overlayWithout(tree, ManifestFieldWitness.make({ slug: "demo", field: "phases.P1" }));
        const demo = A.findFirst(yield* withoutPhase.domain.packets, (facts) => facts.slug === "demo");
        assert.deepStrictEqual(
          O.map(demo, (facts) => facts.phaseIds),
          O.some(["P0"])
        );
        assert.deepStrictEqual(
          O.flatMap(demo, (facts) => facts.status),
          O.some("active")
        );
        const withoutThing = overlayWithout(
          tree,
          ExportWitness.make({ packageName: "@beep/a", file: "packages/a/src/Thing.ts", exportName: "Thing" })
        );
        assert.deepStrictEqual((yield* withoutThing.domain.fileExports("packages/a/src/Thing.ts")).names, []);
        assert.deepStrictEqual((yield* withoutThing.domain.fileExports("packages/a/src/index.ts")).names, ["Direct"]);
        const withoutLock = overlayWithout(tree, LockEntryWitness.make({ skill: "alpha" }));
        assert.deepStrictEqual((yield* withoutLock.domain.skills).entries, []);
      })
    );
  });
});

// `evaluateSkillsLocal` must need nothing from its environment: in particular no HttpClient, so the
// doctor can never reach the network for skill sources or licenses. This fails to compile otherwise.
type SkillsLocalRequirements = Effect.Services<ReturnType<typeof evaluateSkillsLocal>>;
const skillsLocalIsHermetic: [SkillsLocalRequirements] extends [never] ? true : false = true;
const skillsLocalNeedsNoHttpClient: [HttpClient.HttpClient] extends [SkillsLocalRequirements] ? false : true = true;

describe("knowledge doctor domain evaluators on this checkout", () => {
  it.layer(Layer.mergeAll(testLayer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer))), { timeout: "30 seconds" })(
    (it) => {
      it.effect(
        "reads the same packets, workspace packages, and installed skills as the live filesystem",
        Effect.fnUntraced(function* () {
          assert.isTrue(skillsLocalIsHermetic && skillsLocalNeedsNoHttpClient);
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const tree: KnowledgeDoctorTree = yield* makeKnowledgeDoctorTree("HEAD");

          const treeRecords = yield* readKnowledgeGoalPacketRecords(tree);
          const liveRecords = yield* listGoalPackets(repoRoot);
          assert.deepStrictEqual(
            A.map(treeRecords, (record) => [record.slug, record.manifestText]),
            A.map(liveRecords, (record) => [record.slug, record.manifestText])
          );

          const treePackages = A.sort(
            A.map(
              A.filter(yield* tree.domain.packages, (pkg) => pkg.manifestPath !== "package.json"),
              (pkg) => pkg.name
            ),
            Str.Order
          );
          const livePackages = yield* resolveWorkspaceDirs(repoRoot).pipe(
            Effect.map(HashMap.keys),
            Effect.map((names) => A.sort(A.filter(A.fromIterable(names), Str.startsWith("@beep/")), Str.Order))
          );
          assert.deepStrictEqual(treePackages, livePackages);

          const skillsDir = path.join(repoRoot, ".claude", "skills");
          const liveSkills = yield* Effect.filter(A.sort(yield* fs.readDirectory(skillsDir), Str.Order), (name) =>
            fs.exists(path.join(skillsDir, name, "SKILL.md"))
          );
          assert.deepStrictEqual((yield* tree.domain.skills).installed, liveSkills);
        }),
        { timeout: 180_000 }
      );
    }
  );
});
