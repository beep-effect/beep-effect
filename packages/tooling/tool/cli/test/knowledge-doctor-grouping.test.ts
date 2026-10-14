import {
  capabilityPacketFindings,
  goalPacketFindings,
  makeGoalPacketFilesystemReader,
} from "@beep/repo-cli/commands/Goals/Doctor";
import { listGoalPackets } from "@beep/repo-cli/commands/Goals/Inventory";
import {
  encodeKnowledgeDoctorReportJson,
  groupKnowledgeDoctorFindings,
  KnowledgeDoctorFinding,
  KnowledgeDoctorReport,
  KnowledgeFinding,
  KnowledgePathRemoval,
  makeKnowledgeDoctorMemoryTree,
  makeKnowledgeDoctorTree,
  makeKnowledgeGoalPacketReader,
  parseKnowledgePathRemovals,
  readKnowledgeGoalsDoctorFindings,
  scanKnowledgeDoctorTree,
} from "@beep/repo-cli/commands/Knowledge";
import { renderKnowledgeDoctorHumanReport } from "@beep/repo-cli/test/Knowledge";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const REMOVER = "3333333333333333333333333333333333333333";
const OLDER = "4444444444444444444444444444444444444444";

const doc = (...lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const groupOf = (report: KnowledgeDoctorReport, causeKey: string) =>
  Effect.fromOption(A.findFirst(report.groups, (group) => group.causeKey === causeKey));

const citations = (count: number): Readonly<Record<string, string>> =>
  R.fromEntries(
    A.makeBy(count, (index) => [`docs/cite-${index}.md`, "See `docs/gone.md` for the old guide."] as const)
  );

const permutations = (
  findings: ReadonlyArray<KnowledgeDoctorFinding>
): ReadonlyArray<ReadonlyArray<KnowledgeDoctorFinding>> => [
  A.reverse(findings),
  A.sort(
    findings,
    Order.mapInput(Order.String, (row: KnowledgeDoctorFinding) => row.finding.location.path)
  ),
  A.appendAll(A.drop(findings, 7), A.take(findings, 7)),
];

describe("knowledge doctor causal grouping", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "collapses one deleted target cited 40 times into one group with 40 dependents and its authoring commit",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: citations(40),
          pathRemovals: O.some([
            KnowledgePathRemoval.make({
              path: "docs/gone.md",
              commit: REMOVER,
              subject: "docs: move the guide",
              change: "renamed",
              renamedTo: O.some("docs/guide.md"),
            }),
            KnowledgePathRemoval.make({
              path: "docs/gone.md",
              commit: OLDER,
              subject: "docs: an older deletion",
              change: "deleted",
              renamedTo: O.none(),
            }),
          ]),
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.strictEqual(A.length(report.findings), 40);
        assert.strictEqual(A.length(report.groups), 1);
        const group = yield* groupOf(report, "path:docs/gone.md");
        assert.strictEqual(group.rootOrigin, "owned");
        assertNone(group.root);
        assert.strictEqual(A.length(group.dependents), 40);
        const attribution = yield* Effect.fromOption(group.attribution);
        assert.strictEqual(attribution.commit, REMOVER);
        assert.strictEqual(attribution.change, "renamed");
        assert.deepStrictEqual(attribution.repairTarget, O.some("docs/guide.md"));
        const rendered = renderKnowledgeDoctorHumanReport(report);
        assert.include(rendered, "blocking findings (40) under 1 root(s):");
        assert.include(rendered, `    40 path:docs/gone.md [owned] renamed docs/gone.md in ${REMOVER.slice(0, 10)}`);
        // Advisory dependents under the same cause key stay out of the per-root blocking count.
        const mixed = renderKnowledgeDoctorHumanReport(
          KnowledgeDoctorReport.make({
            ...report,
            findings: A.map(report.findings, (row, index) =>
              index < 3
                ? KnowledgeDoctorFinding.make({
                    ...row,
                    finding: KnowledgeFinding.make({ ...row.finding, severity: "advisory" }),
                  })
                : row
            ),
          })
        );
        assert.include(mixed, "blocking findings (37) under 1 root(s):");
        assert.include(mixed, "    37 path:docs/gone.md [owned] renamed docs/gone.md in ");
        assert.include(mixed, "(+3 advisory)");
      })
    );

    it.effect(
      "roots packet-status claims under an invalid manifest at the delegated goals-doctor finding",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "goals/demo/ops/manifest.json": "{ not json",
            "docs/status.md": doc(
              "`goals/demo` is `active`",
              "`goals/demo` (`active`)",
              "`goals/demo` remains `completed-retained`"
            ),
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        const delegated = A.filter(report.findings, (row) => row.origin === "delegated");
        assert.deepStrictEqual(
          A.map(delegated, (row) => [row.finding.kind, row.finding.subject, row.finding.severity]),
          [["delegated-goals-doctor-finding", "goals-doctor:manifest-invalid:demo", "blocking"]]
        );
        const group = yield* groupOf(report, "goals-doctor:manifest-invalid:demo");
        assert.strictEqual(group.rootOrigin, "delegated");
        assert.deepStrictEqual(group.root, O.some(delegated[0]?.finding.findingId ?? ""));
        assert.strictEqual(A.length(group.dependents), 3);
        assert.strictEqual(A.length(report.groups), 1);
        // The blocking delegated root counts on its own line, so the line matches the headline.
        const blocking = A.length(A.filter(report.findings, (row) => row.finding.severity === "blocking"));
        const rendered = renderKnowledgeDoctorHumanReport(report);
        assert.include(rendered, `blocking findings (${blocking}) under 1 root(s):`);
        assert.include(rendered, `${`${blocking}`.padStart(8)} goals-doctor:manifest-invalid:demo [delegated]`);
      })
    );

    it.effect(
      "groups identically whatever order the findings were discovered in",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            ...citations(12),
            "goals/demo/ops/manifest.json": "{",
            "docs/mixed.md": doc(
              "`docs/other.md` and `docs/gone.md`",
              "`goals/demo` is `active`",
              "`goals/nope` is `active`"
            ),
          },
          pathRemovals: O.some(
            parseKnowledgePathRemovals(`\u001e${REMOVER}\u001fchore: drop\n\nD\tdocs/gone.md\nD\tdocs/other.md\n`)
          ),
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        const expected = yield* encodeKnowledgeDoctorReportJson(report);
        for (const shuffled of permutations(report.findings)) {
          const regrouped = groupKnowledgeDoctorFindings(shuffled, O.some(parseKnowledgePathRemovals("")));
          assert.deepStrictEqual(
            A.map(regrouped, (group) => [group.causeKey, group.rootOrigin, group.root, group.dependents]),
            A.map(report.groups, (group) => [group.causeKey, group.rootOrigin, group.root, group.dependents])
          );
        }
        assert.strictEqual(yield* encodeKnowledgeDoctorReportJson(yield* scanKnowledgeDoctorTree(tree)), expected);
        assert.deepStrictEqual(
          A.map(report.groups, (group) => group.causeKey),
          ["goals-doctor:manifest-invalid:demo", "path:docs/gone.md", "path:docs/other.md", "path:goals/nope"]
        );
        // A missing packet's lifecycle claim and the plain reference to its directory share one root.
        assert.strictEqual(A.length((yield* groupOf(report, "path:goals/nope")).dependents), 2);
      })
    );

    it.effect(
      "leaves every root unattributed when history is unavailable, without failing the report",
      Effect.fnUntraced(function* () {
        const report = yield* scanKnowledgeDoctorTree(
          makeKnowledgeDoctorMemoryTree({ files: citations(2), pathRemovals: O.none() })
        );
        assert.strictEqual(report.rootHistory, "unavailable");
        for (const group of report.groups) {
          assertNone(group.attribution);
        }
        assert.strictEqual(A.length(report.groups), 1);
      })
    );

    it.effect(
      "parses deletions and renames and attributes a directory target through a file beneath it",
      Effect.fnUntraced(function* () {
        const removals = parseKnowledgePathRemovals(
          A.join(
            [
              "",
              `${REMOVER}\u001frefactor: move the demo packet\n\nR100\tgoals/demo/README.md\tgoals/renamed/README.md\n`,
              `${OLDER}\u001fchore: drop notes\n\nD\tdocs/notes.md\nM\tdocs/kept.md\n`,
              "not-a-sha\u001fignored\n\nD\tdocs/ignored.md\n",
            ],
            "\u001e"
          )
        );
        assert.deepStrictEqual(
          A.map(removals, (removal) => [removal.path, removal.commit, removal.change]),
          [
            ["goals/demo/README.md", REMOVER, "renamed"],
            ["docs/notes.md", OLDER, "deleted"],
          ]
        );
        const tree = makeKnowledgeDoctorMemoryTree({
          files: { "docs/index.md": "`goals/demo` and `docs/notes.md` and `docs/never.md`" },
          pathRemovals: O.some(removals),
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        const packet = yield* Effect.fromOption((yield* groupOf(report, "path:goals/demo")).attribution);
        assert.deepStrictEqual(
          [packet.commit, packet.removedPath, packet.repairTarget],
          [REMOVER, "goals/demo/README.md", O.some("goals/renamed")]
        );
        const notes = yield* Effect.fromOption((yield* groupOf(report, "path:docs/notes.md")).attribution);
        assert.deepStrictEqual([notes.commit, notes.repairTarget], [OLDER, O.none()]);
        assertNone((yield* groupOf(report, "path:docs/never.md")).attribution);
      })
    );

    it.effect(
      "reads reflections and exploration back-links from tree bytes",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({
          files: {
            "goals/demo/history/reflections/2026-10-14-claude.md": "no frontmatter",
            "goals/demo/history/reflections/nested/2026-10-14-x.md": "x",
            "explorations/live/README.md": "x",
          },
        });
        const reader = makeKnowledgeGoalPacketReader(tree);
        assert.deepStrictEqual(yield* reader.reflectionFiles("goals/demo"), ["2026-10-14-claude.md"]);
        assert.deepStrictEqual(
          yield* Effect.forEach(
            ["explorations/live", "explorations/live/README.md", "explorations/gone", "../outside", "/abs", ""],
            reader.explorationPath
          ),
          ["present", "present", "absent", "escapes", "escapes", "present"]
        );
      })
    );
  });
});

describe("goals packet core parity", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "lists the same packet and capability findings from HEAD's tree as from the working filesystem",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();
        const records = yield* listGoalPackets(repoRoot);
        const reader = makeGoalPacketFilesystemReader();
        const results = yield* Effect.forEach(records, (record) => goalPacketFindings(record, reader));
        const filesystem = A.appendAll(
          A.flatMap(results, (result) => result.findings),
          capabilityPacketFindings(
            A.zipWith(records, results, (record, result) => ({ slug: record.slug, manifest: result.manifest }))
          )
        );
        const tree = yield* makeKnowledgeDoctorTree("HEAD");
        const fromTree = yield* readKnowledgeGoalsDoctorFindings(tree);
        assert.deepStrictEqual(
          A.map(fromTree, (finding) => finding.key),
          A.map(filesystem, (finding) => finding.key)
        );
      }),
      { timeout: 180_000 }
    );
  });
});
