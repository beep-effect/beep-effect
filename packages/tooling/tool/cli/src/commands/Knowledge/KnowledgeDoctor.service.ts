/**
 * Stage-2 knowledge doctor: span extraction over the knowledge corpus, the ordered span-classification
 * rule table, the witness-bearing paths and commands evaluators, the counterfactual overlay, and the
 * read-only report service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { runCapturedStreams } from "../../internal/process/StepExec.ts";
import { EXPLORATION_ATLAS_PATH } from "../Explore/Atlas.ts";
import { PORTFOLIO_INDEX_PATH } from "../Goals/PortfolioIndex.ts";
import { KnowledgeCommandSurface, KnowledgeStaticCommandFlag } from "./Knowledge.command-surface.ts";
import { KNOWLEDGE_HISTORY_REMEDIATION, KnowledgeOperationalError } from "./Knowledge.errors.ts";
import {
  decodeKnowledgeUtf8,
  isKnowledgeArchivalPath,
  isKnowledgeCommandSpan,
  isKnowledgeScopedPath,
  KnowledgeRefSurface,
  knowledgeDocumentFenceLines,
  knowledgeInlineSpans,
  knowledgeLineMatches,
  normalizeKnowledgeRepoPath,
} from "./Knowledge.refs.ts";
import { KnowledgeFindingCandidate, KnowledgeFindingLocation, KnowledgeTrackedEntry } from "./Knowledge.schemas.ts";
import {
  knowledgeCommandWords,
  knowledgeFindingsFromCandidates,
  materializeKnowledgeTree,
  readKnowledgeGitRefNames,
} from "./Knowledge.service.ts";
import {
  CommandNodeWitness,
  EvaluationFailed,
  EvaluationResolved,
  KnowledgeCounterfactualVerdict,
  KnowledgeDoctorFinding,
  KnowledgeDoctorReport,
  KnowledgeDocumentExtraction,
  KnowledgeEvaluationFailure,
  KnowledgeEvaluationOutcome,
  KnowledgeHistoricalCitation,
  KnowledgeProducerOutput,
  KnowledgeSpan,
  KnowledgeSpanClass,
  KnowledgeSpanCounts,
  ProducerWitness,
  ResolutionWitness,
  TreeEntryWitness,
} from "./KnowledgeDoctor.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { ChildProcessSpawner } from "effect/process";
import type * as Scope from "effect/Scope";
import type { KnowledgeStaticCommandTree } from "./Knowledge.command-surface.ts";
import type { KnowledgeCloneAttributesError } from "./Knowledge.errors.ts";
import type { KnowledgeCommitSha, KnowledgeDocumentFenceLine, KnowledgeTreeOracle } from "./Knowledge.refs.ts";
import type { KnowledgeFindingKind, KnowledgeFindingSeverity } from "./Knowledge.schemas.ts";
import type { KnowledgeMaterializedTree } from "./Knowledge.service.ts";
import type {
  KnowledgeCounterfactualVerdictKind,
  KnowledgeEvaluatorId,
  KnowledgeSpanForm,
} from "./KnowledgeDoctor.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.service");

const nfc = Str.normalize("NFC");

/* -------------------------------------------------------------------------------------------------
 * Tree contract
 * ---------------------------------------------------------------------------------------------- */

type KnowledgeTreeEntryIndex = {
  readonly directories: HashSet.HashSet<string>;
  readonly paths: HashSet.HashSet<string>;
};

/**
 * Everything the knowledge doctor may read from one tree, and nothing from the working filesystem.
 *
 * **Details**
 *
 * The doctor tree extends the census oracle with the facts the paths and commands evaluators need:
 * an entry index, the live ref census, the registered producer outputs, the tree's own static
 * command surface (`O.none()` when the tree has no CLI root module), and the Effect CLI built-in
 * global flags. `isAncestor` and `atCommit` answer historical-citation questions: whether a cited
 * commit is an ancestor of this tree, and the doctor tree of that commit.
 *
 * Every field is data or a lookup over data, which is what lets {@link overlayWithout} remove one
 * resolution witness and hand the evaluators an otherwise identical tree.
 *
 * @see {@link makeKnowledgeDoctorTree} for the live archive-backed tree.
 * @see {@link makeKnowledgeDoctorMemoryTree} for in-memory fixture trees.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeDoctorTree extends KnowledgeTreeOracle {
  readonly atCommit: (commit: KnowledgeCommitSha) => Effect.Effect<KnowledgeDoctorTree, KnowledgeOperationalError>;
  readonly commandTree: Effect.Effect<O.Option<KnowledgeStaticCommandTree>, KnowledgeOperationalError>;
  readonly entryIndex: KnowledgeTreeEntryIndex;
  readonly gitRefNames: HashSet.HashSet<string>;
  readonly globalOptions: ReadonlyArray<KnowledgeStaticCommandFlag>;
  readonly isAncestor: (commit: KnowledgeCommitSha) => Effect.Effect<boolean, KnowledgeOperationalError>;
  readonly producers: ReadonlyArray<KnowledgeProducerOutput>;
}

/**
 * One witness-bearing evaluator: the span forms it reads, the kinds it may emit, and its check.
 *
 * **Details**
 *
 * `evaluate` must return {@link EvaluationResolved} only with witnesses that hold in the tree it was
 * given, so removing any one of them with {@link overlayWithout} changes the verdict. The
 * counterfactual harness ({@link knowledgeCounterfactualVerdicts}) checks exactly that.
 *
 * @see {@link KnowledgePathsEvaluator} and {@link KnowledgeCommandsEvaluator} for the PR-1 evaluators.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeEvaluator {
  readonly evaluate: (
    span: KnowledgeSpan,
    tree: KnowledgeDoctorTree
  ) => Effect.Effect<KnowledgeEvaluationOutcome, KnowledgeOperationalError>;
  readonly forms: ReadonlyArray<KnowledgeSpanForm>;
  readonly id: KnowledgeEvaluatorId;
  readonly kinds: ReadonlyArray<KnowledgeFindingKind>;
}

/**
 * Builds the exact-path and directory-prefix index of a tracked entry list.
 *
 * **Example** (Index a nested file)
 *
 * ```ts
 * import { KnowledgeTrackedEntry } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { makeKnowledgeTreeEntryIndex } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as HashSet from "effect/HashSet"
 *
 * const index = makeKnowledgeTreeEntryIndex([
 *   KnowledgeTrackedEntry.make({ path: "goals/a/README.md", mode: "100644", objectId: "oid" }),
 * ])
 *
 * console.log(HashSet.has(index.directories, "goals/a")) // true
 * ```
 *
 * @param entries - Tracked entries of one tree.
 * @returns Every entry path and every directory that contains one.
 * @category constructors
 * @since 0.0.0
 */
export const makeKnowledgeTreeEntryIndex = (entries: ReadonlyArray<KnowledgeTrackedEntry>): KnowledgeTreeEntryIndex => {
  const paths = HashSet.fromIterable(A.map(entries, (entry) => entry.path));
  const directories = HashSet.fromIterable(
    A.flatMap(entries, (entry) => {
      const segments = A.dropRight(Str.split("/")(entry.path), 1);
      return A.map(segments, (_, index) => A.join(A.take(segments, index + 1), "/"));
    })
  );
  return { paths, directories };
};

/**
 * The Effect CLI built-in global flags every `beep` command accepts.
 *
 * **Details**
 *
 * These mirror `GlobalFlag.BuiltIns` in `effect/cli`: `--help`/`-h`, `--version`/`-v`, `--wizard`,
 * `--completions`, and `--log-level`. They live on the doctor tree rather than in the evaluator so a
 * counterfactual overlay can remove one like any other declared option.
 *
 * **Example** (Read the help alias)
 *
 * ```ts
 * import { KNOWLEDGE_CLI_GLOBAL_FLAGS } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * console.log(KNOWLEDGE_CLI_GLOBAL_FLAGS[0]?.aliases) // [ "h" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_CLI_GLOBAL_FLAGS: ReadonlyArray<KnowledgeStaticCommandFlag> = [
  KnowledgeStaticCommandFlag.make({ name: "help", aliases: ["h"], negatable: true }),
  KnowledgeStaticCommandFlag.make({ name: "version", aliases: ["v"], negatable: true }),
  KnowledgeStaticCommandFlag.make({ name: "wizard", aliases: [], negatable: true }),
  KnowledgeStaticCommandFlag.make({ name: "completions", aliases: [], negatable: false }),
  KnowledgeStaticCommandFlag.make({ name: "log-level", aliases: [], negatable: false }),
];

/**
 * Producer-owned derived paths that resolve even when untracked.
 *
 * **Details**
 *
 * These are the Stage-1 derived projections: the goals portfolio index and the explorations atlas.
 * A path span naming one resolves through a {@link ProducerWitness} when the file itself is not
 * tracked.
 *
 * **Example** (Read the goals index producer)
 *
 * ```ts
 * import { KNOWLEDGE_PRODUCER_OUTPUTS } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * console.log(KNOWLEDGE_PRODUCER_OUTPUTS[0]?.producerId) // "producer://goals/index"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_PRODUCER_OUTPUTS: ReadonlyArray<KnowledgeProducerOutput> = [
  KnowledgeProducerOutput.make({ producerId: "producer://goals/index", targetPath: PORTFOLIO_INDEX_PATH }),
  KnowledgeProducerOutput.make({ producerId: "producer://explorations/atlas", targetPath: EXPLORATION_ATLAS_PATH }),
];

/* -------------------------------------------------------------------------------------------------
 * Span extraction
 * ---------------------------------------------------------------------------------------------- */

const HISTORICAL_BLOCK_PATTERN = /^\s*<!-- beep:historical commit=([0-9a-f]{40}) -->\s*$/u;
const HISTORICAL_FRONTMATTER_PATTERN = /^beep-historical:\s*["']?([0-9a-f]{40})["']?\s*$/u;
const GENERATED_INFO_PATTERN = /(?:^|\s)beep:generated=(\S+)/u;
const ASSERTION_PATTERN = /<!-- beep:assert path-exists ([^\s]+) -->/gu;
const FRONTMATTER_DELIMITER = "---";

const isBlank = (line: KnowledgeDocumentFenceLine): boolean => Str.isEmpty(Str.trim(line.text));

const documentCitation = (lines: ReadonlyArray<KnowledgeDocumentFenceLine>): O.Option<KnowledgeHistoricalCitation> => {
  if (!O.exists(A.head(lines), (line) => Str.equivalence(Str.trimEnd(line.text), FRONTMATTER_DELIMITER))) {
    return O.none();
  }
  const body = A.takeWhile(A.drop(lines, 1), (line) => !Str.equivalence(Str.trimEnd(line.text), FRONTMATTER_DELIMITER));
  return A.findFirst(body, (line) =>
    pipe(
      O.fromNullishOr(HISTORICAL_FRONTMATTER_PATTERN.exec(line.text)?.[1]),
      O.map((commit) =>
        KnowledgeHistoricalCitation.make({ form: "document", commit, line: S.Natural.make(line.number) })
      )
    )
  );
};

// The 0-based [start, end] line range of the Markdown block that follows a block marker: a fence
// through its closing delimiter, or a run of non-blank prose lines up to the next blank line.
const nextBlockRange = (
  lines: ReadonlyArray<KnowledgeDocumentFenceLine>,
  markerIndex: number
): O.Option<readonly [number, number]> =>
  pipe(
    A.findFirstIndex(A.drop(lines, markerIndex + 1), (line) => !isBlank(line)),
    O.map((offset) => markerIndex + 1 + offset),
    O.map((start) => {
      const fenceBlock = O.exists(A.get(lines, start), (line) => line.opensFence);
      const continues = (line: KnowledgeDocumentFenceLine): boolean =>
        fenceBlock ? !line.prose && !line.opensFence : line.prose && !isBlank(line) && !line.opensFence;
      const length = A.length(A.takeWhile(A.drop(lines, start + 1), continues));
      return [start, start + length] as const;
    })
  );

const blockCitations = (
  lines: ReadonlyArray<KnowledgeDocumentFenceLine>
): {
  readonly markers: ReadonlyArray<KnowledgeHistoricalCitation>;
  readonly byLine: HashMap.HashMap<number, KnowledgeHistoricalCitation>;
} =>
  A.reduce(
    lines,
    {
      markers: A.empty<KnowledgeHistoricalCitation>(),
      byLine: HashMap.empty<number, KnowledgeHistoricalCitation>(),
    },
    (state, line, index) => {
      const commit = line.prose ? O.fromNullishOr(HISTORICAL_BLOCK_PATTERN.exec(line.text)?.[1]) : O.none<string>();
      return O.match(commit, {
        onNone: () => state,
        onSome: (sha) => {
          const citation = KnowledgeHistoricalCitation.make({
            form: "block",
            commit: sha,
            line: S.Natural.make(line.number),
          });
          const byLine = O.match(nextBlockRange(lines, index), {
            onNone: () => state.byLine,
            onSome: ([start, end]) =>
              A.reduce(A.range(start, end), state.byLine, (current, lineIndex) =>
                HashMap.set(current, lineIndex + 1, citation)
              ),
          });
          return { markers: A.append(state.markers, citation), byLine };
        },
      });
    }
  );

const spanLocation = (documentPath: string, line: number, column: number): KnowledgeFindingLocation =>
  KnowledgeFindingLocation.make({ path: documentPath, line: S.Natural.make(line), column: S.Natural.make(column) });

const proseSpans = (
  line: KnowledgeDocumentFenceLine,
  documentPath: string,
  gitRefNames: HashSet.HashSet<string>
): ReadonlyArray<readonly [KnowledgeSpanForm, string, number]> => {
  const assertions = A.getSomes(
    A.map(knowledgeLineMatches(new RegExp(ASSERTION_PATTERN.source, "gu"), line.text), (match) =>
      O.map(O.fromNullishOr(match[1]), (raw) => ["path-assertion", raw, match.index + 1] as const)
    )
  );
  const inline = A.getSomes(
    A.map(knowledgeInlineSpans(line.text), (inlineSpan) => {
      if (isKnowledgeCommandSpan(inlineSpan.span)) {
        return O.some(["command", inlineSpan.span, inlineSpan.column] as const);
      }
      return HashSet.has(gitRefNames, inlineSpan.span) ||
        O.isNone(normalizeKnowledgeRepoPath(documentPath, inlineSpan.span))
        ? O.none()
        : O.some(["path", inlineSpan.span, inlineSpan.column] as const);
    })
  );
  return A.appendAll(assertions, inline);
};

/**
 * Extracts every reference-shaped span and historical marker from one decoded document.
 *
 * **Details**
 *
 * Spans come from the Stage-1 readers: inline code spans on prose lines (a `bun run beep` span is a
 * command, a governed repository spelling a path unless it exactly names a Git ref) and
 * `beep:assert path-exists` markers. Fenced content is never read as spans: an unmarked fence is a
 * decoy, and a fence whose info string carries `beep:generated=<producer-id>` is one
 * `generated-fence` span on its opening delimiter. A block marker scopes the next Markdown block
 * (a fence through its closing delimiter, or the run of non-blank prose lines that follows), a
 * frontmatter `beep-historical:` key scopes the document, and the block marker wins where both apply.
 *
 * **Gotchas**
 *
 * Block boundaries come from the Stage-1 line reader (fence verdicts plus blank lines), not a full
 * Markdown AST, so a loose list separated by blank lines is several blocks.
 *
 * **Example** (Extract one live path span)
 *
 * ```ts
 * import { extractKnowledgeDocumentSpans } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as HashSet from "effect/HashSet"
 *
 * const extraction = extractKnowledgeDocumentSpans("docs/README.md", "See `goals/INDEX.md`.", HashSet.empty())
 *
 * console.log(extraction.spans.length) // 1
 * ```
 *
 * @param documentPath - Repository-relative path of the scanned document.
 * @param text - Decoded document text.
 * @param gitRefNames - Exact ref spellings that are never read as paths.
 * @returns Source-ordered spans plus every historical marker in the document.
 * @category parsing
 * @since 0.0.0
 */
export const extractKnowledgeDocumentSpans: {
  (text: string, gitRefNames: HashSet.HashSet<string>): (documentPath: string) => KnowledgeDocumentExtraction;
  (documentPath: string, text: string, gitRefNames: HashSet.HashSet<string>): KnowledgeDocumentExtraction;
} = dual(3, (documentPath: string, text: string, gitRefNames: HashSet.HashSet<string>): KnowledgeDocumentExtraction => {
  const lines = knowledgeDocumentFenceLines(text);
  const surface = isKnowledgeArchivalPath(documentPath)
    ? KnowledgeRefSurface.Enum.archival
    : KnowledgeRefSurface.Enum.live;
  const documentMarker = documentCitation(lines);
  const blocks = blockCitations(lines);
  const citationAt = (lineNumber: number): O.Option<KnowledgeHistoricalCitation> =>
    O.orElse(HashMap.get(blocks.byLine, lineNumber), () => documentMarker);
  const spans = A.flatMap(lines, (line) => {
    const generated = line.opensFence
      ? pipe(
          line.fenceInfo,
          O.flatMap((info) => O.fromNullishOr(GENERATED_INFO_PATTERN.exec(info)?.[1])),
          O.map((producerId) =>
            KnowledgeSpan.make({
              form: "generated-fence",
              documentPath,
              surface,
              location: spanLocation(documentPath, line.number, 1),
              raw: producerId,
              generatedBy: O.some(producerId),
              citation: citationAt(line.number),
            })
          ),
          O.toArray
        )
      : A.empty<KnowledgeSpan>();
    const prose = line.prose
      ? A.map(proseSpans(line, documentPath, gitRefNames), ([form, raw, column]) =>
          KnowledgeSpan.make({
            form,
            documentPath,
            surface,
            location: spanLocation(documentPath, line.number, column),
            raw,
            generatedBy: O.none(),
            citation: citationAt(line.number),
          })
        )
      : A.empty<KnowledgeSpan>();
    return A.appendAll(generated, prose);
  });
  return KnowledgeDocumentExtraction.make({ spans, markers: A.appendAll(O.toArray(documentMarker), blocks.markers) });
});

/* -------------------------------------------------------------------------------------------------
 * Classification rule table
 * ---------------------------------------------------------------------------------------------- */

/** The classification context of one span: the span and its citation once validated. */
type KnowledgeSpanClassificationInput = {
  readonly span: KnowledgeSpan;
  /** The span's citation commit when it is shape-valid and an ancestor of the scanned tree. */
  readonly validCitation: O.Option<KnowledgeCommitSha>;
};

/**
 * One row of the ordered classification rule table.
 *
 * @category models
 * @since 0.0.0
 */
export interface KnowledgeSpanClassificationRule {
  readonly applies: (input: KnowledgeSpanClassificationInput) => boolean;
  readonly rule: string;
  readonly spanClass: KnowledgeSpanClass;
}

/**
 * The total, ordered span-classification rule table; the first matching row wins.
 *
 * **Details**
 *
 * (a) a `beep:generated` fence is `generated-example`; (b) a span on an archival path under an
 * ancestor historical citation is `historical-with-commit`; (c) every span on a live surface is
 * `verified`, whatever markers cover it, because a marker on a live surface is inert; (d) everything
 * else is `unclassified`. The last row matches every input, which is what makes the table total.
 *
 * **Example** (Read the rule order)
 *
 * ```ts
 * import { KNOWLEDGE_SPAN_CLASSIFICATION_RULES } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(KNOWLEDGE_SPAN_CLASSIFICATION_RULES, (row) => row.spanClass))
 * // [ "generated-example", "historical-with-commit", "verified", "unclassified" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_SPAN_CLASSIFICATION_RULES: ReadonlyArray<KnowledgeSpanClassificationRule> = [
  {
    rule: "generated-fence",
    spanClass: KnowledgeSpanClass.Enum["generated-example"],
    applies: ({ span }) => O.isSome(span.generatedBy),
  },
  {
    rule: "archival-ancestor-citation",
    spanClass: KnowledgeSpanClass.Enum["historical-with-commit"],
    applies: ({ span, validCitation }) => KnowledgeRefSurface.is.archival(span.surface) && O.isSome(validCitation),
  },
  {
    rule: "live-surface",
    spanClass: KnowledgeSpanClass.Enum.verified,
    applies: ({ span }) => KnowledgeRefSurface.is.live(span.surface),
  },
  {
    rule: "fallback",
    spanClass: KnowledgeSpanClass.Enum.unclassified,
    applies: () => true,
  },
];

/**
 * Classifies one span with the ordered rule table.
 *
 * **Example** (A live span is verified even under a citation)
 *
 * ```ts
 * import { KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import { classifyKnowledgeSpan } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as O from "effect/Option"
 *
 * const span = KnowledgeSpan.make({
 *   form: "path",
 *   documentPath: "docs/README.md",
 *   surface: "live",
 *   location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *   raw: "goals/INDEX.md",
 *   generatedBy: O.none(),
 *   citation: O.none(),
 * })
 *
 * console.log(classifyKnowledgeSpan({ span, validCitation: O.some("2162ebdc8a2162ebdc8a2162ebdc8a2162ebdc8a") }))
 * // "verified"
 * ```
 *
 * @param input - The span and its validated citation.
 * @returns The class of the first matching rule.
 * @category predicates
 * @since 0.0.0
 */
export const classifyKnowledgeSpan = (input: KnowledgeSpanClassificationInput): KnowledgeSpanClass =>
  pipe(
    A.findFirst(KNOWLEDGE_SPAN_CLASSIFICATION_RULES, (row) => row.applies(input)),
    O.map((row) => row.spanClass),
    O.getOrElse(() => KnowledgeSpanClass.Enum.unclassified)
  );

/* -------------------------------------------------------------------------------------------------
 * Evaluators
 * ---------------------------------------------------------------------------------------------- */

const documentIdFor = (documentPath: string): string => nfc(`tree:${documentPath}`);

const failure = (
  span: KnowledgeSpan,
  fields: {
    readonly kind: KnowledgeFindingKind;
    readonly subject: string;
    readonly message: string;
    readonly remediation: string;
    readonly causeKey: string;
  }
): KnowledgeEvaluationFailure =>
  KnowledgeEvaluationFailure.make({
    candidate: KnowledgeFindingCandidate.make({
      kind: fields.kind,
      documentId: documentIdFor(span.documentPath),
      subject: nfc(fields.subject),
      location: span.location,
      message: fields.message,
      remediation: fields.remediation,
    }),
    causeKey: nfc(fields.causeKey),
  });

const failed = (first: KnowledgeEvaluationFailure, ...rest: ReadonlyArray<KnowledgeEvaluationFailure>) =>
  EvaluationFailed.make({ failures: [first, ...rest] });

const pathWitness = (tree: KnowledgeDoctorTree, repoPath: string): O.Option<ResolutionWitness> =>
  HashSet.has(tree.entryIndex.paths, repoPath) || HashSet.has(tree.entryIndex.directories, repoPath)
    ? O.some(TreeEntryWitness.make({ path: repoPath }))
    : O.map(
        A.findFirst(tree.producers, (output) => Str.equivalence(output.targetPath, repoPath)),
        (output) => ProducerWitness.make({ producerId: output.producerId, targetPath: output.targetPath })
      );

const isAssertionForm = (form: KnowledgeSpanForm): boolean => Str.equivalence(form, "path-assertion");

const evaluatePathSpan = (span: KnowledgeSpan, tree: KnowledgeDoctorTree): KnowledgeEvaluationOutcome => {
  const repoPath = O.getOrElse(normalizeKnowledgeRepoPath(span.documentPath, span.raw), () => nfc(span.raw));
  const assertion = isAssertionForm(span.form);
  return O.match(pathWitness(tree, repoPath), {
    onSome: (witness) => EvaluationResolved.make({ witnesses: [witness], unchecked: [] }),
    onNone: () =>
      failed(
        failure(span, {
          kind: assertion ? "failed-assertion" : "broken-tracked-path",
          subject: assertion ? `path-exists:${repoPath}` : `repo-path:${repoPath}`,
          message: assertion ? `Path assertion failed: ${repoPath}.` : `Tracked path does not exist: ${repoPath}.`,
          remediation: assertion
            ? "Update the assertion or add the tracked target."
            : "Update the inline path or add the tracked target.",
          causeKey: `path:${repoPath}`,
        })
      ),
  });
};

/**
 * The paths evaluator: a path or path-assertion span resolves through a tracked entry, a tracked
 * directory, or a registered producer output.
 *
 * **Details**
 *
 * The span is normalized exactly as Stage 1 normalizes it (governed spelling, `./` and `../`
 * resolved against the document, NFC), then looked up case-sensitively. Its single witness is the
 * entry or directory it named, or the producer that owns the untracked derived path.
 *
 * **Example** (Read the evaluator identity)
 *
 * ```ts
 * import { KnowledgePathsEvaluator } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * console.log(KnowledgePathsEvaluator.id) // "paths"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgePathsEvaluator: KnowledgeEvaluator = {
  id: "paths",
  forms: ["path", "path-assertion"],
  kinds: ["broken-tracked-path", "failed-assertion"],
  evaluate: (span, tree) => Effect.succeed(evaluatePathSpan(span, tree)),
};

const NEGATIVE_NUMBER_PATTERN = /^-(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u;
const END_OF_OPTIONS = "--";
const NEGATION_PREFIX = "no-";

type OptionToken = {
  readonly spelling: string;
  readonly name: string;
  readonly long: boolean;
};

// Mirrors the Effect CLI lexer: `--name[=value]` is one long option, `-abc` is one short option per
// character up to an `=`, and negative numbers and everything after a bare `--` are values.
const optionTokens = (words: ReadonlyArray<string>): ReadonlyArray<OptionToken> =>
  A.flatMap(
    A.takeWhile(words, (word) => !Str.equivalence(word, END_OF_OPTIONS)),
    (word: string): ReadonlyArray<OptionToken> => {
      if (!Str.startsWith("-")(word) || Str.length(word) < 2 || NEGATIVE_NUMBER_PATTERN.test(word)) {
        return A.empty();
      }
      if (Str.startsWith("--")(word)) {
        const name = A.headNonEmpty(Str.split("=")(Str.slice(2)(word)));
        return [{ spelling: `--${name}`, name, long: true }];
      }
      const cluster = A.headNonEmpty(Str.split("=")(Str.slice(1)(word)));
      return A.map(Str.split("")(cluster), (character) => ({
        spelling: `-${character}`,
        name: character,
        long: false,
      }));
    }
  );

const matchFlag = (flags: ReadonlyArray<KnowledgeStaticCommandFlag>, token: OptionToken): O.Option<string> =>
  pipe(
    A.findFirst(flags, (flag) => Str.equivalence(flag.name, token.name) || A.contains(flag.aliases, token.name)),
    O.orElse(() =>
      token.long && Str.startsWith(NEGATION_PREFIX)(token.name)
        ? A.findFirst(
            flags,
            (flag) => flag.negatable && Str.equivalence(flag.name, Str.slice(Str.length(NEGATION_PREFIX))(token.name))
          )
        : O.none()
    ),
    O.map((flag) => flag.name)
  );

type OptionVerdict =
  | { readonly _tag: "Witnessed"; readonly witness: ResolutionWitness }
  | { readonly _tag: "Unchecked"; readonly spelling: string }
  | { readonly _tag: "Unknown"; readonly token: OptionToken };

const optionVerdict = (
  node: KnowledgeStaticCommandTree,
  commandPath: ReadonlyArray<string>,
  globals: ReadonlyArray<KnowledgeStaticCommandFlag>,
  token: OptionToken
): OptionVerdict =>
  pipe(
    O.flatMap(O.fromUndefinedOr(node.options), (options) => matchFlag(options, token)),
    O.map(
      (option): OptionVerdict => ({ _tag: "Witnessed", witness: CommandNodeWitness.make({ commandPath, option }) })
    ),
    O.orElse(() =>
      O.map(
        matchFlag(globals, token),
        (option): OptionVerdict => ({
          _tag: "Witnessed",
          witness: CommandNodeWitness.make({ commandPath: [], option }),
        })
      )
    ),
    O.getOrElse(
      (): OptionVerdict =>
        P.isUndefined(node.options) ? { _tag: "Unchecked", spelling: token.spelling } : { _tag: "Unknown", token }
    )
  );

const witnessEquivalence = S.toEquivalence(ResolutionWitness);

const unknownCommand = (span: KnowledgeSpan, canonicalPath: ReadonlyArray<string>): KnowledgeEvaluationOutcome => {
  const canonical = A.join(canonicalPath, " ");
  return failed(
    failure(span, {
      kind: "unknown-beep-command",
      subject: `beep-command:${canonical}`,
      message: `Unknown beep command path: ${canonical}.`,
      remediation: "Update the inline command to one available in the CLI command surface of this tree.",
      causeKey: `command:${canonical}`,
    })
  );
};

const evaluateCommandSpan = Effect.fn("KnowledgeDoctor.evaluateCommandSpan")(function* (
  span: KnowledgeSpan,
  tree: KnowledgeDoctorTree
) {
  const words = knowledgeCommandWords(span.raw);
  const root = yield* tree.commandTree;
  if (O.isNone(root)) {
    return unknownCommand(
      span,
      A.take(
        A.takeWhile(words, (word) => !Str.startsWith("-")(word)),
        1
      )
    );
  }
  const resolution = KnowledgeCommandSurface.resolveStaticCommandNode(root.value, words);
  if (resolution.status === "unknown") {
    return unknownCommand(span, resolution.canonicalPath);
  }
  const commandPath = resolution.canonicalPath;
  const verdicts = A.map(optionTokens(A.drop(words, resolution.consumed)), (token) =>
    optionVerdict(resolution.node, commandPath, tree.globalOptions, token)
  );
  const failures = A.getSomes(
    A.map(verdicts, (verdict) =>
      verdict._tag === "Unknown"
        ? O.some(
            failure(span, {
              kind: "unknown-beep-option",
              subject: `beep-option:${A.join(commandPath, " ")} ${verdict.token.spelling}`,
              message: `Unknown option ${verdict.token.spelling} for beep command: ${A.join(commandPath, " ")}.`,
              remediation: "Update the inline command to an option the command declares.",
              causeKey: `command-option:${A.join(commandPath, " ")}:${verdict.token.name}`,
            })
          )
        : O.none()
    )
  );
  return A.match(failures, {
    onNonEmpty: ([first, ...rest]): KnowledgeEvaluationOutcome => failed(first, ...rest),
    onEmpty: (): KnowledgeEvaluationOutcome =>
      EvaluationResolved.make({
        witnesses: [
          CommandNodeWitness.make({ commandPath }),
          ...A.dedupeWith(
            A.getSomes(
              A.map(verdicts, (verdict) => (verdict._tag === "Witnessed" ? O.some(verdict.witness) : O.none()))
            ),
            witnessEquivalence
          ),
        ],
        unchecked: A.getSomes(
          A.map(verdicts, (verdict) => (verdict._tag === "Unchecked" ? O.some(verdict.spelling) : O.none()))
        ),
      }),
  });
});

/**
 * The commands evaluator: a `bun run beep` span resolves through the tree's static command surface,
 * and every option token through a flag the resolved command (or the CLI's global flags) declares.
 *
 * **Details**
 *
 * Command words resolve exactly as the Stage-1 static resolver resolves them (names and aliases,
 * stopping at the first option). Option tokens follow the Effect CLI lexer: `--name`, `--name=value`,
 * `--no-name` for boolean flags, and clustered short aliases; a bare `--` ends option parsing. An
 * undeclared option emits `unknown-beep-option`. When the resolved command's flags are not
 * statically derivable, its non-global option tokens are reported as `unchecked` rather than passed.
 *
 * **Example** (Read the evaluator identity)
 *
 * ```ts
 * import { KnowledgeCommandsEvaluator } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * console.log(KnowledgeCommandsEvaluator.kinds) // [ "unknown-beep-command", "unknown-beep-option" ]
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const KnowledgeCommandsEvaluator: KnowledgeEvaluator = {
  id: "commands",
  forms: ["command"],
  kinds: ["unknown-beep-command", "unknown-beep-option"],
  evaluate: evaluateCommandSpan,
};

/**
 * The evaluators the report runs, in order.
 *
 * **Example** (List the evaluator ids)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_EVALUATORS } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as A from "effect/Array"
 *
 * console.log(A.map(KNOWLEDGE_DOCTOR_EVALUATORS, (evaluator) => evaluator.id)) // [ "paths", "commands" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_EVALUATORS: ReadonlyArray<KnowledgeEvaluator> = [
  KnowledgePathsEvaluator,
  KnowledgeCommandsEvaluator,
];

/* -------------------------------------------------------------------------------------------------
 * Counterfactual overlay and harness
 * ---------------------------------------------------------------------------------------------- */

const withTrackedEntries = (
  tree: KnowledgeDoctorTree,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): KnowledgeDoctorTree => ({
  ...tree,
  trackedEntries: entries,
  entryIndex: makeKnowledgeTreeEntryIndex(entries),
});

const withoutCommandWitness = (tree: KnowledgeDoctorTree, witness: CommandNodeWitness): KnowledgeDoctorTree =>
  O.match(O.fromUndefinedOr(witness.option), {
    onNone: () => ({
      ...tree,
      commandTree: Effect.map(tree.commandTree, (root) =>
        A.isReadonlyArrayNonEmpty(witness.commandPath)
          ? O.map(root, (node) => KnowledgeCommandSurface.pruneStaticCommand(node, witness.commandPath))
          : O.none()
      ),
    }),
    onSome: (option) => ({
      ...tree,
      commandTree: Effect.map(
        tree.commandTree,
        O.map((node) => KnowledgeCommandSurface.withoutStaticCommandOption(node, witness.commandPath, option))
      ),
      globalOptions: A.isReadonlyArrayNonEmpty(witness.commandPath)
        ? tree.globalOptions
        : A.filter(tree.globalOptions, (flag) => !Str.equivalence(flag.name, option)),
    }),
  });

/**
 * The same tree with one resolution witness removed.
 *
 * **Details**
 *
 * A tree-entry witness hides the entry and, for a directory, every entry below it. A command-node
 * witness prunes the command (removing the root removes the whole command surface); with an option
 * it removes that flag from the command, and from the global flags when the command is the root. A
 * producer witness unregisters the producer output. Nothing else about the tree changes.
 *
 * **Example** (Hide a tracked file)
 *
 * ```ts
 * import { TreeEntryWitness } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import { makeKnowledgeDoctorMemoryTree, overlayWithout } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as HashSet from "effect/HashSet"
 *
 * const tree = makeKnowledgeDoctorMemoryTree({ files: { "goals/INDEX.md": "# Goals" } })
 * const hidden = overlayWithout(tree, TreeEntryWitness.make({ path: "goals/INDEX.md" }))
 *
 * console.log(HashSet.has(hidden.entryIndex.paths, "goals/INDEX.md")) // false
 * ```
 *
 * @param tree - Tree the witness held in.
 * @param witness - Witness to remove.
 * @returns The overlaid tree.
 * @category combinators
 * @since 0.0.0
 */
export const overlayWithout: {
  (witness: ResolutionWitness): (tree: KnowledgeDoctorTree) => KnowledgeDoctorTree;
  (tree: KnowledgeDoctorTree, witness: ResolutionWitness): KnowledgeDoctorTree;
} = dual(
  2,
  (tree: KnowledgeDoctorTree, witness: ResolutionWitness): KnowledgeDoctorTree =>
    ResolutionWitness.match(witness, {
      TreeEntryWitness: (entry) =>
        withTrackedEntries(
          tree,
          A.filter(
            tree.trackedEntries,
            (tracked) => !Str.equivalence(tracked.path, entry.path) && !Str.startsWith(`${entry.path}/`)(tracked.path)
          )
        ),
      CommandNodeWitness: (command) => withoutCommandWitness(tree, command),
      ProducerWitness: (producer) => ({
        ...tree,
        producers: A.filter(tree.producers, (output) => !Str.equivalence(output.producerId, producer.producerId)),
      }),
    })
);

const witnessHolds = Effect.fn("KnowledgeDoctor.witnessHolds")(function* (
  tree: KnowledgeDoctorTree,
  witness: ResolutionWitness
) {
  return yield* ResolutionWitness.match(witness, {
    TreeEntryWitness: (entry) =>
      Effect.succeed(
        HashSet.has(tree.entryIndex.paths, entry.path) || HashSet.has(tree.entryIndex.directories, entry.path)
      ),
    ProducerWitness: (producer) =>
      Effect.succeed(
        A.some(
          tree.producers,
          (output) =>
            Str.equivalence(output.producerId, producer.producerId) &&
            Str.equivalence(output.targetPath, producer.targetPath)
        )
      ),
    CommandNodeWitness: (command) =>
      Effect.map(tree.commandTree, (root) =>
        O.exists(root, (node) => {
          const resolution = KnowledgeCommandSurface.resolveStaticCommandNode(node, command.commandPath);
          return (
            resolution.status === "resolved" &&
            A.length(resolution.canonicalPath) === A.length(command.commandPath) &&
            O.match(O.fromUndefinedOr(command.option), {
              onNone: () => true,
              onSome: (option) =>
                A.some(resolution.node.options ?? A.empty(), (flag) => Str.equivalence(flag.name, option)) ||
                (A.isReadonlyArrayEmpty(command.commandPath) &&
                  A.some(tree.globalOptions, (flag) => Str.equivalence(flag.name, option))),
            })
          );
        })
      ),
  });
});

const witnessVerdict = Effect.fn("KnowledgeDoctor.witnessVerdict")(function* (
  tree: KnowledgeDoctorTree,
  span: KnowledgeSpan,
  evaluator: KnowledgeEvaluator,
  witness: ResolutionWitness
) {
  const holds = yield* witnessHolds(tree, witness);
  const counterfactual = yield* evaluator.evaluate(span, overlayWithout(tree, witness));
  const verdict: KnowledgeCounterfactualVerdictKind = KnowledgeEvaluationOutcome.match(counterfactual, {
    Failed: (): KnowledgeCounterfactualVerdictKind => "failed",
    Resolved: (resolved): KnowledgeCounterfactualVerdictKind =>
      A.some(resolved.witnesses, (candidate) => witnessEquivalence(candidate, witness)) ? "vacuous" : "rebound",
  });
  return KnowledgeCounterfactualVerdict.make({
    evaluator: evaluator.id,
    span,
    witness,
    verdict: holds ? verdict : "vacuous",
  });
});

const spanCounterfactuals = Effect.fn("KnowledgeDoctor.spanCounterfactuals")(function* (
  tree: KnowledgeDoctorTree,
  span: KnowledgeSpan,
  evaluator: KnowledgeEvaluator
) {
  const outcome = yield* evaluator.evaluate(span, tree);
  return yield* KnowledgeEvaluationOutcome.match(outcome, {
    Failed: () => Effect.succeed(A.empty<KnowledgeCounterfactualVerdict>()),
    Resolved: (resolved) =>
      Effect.forEach(resolved.witnesses, (witness) => witnessVerdict(tree, span, evaluator, witness)),
  });
});

/**
 * Runs the counterfactual harness over every resolved span: each witness must hold, and removing it
 * must change the verdict.
 *
 * **Details**
 *
 * For each span an evaluator resolves, every witness is first checked against the tree, then
 * removed with {@link overlayWithout} and the span re-evaluated. A test asserts no `vacuous`
 * verdict anywhere and, on fixtures without shadowed spellings, `failed` for every witness.
 *
 * **Example** (Run the harness over no spans)
 *
 * ```ts
 * import {
 *   knowledgeCounterfactualVerdicts,
 *   makeKnowledgeDoctorMemoryTree,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * const verdicts = knowledgeCounterfactualVerdicts(makeKnowledgeDoctorMemoryTree({ files: {} }), [])
 *
 * console.log(Effect.isEffect(verdicts)) // true
 * ```
 *
 * @param tree - Tree the spans are evaluated in.
 * @param spans - Spans to evaluate; spans no evaluator reads are skipped.
 * @param evaluators - Evaluators under test.
 * @returns One verdict per (resolved span, witness) pair.
 * @category testing
 * @since 0.0.0
 */
export const knowledgeCounterfactualVerdicts = Effect.fn("KnowledgeDoctor.counterfactualVerdicts")(function* (
  tree: KnowledgeDoctorTree,
  spans: ReadonlyArray<KnowledgeSpan>,
  evaluators: ReadonlyArray<KnowledgeEvaluator> = KNOWLEDGE_DOCTOR_EVALUATORS
) {
  const perSpan = yield* Effect.forEach(spans, (span) =>
    O.match(evaluatorFor(evaluators, span), {
      onNone: () => Effect.succeed(A.empty<KnowledgeCounterfactualVerdict>()),
      onSome: (evaluator) => spanCounterfactuals(tree, span, evaluator),
    })
  );
  return A.flatten(perSpan);
});

/* -------------------------------------------------------------------------------------------------
 * Scan
 * ---------------------------------------------------------------------------------------------- */

const evaluatorFor = (
  evaluators: ReadonlyArray<KnowledgeEvaluator>,
  span: KnowledgeSpan
): O.Option<KnowledgeEvaluator> => A.findFirst(evaluators, (evaluator) => A.contains(evaluator.forms, span.form));

const isRegularBlob = (entry: KnowledgeTrackedEntry): boolean => entry.mode === "100644" || entry.mode === "100755";

const isDoctorDocument = (entry: KnowledgeTrackedEntry): boolean =>
  isRegularBlob(entry) && Str.endsWith(".md")(entry.path) && isKnowledgeScopedPath(entry.path);

const entryOrder = Order.mapInput(Order.String, (entry: KnowledgeTrackedEntry) => entry.path);
const doctorFindingOrder = Order.mapInput(Order.String, (row: KnowledgeDoctorFinding) => row.finding.findingId);

type FindingRow = {
  readonly candidate: KnowledgeFindingCandidate;
  readonly spanClass: KnowledgeSpanClass;
  readonly evaluator: O.Option<KnowledgeEvaluatorId>;
  readonly causeKey: string;
};

const severityOf = (candidate: KnowledgeFindingCandidate): KnowledgeFindingSeverity =>
  Str.equivalence(candidate.kind, "unclassified-reference-span") ? "advisory" : "blocking";

const markerRows = (
  documentPath: string,
  surface: KnowledgeRefSurface,
  markers: ReadonlyArray<KnowledgeHistoricalCitation>,
  ancestry: HashMap.HashMap<string, boolean>
): ReadonlyArray<FindingRow> =>
  A.getSomes(
    A.map(markers, (marker) => {
      const location = KnowledgeFindingLocation.make({
        path: documentPath,
        line: marker.line,
        column: S.Natural.make(1),
      });
      if (KnowledgeRefSurface.is.live(surface)) {
        return O.some<FindingRow>({
          candidate: KnowledgeFindingCandidate.make({
            kind: "historical-marker-on-live-surface",
            documentId: documentIdFor(documentPath),
            subject: `historical-marker:${marker.form}:${marker.commit}`,
            location,
            message: `Historical ${marker.form} marker on a live surface is inert; its spans are checked at the scanned tree.`,
            remediation: "Remove the marker, or move the captured content under an archival path.",
          }),
          spanClass: KnowledgeSpanClass.Enum.verified,
          evaluator: O.none(),
          causeKey: `historical-marker:${documentPath}:${marker.line}`,
        });
      }
      return O.getOrElse(HashMap.get(ancestry, marker.commit), () => false)
        ? O.none()
        : O.some<FindingRow>({
            candidate: KnowledgeFindingCandidate.make({
              kind: "historical-commit-not-ancestor",
              documentId: documentIdFor(documentPath),
              subject: `historical-commit:${marker.commit}`,
              location,
              message: `Historical citation ${marker.commit} is not an ancestor of the scanned tree.`,
              remediation: "Cite a commit reachable from the default branch, or remove the marker.",
            }),
            spanClass: KnowledgeSpanClass.Enum.unclassified,
            evaluator: O.none(),
            causeKey: `historical-commit:${marker.commit}`,
          });
    })
  );

const unclassifiedRow = (span: KnowledgeSpan, evaluator: O.Option<KnowledgeEvaluator>): FindingRow => ({
  candidate: KnowledgeFindingCandidate.make({
    kind: "unclassified-reference-span",
    documentId: documentIdFor(span.documentPath),
    subject: nfc(`${span.form}:${span.raw}`),
    location: span.location,
    message: `Reference span on an archival path has no valid historical citation: ${span.raw}.`,
    remediation: "Add a beep:historical citation to an ancestor commit, or move the reference to a live surface.",
  }),
  spanClass: KnowledgeSpanClass.Enum.unclassified,
  evaluator: O.map(evaluator, (value) => value.id),
  causeKey: nfc(`unclassified:${span.form}:${span.raw}`),
});

const historicalRow = (
  failureRow: KnowledgeEvaluationFailure,
  commit: string,
  evaluator: KnowledgeEvaluator
): FindingRow => ({
  candidate: KnowledgeFindingCandidate.make({
    ...failureRow.candidate,
    kind: "historical-claim-unverified",
    subject: nfc(`historical:${commit}:${failureRow.candidate.subject}`),
    message: `At cited commit ${commit}: ${failureRow.candidate.message}`,
    remediation: "Correct the citation to the commit the claim held at, or fix the captured claim.",
  }),
  spanClass: KnowledgeSpanClass.Enum["historical-with-commit"],
  evaluator: O.some(evaluator.id),
  causeKey: nfc(`historical:${commit}:${failureRow.causeKey}`),
});

type SpanResult = {
  readonly rows: ReadonlyArray<FindingRow>;
  readonly unchecked: number;
};

const NO_SPAN_RESULT: SpanResult = { rows: A.empty(), unchecked: 0 };

const spanResult = (
  outcome: KnowledgeEvaluationOutcome,
  toRow: (failureRow: KnowledgeEvaluationFailure) => FindingRow
): SpanResult =>
  KnowledgeEvaluationOutcome.match(outcome, {
    Failed: (failedOutcome) => ({ rows: A.map(failedOutcome.failures, toRow), unchecked: 0 }),
    Resolved: (resolved) => ({ rows: A.empty(), unchecked: A.length(resolved.unchecked) }),
  });

const evaluateSpan = Effect.fn("KnowledgeDoctor.evaluateSpan")(function* (
  tree: KnowledgeDoctorTree,
  span: KnowledgeSpan,
  spanClass: KnowledgeSpanClass,
  evaluators: ReadonlyArray<KnowledgeEvaluator>
) {
  const evaluator = evaluatorFor(evaluators, span);
  return yield* Match.value(spanClass).pipe(
    Match.when("generated-example", () => Effect.succeed(NO_SPAN_RESULT)),
    Match.when("unclassified", () =>
      Effect.succeed<SpanResult>({ rows: [unclassifiedRow(span, evaluator)], unchecked: 0 })
    ),
    Match.when("verified", () =>
      O.match(evaluator, {
        onNone: () => Effect.succeed(NO_SPAN_RESULT),
        onSome: (value) =>
          Effect.map(value.evaluate(span, tree), (outcome) =>
            spanResult(outcome, (failureRow) => ({
              candidate: failureRow.candidate,
              spanClass,
              evaluator: O.some(value.id),
              causeKey: failureRow.causeKey,
            }))
          ),
      })
    ),
    Match.when("historical-with-commit", () =>
      O.match(O.all({ evaluator, citation: span.citation }), {
        onNone: () => Effect.succeed(NO_SPAN_RESULT),
        onSome: ({ evaluator: value, citation }) =>
          tree.atCommit(citation.commit).pipe(
            Effect.flatMap((historical) => value.evaluate(span, historical)),
            Effect.map((outcome) =>
              spanResult(outcome, (failureRow) => historicalRow(failureRow, citation.commit, value))
            )
          ),
      })
    ),
    Match.exhaustive
  );
});

const citationAncestry = Effect.fn("KnowledgeDoctor.citationAncestry")(function* (
  tree: KnowledgeDoctorTree,
  commits: ReadonlyArray<string>
) {
  const unique = A.dedupe(commits);
  const verdicts = yield* Effect.forEach(unique, (commit) =>
    Effect.map(tree.isAncestor(commit), (ancestor) => [commit, ancestor] as const)
  );
  return HashMap.fromIterable(verdicts);
});

/**
 * Scans one doctor tree into the read-only report: extraction, classification, evaluation.
 *
 * **Details**
 *
 * Every tracked regular Markdown file in the knowledge scope is read, live and archival alike. Each
 * span is classified by {@link KNOWLEDGE_SPAN_CLASSIFICATION_RULES}: `verified` spans are evaluated
 * at the tree, `historical-with-commit` spans at their cited commit (a failure there is
 * `historical-claim-unverified`), `unclassified` spans are reported as advisory
 * `unclassified-reference-span` findings, and `generated-example` fences are counted (their producer
 * validation is a later evaluator). A historical marker on a live surface is reported as
 * `historical-marker-on-live-surface`; an archival marker citing a non-ancestor commit as
 * `historical-commit-not-ancestor`, and its spans stay unclassified.
 *
 * The scan is pure over the tree, so golden and counterfactual tests drive it with in-memory trees.
 *
 * **Example** (Scan an empty in-memory tree)
 *
 * ```ts
 * import {
 *   makeKnowledgeDoctorMemoryTree,
 *   scanKnowledgeDoctorTree,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(scanKnowledgeDoctorTree(makeKnowledgeDoctorMemoryTree({ files: {} })))) // true
 * ```
 *
 * @param tree - Tree to scan.
 * @param evaluators - Evaluators to run; defaults to {@link KNOWLEDGE_DOCTOR_EVALUATORS}.
 * @returns The report, findings sorted by identity.
 * @category use-cases
 * @since 0.0.0
 */
export const scanKnowledgeDoctorTree = Effect.fn("KnowledgeDoctor.scanTree")(function* (
  tree: KnowledgeDoctorTree,
  evaluators: ReadonlyArray<KnowledgeEvaluator> = KNOWLEDGE_DOCTOR_EVALUATORS
) {
  const documents = A.sort(A.filter(tree.trackedEntries, isDoctorDocument), entryOrder);
  const extractions = yield* Effect.forEach(documents, (entry) =>
    tree.readBytes(entry.path).pipe(
      Effect.flatMap((bytes) =>
        decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked Markdown file "${entry.path}".`)
      ),
      Effect.map((text) => ({
        documentPath: entry.path,
        extraction: extractKnowledgeDocumentSpans(entry.path, text, tree.gitRefNames),
      }))
    )
  );
  const archivalCommits = A.flatMap(extractions, ({ documentPath, extraction }) =>
    isKnowledgeArchivalPath(documentPath) ? A.map(extraction.markers, (marker) => marker.commit) : A.empty<string>()
  );
  const ancestry = yield* citationAncestry(tree, archivalCommits);
  let rows = A.empty<FindingRow>();
  let counts = HashMap.empty<KnowledgeSpanClass, number>();
  let unchecked = 0;
  for (const { documentPath, extraction } of extractions) {
    const surface = isKnowledgeArchivalPath(documentPath)
      ? KnowledgeRefSurface.Enum.archival
      : KnowledgeRefSurface.Enum.live;
    rows = A.appendAll(rows, markerRows(documentPath, surface, extraction.markers, ancestry));
    for (const span of extraction.spans) {
      const validCitation = pipe(
        span.citation,
        O.map((citation) => citation.commit),
        O.filter((commit) => O.getOrElse(HashMap.get(ancestry, commit), () => false))
      );
      const spanClass = classifyKnowledgeSpan({ span, validCitation });
      counts = HashMap.set(counts, spanClass, O.getOrElse(HashMap.get(counts, spanClass), () => 0) + 1);
      const result = yield* evaluateSpan(tree, span, spanClass, evaluators);
      rows = A.appendAll(rows, result.rows);
      unchecked += result.unchecked;
    }
  }
  const findings = yield* knowledgeFindingsFromCandidates(
    A.map(rows, (row) => row.candidate),
    severityOf
  );
  const countOf = (spanClass: KnowledgeSpanClass) =>
    S.Natural.make(O.getOrElse(HashMap.get(counts, spanClass), () => 0));
  return KnowledgeDoctorReport.make({
    treeish: tree.treeish,
    tree: tree.commit,
    mode: "report",
    spanCounts: KnowledgeSpanCounts.make({
      verified: countOf("verified"),
      "generated-example": countOf("generated-example"),
      "historical-with-commit": countOf("historical-with-commit"),
      unclassified: countOf("unclassified"),
    }),
    uncheckedOptionCount: S.Natural.make(unchecked),
    findings: A.sort(
      A.zipWith(findings, rows, (finding, row) =>
        KnowledgeDoctorFinding.make({
          finding,
          spanClass: row.spanClass,
          origin: "owned",
          evaluator: row.evaluator,
          causeKey: row.causeKey,
        })
      ),
      doctorFindingOrder
    ),
  });
});

/* -------------------------------------------------------------------------------------------------
 * Trees
 * ---------------------------------------------------------------------------------------------- */

/**
 * Inputs for an in-memory doctor tree.
 *
 * @category models
 * @since 0.0.0
 */
export interface KnowledgeDoctorMemoryTreeInput {
  /** Commits that count as ancestors of this tree. */
  readonly ancestors?: ReadonlyArray<string> | undefined;
  readonly commandTree?: O.Option<KnowledgeStaticCommandTree> | undefined;
  readonly commit?: string | undefined;
  readonly files: Readonly<Record<string, string>>;
  readonly gitRefNames?: HashSet.HashSet<string> | undefined;
  readonly globalOptions?: ReadonlyArray<KnowledgeStaticCommandFlag> | undefined;
  /** Doctor trees of historical commits, keyed by commit. */
  readonly history?: Readonly<Record<string, KnowledgeDoctorTree>> | undefined;
  readonly producers?: ReadonlyArray<KnowledgeProducerOutput> | undefined;
}

const MEMORY_TREE_COMMIT = "0000000000000000000000000000000000000000";
const textEncoder = new TextEncoder();

/**
 * Builds a doctor tree over in-memory files, for golden, adversarial, and counterfactual tests.
 *
 * **Details**
 *
 * Every file is a regular tracked blob. The command surface defaults to none, the global flags to
 * {@link KNOWLEDGE_CLI_GLOBAL_FLAGS}, and the producers to {@link KNOWLEDGE_PRODUCER_OUTPUTS}.
 * `atCommit` serves `history` and fails closed for any other commit, like an absent object.
 *
 * **Example** (Build a one-file tree)
 *
 * ```ts
 * import { makeKnowledgeDoctorMemoryTree } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * const tree = makeKnowledgeDoctorMemoryTree({ files: { "AGENTS.md": "# Agents" } })
 *
 * console.log(tree.trackedEntries.length) // 1
 * ```
 *
 * @param input - Files plus optional command surface, ancestry, history, and producers.
 * @returns The in-memory doctor tree.
 * @category testing
 * @since 0.0.0
 */
export const makeKnowledgeDoctorMemoryTree = (input: KnowledgeDoctorMemoryTreeInput): KnowledgeDoctorTree => {
  const commit = input.commit ?? MEMORY_TREE_COMMIT;
  const files = HashMap.fromIterable(R.toEntries(input.files));
  const entries = A.map(R.keys(input.files), (path) =>
    KnowledgeTrackedEntry.make({ path, mode: "100644", objectId: `oid:${path}` })
  );
  const ancestors = HashSet.fromIterable(input.ancestors ?? A.empty());
  const history = HashMap.fromIterable(R.toEntries(input.history ?? {}));
  return {
    treeish: commit,
    commit,
    trackedEntries: entries,
    entryIndex: makeKnowledgeTreeEntryIndex(entries),
    readBytes: (repoPath) =>
      Effect.fromOption(HashMap.get(files, repoPath)).pipe(
        Effect.mapError(() =>
          KnowledgeOperationalError.make({ message: `Fixture is missing tracked bytes for ${repoPath}.` })
        ),
        Effect.map((text) => textEncoder.encode(text))
      ),
    gitRefNames: input.gitRefNames ?? HashSet.empty(),
    producers: input.producers ?? KNOWLEDGE_PRODUCER_OUTPUTS,
    commandTree: Effect.succeed(input.commandTree ?? O.none()),
    globalOptions: input.globalOptions ?? KNOWLEDGE_CLI_GLOBAL_FLAGS,
    isAncestor: (sha) => Effect.succeed(HashSet.has(ancestors, sha)),
    atCommit: (sha) =>
      Effect.fromOption(HashMap.get(history, sha)).pipe(
        Effect.mapError(() => KnowledgeOperationalError.make({ message: `Fixture has no tree for commit ${sha}.` }))
      ),
  };
};

const COMMAND_ROOT_MODULE = "packages/tooling/tool/cli/src/commands/Root.ts";

// `git merge-base --is-ancestor` exits 0 for an ancestor and 1 for a non-ancestor. Any other exit
// (an unknown object) is a non-ancestor in a full clone and an operational failure in a shallow one,
// where missing history cannot be told apart from a bad citation.
const isAncestorLive = Effect.fn("KnowledgeDoctor.isAncestor")(function* (
  repoRoot: string,
  treeCommit: string,
  cited: KnowledgeCommitSha
) {
  const result = yield* runCapturedStreams({
    command: "git",
    args: ["merge-base", "--is-ancestor", cited, treeCommit],
    cwd: repoRoot,
    extendEnv: true,
  }).pipe(KnowledgeOperationalError.mapError("Failed to spawn git merge-base --is-ancestor."));
  if (result.exitCode === 0 || result.exitCode === 1) {
    return result.exitCode === 0;
  }
  const shallow = yield* runCapturedStreams({
    command: "git",
    args: ["rev-parse", "--is-shallow-repository"],
    cwd: repoRoot,
    extendEnv: true,
    trim: true,
  }).pipe(KnowledgeOperationalError.mapError("Failed to spawn git rev-parse --is-shallow-repository."));
  return Str.equivalence(shallow.stdout, "true")
    ? yield* KnowledgeOperationalError.make({
        message: `Cannot verify historical citation ${cited} in a shallow clone. ${KNOWLEDGE_HISTORY_REMEDIATION}`,
      })
    : false;
});

type LiveTreeRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Scope.Scope;

const liveCommandTree = (materialized: KnowledgeMaterializedTree) =>
  A.some(materialized.oracle.trackedEntries, (entry) => Str.equivalence(entry.path, COMMAND_ROOT_MODULE))
    ? Effect.asSome(KnowledgeCommandSurface.buildStaticCommandTree(materialized.archiveRoot))
    : Effect.succeed(O.none<KnowledgeStaticCommandTree>());

const liveDoctorTree = Effect.fn("KnowledgeDoctor.liveTree")(function* (
  materialized: KnowledgeMaterializedTree,
  gitRefNames: HashSet.HashSet<string>,
  history: MutableHashMap.MutableHashMap<string, KnowledgeDoctorTree>
) {
  const runtime = yield* Effect.context<LiveTreeRequirements>();
  const commandTree = yield* Effect.cached(liveCommandTree(materialized).pipe(Effect.provide(runtime)));
  const tree: KnowledgeDoctorTree = {
    ...materialized.oracle,
    entryIndex: makeKnowledgeTreeEntryIndex(materialized.oracle.trackedEntries),
    gitRefNames,
    producers: KNOWLEDGE_PRODUCER_OUTPUTS,
    commandTree,
    globalOptions: KNOWLEDGE_CLI_GLOBAL_FLAGS,
    isAncestor: (cited) =>
      isAncestorLive(materialized.repoRoot, materialized.oracle.commit, cited).pipe(Effect.provide(runtime)),
    atCommit: (cited) =>
      O.match(MutableHashMap.get(history, cited), {
        onSome: Effect.succeed,
        onNone: () =>
          materializeKnowledgeTree(cited).pipe(
            Effect.flatMap((historical) => liveDoctorTree(historical, gitRefNames, history)),
            Effect.tap((historical) => Effect.sync(() => MutableHashMap.set(history, cited, historical))),
            Effect.catchTag("KnowledgeCloneAttributesError", (error) =>
              Effect.fail(KnowledgeOperationalError.make({ message: error.message }))
            ),
            Effect.provide(runtime)
          ),
      }),
  };
  return tree;
});

/**
 * Materializes one commit-ish as a live doctor tree backed by a scoped Git archive.
 *
 * **Details**
 *
 * The tree reads only the archive: tracked entries from `git ls-tree`, bytes from the extracted
 * archive, and the command surface statically from the archive's own CLI sources. Historical trees
 * from `atCommit` are materialized on first use and cached for the scan. No fetch ever occurs.
 *
 * **Gotchas**
 *
 * Every archive lives in the enclosing scope, so the tree is only valid inside the `Effect.scoped`
 * region that built it.
 *
 * **Example** (Build the tree of the working commit)
 *
 * ```ts
 * import { makeKnowledgeDoctorTree } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.scoped(makeKnowledgeDoctorTree("HEAD")))) // true
 * ```
 *
 * @param treeish - Any commit-ish.
 * @returns The live doctor tree.
 * @category constructors
 * @since 0.0.0
 */
export const makeKnowledgeDoctorTree = Effect.fn("KnowledgeDoctor.makeTree")(function* (treeish: string) {
  const materialized = yield* materializeKnowledgeTree(treeish);
  const gitRefNames = yield* readKnowledgeGitRefNames(materialized.repoRoot);
  return yield* liveDoctorTree(materialized, gitRefNames, MutableHashMap.empty());
});

/**
 * The knowledge doctor's operations.
 *
 * **Details**
 *
 * `scanTree` is pure over an injected tree, which is what golden and counterfactual tests drive.
 * `report` materializes a commit-ish and scans it; it reads no baseline and writes nothing.
 *
 * @see {@link KnowledgeDoctor} for the service tag.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeDoctorShape {
  readonly report: (
    treeish: string
  ) => Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>;
  readonly scanTree: (
    tree: KnowledgeDoctorTree,
    evaluators?: ReadonlyArray<KnowledgeEvaluator>
  ) => Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError>;
}

/**
 * Service tag for the knowledge doctor.
 *
 * **Example** (Count findings in the working tree)
 *
 * ```ts
 * import { KnowledgeDoctor } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * const count = Effect.gen(function* () {
 *   const doctor = yield* KnowledgeDoctor
 *   const report = yield* doctor.report("HEAD")
 *   return report.findings.length
 * })
 *
 * console.log(Effect.isEffect(count)) // true
 * ```
 *
 * @see {@link KnowledgeDoctorLive} for the live layer.
 * @category services
 * @since 0.0.0
 */
export class KnowledgeDoctor extends Context.Service<KnowledgeDoctor, KnowledgeDoctorShape>()($I`KnowledgeDoctor`) {}

type KnowledgeDoctorRequirements =
  | Crypto.Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

const makeKnowledgeDoctor = Effect.fn("KnowledgeDoctor.make")(function* () {
  const runtime = yield* Effect.context<KnowledgeDoctorRequirements>();
  return KnowledgeDoctor.of({
    scanTree: Effect.fn("KnowledgeDoctor.scanTreeService")((tree, evaluators) =>
      scanKnowledgeDoctorTree(tree, evaluators).pipe(Effect.provide(runtime))
    ),
    report: Effect.fn("KnowledgeDoctor.report")((treeish) =>
      Effect.scoped(Effect.flatMap(makeKnowledgeDoctorTree(treeish), (tree) => scanKnowledgeDoctorTree(tree))).pipe(
        Effect.provide(runtime)
      )
    ),
  });
});

/**
 * Live layer that scans real Git archives of the local repository.
 *
 * **Example** (Provide the live doctor)
 *
 * ```ts
 * import { KnowledgeDoctor, KnowledgeDoctorLive } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * const report = Effect.gen(function* () {
 *   const doctor = yield* KnowledgeDoctor
 *   return yield* doctor.report("HEAD")
 * }).pipe(Effect.provide(KnowledgeDoctorLive))
 *
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const KnowledgeDoctorLive: Layer.Layer<KnowledgeDoctor, never, KnowledgeDoctorRequirements> = Layer.effect(
  KnowledgeDoctor,
  makeKnowledgeDoctor()
);
