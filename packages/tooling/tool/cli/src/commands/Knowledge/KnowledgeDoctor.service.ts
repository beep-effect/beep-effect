/**
 * Stage-2 knowledge doctor: span extraction over the knowledge corpus, the ordered span-classification
 * rule table, the witness-bearing paths and commands evaluators, the counterfactual overlay, and the
 * read-only report service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { isCi } from "../../internal/cli/EnvConfig.ts";
import { runCapturedStreams } from "../../internal/process/StepExec.ts";
import {
  readGitRenames,
  readGitTree,
  resolveGitCommit,
  resolveGitMergeBase,
  runGitPathList,
} from "../../internal/repo-run/GitExec.ts";
import { EXPLORATION_ATLAS_PATH } from "../Explore/Atlas.ts";
import { PORTFOLIO_INDEX_PATH } from "../Goals/PortfolioIndex.ts";
import { KnowledgeCommandSurface, KnowledgeStaticCommandFlag } from "./Knowledge.command-surface.ts";
import {
  KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE,
  KNOWLEDGE_HISTORY_REMEDIATION,
  KnowledgeDoctorInputError,
  KnowledgeMintContextRefusal,
  KnowledgeOperationalError,
} from "./Knowledge.errors.ts";
import {
  decodeKnowledgeUtf8,
  isKnowledgeArchivalPath,
  isKnowledgeCommandSpan,
  isKnowledgeScopedPath,
  KnowledgeRefSurface,
  knowledgeDocumentFenceLines,
  knowledgeInlineSpans,
  knowledgePathAssertion,
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
  checkKnowledgeDoctorReport,
  KNOWLEDGE_DOCTOR_BASELINE_PATH,
  KnowledgeDoctorCheckInput,
  KnowledgeMintAcceptance,
  mintKnowledgeBaseline,
  readKnowledgeSealFiles,
  verifyKnowledgeBaselineText,
} from "./KnowledgeDoctor.baseline.ts";
import {
  cacheKnowledgeDoctorDomain,
  deriveKnowledgeDoctorDomain,
  knowledgeDomainWithout,
  knowledgeDomainWitnessHolds,
} from "./KnowledgeDoctor.domain.ts";
import {
  KnowledgePacketStatusEvaluator,
  KnowledgeSkillsLocalEvaluator,
  KnowledgeSymbolsEvaluator,
  knowledgeCurrentPhaseClaim,
  knowledgeDoctorDocumentId,
  knowledgeDomainLineSpans,
  knowledgeEvaluationFailure,
} from "./KnowledgeDoctor.evaluators.ts";
import {
  groupKnowledgeDoctorFindings,
  KNOWLEDGE_PATH_REMOVAL_LOG_ARGS,
  knowledgeDelegatedRow,
  parseKnowledgePathRemovals,
} from "./KnowledgeDoctor.grouping.ts";
import {
  evaluateKnowledgeLeases,
  KnowledgeLeaseEvaluationInput,
  KnowledgeLeasesReport,
} from "./KnowledgeDoctor.leases.ts";
import {
  decideKnowledgeDoctorCiMode,
  KnowledgeDoctorCiModeInput,
  KnowledgeMintWriteContext,
  knowledgeMintWriteRefusals,
  mintKnowledgeBaselineText,
} from "./KnowledgeDoctor.mint.ts";
import {
  CommandNodeWitness,
  EvaluationFailed,
  EvaluationResolved,
  KnowledgeCounterfactualVerdict,
  KnowledgeDoctorFinding,
  KnowledgeDoctorReport,
  KnowledgeDocumentExtraction,
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
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Scope from "effect/Scope";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
import type { KnowledgeStaticCommandTree } from "./Knowledge.command-surface.ts";
import type { KnowledgeCloneAttributesError, KnowledgeMintRefusal, KnowledgeSealBroken } from "./Knowledge.errors.ts";
import type { KnowledgeCommitSha, KnowledgeDocumentFenceLine, KnowledgeTreeOracle } from "./Knowledge.refs.ts";
import type { KnowledgeFindingKind, KnowledgeFindingSeverity } from "./Knowledge.schemas.ts";
import type { KnowledgeMaterializedTree } from "./Knowledge.service.ts";
import type {
  KnowledgeDoctorBaseline,
  KnowledgeDoctorPromotion,
  KnowledgeMintInput,
  KnowledgeSealFiles,
} from "./KnowledgeDoctor.baseline.ts";
import type { KnowledgeDoctorDomain } from "./KnowledgeDoctor.domain.ts";
import type { KnowledgeDebtLease } from "./KnowledgeDoctor.leases.ts";
import type { KnowledgeDoctorCiMode, KnowledgeMintOutcome } from "./KnowledgeDoctor.mint.ts";
import type {
  KnowledgeCounterfactualVerdictKind,
  KnowledgeEvaluationFailure,
  KnowledgeEvaluatorId,
  KnowledgePathRemoval,
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
 * commit is an ancestor of this tree, and the doctor tree of that commit. `domain` holds the goal
 * packet, workspace package, and skill facts the domain evaluators read, derived from tree bytes.
 * `pathRemovals` is the tree's history of deleted and renamed-away paths, newest first, used only to
 * attribute cause-group roots; it is `O.none()` when history is unavailable and never fails.
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
  readonly domain: KnowledgeDoctorDomain;
  readonly entryIndex: KnowledgeTreeEntryIndex;
  readonly gitRefNames: HashSet.HashSet<string>;
  readonly globalOptions: ReadonlyArray<KnowledgeStaticCommandFlag>;
  readonly isAncestor: (commit: KnowledgeCommitSha) => Effect.Effect<boolean, KnowledgeOperationalError>;
  readonly pathRemovals: Effect.Effect<O.Option<ReadonlyArray<KnowledgePathRemoval>>>;
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
 * `treeSpans`, when present, synthesizes spans from the tree itself rather than from prose (the
 * skills evaluator's one span per installed or locked skill); the scan evaluates them like any other.
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
  readonly treeSpans?:
    | ((tree: KnowledgeDoctorTree) => Effect.Effect<ReadonlyArray<KnowledgeSpan>, KnowledgeOperationalError>)
    | undefined;
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

// A span the prose introduces as a branch ("branch `goals/x`") names a Git ref, not a path, even when
// the ref no longer exists locally (K29).
const BRANCH_NAME_PREFIX = /\bbranch(?:es)?\s+$/iu;

const namesBranch = (text: string, column: number): boolean => BRANCH_NAME_PREFIX.test(Str.slice(0, column - 1)(text));

const proseSpans = (
  line: KnowledgeDocumentFenceLine,
  documentPath: string,
  gitRefNames: HashSet.HashSet<string>
): ReadonlyArray<readonly [KnowledgeSpanForm, string, number]> => {
  const assertions = O.toArray(
    O.map(knowledgePathAssertion(line.text), ({ path, column }) => ["path-assertion", path, column] as const)
  );
  const inline = A.getSomes(
    A.map(knowledgeInlineSpans(line.text), (inlineSpan) => {
      if (isKnowledgeCommandSpan(inlineSpan.span)) {
        return O.some(["command", inlineSpan.span, inlineSpan.column] as const);
      }
      return HashSet.has(gitRefNames, inlineSpan.span) ||
        namesBranch(line.text, inlineSpan.column) ||
        O.isNone(normalizeKnowledgeRepoPath(documentPath, inlineSpan.span))
        ? O.none()
        : O.some(["path", inlineSpan.span, inlineSpan.column] as const);
    })
  );
  return A.appendAll(A.appendAll(assertions, inline), knowledgeDomainLineSpans(line.text));
};

/**
 * Extracts every reference-shaped span and historical marker from one decoded document.
 *
 * **Details**
 *
 * Spans come from the Stage-1 readers: inline code spans on prose lines (a `bun run beep` span is a
 * command, a governed repository spelling a path unless it exactly names a Git ref or the prose
 * introduces it as a branch, as in "branch `goals/x`") and
 * `beep:assert path-exists` markers that fill a whole prose line (a marker quoted in inline code or
 * written mid-line asserts nothing). Fenced content is never read as spans: an unmarked fence is a
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
  const phaseClaim = knowledgeCurrentPhaseClaim(documentPath, lines);
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
    const phase = pipe(
      phaseClaim,
      O.filter(([lineNumber]) => lineNumber === line.number),
      O.map(([, raw, column]): readonly [KnowledgeSpanForm, string, number] => ["packet-phase", raw, column]),
      O.toArray
    );
    const prose = line.prose
      ? A.map(A.appendAll(phase, proseSpans(line, documentPath, gitRefNames)), ([form, raw, column]) =>
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
        knowledgeEvaluationFailure(span, {
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
    knowledgeEvaluationFailure(span, {
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
            knowledgeEvaluationFailure(span, {
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
 * console.log(A.map(KNOWLEDGE_DOCTOR_EVALUATORS, (evaluator) => evaluator.id))
 * // [ "paths", "commands", "symbols", "packet-status", "skills-local" ]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_EVALUATORS: ReadonlyArray<KnowledgeEvaluator> = [
  KnowledgePathsEvaluator,
  KnowledgeCommandsEvaluator,
  KnowledgeSymbolsEvaluator,
  KnowledgePacketStatusEvaluator,
  KnowledgeSkillsLocalEvaluator,
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
  domain: deriveKnowledgeDoctorDomain({ ...tree, trackedEntries: entries }),
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
 * producer witness unregisters the producer output. A manifest-field, export, or lock-entry witness
 * removes that one fact from the domain ({@link knowledgeDomainWithout}). Nothing else about the
 * tree changes.
 *
 * **Gotchas**
 *
 * Hiding a tree entry re-derives the domain from the remaining entries, uncached, so a domain overlay
 * applied before it is not carried over; the harness overlays one witness at a time.
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
      ManifestFieldWitness: (field) => ({ ...tree, domain: knowledgeDomainWithout(tree.domain, field) }),
      ExportWitness: (exported) => ({ ...tree, domain: knowledgeDomainWithout(tree.domain, exported) }),
      LockEntryWitness: (locked) => ({ ...tree, domain: knowledgeDomainWithout(tree.domain, locked) }),
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
    ManifestFieldWitness: (field) => knowledgeDomainWitnessHolds(tree.domain, field),
    ExportWitness: (exported) => knowledgeDomainWitnessHolds(tree.domain, exported),
    LockEntryWitness: (locked) => knowledgeDomainWitnessHolds(tree.domain, locked),
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
            documentId: knowledgeDoctorDocumentId(documentPath),
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
              documentId: knowledgeDoctorDocumentId(documentPath),
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
    documentId: knowledgeDoctorDocumentId(span.documentPath),
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

// Every goals-doctor finding the tree's bytes determine, listed as delegated: the goals doctor keeps
// the gate, and each one is a causal root for the claims beneath it.
const delegatedFindings = Effect.fn("KnowledgeDoctor.delegatedFindings")(function* (tree: KnowledgeDoctorTree) {
  const delegatedRows = A.map(yield* tree.domain.goalsDoctorFindings, knowledgeDelegatedRow);
  const severities = HashMap.fromIterable(
    A.map(delegatedRows, (row) => [row.candidate.subject, row.severity] as const)
  );
  const findings = yield* knowledgeFindingsFromCandidates(
    A.map(delegatedRows, (row) => row.candidate),
    (candidate) => O.getOrElse(HashMap.get(severities, candidate.subject), () => "blocking" as const)
  );
  return A.zipWith(findings, delegatedRows, (finding, row) =>
    KnowledgeDoctorFinding.make({
      finding,
      spanClass: KnowledgeSpanClass.Enum.verified,
      origin: "delegated",
      evaluator: O.none(),
      causeKey: row.causeKey,
    })
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
 * `historical-commit-not-ancestor`, and its spans stay unclassified. Spans an evaluator synthesizes
 * from the tree (`treeSpans`, such as one per skill) are classified and evaluated after the documents.
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
  const treeSpans = yield* Effect.forEach(evaluators, (evaluator) =>
    P.isUndefined(evaluator.treeSpans) ? Effect.succeed(A.empty<KnowledgeSpan>()) : evaluator.treeSpans(tree)
  );
  const synthesized = A.map(A.flatten(treeSpans), (span) => ({
    documentPath: span.documentPath,
    extraction: KnowledgeDocumentExtraction.make({ markers: [], spans: [span] }),
  }));
  const archivalCommits = A.flatMap(extractions, ({ documentPath, extraction }) =>
    isKnowledgeArchivalPath(documentPath) ? A.map(extraction.markers, (marker) => marker.commit) : A.empty<string>()
  );
  const distinctHistoricalCommits = A.dedupe(archivalCommits);
  if (A.length(distinctHistoricalCommits) > 4) {
    return yield* KnowledgeOperationalError.make({
      message: "Knowledge doctor refuses more than four distinct historical commits in one report.",
    });
  }
  const ancestry = yield* citationAncestry(tree, archivalCommits);
  let rows = A.empty<FindingRow>();
  let counts = HashMap.empty<KnowledgeSpanClass, number>();
  let unchecked = 0;
  for (const { documentPath, extraction } of A.appendAll(extractions, synthesized)) {
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
  const owned = A.zipWith(findings, rows, (finding, row) =>
    KnowledgeDoctorFinding.make({
      finding,
      spanClass: row.spanClass,
      origin: "owned",
      evaluator: row.evaluator,
      causeKey: row.causeKey,
    })
  );
  const delegated = yield* delegatedFindings(tree);
  const all = A.sort(A.appendAll(owned, delegated), doctorFindingOrder);
  const removals = yield* tree.pathRemovals;
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
    rootHistory: O.isSome(removals) ? "available" : "unavailable",
    groups: groupKnowledgeDoctorFindings(all, removals),
    findings: all,
    ratchet: O.none(),
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
  /** Deleted and renamed-away paths, newest first; `O.none()` simulates unavailable history. */
  readonly pathRemovals?: O.Option<ReadonlyArray<KnowledgePathRemoval>> | undefined;
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
 * {@link KNOWLEDGE_CLI_GLOBAL_FLAGS}, the producers to {@link KNOWLEDGE_PRODUCER_OUTPUTS}, and the path
 * removals to an available, empty history.
 * `atCommit` serves `history` and fails closed for any other commit, like an absent object. The
 * domain facts are derived from `files`, uncached.
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
 * @returns A tree whose reads come from `input.files` and never touch git or the disk.
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
  const oracle: KnowledgeTreeOracle = {
    treeish: commit,
    commit,
    trackedEntries: entries,
    readBytes: (repoPath) =>
      Effect.fromOption(HashMap.get(files, repoPath)).pipe(
        Effect.mapError(() =>
          KnowledgeOperationalError.make({ message: `Fixture is missing tracked bytes for ${repoPath}.` })
        ),
        Effect.map((text) => textEncoder.encode(text))
      ),
  };
  return {
    ...oracle,
    entryIndex: makeKnowledgeTreeEntryIndex(entries),
    domain: deriveKnowledgeDoctorDomain(oracle),
    gitRefNames: input.gitRefNames ?? HashSet.empty(),
    producers: input.producers ?? KNOWLEDGE_PRODUCER_OUTPUTS,
    commandTree: Effect.succeed(input.commandTree ?? O.none()),
    globalOptions: input.globalOptions ?? KNOWLEDGE_CLI_GLOBAL_FLAGS,
    isAncestor: (sha) => Effect.succeed(HashSet.has(ancestors, sha)),
    pathRemovals: Effect.succeed(input.pathRemovals ?? O.some(A.empty())),
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

// The tree's deleted and renamed-away paths, newest first. History is optional evidence for root
// attribution: a shallow clone, a failed spawn, or a non-zero exit yields `O.none()`, never a failure.
const pathRemovalsLive = Effect.fn("KnowledgeDoctor.pathRemovals")(function* (repoRoot: string, treeCommit: string) {
  const shallow = yield* runCapturedStreams({
    command: "git",
    args: ["rev-parse", "--is-shallow-repository"],
    cwd: repoRoot,
    extendEnv: true,
    trim: true,
  });
  if (shallow.exitCode !== 0 || Str.equivalence(shallow.stdout, "true")) {
    return O.none<ReadonlyArray<KnowledgePathRemoval>>();
  }
  const log = yield* runCapturedStreams({
    command: "git",
    args: [...KNOWLEDGE_PATH_REMOVAL_LOG_ARGS, treeCommit],
    cwd: repoRoot,
    extendEnv: true,
  });
  return log.exitCode === 0 ? O.some(parseKnowledgePathRemovals(log.stdout)) : O.none();
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
  const domain = yield* cacheKnowledgeDoctorDomain(deriveKnowledgeDoctorDomain(materialized.oracle));
  const pathRemovals = yield* Effect.cached(
    pathRemovalsLive(materialized.repoRoot, materialized.oracle.commit).pipe(
      Effect.catchTags({
        PlatformError: () => Effect.succeed(O.none<ReadonlyArray<KnowledgePathRemoval>>()),
        AdmissionWorkloadRegistrationError: () => Effect.succeed(O.none<ReadonlyArray<KnowledgePathRemoval>>()),
      }),
      Effect.provide(runtime)
    )
  );
  const tree: KnowledgeDoctorTree = {
    ...materialized.oracle,
    domain,
    entryIndex: makeKnowledgeTreeEntryIndex(materialized.oracle.trackedEntries),
    gitRefNames,
    producers: KNOWLEDGE_PRODUCER_OUTPUTS,
    commandTree,
    globalOptions: KNOWLEDGE_CLI_GLOBAL_FLAGS,
    pathRemovals,
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

/* -------------------------------------------------------------------------------------------------
 * Gate
 * ---------------------------------------------------------------------------------------------- */

type DoctorGitError = KnowledgeDoctorInputError | KnowledgeOperationalError;

const doctorGitAdapter = (subject: string): GitCommandErrorAdapter<DoctorGitError> => ({
  onSpawnFailure: (commandLine) => KnowledgeOperationalError.new(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    KnowledgeDoctorInputError.of(
      "absent-ref",
      subject,
      `Cannot resolve ${subject} with ${commandLine} (exit ${exitCode}).${Str.isEmpty(output) ? "" : ` ${output}`}`
    ),
  onTruncated: O.none(),
});

/**
 * The typed failure a shallow clone raises before the gate reads any history.
 *
 * **Example** (A full clone passes)
 *
 * ```ts
 * import { knowledgeShallowHistoryError } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(knowledgeShallowHistoryError("false", "origin/main"))) // true
 * ```
 *
 * @param isShallowOutput - Trimmed output of `git rev-parse --is-shallow-repository`.
 * @param subject - The base ref the gate needs history for.
 * @returns The `shallow-history` error when the clone is shallow.
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeShallowHistoryError: {
  (subject: string): (isShallowOutput: string) => O.Option<KnowledgeDoctorInputError>;
  (isShallowOutput: string, subject: string): O.Option<KnowledgeDoctorInputError>;
} = dual(
  2,
  (isShallowOutput: string, subject: string): O.Option<KnowledgeDoctorInputError> =>
    Str.equivalence(isShallowOutput, "true")
      ? O.some(
          KnowledgeDoctorInputError.of(
            "shallow-history",
            subject,
            `The clone is shallow, so the merge-base with ${subject} and the rename lineage since mintedAt are unknowable.`
          )
        )
      : O.none()
);

type DoctorRefs = { readonly repoRoot: string; readonly head: string; readonly mergeBase: string };

const resolveDoctorRefs = Effect.fn("KnowledgeDoctor.resolveRefs")(function* (baseRef: string) {
  const repoRoot = yield* findRepoRoot().pipe(
    KnowledgeOperationalError.mapError("Failed to locate the repository root for the knowledge doctor.")
  );
  const shallow = yield* runCapturedStreams({
    command: "git",
    args: ["rev-parse", "--is-shallow-repository"],
    cwd: repoRoot,
    extendEnv: true,
    trim: true,
  }).pipe(KnowledgeOperationalError.mapError("Failed to spawn git rev-parse --is-shallow-repository."));
  yield* O.match(knowledgeShallowHistoryError(shallow.stdout, baseRef), {
    onNone: () => Effect.void,
    onSome: Effect.fail,
  });
  const head = yield* resolveGitCommit(repoRoot, "HEAD", doctorGitAdapter("HEAD"));
  yield* resolveGitCommit(repoRoot, baseRef, doctorGitAdapter(baseRef));
  const mergeBase = yield* resolveGitMergeBase(
    repoRoot,
    baseRef,
    head,
    doctorGitAdapter(`the merge-base of ${baseRef}`)
  );
  return { repoRoot, head, mergeBase } satisfies DoctorRefs;
});

/**
 * Options of the gating check.
 *
 * **Details**
 *
 * `acceptMint` is CI-only: it admits a mint-App baseline change when the C8 conditions hold.
 * `baseRef` is a local ref whose merge-base with HEAD is the trust anchor; the doctor never fetches.
 * `now` is the instant lease expiry is judged at.
 *
 * **Example** (Check against origin/main)
 *
 * ```ts
 * import { KnowledgeDoctorCheckOptions } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as DateTime from "effect/DateTime"
 *
 * const options = KnowledgeDoctorCheckOptions.make({
 *   acceptMint: false,
 *   baseRef: "origin/main",
 *   now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 * })
 *
 * console.log(options.baseRef) // "origin/main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorCheckOptions extends S.Opaque<
  KnowledgeDoctorCheckOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    acceptMint: S.Boolean,
    baseRef: S.String,
    now: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorCheckOptions", {
      description: "Base ref, CI mint acceptance flag, and the instant of one gating knowledge-doctor check.",
    })
  )
) {}

const missingBaseline = (): KnowledgeDoctorInputError =>
  KnowledgeDoctorInputError.make({
    reason: "missing-baseline",
    subject: KNOWLEDGE_DOCTOR_BASELINE_PATH,
    message: KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE,
    remediation: "Run `bun run beep knowledge doctor --report` until the CI mint opens the first sealed baseline.",
  });

const previousPromotions = Effect.fn("KnowledgeDoctor.previousPromotions")(function* (
  tree: KnowledgeDoctorTree,
  files: KnowledgeSealFiles
) {
  return yield* O.match(files.baseline, {
    onNone: () => Effect.succeed(A.empty<KnowledgeDoctorPromotion>()),
    onSome: (baseline) =>
      tree.atCommit(baseline.mintedAt).pipe(
        Effect.flatMap(readKnowledgeSealFiles),
        Effect.map((previous) =>
          O.match(previous.promotions, { onNone: A.empty<KnowledgeDoctorPromotion>, onSome: (file) => file.promotions })
        )
      ),
  });
});

const mintInputAt = Effect.fn("KnowledgeDoctor.mintInputAt")(function* (commit: string) {
  const tree = yield* makeKnowledgeDoctorTree(commit);
  const report = yield* scanKnowledgeDoctorTree(tree);
  const files = yield* readKnowledgeSealFiles(tree);
  return {
    tree,
    report,
    removals: yield* tree.pathRemovals,
    files,
    previousPromotions: yield* previousPromotions(tree, files),
  } satisfies KnowledgeMintInput;
});

const mintAt = (commit: string) => Effect.flatMap(mintInputAt(commit), mintKnowledgeBaseline);

const reproducesAt = (text: O.Option<string>, baseline: KnowledgeDoctorBaseline) =>
  Effect.scoped(mintAt(baseline.mintedAt)).pipe(
    Effect.flatMap((minted) =>
      verifyKnowledgeBaselineText(
        O.getOrElse(text, () => ""),
        minted
      )
    ),
    Effect.as(true),
    Effect.catchTags({
      KnowledgeSealBroken: () => Effect.succeed(false),
      KnowledgeMintRefusal: () => Effect.succeed(false),
    })
  );

const mintAcceptance = Effect.fn("KnowledgeDoctor.mintAcceptance")(function* (
  refs: DoctorRefs,
  baseline: KnowledgeDoctorBaseline,
  text: O.Option<string>
) {
  const mintedAtIsAncestor = yield* isAncestorLive(refs.repoRoot, refs.mergeBase, baseline.mintedAt);
  const reproduces = yield* reproducesAt(text, baseline);
  return KnowledgeMintAcceptance.make({ mintedAtIsAncestor, reproduces });
});

const checkLive = Effect.fn("KnowledgeDoctor.checkLive")(function* (options: KnowledgeDoctorCheckOptions) {
  const refs = yield* resolveDoctorRefs(options.baseRef);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const tree = yield* makeKnowledgeDoctorTree(refs.head);
      const head = yield* readKnowledgeSealFiles(tree);
      const baseTree = yield* materializeKnowledgeTree(refs.mergeBase);
      const base = yield* readKnowledgeSealFiles(baseTree.oracle);
      const baseline = yield* Effect.fromOption(O.orElse(head.baseline, () => base.baseline)).pipe(
        Effect.mapError(missingBaseline)
      );
      const report = yield* scanKnowledgeDoctorTree(tree);
      const adapter = doctorGitAdapter(`mintedAt ${baseline.mintedAt}`);
      const renames = yield* readGitRenames(refs.repoRoot, baseline.mintedAt, refs.head, [], adapter, () =>
        KnowledgeOperationalError.make({ message: "Malformed NUL-delimited rename output since mintedAt." })
      );
      const mintedAtPaths = O.isSome(head.identity)
        ? HashSet.fromIterable(
            A.map(
              yield* readGitTree(refs.repoRoot, baseline.mintedAt, adapter, () =>
                KnowledgeOperationalError.make({ message: "Malformed NUL-delimited mintedAt ls-tree output." })
              ),
              (entry) => entry.path
            )
          )
        : HashSet.empty<string>();
      const changedPaths = yield* runGitPathList(
        refs.repoRoot,
        ["diff", "--name-only", "-z", refs.mergeBase, refs.head],
        doctorGitAdapter(refs.mergeBase)
      );
      const acceptMint = options.acceptMint
        ? yield* O.match(head.baseline, {
            onNone: () => Effect.succeedNone,
            onSome: (headBaseline) => Effect.asSome(mintAcceptance(refs, headBaseline, head.baselineText)),
          })
        : O.none<KnowledgeMintAcceptance>();
      return yield* checkKnowledgeDoctorReport(
        KnowledgeDoctorCheckInput.make({
          acceptMint,
          base,
          baseRef: options.baseRef,
          changedPaths,
          head,
          headPaths: tree.entryIndex.paths,
          mergeBase: refs.mergeBase,
          mintedAtPaths,
          now: options.now,
          renames: A.map(renames, (rename) => [rename.sourcePath, rename.targetPath] as const),
          report,
          removals: yield* tree.pathRemovals,
        })
      );
    })
  );
});

const verifyMintLive = Effect.scoped(
  Effect.gen(function* () {
    const tree = yield* materializeKnowledgeTree("HEAD");
    const files = yield* readKnowledgeSealFiles(tree.oracle);
    const baseline = yield* Effect.fromOption(files.baseline).pipe(Effect.mapError(missingBaseline));
    const minted = yield* Effect.scoped(mintAt(baseline.mintedAt));
    yield* verifyKnowledgeBaselineText(
      O.getOrElse(files.baselineText, () => ""),
      minted
    );
    return minted;
  })
).pipe(Effect.withSpan("KnowledgeDoctor.verifyMintLive"));

/**
 * Options of one mint run.
 *
 * **Details**
 *
 * `at` is the commit-ish to mint (default `HEAD`); `baseRef` the local ref that must contain it for
 * a write; `write` writes `goals/knowledge-doctor.baseline.jsonc` when the mint changes it. Without
 * `write` the run is a dry run that writes nothing and checks no CI context.
 *
 * **Example** (The CI mint at HEAD)
 *
 * ```ts
 * import { KnowledgeDoctorMintOptions } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 *
 * const options = KnowledgeDoctorMintOptions.make({ at: "HEAD", baseRef: "origin/main", write: true })
 *
 * console.log(options.write) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorMintOptions extends S.Opaque<
  KnowledgeDoctorMintOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    at: S.String,
    baseRef: S.String,
    write: S.Boolean,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorMintOptions", {
      description: "Minted commit-ish, the base ref that must contain it, and whether the run writes the baseline.",
    })
  )
) {}

const mintWriteContext = Effect.fn("KnowledgeDoctor.mintWriteContext")(function* (
  repoRoot: string,
  commit: KnowledgeCommitSha,
  baseRef: string
) {
  const head = yield* resolveGitCommit(repoRoot, "HEAD", doctorGitAdapter("HEAD"));
  const base = yield* resolveGitCommit(repoRoot, baseRef, doctorGitAdapter(baseRef));
  const status = yield* runCapturedStreams({
    command: "git",
    args: ["status", "--porcelain", "--untracked-files=no"],
    cwd: repoRoot,
    extendEnv: true,
    trim: true,
  }).pipe(KnowledgeOperationalError.mapError("Failed to spawn git status --porcelain."));
  return KnowledgeMintWriteContext.make({
    baseRef,
    ci: yield* isCi,
    clean: status.exitCode === 0 && Str.isEmpty(status.stdout),
    commit,
    headIsMinted: head === commit,
    onBase: yield* isAncestorLive(repoRoot, base, commit),
  });
});

// The only writer of the sealed baseline: the CI mint, after every write condition holds and only
// when the mint changes the committed file.
const mintLive = Effect.fn("KnowledgeDoctor.mintLive")(function* (options: KnowledgeDoctorMintOptions) {
  const repoRoot = yield* findRepoRoot().pipe(
    KnowledgeOperationalError.mapError("Failed to locate the repository root for the knowledge doctor mint.")
  );
  const commit = yield* resolveGitCommit(repoRoot, options.at, doctorGitAdapter(options.at));
  if (options.write) {
    const reasons = knowledgeMintWriteRefusals(yield* mintWriteContext(repoRoot, commit, options.baseRef));
    if (A.isReadonlyArrayNonEmpty(reasons)) {
      return yield* KnowledgeMintContextRefusal.make({
        message: `knowledge doctor mint --write: ${A.length(reasons)} condition(s) unmet at ${commit}.`,
        reasons,
      });
    }
  }
  const outcome = yield* Effect.scoped(Effect.flatMap(mintInputAt(commit), mintKnowledgeBaselineText));
  if (options.write && outcome.changed) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs
      .writeFileString(path.join(repoRoot, KNOWLEDGE_DOCTOR_BASELINE_PATH), outcome.text)
      .pipe(KnowledgeOperationalError.mapError(`Failed to write ${KNOWLEDGE_DOCTOR_BASELINE_PATH}.`));
  }
  return outcome;
});

const ciModeLive = Effect.fn("KnowledgeDoctor.ciModeLive")(function* (baseRef: string) {
  const refs = yield* resolveDoctorRefs(baseRef);
  const adapter = doctorGitAdapter(refs.mergeBase);
  const changedPaths = yield* runGitPathList(
    refs.repoRoot,
    ["diff", "--name-only", "-z", refs.mergeBase, refs.head],
    adapter
  );
  const sealed = yield* runGitPathList(
    refs.repoRoot,
    ["ls-tree", "--name-only", "-z", refs.mergeBase, "--", KNOWLEDGE_DOCTOR_BASELINE_PATH],
    adapter
  );
  return decideKnowledgeDoctorCiMode(
    KnowledgeDoctorCiModeInput.make({ sealedAtBase: A.isReadonlyArrayNonEmpty(sealed), changedPaths })
  );
});

/**
 * Options of the lease listing.
 *
 * **Details**
 *
 * `baseRef` names the local ref whose merge-base CODEOWNERS and leases anchor the owner and `issued`
 * checks; `now` is the instant expiry is judged at.
 *
 * **Example** (List leases now)
 *
 * ```ts
 * import { KnowledgeDoctorLeasesOptions } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as DateTime from "effect/DateTime"
 *
 * const options = KnowledgeDoctorLeasesOptions.make({
 *   baseRef: "origin/main",
 *   now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 * })
 *
 * console.log(options.baseRef) // "origin/main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorLeasesOptions extends S.Opaque<
  KnowledgeDoctorLeasesOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    baseRef: S.String,
    now: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorLeasesOptions", {
      description: "Base ref and instant of one knowledge-doctor lease listing.",
    })
  )
) {}

const leasesLive = Effect.fn("KnowledgeDoctor.leasesLive")(function* (options: KnowledgeDoctorLeasesOptions) {
  const refs = yield* resolveDoctorRefs(options.baseRef);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const headTree = yield* materializeKnowledgeTree(refs.head);
      const head = yield* readKnowledgeSealFiles(headTree.oracle);
      const leases = O.match(head.leases, { onNone: A.empty<KnowledgeDebtLease>, onSome: (file) => file.leases });
      const base = A.isReadonlyArrayEmpty(leases)
        ? O.none<KnowledgeSealFiles>()
        : O.some(yield* readKnowledgeSealFiles((yield* materializeKnowledgeTree(refs.mergeBase)).oracle));
      const rows = yield* evaluateKnowledgeLeases(
        KnowledgeLeaseEvaluationInput.make({
          leases,
          baseLeases: pipe(
            base,
            O.flatMap((files) => files.leases),
            O.match({ onNone: A.empty<KnowledgeDebtLease>, onSome: (file) => file.leases })
          ),
          codeowners: O.flatMap(base, (files) => files.codeowners),
          now: options.now,
        })
      );
      return KnowledgeLeasesReport.make({ tree: refs.head, mergeBase: refs.mergeBase, now: options.now, leases: rows });
    })
  );
});

/**
 * The knowledge doctor's operations.
 *
 * **Details**
 *
 * `scanTree` is pure over an injected tree, which is what golden and counterfactual tests drive.
 * `report` materializes a commit-ish and scans it; it reads no baseline and writes nothing. `check`
 * is the gate: it scans HEAD, resolves the merge-base with `baseRef`, and classifies the scan against
 * the sealed baseline, leases, and the seal guard; it refuses while no baseline exists. `mint`
 * returns the baseline a commit seals to and writes nothing (the CI job writes it). `verifyMint`
 * re-mints the committed baseline at its `mintedAt` and byte-compares. `mintFile` is the only writer
 * of the sealed baseline: a dry run returns the outcome, and a write checks the CI context first and
 * writes only a changed file. `ciMode` decides whether the quality lane runs the read-only report or
 * the gate. `leases` evaluates the lease file without scanning the corpus.
 *
 * @see {@link KnowledgeDoctor} for the service tag.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeDoctorShape {
  readonly check: (
    options: KnowledgeDoctorCheckOptions
  ) => Effect.Effect<
    KnowledgeDoctorReport,
    KnowledgeOperationalError | KnowledgeDoctorInputError | KnowledgeCloneAttributesError
  >;
  readonly ciMode: (
    baseRef: string
  ) => Effect.Effect<KnowledgeDoctorCiMode, KnowledgeOperationalError | KnowledgeDoctorInputError>;
  readonly leases: (
    options: KnowledgeDoctorLeasesOptions
  ) => Effect.Effect<
    KnowledgeLeasesReport,
    KnowledgeOperationalError | KnowledgeDoctorInputError | KnowledgeCloneAttributesError
  >;
  readonly mint: (
    commit: string
  ) => Effect.Effect<
    KnowledgeDoctorBaseline,
    KnowledgeOperationalError | KnowledgeDoctorInputError | KnowledgeCloneAttributesError | KnowledgeMintRefusal
  >;
  readonly mintFile: (
    options: KnowledgeDoctorMintOptions
  ) => Effect.Effect<
    KnowledgeMintOutcome,
    | KnowledgeOperationalError
    | KnowledgeDoctorInputError
    | KnowledgeCloneAttributesError
    | KnowledgeMintRefusal
    | KnowledgeMintContextRefusal
  >;
  readonly report: (
    treeish: string
  ) => Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>;
  readonly scanTree: (
    tree: KnowledgeDoctorTree,
    evaluators?: ReadonlyArray<KnowledgeEvaluator>
  ) => Effect.Effect<KnowledgeDoctorReport, KnowledgeOperationalError>;
  readonly verifyMint: Effect.Effect<
    KnowledgeDoctorBaseline,
    | KnowledgeOperationalError
    | KnowledgeDoctorInputError
    | KnowledgeCloneAttributesError
    | KnowledgeMintRefusal
    | KnowledgeSealBroken
  >;
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
    check: Effect.fn("KnowledgeDoctor.check")((options) => checkLive(options).pipe(Effect.provide(runtime))),
    mint: Effect.fn("KnowledgeDoctor.mint")((commit) => Effect.scoped(mintAt(commit)).pipe(Effect.provide(runtime))),
    mintFile: Effect.fn("KnowledgeDoctor.mintFile")((options) => mintLive(options).pipe(Effect.provide(runtime))),
    ciMode: Effect.fn("KnowledgeDoctor.ciMode")((baseRef) => ciModeLive(baseRef).pipe(Effect.provide(runtime))),
    verifyMint: verifyMintLive.pipe(Effect.provide(runtime)),
    leases: Effect.fn("KnowledgeDoctor.leases")((options) => leasesLive(options).pipe(Effect.provide(runtime))),
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
