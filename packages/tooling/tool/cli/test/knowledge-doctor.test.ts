import {
  CommandNodeWitness,
  classifyKnowledgeSpan,
  decodeKnowledgeDoctorReportJson,
  decodeKnowledgeUtf8,
  EvaluationResolved,
  encodeKnowledgeDoctorReportJson,
  extractKnowledgeDocumentSpans,
  KNOWLEDGE_CLI_GLOBAL_FLAGS,
  KNOWLEDGE_DOCTOR_EVALUATORS,
  KNOWLEDGE_SPAN_CLASSIFICATION_RULES,
  KnowledgeSpan,
  KnowledgeSpanClass,
  knowledgeCounterfactualVerdicts,
  makeKnowledgeDoctorMemoryTree,
  makeKnowledgeDoctorTree,
  overlayWithout,
  ProducerWitness,
  scanKnowledgeDoctorTree,
  TreeEntryWitness,
} from "@beep/repo-cli/commands/Knowledge";
import { knowledgeDoctorCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command";
import { KnowledgeCommandSurface, renderKnowledgeDoctorHumanReport } from "@beep/repo-cli/test/Knowledge";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { temporaryWorkingDirectory } from "./support/CommandTest.ts";
import type {
  KnowledgeCounterfactualVerdict,
  KnowledgeDoctorMemoryTreeInput,
  KnowledgeDoctorReport,
  KnowledgeDoctorTree,
  KnowledgeEvaluator,
  KnowledgeFindingKind,
} from "@beep/repo-cli/commands/Knowledge";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const CITED = "1111111111111111111111111111111111111111";
const FOREIGN = "2222222222222222222222222222222222222222";
const FENCE = "```";
const TILDES = "~~~";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeConsoleLines = S.decodeUnknownEffect(S.Array(S.String));

const commandTreeOf = (value: unknown) =>
  Effect.flatMap(encodeJson(value), KnowledgeCommandSurface.decodeCurrentCommandTree).pipe(Effect.asSome);

const flag = (name: string, aliases: ReadonlyArray<string> = [], negatable = false) => ({ name, aliases, negatable });

const FIXTURE_SURFACE = {
  name: "beep-cli",
  alias: null,
  options: [],
  children: [
    {
      name: "knowledge",
      alias: "k",
      options: [],
      children: [
        {
          name: "refs",
          alias: null,
          options: [flag("tree"), flag("json", ["j"], true), flag("verbose", ["v"], true)],
          children: [],
        },
        { name: "census", alias: null, options: [], children: [] },
      ],
    },
    {
      name: "goals",
      alias: null,
      options: [],
      children: [
        { name: "doctor", alias: null, options: [], children: [] },
        { name: "index", alias: null, options: [], children: [] },
      ],
    },
    { name: "legacy", alias: null, children: [] },
  ],
};

const memoryTree = Effect.fnUntraced(function* (input: KnowledgeDoctorMemoryTreeInput) {
  const commandTree = yield* commandTreeOf(FIXTURE_SURFACE);
  return makeKnowledgeDoctorMemoryTree({ commandTree, ...input });
});

const kinds = (report: KnowledgeDoctorReport): ReadonlyArray<KnowledgeFindingKind> =>
  A.map(report.findings, (row) => row.finding.kind);

const subjects = (report: KnowledgeDoctorReport, kind: KnowledgeFindingKind): ReadonlyArray<string> =>
  A.sort(
    A.map(
      A.filter(report.findings, (row) => row.finding.kind === kind),
      (row) => row.finding.subject
    ),
    Str.Order
  );

const spansOf = (documentPath: string, text: string) =>
  extractKnowledgeDocumentSpans(documentPath, text, HashSet.empty()).spans;

const doc = (...lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const verdictNames = (verdicts: ReadonlyArray<KnowledgeCounterfactualVerdict>) =>
  A.map(verdicts, (verdict) => `${verdict.verdict} ${verdict.span.raw} ${verdict.witness._tag}`);

describe("knowledge doctor classification rule table", () => {
  it.effect.prop(
    "is total and ordered: generated, then archival-with-valid-citation, then live, then unclassified",
    { span: KnowledgeSpan, valid: S.Boolean },
    ({ span, valid }) =>
      Effect.sync(() => {
        const validCitation = valid ? O.some(CITED) : O.none();
        const expected = O.isSome(span.generatedBy)
          ? "generated-example"
          : span.surface === "archival" && valid
            ? "historical-with-commit"
            : span.surface === "live"
              ? "verified"
              : "unclassified";
        const spanClass = classifyKnowledgeSpan({ span: KnowledgeSpan.make(span), validCitation });
        assert.strictEqual(spanClass, expected);
        assert.isTrue(KnowledgeSpanClass.is[spanClass](spanClass));
        assert.isTrue(A.some(KNOWLEDGE_SPAN_CLASSIFICATION_RULES, (row) => row.spanClass === spanClass));
      }),
    { arbitrary: fcRuns(200) }
  );

  it.effect.prop(
    "never moves a live span off the scanned tree, whatever citation covers it",
    { span: KnowledgeSpan },
    ({ span }) =>
      Effect.sync(() => {
        const live = KnowledgeSpan.make({ ...span, surface: "live", generatedBy: O.none() });
        assert.strictEqual(classifyKnowledgeSpan({ span: live, validCitation: O.some(CITED) }), "verified");
      }),
    { arbitrary: fcRuns(100) }
  );
});

describe("knowledge doctor span extraction", () => {
  it.effect(
    "reads only prose: unmarked, tilde, and nested fences are decoys",
    Effect.fnUntraced(function* () {
      const spans = spansOf(
        "docs/guide.md",
        doc(
          "`goals/INDEX.md` in prose",
          FENCE,
          "`goals/missing-in-fence.md`",
          "bun run beep nope",
          FENCE,
          TILDES,
          "`goals/missing-in-tilde.md`",
          TILDES,
          "````md",
          FENCE,
          "`goals/missing-in-nested.md`",
          FENCE,
          "````",
          "`docs/after.md` after"
        )
      );
      assert.deepStrictEqual(
        A.map(spans, (span) => span.raw),
        ["goals/INDEX.md", "docs/after.md"]
      );
    })
  );

  it.effect(
    "takes beep:generated only from a fence info string, never from prose or a comment inside a fence",
    Effect.fnUntraced(function* () {
      const spans = spansOf(
        "docs/guide.md",
        doc(
          "prose mention: `beep:generated=producer://goals/index` and ``` text beep:generated=x ```",
          `${FENCE}text`,
          "<!-- beep:generated=producer://smuggled -->",
          FENCE,
          `${TILDES}text beep:generated=producer://unknown/thing`,
          "`goals/missing.md`",
          TILDES
        )
      );
      assert.deepStrictEqual(
        A.map(spans, (span) => [span.form, span.raw, O.getOrNull(span.generatedBy)]),
        [["generated-fence", "producer://unknown/thing", "producer://unknown/thing"]]
      );
    })
  );

  it.effect(
    "does not read a reflowed span broken across lines",
    Effect.fnUntraced(function* () {
      const spans = spansOf("docs/guide.md", doc("run `bun run", "beep nope` or `goals/", "missing.md`"));
      assert.deepStrictEqual(spans, []);
    })
  );

  it.effect(
    "scopes a block citation to exactly the next block, and a frontmatter citation to the document",
    Effect.fnUntraced(function* () {
      const extraction = extractKnowledgeDocumentSpans(
        "goals/demo/history/notes.md",
        doc(
          "---",
          `beep-historical: ${FOREIGN}`,
          "---",
          `<!-- beep:historical commit=${CITED} -->`,
          "",
          "`goals/a.md` first line of the block",
          "`goals/b.md` still the block",
          "",
          "`goals/c.md` next block",
          `<!-- beep:historical commit=${CITED} -->`,
          FENCE,
          "not a span",
          FENCE,
          "`goals/d.md` after the fence"
        ),
        HashSet.empty()
      );
      assert.deepStrictEqual(
        A.map(extraction.spans, (span) => [span.raw, O.getOrNull(O.map(span.citation, (citation) => citation.form))]),
        [
          ["goals/a.md", "block"],
          ["goals/b.md", "block"],
          ["goals/c.md", "document"],
          ["goals/d.md", "document"],
        ]
      );
      assert.deepStrictEqual(
        A.map(extraction.markers, (marker) => [marker.form, marker.line]),
        [
          ["document", 2],
          ["block", 4],
          ["block", 10],
        ]
      );
    })
  );

  it.effect(
    "reads an assertion only from a whole comment line: quoted, fenced, and mid-line markers are syntax",
    Effect.fnUntraced(function* () {
      const quoted = "Write `<!-- beep:assert path-exists docs/quoted.md -->` to assert a path.";
      const spans = spansOf(
        "docs/guide.md",
        doc(
          quoted,
          FENCE,
          "<!-- beep:assert path-exists docs/fenced.md -->",
          FENCE,
          "Prose then <!-- beep:assert path-exists docs/mid-line.md --> mid-line.",
          "<!-- beep:assert path-exists docs/real.md -->",
          "",
          "    <!-- beep:assert path-exists docs/code-indented.md -->",
          "\t<!-- beep:assert path-exists docs/tab-indented.md -->",
          "",
          "   <!-- beep:assert path-exists docs/three-spaces.md -->"
        )
      );
      // Four spaces or a tab make a CommonMark indented code block; three spaces still assert.
      assert.deepStrictEqual(
        A.map(spans, (span) => [span.form, span.raw, span.location.line, span.location.column]),
        [
          ["path-assertion", "docs/real.md", 6, 1],
          ["path-assertion", "docs/three-spaces.md", 11, 4],
        ]
      );
      // Counterfactual: the pre-fix unanchored pattern read the quoted marker as an assertion.
      assert.isNotNull(/<!-- beep:assert path-exists ([^\s]+) -->/u.exec(quoted));
    })
  );

  it.effect(
    "never reads an arrow chain of commands as one command span",
    Effect.fnUntraced(function* () {
      const spans = spansOf(
        "docs/guide.md",
        doc(
          "`bun run beep yeet repair → verify → publish --pr → monitor`",
          "`bun run beep yeet repair -> verify -> publish --pr -> monitor`",
          "`bun run beep yeet publish --pr`",
          '`bun run beep create-package demo --description "Doc→KG→eval"`'
        )
      );
      // An arrow inside one argument is not a chain: that invocation is still probed.
      assert.deepStrictEqual(
        A.map(spans, (span) => [span.form, span.raw]),
        [
          ["command", "bun run beep yeet publish --pr"],
          ["command", 'bun run beep create-package demo --description "Doc→KG→eval"'],
        ]
      );
    })
  );

  it.effect(
    "reads a spaced arrow inside a quoted argument as one command, and still drops real chains",
    Effect.fnUntraced(function* () {
      const spans = spansOf(
        "docs/guide.md",
        doc(
          '`bun run beep create-package demo --description "Doc → KG"`',
          "`bun run beep create-package demo --description 'Doc -> KG'`",
          "`bun run beep yeet repair → verify → publish --pr`",
          '`bun run beep yeet repair "a" → verify`',
          '`bun run beep create-package demo --description "Doc → KG`'
        )
      );
      assert.deepStrictEqual(
        A.map(spans, (span) => [span.form, span.raw]),
        [
          ["command", 'bun run beep create-package demo --description "Doc → KG"'],
          ["command", "bun run beep create-package demo --description 'Doc -> KG'"],
        ]
      );
    })
  );

  it.effect(
    "never reads a span that exactly names a Git ref as a path",
    Effect.fnUntraced(function* () {
      const extraction = extractKnowledgeDocumentSpans(
        "docs/guide.md",
        "branch `goals/feature-x` and path `goals/feature-y`",
        HashSet.make("goals/feature-x")
      );
      assert.deepStrictEqual(
        A.map(extraction.spans, (span) => span.raw),
        ["goals/feature-y"]
      );
    })
  );
});

describe("knowledge doctor scan", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "normalizes alternate path spellings exactly as Stage 1 does and stays case-sensitive",
      Effect.fnUntraced(function* () {
        const nfdName = Str.normalize("NFD")("goals/café.md");
        const tree = yield* memoryTree({
          files: {
            "goals/sub/README.md": "x",
            "goals/café.md": "x",
            "docs/guide.md": doc(
              "`./sibling.md`",
              "`goals/sub/`",
              "`goals//sub/README.md`",
              `\`${nfdName}\``,
              "`goals/sub%20space.md`",
              "`goals/SUB/README.md`",
              "`Goals/sub/README.md`"
            ),
            "docs/sibling.md": "x",
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "broken-tracked-path"), [
          "repo-path:goals/SUB/README.md",
          "repo-path:goals/sub%20space.md",
        ]);
        assert.strictEqual(report.spanCounts.verified, 6);
      })
    );

    it.effect(
      "evaluates commands, options, aliases, negation, globals, and end-of-options through the static surface",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({
          files: {
            "docs/guide.md": doc(
              "`bun run beep knowledge refs --tree HEAD --json`",
              "`bun run beep k refs -j --verbose`",
              "`bun run beep knowledge refs --no-json --tree=main`",
              "`bun run beep knowledge refs --tree -5 -- --bogus`",
              "`bun run beep goals doctor --help -h --log-level=info`",
              "`bun run beep`",
              "`bun run beep legacy --whatever -x`",
              "`bun run beep knowledge refs --bogus -q`",
              "`bun run beep knowledge refs --no-tree`",
              "`bun run beep knowledge nope`"
            ),
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "unknown-beep-option"), [
          "beep-option:knowledge refs --bogus",
          "beep-option:knowledge refs --no-tree",
          "beep-option:knowledge refs -q",
        ]);
        assert.deepStrictEqual(subjects(report, "unknown-beep-command"), ["beep-command:knowledge nope"]);
        assert.strictEqual(report.uncheckedOptionCount, 2);
        assert.strictEqual(report.spanCounts.verified, 10);
      })
    );

    it.effect(
      "fails every command span when the tree has no command surface",
      Effect.fnUntraced(function* () {
        const tree = makeKnowledgeDoctorMemoryTree({ files: { "AGENTS.md": "`bun run beep goals doctor`" } });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "unknown-beep-command"), ["beep-command:goals"]);
      })
    );

    it.effect(
      "keeps live spans at the scanned tree under document and block markers, and reports each marker",
      Effect.fnUntraced(function* () {
        const historical = yield* memoryTree({ files: { "goals/old.md": "x" }, commit: CITED });
        const tree = yield* memoryTree({
          files: {
            "docs/live.md": doc(
              "---",
              `beep-historical: ${CITED}`,
              "---",
              `<!-- beep:historical commit=${CITED} -->`,
              "`goals/old.md` is gone at HEAD"
            ),
          },
          ancestors: [CITED],
          history: { [CITED]: historical },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(A.sort(kinds(report), Str.Order), [
          "broken-tracked-path",
          "historical-marker-on-live-surface",
          "historical-marker-on-live-surface",
        ]);
        assert.isTrue(A.every(report.findings, (row) => row.spanClass === "verified"));
        assert.strictEqual(report.spanCounts["historical-with-commit"], 0);
      })
    );

    it.effect(
      "verifies archival spans at the cited commit, through renames and multi-hop moves",
      Effect.fnUntraced(function* () {
        const historical = yield* memoryTree({
          files: { "goals/first-name.md": "x", "goals/kept.md": "x" },
          commit: CITED,
        });
        const tree = yield* memoryTree({
          files: {
            // first-name.md was renamed twice since the cited commit; kept.md was renamed and edited.
            "goals/third-name.md": "x",
            "goals/kept-renamed.md": "y",
            "goals/demo/history/notes.md": doc(
              `<!-- beep:historical commit=${CITED} -->`,
              "`goals/first-name.md` and `goals/kept.md` and `goals/never-existed.md`"
            ),
            "docs/live.md": "`goals/first-name.md` cited from a live surface",
          },
          ancestors: [CITED],
          history: { [CITED]: historical },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.strictEqual(report.spanCounts["historical-with-commit"], 3);
        assert.deepStrictEqual(subjects(report, "historical-claim-unverified"), [
          `historical:${CITED}:repo-path:goals/never-existed.md`,
        ]);
        assert.deepStrictEqual(subjects(report, "broken-tracked-path"), ["repo-path:goals/first-name.md"]);
      })
    );

    it.effect(
      "refuses an unbounded fan-out of distinct historical commits before materialization",
      Effect.fnUntraced(function* () {
        const commits = A.map(["1", "2", "3", "4", "5"], (digit) => Str.repeat(40)(digit));
        const tree = yield* memoryTree({
          files: {
            "goals/demo/research/notes.md": doc(
              ...A.flatMap(commits, (commit) => [`<!-- beep:historical commit=${commit} -->`, "`package.json`"])
            ),
          },
          ancestors: commits,
        });
        const error = yield* Effect.flip(scanKnowledgeDoctorTree(tree));
        assert.include(error.message, "more than four distinct historical commits");
      })
    );

    it.effect(
      "reports a non-ancestor citation and leaves its spans unclassified",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({
          files: {
            "goals/demo/research/notes.md": doc(
              `<!-- beep:historical commit=${FOREIGN} -->`,
              "`goals/anything.md` `bun run beep nope`"
            ),
            "goals/demo/reviews/plain.md": "`goals/uncited.md`",
          },
          ancestors: [CITED],
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.deepStrictEqual(subjects(report, "historical-commit-not-ancestor"), [`historical-commit:${FOREIGN}`]);
        assert.deepStrictEqual(subjects(report, "unclassified-reference-span"), [
          "command:bun run beep nope",
          "path:goals/anything.md",
          "path:goals/uncited.md",
        ]);
        assert.strictEqual(report.spanCounts.unclassified, 3);
        assert.isTrue(
          A.every(
            A.filter(report.findings, (row) => row.finding.kind === "unclassified-reference-span"),
            (row) => row.finding.severity === "advisory"
          )
        );
      })
    );

    it.effect(
      "counts a beep:generated fence as a generated example and evaluates nothing inside it",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({
          files: {
            "docs/live.md": doc(`${FENCE}text beep:generated=producer://unregistered`, "`goals/missing.md`", FENCE),
          },
        });
        const report = yield* scanKnowledgeDoctorTree(tree);
        assert.strictEqual(report.spanCounts["generated-example"], 1);
        assert.deepStrictEqual(report.findings, []);
      })
    );

    it.effect(
      "resolves an untracked producer-owned path through its producer witness",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({ files: { "AGENTS.md": "`goals/INDEX.md`" } });
        const spans = spansOf("AGENTS.md", "`goals/INDEX.md`");
        const verdicts = yield* knowledgeCounterfactualVerdicts(tree, spans);
        assert.deepStrictEqual(
          A.map(verdicts, (verdict) => [verdict.verdict, verdict.witness]),
          [["failed", ProducerWitness.make({ producerId: "producer://goals/index", targetPath: "goals/INDEX.md" })]]
        );
      })
    );

    it.effect(
      "encodes deterministically and round-trips the report schema",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({
          files: {
            "docs/a.md": "`goals/x.md` `bun run beep knowledge refs --bogus`",
            "goals/demo/history/b.md": "`goals/y.md`",
          },
        });
        const first = yield* encodeKnowledgeDoctorReportJson(yield* scanKnowledgeDoctorTree(tree));
        const second = yield* encodeKnowledgeDoctorReportJson(yield* scanKnowledgeDoctorTree(tree));
        assert.strictEqual(first, second);
        const decoded = yield* decodeKnowledgeDoctorReportJson(first);
        assert.strictEqual(yield* encodeKnowledgeDoctorReportJson(decoded), first);
        // goals/demo tracks a file but no manifest, so the goals doctor's manifest-missing is listed as delegated.
        assert.include(renderKnowledgeDoctorHumanReport(decoded), "blocking findings (3) under 3 root(s):");
      })
    );
  });
});

describe("knowledge doctor counterfactual harness", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "every witness of every resolved path and command span is load-bearing",
      Effect.fnUntraced(function* () {
        const text = doc(
          "`goals/sub/README.md` `goals/sub` `./sibling.md` `goals/INDEX.md`",
          "<!-- beep:assert path-exists docs/sibling.md -->",
          "`bun run beep knowledge refs --tree HEAD --json -j --no-verbose`",
          "`bun run beep k refs`",
          "`bun run beep goals doctor --help --log-level=debug`",
          "`bun run beep`"
        );
        const tree = yield* memoryTree({
          files: { "goals/sub/README.md": "x", "docs/sibling.md": "x", "docs/guide.md": text },
        });
        const verdicts = yield* knowledgeCounterfactualVerdicts(tree, spansOf("docs/guide.md", text));
        assert.isTrue(A.isReadonlyArrayNonEmpty(verdicts));
        assert.deepStrictEqual(
          A.filter(verdictNames(verdicts), (name) => !Str.startsWith("failed")(name)),
          []
        );
        assert.strictEqual(A.length(verdicts), 14);
      })
    );

    it.effect(
      "reports a shadowed option alias as rebound rather than failed",
      Effect.fnUntraced(function* () {
        const text = "`bun run beep knowledge refs -v`";
        const tree = yield* memoryTree({ files: { "docs/guide.md": text } });
        const verdicts = yield* knowledgeCounterfactualVerdicts(tree, spansOf("docs/guide.md", text));
        assert.deepStrictEqual(verdictNames(verdicts), [
          "failed bun run beep knowledge refs -v CommandNodeWitness",
          "rebound bun run beep knowledge refs -v CommandNodeWitness",
        ]);
      })
    );

    it.effect(
      "catches a vacuous evaluator that resolves without consulting the tree",
      Effect.fnUntraced(function* () {
        const vacuous: KnowledgeEvaluator = {
          id: "paths",
          forms: ["path"],
          kinds: ["broken-tracked-path"],
          evaluate: () =>
            Effect.succeed(
              EvaluationResolved.make({ witnesses: [TreeEntryWitness.make({ path: "goals/x.md" })], unchecked: [] })
            ),
        };
        const tree = yield* memoryTree({ files: { "goals/x.md": "x" } });
        const verdicts = yield* knowledgeCounterfactualVerdicts(tree, spansOf("docs/guide.md", "`goals/y.md`"), [
          vacuous,
        ]);
        assert.deepStrictEqual(
          A.map(verdicts, (verdict) => verdict.verdict),
          ["vacuous"]
        );
      })
    );

    it.effect(
      "removes exactly the witnessed fact and nothing else",
      Effect.fnUntraced(function* () {
        const tree = yield* memoryTree({ files: { "goals/sub/a.md": "x", "goals/sub/b.md": "x", "goals/c.md": "x" } });
        const hidden = overlayWithout(tree, TreeEntryWitness.make({ path: "goals/sub" }));
        assert.deepStrictEqual(
          A.map(hidden.trackedEntries, (entry) => entry.path),
          ["goals/c.md"]
        );
        const withoutGlobal = overlayWithout(tree, CommandNodeWitness.make({ commandPath: [], option: "help" }));
        assert.strictEqual(A.length(withoutGlobal.globalOptions), A.length(KNOWLEDGE_CLI_GLOBAL_FLAGS) - 1);
        const withoutRoot = overlayWithout(tree, CommandNodeWitness.make({ commandPath: [] }));
        assertNone(yield* withoutRoot.commandTree);
        const withoutRefs = overlayWithout(tree, CommandNodeWitness.make({ commandPath: ["knowledge", "refs"] }));
        const resolution = O.map(yield* withoutRefs.commandTree, (root) =>
          KnowledgeCommandSurface.resolveStaticCommand(root, ["knowledge", "refs"])
        );
        assert.deepStrictEqual(O.getOrNull(resolution), ["unknown", ["knowledge", "refs"]]);
      })
    );
  });
});

const ROOT_MODULE_PATH = "packages/tooling/tool/cli/src/commands/Root.ts";

class RuntimeCommandFlags extends S.Opaque<RuntimeCommandFlags, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    flags: S.Array(S.String),
  }).annotate({ identifier: "RuntimeCommandFlags" })
) {}

const RuntimeCommandFlagsJson = RuntimeCommandFlags.pipe(S.Array, S.fromJsonString);
const SHARED_FLAGS_PATH = "packages/tooling/tool/cli/src/internal/cli/Flags.ts";

describe("knowledge static option surface", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "derives declared flags through consts, pipes, data-first combinators, factories, records, and shared flags",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-option-surface-" });
        yield* fs.makeDirectory(path.dirname(path.join(tempRoot, ROOT_MODULE_PATH)), { recursive: true });
        yield* fs.makeDirectory(path.dirname(path.join(tempRoot, SHARED_FLAGS_PATH)), { recursive: true });
        yield* fs.writeFileString(
          path.join(tempRoot, SHARED_FLAGS_PATH),
          doc(
            'import { Flag } from "effect/cli"',
            'export const jsonFlagWith = (description: string) => Flag.Boolean("json").pipe(Flag.withDescription(description))',
            'export const jsonFlag = jsonFlagWith("Emit JSON")',
            ""
          )
        );
        yield* fs.writeFileString(
          path.join(tempRoot, ROOT_MODULE_PATH),
          doc(
            'import { Argument, Command, Flag } from "effect/cli"',
            'import { pipe } from "effect/Function"',
            'import { jsonFlag } from "../internal/cli/Flags.ts"',
            'const treeFlag = Flag.String("tree").pipe(Flag.withAlias("-t"), Flag.withDefault("HEAD"))',
            'const shared = { verbose: Flag.optional(Flag.Boolean("verbose")) }',
            "const json = jsonFlag",
            'const fileArgument = Argument.String("file").pipe(Argument.optional)',
            "const derived = Command.make(",
            '  "derived",',
            "  {",
            "    tree: treeFlag,",
            "    json,",
            "    ...shared,",
            '    nested: { depth: pipe(Flag.Int("depth"), Flag.withAlias("d")) },',
            "    file: fileArgument,",
            "  },",
            "  () => undefined",
            ")",
            'const opaque = Command.make("opaque", { either: Flag.String("a").pipe(Flag.orElse(() => Flag.String("b"))) })',
            'const bare = Command.make("bare")',
            'const invalidAlias = Command.make("invalidAlias", { file: Argument.String("file").pipe(Flag.withAlias("v")) })',
            'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([derived, opaque, bare, invalidAlias]))',
            ""
          )
        );
        const tree = yield* KnowledgeCommandSurface.buildStaticCommandTree(tempRoot);
        const options = (name: string) =>
          O.getOrNull(
            O.flatMap(
              A.findFirst(tree.children, (child) => child.name === name),
              (child) => O.fromUndefinedOr(child.options)
            )
          );
        assert.deepStrictEqual(
          A.map(options("derived") ?? [], (option) => [option.name, option.aliases, option.negatable]),
          [
            ["tree", ["t"], false],
            ["json", [], true],
            ["verbose", [], true],
            ["depth", ["d"], false],
          ]
        );
        assert.isNull(options("opaque"));
        assert.isNull(options("invalidAlias"));
        assert.deepStrictEqual(KnowledgeCommandSurface.resolveStaticCommand(tree, ["invalidAlias"]), [
          "resolved",
          ["invalidAlias"],
        ]);
        assert.strictEqual(KnowledgeCommandSurface.pruneStaticCommand(tree, []), tree);
        assert.deepStrictEqual(options("bare"), []);
      })
    );

    it.effect(
      "matches the runtime flag declarations of every statically derivable command in this checkout",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const repoRoot = yield* findRepoRoot();
        const cliRoot = path.join(repoRoot, "packages/tooling/tool/cli");
        const bun = yield* spawner
          .string(ChildProcess.make("which", ["bun"], { extendEnv: true }))
          .pipe(Effect.map(Str.trim));
        const probe = doc(
          'import { Param, Primitive } from "effect/cli"',
          'import { rootCommand } from "./src/commands/Root.ts"',
          "const rows = []",
          "const walk = (command, path) => {",
          "  const flags = command.config.flags.flatMap((param) => Param.extractSingleParams(param))",
          '    .map((single) => `${single.name}[${[...single.aliases].join(",")}]${Primitive.isBoolean(single.primitiveType) ? "!" : ""}`)',
          "    .sort()",
          '  rows.push({ path: path.join(" "), flags })',
          "  for (const group of command.subcommands) for (const child of group.commands) walk(child, [...path, child.name])",
          "}",
          "walk(rootCommand, [])",
          "process.stdout.write(JSON.stringify(rows))"
        );
        const output = yield* spawner.string(ChildProcess.make(bun, ["-e", probe], { cwd: cliRoot, extendEnv: true }));
        const runtime = yield* S.decodeEffect(RuntimeCommandFlagsJson)(output);
        const runtimeFlags = R.fromEntries(A.map(runtime, (row) => [row.path, row.flags] as const));
        const tree = yield* KnowledgeCommandSurface.buildStaticCommandTree(repoRoot);
        let derived = 0;
        let mismatches = A.empty<string>();
        const walk = (node: typeof tree, commandPath: ReadonlyArray<string>): void => {
          const key = A.join(commandPath, " ");
          if (node.options !== undefined) {
            derived += 1;
            const staticFlags = A.sort(
              A.map(
                node.options,
                (option) => `${option.name}[${A.join(option.aliases, ",")}]${option.negatable ? "!" : ""}`
              ),
              Str.Order
            );
            const live = O.getOrElse(R.get(runtimeFlags, key), () => A.empty<string>());
            if (A.join(staticFlags, " ") !== A.join(live, " ")) {
              mismatches = A.append(mismatches, key);
            }
          }
          for (const child of node.children) walk(child, A.append(commandPath, child.name));
        };
        walk(tree, []);
        assert.deepStrictEqual(mismatches, []);
        assert.isAbove(derived, A.length(runtime) - 10);
      })
    );
  });
});

describe("knowledge doctor on this checkout", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "reads HEAD and has no vacuous live witness",
      Effect.fnUntraced(function* () {
        const tree: KnowledgeDoctorTree = yield* makeKnowledgeDoctorTree("HEAD");
        assert.isAbove(A.length(tree.trackedEntries), 0);
        const sample = yield* Effect.forEach(
          A.take(
            A.filter(tree.trackedEntries, (entry) => entry.path === "AGENTS.md"),
            1
          ),
          (entry) =>
            tree.readBytes(entry.path).pipe(
              Effect.flatMap((bytes) => decodeKnowledgeUtf8(bytes, "AGENTS.md is not UTF-8")),
              Effect.map((text) => spansOf(entry.path, text))
            )
        );
        const verdicts = yield* knowledgeCounterfactualVerdicts(
          tree,
          A.take(A.flatten(sample), 50),
          KNOWLEDGE_DOCTOR_EVALUATORS
        );
        assert.deepStrictEqual(
          A.filter(verdicts, (verdict) => verdict.verdict === "vacuous"),
          []
        );
      }),
      { timeout: 90_000 }
    );
  });
});

describe("knowledge doctor command boundary", () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses the unavailable gating form and emits human and JSON reports without gating findings",
      Effect.fnUntraced(
        function* () {
          yield* temporaryWorkingDirectory;
          const fs = yield* FileSystem.FileSystem;
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const rootModule = "packages/tooling/tool/cli/src/commands/Root.ts";
          yield* fs.makeDirectory("packages/tooling/tool/cli/src/commands", { recursive: true });
          yield* fs.writeFileString(
            rootModule,
            doc(
              'import { Command, Flag } from "effect/cli"',
              'const doctor = Command.make("doctor", { report: Flag.Boolean("report"), tree: Flag.String("tree"), json: Flag.Boolean("json") })',
              'const knowledge = Command.make("knowledge").pipe(Command.withSubcommands([doctor]))',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([knowledge]))'
            )
          );
          yield* fs.writeFileString(
            "AGENTS.md",
            `Read \`${rootModule}\` or run \`bun run beep knowledge doctor --report\`. Missing: \`goals/missing.md\`.\n`
          );
          yield* fs.makeDirectory("goals/demo/reviews", { recursive: true });
          yield* fs.writeFileString("goals/demo/reviews/plain.md", "Old `goals/archived.md` reference.\n");
          for (const args of [
            ["init", "--initial-branch=main"],
            ["add", "."],
            ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit", "-m", "fixture"],
          ]) {
            const code = yield* spawner.exitCode(ChildProcess.make("git", args, { extendEnv: true }));
            assert.strictEqual(code, 0);
          }
          const run = Command.runWith(knowledgeDoctorCommand, { version: "0.0.0" });
          const refused = yield* Effect.exit(run([]));
          assert.isTrue(Exit.isFailure(refused));
          yield* run(["--report", "--tree", "HEAD"]);
          const human = yield* TestConsole.logLines.pipe(Effect.flatMap(decodeConsoleLines));
          assert.isTrue(A.some(human, (line) => Str.includes("knowledge doctor --report @ HEAD")(line)));
          yield* run(["--report", "--tree", "HEAD", "--json"]);
          const lines = yield* TestConsole.logLines.pipe(Effect.flatMap(decodeConsoleLines));
          const report = yield* A.last(lines).pipe(O.getOrThrow, decodeKnowledgeDoctorReportJson);
          assert.strictEqual(report.mode, "report");
          assert.isAbove(report.spanCounts.verified, 0);
          assert.isTrue(A.some(report.findings, (row) => row.finding.severity === "blocking"));
          assert.isTrue(A.some(report.findings, (row) => row.finding.severity === "advisory"));
        },
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );
  });
});

describe("knowledge doctor branch-name spans", () => {
  it.effect("reads a span the prose introduces as a branch as a ref, not a path", () =>
    Effect.sync(() => {
      const spans = spansOf(
        "goals/demo/ops/RUNBOOK.md",
        doc("Work on branch `goals/demo-lane`, then read `goals/INDEX.md`.", "Branches `docs/old` are gone.")
      );
      assert.deepStrictEqual(
        A.map(spans, (span) => span.raw),
        ["goals/INDEX.md"]
      );
    })
  );
});
