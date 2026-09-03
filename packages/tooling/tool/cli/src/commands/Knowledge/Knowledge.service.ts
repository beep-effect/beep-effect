/**
 * Injectable Stage-1 knowledge semantic-delta service and live paired-archive implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { sanitizeSensitiveText } from "@beep/observability";
import { findRepoRoot } from "@beep/repo-utils";
import { NonNegativeInt } from "@beep/schema";
import { Str } from "@beep/utils";
import { Context, Effect, FileSystem, HashSet, Layer, Match, MutableHashMap, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { extract as extractTar } from "tar";
import { OutputBound, runCapturedStreams } from "../../internal/process/StepExec.ts";
import {
  gitArchiveEnv,
  guardCloneLocalGitAttributes,
  readGitRenames,
  readGitTree,
  resolveGitCommit,
  resolveGitMergeBase,
  runGitLines,
  writeGitArchive,
} from "../../internal/repo-run/GitExec.ts";
import { EXPLORATION_ATLAS_PATH } from "../Explore/Atlas.ts";
import { PORTFOLIO_INDEX_PATH } from "../Goals/PortfolioIndex.ts";
import { KnowledgeCommandSurface } from "./Knowledge.command-surface.ts";
import {
  KNOWLEDGE_HISTORY_REMEDIATION,
  KnowledgeCloneAttributesError,
  KnowledgeOperationalError,
  KnowledgeProbeBootError,
} from "./Knowledge.errors.ts";
import {
  decodeKnowledgeUtf8,
  isKnowledgeArchivalPath,
  isKnowledgeCommandSpan,
  isKnowledgeScopedPath,
  KNOWLEDGE_SCANNER_SCOPE,
  knowledgeDocumentLines,
  knowledgeInlineSpans,
  knowledgeLengthPrefix,
  knowledgeLineMatches,
  knowledgeSha256Hex,
  normalizeKnowledgeRepoPath,
  scanKnowledgeRefsTree,
} from "./Knowledge.refs.ts";
import {
  KnowledgeCommandOccurrence,
  KnowledgeCommandResolved,
  KnowledgeCommandUnknown,
  KnowledgeFinding,
  KnowledgeFindingCandidate,
  KnowledgeFindingId,
  KnowledgeFindingLocation,
  KnowledgeIndexBytes,
  KnowledgeProbePolicy,
  KnowledgeRename,
  KnowledgeSemanticDeltaReport,
  KnowledgeTrackedEntry,
} from "./Knowledge.schemas.ts";
import type { Crypto } from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CapturedStreams } from "../../internal/process/StepExec.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
import type { KnowledgeStaticCommandTree } from "./Knowledge.command-surface.ts";
import type { KnowledgeInlineSpan, KnowledgeRefsReport, KnowledgeTreeOracle } from "./Knowledge.refs.ts";
import type { KnowledgeCommandProbeResult } from "./Knowledge.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.service");

/**
 * Everything the reference census may read from one Git tree.
 *
 * **Details**
 *
 * Re-exported here because the tree oracle is the census counterpart of {@link KnowledgeArchiveOracle}
 * and callers reach for both from one module. It is declared in `Knowledge.refs.ts`, which owns the
 * evaluator that consumes it, so the runtime dependency graph stays acyclic.
 *
 * @category services
 * @since 0.0.0
 */
export type { KnowledgeTreeOracle } from "./Knowledge.refs.ts";

const NORMALIZATION_VERSION = "knowledge-normalization/v1";
const FINDING_ID_PREFIX = "knowledge-finding/v1:";
const INDEX_PATH = PORTFOLIO_INDEX_PATH;
const DERIVED_PROJECTION_PATHS = HashSet.make(EXPLORATION_ATLAS_PATH, PORTFOLIO_INDEX_PATH);
const COMMAND_PREFIX = "bun run beep";
const COMMAND_INPUT_ROW_PREFIX = "command/v1";
const SEMANTIC_DELTA_DIGEST_FAILURE = "Failed to compute a semantic-delta SHA-256 digest.";
const PROBE_STREAM_MAX_CHARS = 1024 * 1024;
const PROBE_DIAGNOSTIC_MAX_CHARS = 2048;
const PROBE_STREAM_BOUND = OutputBound.make({
  maxChars: PROBE_STREAM_MAX_CHARS,
  truncatedNotice: "\n[probe stream truncated]",
});
const OSC_ESCAPE_PATTERN = /\u001B\][\s\S]*?(?:\u0007|\u001B\\)/gu;
const ANSI_ESCAPE_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/gu;
const OTHER_ESCAPE_PATTERN = /\u001B[@-Z\\-_]/gu;
const DISALLOWED_DIAGNOSTIC_CONTROL_PATTERN = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/gu;
const FORMAT_CHARACTER_PATTERN = /\p{Cf}/gu;
// Segments consume any non-delimiter character (mirroring WINDOWS_ABSOLUTE_PATH_PATTERN's negated
// class) so a path with non-ASCII, emoji, or punctuation segments is redacted whole instead of
// leaking its tail — a redactor must over-swallow, never under-swallow. Colon stays a delimiter so
// the trailing `:line(:col)` suffix keeps matching. The lookbehind blocks only Unicode word and
// slash adjacency, preserving URLs and path-like word suffixes while admitting punctuation as a
// diagnostic delimiter.
const POSIX_ABSOLUTE_PATH_PATTERN = /(?<![\p{L}\p{M}\p{N}\p{Pc}/])\/[^\s/"'`:]+(?:\/[^\s/"'`:]+)*(?::\d+(?::\d+)?)?/gu;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:\\(?:[^\\\s"'`]+\\)*[^\\\s"'`]+(?::\d+(?::\d+)?)?/gu;
const textEncoder = new TextEncoder();
const bytesEquivalent = S.toEquivalence(S.Uint8Array);
const decodeFindingId = S.decodeUnknownEffect(KnowledgeFindingId);

const replaceKnownProbeRoots = (
  input: string,
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string
): string =>
  A.reduce(
    A.make(
      [scratchRoot, "<probe-scratch>"] as const,
      [archiveRoot, "<archive-data>"] as const,
      [currentCheckoutRoot, "<current-checkout>"] as const
    ),
    input,
    (text, [root, replacement]) =>
      Str.isEmpty(root) || Str.equivalence(root, "/") ? text : Str.replaceAll(root, replacement)(text)
  );

const sanitizeProbeDiagnostic = (input: string, currentCheckoutRoot = "", archiveRoot = "", scratchRoot = ""): string =>
  pipe(
    replaceKnownProbeRoots(input, currentCheckoutRoot, archiveRoot, scratchRoot),
    Str.replace(/\r\n/gu, "\n"),
    Str.replace(/\r/gu, ""),
    Str.replace(OSC_ESCAPE_PATTERN, ""),
    Str.replace(ANSI_ESCAPE_PATTERN, ""),
    Str.replace(OTHER_ESCAPE_PATTERN, ""),
    Str.replace(DISALLOWED_DIAGNOSTIC_CONTROL_PATTERN, ""),
    Str.replace(FORMAT_CHARACTER_PATTERN, ""),
    Str.replace(POSIX_ABSOLUTE_PATH_PATTERN, "<absolute-path>"),
    Str.replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "<absolute-path>"),
    sanitizeSensitiveText,
    Str.truncate(PROBE_DIAGNOSTIC_MAX_CHARS)
  );

const sanitizePublicFindingText = (input: string): string =>
  pipe(sanitizeProbeDiagnostic(input), Str.replace(/\n+/gu, " "), Str.trim);

/**
 * Everything the scanner may read from one side of a comparison.
 *
 * **Details**
 *
 * The scanner never touches the filesystem directly: both the live paired-archive implementation and
 * the golden tests satisfy this shape, which is what keeps a golden fixture and a real archive
 * indistinguishable to the scanning logic.
 *
 * **Gotchas**
 *
 * Only current-checkout runtime probes may fail with {@link KnowledgeProbeBootError}, and only that
 * error is survivable: it reports that current code could not start against that oracle's archive
 * data, which the scanner treats as lost coverage on the base side and as an operational failure on
 * the HEAD side. Static command-surface derivation always fails the whole comparison closed.
 *
 * @see {@link KnowledgePairedOracleInput} for the two-sided input that carries rename lineage.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeArchiveOracle {
  readonly commandTree: Effect.Effect<KnowledgeStaticCommandTree, KnowledgeOperationalError>;
  readonly currentCommandTree: Effect.Effect<
    KnowledgeStaticCommandTree,
    KnowledgeOperationalError | KnowledgeProbeBootError
  >;
  readonly indexBytes: Effect.Effect<KnowledgeIndexBytes, KnowledgeOperationalError | KnowledgeProbeBootError>;
  readonly probeCommands: (
    commands: ReadonlyArray<ReadonlyArray<string>>
  ) => Effect.Effect<ReadonlyArray<KnowledgeCommandProbeResult>, KnowledgeOperationalError | KnowledgeProbeBootError>;
  readonly readBytes: (repoPath: string) => Effect.Effect<Uint8Array, KnowledgeOperationalError>;
  readonly trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>;
}

/**
 * The complete comparison boundary handed to the pure paired scanner.
 *
 * **Details**
 *
 * `renames` is what lets a moved document keep its base-side identity; without it every finding in a
 * renamed file would report as one resolved and one introduced pair. `gitRefNames` is one live,
 * immutable census for the whole comparison because branches and tags belong to the repository, not
 * either archived tree.
 *
 * **Gotchas**
 *
 * `probePolicy` is one value for the comparison rather than one per oracle on purpose. Probing only
 * the base would report every archive-data command and index finding as resolved, and probing only
 * HEAD would report every one of them as introduced. This is a request, not a guarantee: a base-data
 * probe that cannot boot downgrades the whole comparison, both sides at once.
 *
 * @see {@link KnowledgeArchiveOracle} for the per-side read surface this input pairs.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgePairedOracleInput {
  readonly base: KnowledgeArchiveOracle;
  readonly gitRefNames: HashSet.HashSet<string>;
  readonly head: KnowledgeArchiveOracle;
  readonly probePolicy: KnowledgeProbePolicy;
  readonly renames: ReadonlyArray<KnowledgeRename>;
}

/**
 * The two operations every knowledge semantic-delta implementation provides.
 *
 * **Details**
 *
 * `scanPair` takes an already-materialized comparison boundary and stays pure; `semanticDelta` builds
 * that boundary from local Git history for a base ref and then delegates to it. `refsTree` is the
 * single-tree read-only census: it shares the archive plumbing but compares nothing, so it gates
 * nothing either. Both tree-materializing operations refuse to archive while a non-empty
 * clone-local git attributes file is present, failing with {@link KnowledgeCloneAttributesError}
 * before any bytes are compared.
 *
 * @see {@link KnowledgeService} for the service tag that carries this shape.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeServiceShape {
  readonly refsTree: (
    treeish: string
  ) => Effect.Effect<KnowledgeRefsReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>;
  readonly scanPair: (
    input: KnowledgePairedOracleInput
  ) => Effect.Effect<KnowledgeSemanticDeltaReport, KnowledgeOperationalError>;
  readonly semanticDelta: (
    baseRef: string
  ) => Effect.Effect<KnowledgeSemanticDeltaReport, KnowledgeOperationalError | KnowledgeCloneAttributesError>;
}

/**
 * Service tag for knowledge semantic-delta operations.
 *
 * **Example** (Count introduced findings against the default base)
 *
 * ```ts
 * import { KnowledgeService } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * const introducedCount = Effect.gen(function* () {
 *   const knowledge = yield* KnowledgeService
 *   const report = yield* knowledge.semanticDelta("origin/main")
 *   return report.introduced.length
 * })
 *
 * console.log(Effect.isEffect(introducedCount)) // true
 * ```
 *
 * @see {@link KnowledgeServiceLive} for the live paired-archive layer that satisfies this tag.
 * @category services
 * @since 0.0.0
 */
export class KnowledgeService extends Context.Service<KnowledgeService, KnowledgeServiceShape>()(
  $I`KnowledgeService`
) {}

const nfc = Str.normalize("NFC");

const sha256 = (bytes: Uint8Array) => knowledgeSha256Hex(bytes, SEMANTIC_DELTA_DIGEST_FAILURE);

/**
 * Computes the ratified v1 finding identity from its exact length-prefixed preimage.
 *
 * **Details**
 *
 * The preimage concatenates the byte-length-prefixed normalization version, kind, NFC-normalized
 * document id, NFC-normalized subject, and occurrence index. Length prefixing is what makes the
 * digest injective, so two different field splits can never collide into the same identity. Display
 * location is deliberately absent: moving a finding inside a document must not change its identity.
 *
 * **Example** (Derive an identity for a broken-path finding)
 *
 * ```ts
 * import { makeKnowledgeFindingId } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * const findingId = makeKnowledgeFindingId(
 *   "broken-tracked-path",
 *   "base:CLAUDE.md",
 *   "repo-path:goals/missing.md",
 *   0
 * )
 *
 * console.log(Effect.isEffect(findingId)) // true
 * ```
 *
 * @param occurrence - Zero-based index among identical kind, document, and subject triples.
 * @category identifiers
 * @since 0.0.0
 */
export const makeKnowledgeFindingId = Effect.fn("Knowledge.makeFindingId")(function* (
  kind: KnowledgeFindingCandidate["kind"],
  documentId: string,
  subject: string,
  occurrence: number
) {
  const preimage = A.join(
    A.map([NORMALIZATION_VERSION, kind, nfc(documentId), nfc(subject), `${occurrence}`], knowledgeLengthPrefix),
    ""
  );
  const digest = yield* sha256(textEncoder.encode(preimage));
  return yield* decodeFindingId(`${FINDING_ID_PREFIX}${digest}`).pipe(
    KnowledgeOperationalError.mapError("Computed knowledge finding id failed schema validation.")
  );
});

// Stage-1 enforcement scans the census scope narrowed twice: Markdown only, and never below an
// archival directory segment.
const isScannerMarkdownPath = (repoPath: string): boolean =>
  Str.endsWith(".md")(repoPath) && isKnowledgeScopedPath(repoPath) && !isKnowledgeArchivalPath(repoPath);

const isRegularBlob = (entry: KnowledgeTrackedEntry): boolean => entry.mode === "100644" || entry.mode === "100755";

const trackedTreePathExists = (entries: ReadonlyArray<KnowledgeTrackedEntry>, repoPath: string): boolean => {
  const directoryPrefix = `${repoPath}/`;
  return A.some(entries, (entry) => entry.path === repoPath || Str.startsWith(directoryPrefix)(entry.path));
};

const knowledgePathExists = (entries: ReadonlyArray<KnowledgeTrackedEntry>, repoPath: string): boolean =>
  HashSet.has(DERIVED_PROJECTION_PATHS, repoPath) || trackedTreePathExists(entries, repoPath);

const decodeUtf8 = (bytes: Uint8Array, repoPath: string): Effect.Effect<string, KnowledgeOperationalError> =>
  decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked Markdown file "${repoPath}".`);

const documentIdForBase = (repoPath: string): string => nfc(`base:${repoPath}`);

const makeHeadDocumentId = (
  baseEntries: ReadonlyArray<KnowledgeTrackedEntry>,
  headEntry: KnowledgeTrackedEntry,
  renames: ReadonlyArray<KnowledgeRename>
): string => {
  const renameTarget = A.findFirst(renames, (rename) => rename.targetPath === headEntry.path);
  if (O.isSome(renameTarget)) {
    return nfc(`base:${renameTarget.value.sourcePath}`);
  }
  const renamedSources = HashSet.fromIterable(A.map(renames, (rename) => rename.sourcePath));
  const basePaths = HashSet.fromIterable(A.map(baseEntries, (entry) => entry.path));
  if (HashSet.has(basePaths, headEntry.path) && !HashSet.has(renamedSources, headEntry.path)) {
    return nfc(`base:${headEntry.path}`);
  }
  return nfc(
    HashSet.has(renamedSources, headEntry.path)
      ? `head-new:${headEntry.path}:${headEntry.objectId}`
      : `head-new:${headEntry.path}`
  );
};

const findingLocation = (path: string, line: number, column: number): KnowledgeFindingLocation =>
  KnowledgeFindingLocation.make({
    path: sanitizePublicFindingText(path),
    line: NonNegativeInt.make(line),
    column: NonNegativeInt.make(column),
  });

const missingPathCandidate = (
  documentId: string,
  documentPath: string,
  repoPath: string,
  line: number,
  column: number
): KnowledgeFindingCandidate =>
  KnowledgeFindingCandidate.make({
    kind: "broken-tracked-path",
    documentId,
    subject: nfc(`repo-path:${repoPath}`),
    location: findingLocation(documentPath, line, column),
    message: `Tracked path does not exist: ${repoPath}.`,
    remediation: "Update the inline path or add the tracked target.",
  });

const failedAssertionCandidate = (
  documentId: string,
  documentPath: string,
  repoPath: string,
  line: number,
  column: number
): KnowledgeFindingCandidate =>
  KnowledgeFindingCandidate.make({
    kind: "failed-assertion",
    documentId,
    subject: nfc(`path-exists:${repoPath}`),
    location: findingLocation(documentPath, line, column),
    message: `Path assertion failed: ${repoPath}.`,
    remediation: "Update the assertion or add the tracked target.",
  });

const commandWords = (span: string): ReadonlyArray<string> => {
  const tail = Str.trim(Str.slice(Str.length(COMMAND_PREFIX))(span));
  return Str.isEmpty(tail) ? A.empty<string>() : Str.split(/\s+/u)(tail);
};

/**
 * A tracked path that the paired archive does not contain, or `O.none()` when the spelling is fine.
 *
 * @param raw - Path spelling exactly as written inside the document.
 * @param documentPath - Containing document, which anchors `./` and `../` resolution.
 * @param entries - Tracked tree of the archive side currently being scanned.
 * @returns The normalized repository path when it is governed and absent from that tracked tree.
 */
const brokenPathAt = (
  raw: string,
  documentPath: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): O.Option<string> =>
  pipe(
    normalizeKnowledgeRepoPath(documentPath, raw),
    O.filter((repoPath) => !knowledgePathExists(entries, repoPath))
  );

const assertionCandidate = (
  match: RegExpExecArray,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): O.Option<KnowledgeFindingCandidate> => {
  const raw = match[1];
  if (!P.isString(raw)) {
    return O.none();
  }
  return O.map(brokenPathAt(raw, documentPath, entries), (repoPath) =>
    failedAssertionCandidate(documentId, documentPath, repoPath, lineNumber, match.index + 1)
  );
};

const commandOccurrence = (
  inline: KnowledgeInlineSpan,
  lineNumber: number,
  documentPath: string,
  documentId: string
): O.Option<KnowledgeCommandOccurrence> =>
  isKnowledgeCommandSpan(inline.span)
    ? O.some(
        KnowledgeCommandOccurrence.make({
          documentId,
          location: findingLocation(documentPath, lineNumber, inline.column),
          words: commandWords(inline.span),
        })
      )
    : O.none();

/**
 * A broken tracked-path candidate from one inline code span, unless Git proves the exact span is a
 * local branch, remote-tracking branch, or tag name.
 *
 * **Details**
 *
 * Ref exclusion compares the raw code span against the single live `git for-each-ref` census before
 * path normalization. It deliberately does not guess from branch-like spelling or surrounding
 * prose: an unproven `goals/...` or `packages/...` span remains governed as a repository path.
 *
 * @param inline - Parsed inline code span and its source column.
 * @param lineNumber - One-based source line containing the span.
 * @param documentPath - Repository-relative path of the scanned document.
 * @param documentId - Stable paired-document identity used by semantic delta.
 * @param entries - Tracked entries in the archive side being scanned.
 * @param gitRefNames - Exact branch and tag names collected once for the comparison.
 * @returns A finding candidate only when the span is a governed missing path rather than a command
 * or proven Git ref.
 */
const inlinePathCandidate = (
  inline: KnowledgeInlineSpan,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>,
  gitRefNames: HashSet.HashSet<string>
): O.Option<KnowledgeFindingCandidate> =>
  isKnowledgeCommandSpan(inline.span) || HashSet.has(gitRefNames, inline.span)
    ? O.none()
    : O.map(brokenPathAt(inline.span, documentPath, entries), (repoPath) =>
        missingPathCandidate(documentId, documentPath, repoPath, lineNumber, inline.column)
      );

const extractLineFindings = (
  lineText: string,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>,
  gitRefNames: HashSet.HashSet<string>
): readonly [ReadonlyArray<KnowledgeFindingCandidate>, ReadonlyArray<KnowledgeCommandOccurrence>] => {
  const assertions = knowledgeLineMatches(/<!-- beep:assert path-exists ([^\s]+) -->/gu, lineText);
  const inlines = knowledgeInlineSpans(lineText);
  const candidates = A.appendAll(
    A.getSomes(A.map(assertions, (match) => assertionCandidate(match, lineNumber, documentPath, documentId, entries))),
    A.getSomes(
      A.map(inlines, (inline) =>
        inlinePathCandidate(inline, lineNumber, documentPath, documentId, entries, gitRefNames)
      )
    )
  );
  const commands = A.getSomes(
    A.map(inlines, (inline) => commandOccurrence(inline, lineNumber, documentPath, documentId))
  );

  return [candidates, commands];
};

const extractDocument = Effect.fn("Knowledge.extractDocument")(function* (
  oracle: KnowledgeArchiveOracle,
  entry: KnowledgeTrackedEntry,
  documentId: string,
  gitRefNames: HashSet.HashSet<string>
) {
  const text = yield* oracle.readBytes(entry.path).pipe(Effect.flatMap((bytes) => decodeUtf8(bytes, entry.path)));
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();

  for (const line of knowledgeDocumentLines(text)) {
    if (!line.prose) {
      continue;
    }
    const extracted = extractLineFindings(
      line.text,
      line.number,
      entry.path,
      documentId,
      oracle.trackedEntries,
      gitRefNames
    );
    candidates = A.appendAll(candidates, extracted[0]);
    commands = A.appendAll(commands, extracted[1]);
  }

  return { candidates, commands };
});

const commandProbeResults = Effect.fn("Knowledge.commandProbeResults")(function* (
  oracle: KnowledgeArchiveOracle,
  occurrences: ReadonlyArray<KnowledgeCommandOccurrence>
) {
  const results = yield* oracle.probeCommands(A.map(occurrences, (occurrence) => occurrence.words));
  if (A.length(results) !== A.length(occurrences)) {
    return yield* KnowledgeOperationalError.make({
      message: "Current-checkout command probe returned a result count that did not match its archive-data inputs.",
    });
  }
  return results;
});

const staticCommandProbeResults = (
  tree: KnowledgeStaticCommandTree,
  occurrences: ReadonlyArray<KnowledgeCommandOccurrence>
): ReadonlyArray<KnowledgeCommandProbeResult> =>
  A.map(occurrences, (occurrence) => {
    const [status, canonicalPath] = KnowledgeCommandSurface.resolveStaticCommand(tree, occurrence.words);
    return status === "resolved"
      ? KnowledgeCommandResolved.make({ canonicalPath })
      : KnowledgeCommandUnknown.make({ canonicalPath });
  });

const commandCandidatesFromResults = Effect.fn("Knowledge.commandCandidatesFromResults")(function* (
  occurrences: ReadonlyArray<KnowledgeCommandOccurrence>,
  results: ReadonlyArray<KnowledgeCommandProbeResult>
) {
  if (A.length(results) !== A.length(occurrences)) {
    return yield* KnowledgeOperationalError.make({
      message: "Current-checkout command probe returned a result count that did not match its archive-data inputs.",
    });
  }
  let candidates = A.empty<KnowledgeFindingCandidate>();
  for (let index = 0; index < A.length(results); index += 1) {
    const result = results[index];
    const occurrence = occurrences[index];
    if (!P.isObject(result) || !P.isObject(occurrence) || result.status !== "unknown") {
      continue;
    }
    const canonical = A.join(result.canonicalPath, " ");
    candidates = A.append(
      candidates,
      KnowledgeFindingCandidate.make({
        kind: "unknown-beep-command",
        documentId: occurrence.documentId,
        subject: nfc(`beep-command:${canonical}`),
        location: occurrence.location,
        message: `Unknown beep command path: ${canonical}.`,
        remediation: "Update the inline command to one available in the current CLI command surface.",
      })
    );
  }
  return candidates;
});

const indexCandidate = Effect.fn("Knowledge.indexCandidate")(function* (
  oracle: KnowledgeArchiveOracle,
  documentId: string
) {
  if (!trackedTreePathExists(oracle.trackedEntries, INDEX_PATH)) {
    return O.none<KnowledgeFindingCandidate>();
  }
  const bytes = yield* oracle.indexBytes;
  if (bytesEquivalent(bytes.expected, bytes.archived)) {
    return O.none<KnowledgeFindingCandidate>();
  }
  const expectedDigest = yield* sha256(bytes.expected);
  const archivedDigest = yield* sha256(bytes.archived);
  return O.some(
    KnowledgeFindingCandidate.make({
      kind: "index-drift",
      documentId,
      subject: `producer://goals/index:${expectedDigest}:${archivedDigest}`,
      location: KnowledgeFindingLocation.make({ path: INDEX_PATH }),
      message: "goals/INDEX.md differs from the current-checkout projection of the archive data.",
      remediation: "Run `bun run beep goals index --write` and commit the regenerated index.",
    })
  );
});

const documentCandidatesForSide = Effect.fn("Knowledge.documentCandidatesForSide")(function* (
  oracle: KnowledgeArchiveOracle,
  documentId: (entry: KnowledgeTrackedEntry) => string,
  gitRefNames: HashSet.HashSet<string>
) {
  const documents = pipe(
    oracle.trackedEntries,
    A.filter((entry) => isRegularBlob(entry) && isScannerMarkdownPath(entry.path)),
    A.sort(Order.mapInput(Order.String, (entry: KnowledgeTrackedEntry) => entry.path))
  );
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();
  for (const entry of documents) {
    const extracted = yield* extractDocument(oracle, entry, documentId(entry), gitRefNames);
    candidates = A.appendAll(candidates, extracted.candidates);
    commands = A.appendAll(commands, extracted.commands);
  }
  return { candidates, commands };
});

/** The archive-data reads one side's probe substep needs once the tracked-tree pass has finished. */
interface KnowledgeProbeSideInput {
  readonly commands: ReadonlyArray<KnowledgeCommandOccurrence>;
  readonly indexDocumentId: string;
}

/** Probe-derived candidates for both sides, plus the policy and evidence the report must carry. */
interface KnowledgeProbeOutcome {
  readonly base: ReadonlyArray<KnowledgeFindingCandidate>;
  readonly detail: O.Option<string>;
  readonly head: ReadonlyArray<KnowledgeFindingCandidate>;
  readonly policy: KnowledgeProbePolicy;
}

const probeCandidatesForSide = Effect.fn("Knowledge.probeCandidatesForSide")(function* (
  oracle: KnowledgeArchiveOracle,
  side: KnowledgeProbeSideInput
) {
  // Derive provenance first so unsupported archive syntax always fails closed rather than hiding
  // behind a degradable runtime boot failure. The runtime result is intentionally discarded: it
  // preserves base-data boot/degradation semantics, while the static tree owns base attribution.
  const commandTree = yield* oracle.commandTree;
  yield* commandProbeResults(oracle, side.commands);
  const candidates = yield* commandCandidatesFromResults(
    side.commands,
    staticCommandProbeResults(commandTree, side.commands)
  );
  const index = yield* indexCandidate(oracle, side.indexDocumentId);
  return O.match(index, {
    onNone: () => candidates,
    onSome: (candidate) => A.append(candidates, candidate),
  });
});

const probeCandidatesForHead = Effect.fn("Knowledge.probeCandidatesForHead")(function* (
  oracle: KnowledgeArchiveOracle,
  baseCommands: ReadonlyArray<KnowledgeCommandOccurrence>,
  head: KnowledgeProbeSideInput
) {
  // The current checkout must successfully load every command needed by either revision while using
  // HEAD data before any merge-base-only failure may degrade coverage. Keep the raw base prefix in the
  // probe input, then discard its results: only HEAD occurrences may produce HEAD findings.
  const combinedOccurrences = A.appendAll(baseCommands, head.commands);
  const combinedResults = yield* commandProbeResults(oracle, combinedOccurrences);
  const headResults = A.drop(combinedResults, A.length(baseCommands));
  const candidates = yield* commandCandidatesFromResults(head.commands, headResults);
  const index = yield* indexCandidate(oracle, head.indexDocumentId);
  return O.match(index, {
    onNone: () => candidates,
    onSome: (candidate) => A.append(candidates, candidate),
  });
});

/**
 * Lines of a base boot failure carried into the report: the probe header plus the thrown error and
 * its runtime banner, which is everything needed to name the missing module without pasting a stack.
 */
const PROBE_BOOT_EXCERPT_LINES = 5;

const probeBootExcerpt = (error: KnowledgeProbeBootError): string =>
  pipe(
    error.message,
    sanitizeProbeDiagnostic,
    Str.split(/\r?\n/u),
    A.map(Str.trimEnd),
    A.filter(P.not(Str.isEmpty)),
    A.take(PROBE_BOOT_EXCERPT_LINES),
    A.join("\n")
  );

const skippedProbeOutcome = (policy: KnowledgeProbePolicy, detail: O.Option<string>): KnowledgeProbeOutcome => ({
  policy,
  detail,
  base: A.empty<KnowledgeFindingCandidate>(),
  head: A.empty<KnowledgeFindingCandidate>(),
});

const degradeToBaseBootFailure = (error: KnowledgeProbeBootError): Effect.Effect<KnowledgeProbeOutcome> =>
  Effect.succeed(
    skippedProbeOutcome(KnowledgeProbePolicy.Enum["skipped-base-boot-failure"], pipe(error, probeBootExcerpt, O.some))
  );

const probeBothSides = Effect.fn("Knowledge.probeBothSides")(function* (
  input: KnowledgePairedOracleInput,
  base: KnowledgeProbeSideInput,
  head: KnowledgeProbeSideInput
) {
  const [currentTree, headStaticTree] = yield* Effect.all([input.head.currentCommandTree, input.head.commandTree]).pipe(
    Effect.catchTag("KnowledgeProbeBootError", (error) =>
      Effect.fail(KnowledgeOperationalError.make({ message: sanitizeProbeDiagnostic(error.message) }))
    )
  );
  if (!KnowledgeCommandSurface.staticCommandNodeEquivalent(currentTree, headStaticTree)) {
    return yield* KnowledgeOperationalError.make({
      message: "Static command surface provenance does not match the current-checkout command tree.",
    });
  }
  // HEAD runs first because both sides execute the current checkout's code. Its command probe receives
  // the union of base and HEAD inputs, so a current-code defect in a base-only command fails as the
  // branch author's operational error before a base-data-only incompatibility may degrade coverage.
  const headCandidates = yield* probeCandidatesForHead(input.head, base.commands, head).pipe(
    Effect.catchTag("KnowledgeProbeBootError", (error) =>
      Effect.fail(KnowledgeOperationalError.make({ message: sanitizeProbeDiagnostic(error.message) }))
    )
  );
  const baseCandidates = yield* probeCandidatesForSide(input.base, base);
  return {
    policy: KnowledgeProbePolicy.Enum.enabled,
    detail: O.none<string>(),
    base: baseCandidates,
    head: headCandidates,
  } satisfies KnowledgeProbeOutcome;
});

const resolveProbeCandidates = Effect.fn("Knowledge.resolveProbeCandidates")(function* (
  input: KnowledgePairedOracleInput,
  base: KnowledgeProbeSideInput,
  head: KnowledgeProbeSideInput
) {
  // Both evaluators run current-checkout code against the selected revision's data. The existing
  // trust policy remains a defense-in-depth boundary: a skipped comparison stops here with only the
  // tracked-tree classes and performs no data-driven probe work at all.
  if (!KnowledgeProbePolicy.is.enabled(input.probePolicy)) {
    return skippedProbeOutcome(input.probePolicy, O.none());
  }
  return yield* probeBothSides(input, base, head).pipe(
    // Whatever base probe results were already collected are discarded with the policy: comparing a
    // probed base against an unprobed HEAD would report every probe-class finding as resolved.
    Effect.catchTag("KnowledgeProbeBootError", degradeToBaseBootFailure)
  );
});

const candidateGroupKey = (candidate: KnowledgeFindingCandidate): string =>
  A.join(A.map([candidate.kind, candidate.documentId, candidate.subject], knowledgeLengthPrefix), "");

const findingsFromCandidates = Effect.fn("Knowledge.findingsFromCandidates")(function* (
  candidates: ReadonlyArray<KnowledgeFindingCandidate>
) {
  const occurrences = MutableHashMap.empty<string, number>();
  let findings = A.empty<KnowledgeFinding>();
  for (const candidate of candidates) {
    const key = candidateGroupKey(candidate);
    const occurrence = pipe(
      MutableHashMap.get(occurrences, key),
      O.getOrElse(() => 0)
    );
    MutableHashMap.set(occurrences, key, occurrence + 1);
    const findingId = yield* makeKnowledgeFindingId(
      candidate.kind,
      candidate.documentId,
      candidate.subject,
      occurrence
    );
    findings = A.append(
      findings,
      KnowledgeFinding.make({
        findingId,
        kind: candidate.kind,
        severity: "blocking",
        documentId: sanitizePublicFindingText(candidate.documentId),
        subject: sanitizePublicFindingText(candidate.subject),
        occurrence: NonNegativeInt.make(occurrence),
        location: KnowledgeFindingLocation.make({
          ...candidate.location,
          path: sanitizePublicFindingText(candidate.location.path),
        }),
        message: sanitizePublicFindingText(candidate.message),
        remediation: sanitizePublicFindingText(candidate.remediation),
      })
    );
  }
  return findings;
});

const findingOrder = Order.mapInput(Order.String, (finding: KnowledgeFinding) => finding.findingId);

/**
 * Scans a pair of fully injected archive oracles and computes the sorted delta between them.
 *
 * **Details**
 *
 * Both sides are scanned independently into identity-bearing findings, then compared by
 * `findingId`: HEAD-only identities become `introduced`, base-only identities become `resolved`, and
 * shared identities become `unchanged`. Every bucket is sorted by identity, so the report is stable
 * across runs and safe to diff.
 *
 * **Gotchas**
 *
 * `input.probePolicy` is the requested policy, applied to both sides at once; the report carries the
 * policy that was actually achieved, which is weaker when the current-checkout probe failed to boot
 * against merge-base archive data. Either way a non-`enabled` report is still a well-formed delta, but
 * one whose empty buckets only cover the classes that need no executable probe.
 *
 * **Example** (Scan two empty archives)
 *
 * ```ts
 * import { KnowledgeIndexBytes } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { scanKnowledgePair } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect, HashSet } from "effect"
 * import type { KnowledgeArchiveOracle } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 *
 * const emptyArchive: KnowledgeArchiveOracle = {
 *   commandTree: Effect.die("unused under skipped policy"),
 *   currentCommandTree: Effect.die("unused under skipped policy"),
 *   indexBytes: Effect.succeed(
 *     KnowledgeIndexBytes.make({ expected: new Uint8Array(), archived: new Uint8Array() })
 *   ),
 *   probeCommands: () => Effect.succeed([]),
 *   readBytes: () => Effect.succeed(new Uint8Array()),
 *   trackedEntries: [],
 * }
 *
 * const report = scanKnowledgePair({
 *   base: emptyArchive,
 *   gitRefNames: HashSet.empty(),
 *   head: emptyArchive,
 *   probePolicy: "skipped-untrusted-context",
 *   renames: [],
 * })
 *
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @see {@link resolveKnowledgeProbePolicy} for how the live command decides that policy.
 * @category use-cases
 * @since 0.0.0
 */
export const scanKnowledgePair = Effect.fn("Knowledge.scanPair")(function* (input: KnowledgePairedOracleInput) {
  const baseDocuments = yield* documentCandidatesForSide(
    input.base,
    (entry) => documentIdForBase(entry.path),
    input.gitRefNames
  );
  const headIndexEntry = A.findFirst(input.head.trackedEntries, (entry) => entry.path === INDEX_PATH);
  const headIndexDocumentId = O.match(headIndexEntry, {
    onNone: () => `head-new:${INDEX_PATH}`,
    onSome: (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
  });
  const headDocuments = yield* documentCandidatesForSide(
    input.head,
    (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
    input.gitRefNames
  );
  const probe = yield* resolveProbeCandidates(
    input,
    { commands: baseDocuments.commands, indexDocumentId: documentIdForBase(INDEX_PATH) },
    { commands: headDocuments.commands, indexDocumentId: headIndexDocumentId }
  );
  const baseFindings = yield* findingsFromCandidates(A.appendAll(baseDocuments.candidates, probe.base));
  const headFindings = yield* findingsFromCandidates(A.appendAll(headDocuments.candidates, probe.head));
  const baseIds = HashSet.fromIterable(A.map(baseFindings, (finding) => finding.findingId));
  const headIds = HashSet.fromIterable(A.map(headFindings, (finding) => finding.findingId));
  return KnowledgeSemanticDeltaReport.make({
    introduced: A.sort(
      A.filter(headFindings, (finding) => !HashSet.has(baseIds, finding.findingId)),
      findingOrder
    ),
    resolved: A.sort(
      A.filter(baseFindings, (finding) => !HashSet.has(headIds, finding.findingId)),
      findingOrder
    ),
    unchanged: A.sort(
      A.filter(headFindings, (finding) => HashSet.has(baseIds, finding.findingId)),
      findingOrder
    ),
    probePolicy: probe.policy,
    probeSkipDetail: probe.detail,
  });
});

const historyGitAdapter = (baseRef: string): GitCommandErrorAdapter<KnowledgeOperationalError> => ({
  onSpawnFailure: (commandLine) =>
    KnowledgeOperationalError.new(
      `Failed to spawn ${commandLine} while resolving HEAD and base "${baseRef}". ${KNOWLEDGE_HISTORY_REMEDIATION}`
    ),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    KnowledgeOperationalError.make({
      message: `Cannot resolve semantic-delta history with ${commandLine} (exit ${exitCode}). ${KNOWLEDGE_HISTORY_REMEDIATION}${Str.isEmpty(output) ? "" : `\n${output}`}`,
    }),
  onTruncated: O.none(),
});

const treeGitAdapter = (treeish: string): GitCommandErrorAdapter<KnowledgeOperationalError> => ({
  onSpawnFailure: (commandLine) =>
    KnowledgeOperationalError.new(
      `Failed to spawn ${commandLine} while resolving census tree "${treeish}". ${KNOWLEDGE_HISTORY_REMEDIATION}`
    ),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    KnowledgeOperationalError.make({
      message: `Cannot resolve census tree "${treeish}" with ${commandLine} (exit ${exitCode}). ${KNOWLEDGE_HISTORY_REMEDIATION}${Str.isEmpty(output) ? "" : `\n${output}`}`,
    }),
  onTruncated: O.none(),
});

const gitAdapter: GitCommandErrorAdapter<KnowledgeOperationalError> = {
  onSpawnFailure: (commandLine) => KnowledgeOperationalError.new(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    KnowledgeOperationalError.make({
      message: `Knowledge archive Git command failed: ${commandLine} (exit ${exitCode}).${Str.isEmpty(output) ? "" : `\n${output}`}`,
    }),
  onTruncated: O.none(),
};

const GIT_LOCAL_REF_NAME_PATTERN = /^refs\/(?:heads|tags)\/(.+)$/u;
const GIT_REMOTE_REF_NAME_PATTERN = /^refs\/remotes\/([^/]+)\/(.+)$/u;

/**
 * Parses one full Git ref into the exact inline spellings that can otherwise resemble tracked paths.
 *
 * @param fullRef - Fully qualified ref name emitted by `git for-each-ref`.
 * @returns Branch or tag spellings used in prose when the namespace is supported.
 */
const gitRefSpanNames = (fullRef: string): ReadonlyArray<string> => {
  const localMatch = GIT_LOCAL_REF_NAME_PATTERN.exec(fullRef);
  const localName = localMatch?.[1];
  if (P.isString(localName)) {
    return [localName];
  }

  const remoteMatch = GIT_REMOTE_REF_NAME_PATTERN.exec(fullRef);
  const remoteName = remoteMatch?.[1];
  const branchName = remoteMatch?.[2];
  return P.isString(remoteName) && P.isString(branchName)
    ? [`${remoteName}/${branchName}`, branchName]
    : A.empty<string>();
};

/**
 * Parses a fully qualified Git ref into the exact prose spellings used by semantic-delta.
 *
 * **Details**
 *
 * Local branches and tags yield their unqualified name. Remote-tracking branches yield both the
 * conventional remote-qualified spelling and its branch-name suffix. Unsupported namespaces yield
 * an empty collection.
 *
 * **Example** (Parse a remote-tracking branch)
 *
 * ```ts
 * import { gitRefSpanNamesForTesting } from "@beep/repo-cli/test/Knowledge"
 *
 * console.log(gitRefSpanNamesForTesting("refs/remotes/origin/goals/example"))
 * // ["origin/goals/example", "goals/example"]
 * ```
 *
 * @param fullRef - Fully qualified ref name emitted by `git for-each-ref`.
 * @returns Exact local, tag, or remote-tracking spellings accepted by the ref exclusion.
 * @category testing
 * @since 0.0.0
 */
export const gitRefSpanNamesForTesting = gitRefSpanNames;

/** Collects local branch, remote-tracking branch, and tag names with one Git process per comparison. */
const readGitRefNames = Effect.fn("Knowledge.readGitRefNames")(function* (repoRoot: string) {
  const fullRefs = yield* runGitLines(
    repoRoot,
    ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes", "refs/tags"],
    gitAdapter
  );
  return HashSet.fromIterable(A.flatMap(fullRefs, gitRefSpanNames));
});

/**
 * Refuses to materialize archives while a non-empty clone-local git attributes file exists.
 *
 * **Details**
 *
 * A clone-local `info/attributes` file outranks every attribute layer the canonical archive
 * contract pins and no git invocation can disable it
 * (`goals/knowledge-surface-automation/research/p3-hermetic-lane-decisions.md`, "Measured
 * residual"), so both tree-materializing entry points run this guard before writing any archive.
 * An absent or empty file passes; a non-empty file fails with
 * {@link KnowledgeCloneAttributesError}; a stat failure other than not-found fails closed as
 * {@link KnowledgeOperationalError}.
 *
 * **Example** (Guard a repository root before archiving)
 *
 * ```ts
 * import { guardKnowledgeCloneAttributes } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(guardKnowledgeCloneAttributes("/repo"))) // true
 * ```
 *
 * @param repoRoot - Repository root whose clone-local attributes file is checked.
 * @returns Void when archiving may proceed; a typed failure otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const guardKnowledgeCloneAttributes = (
  repoRoot: string
): Effect.Effect<
  void,
  KnowledgeOperationalError | KnowledgeCloneAttributesError,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  guardCloneLocalGitAttributes(repoRoot, gitAdapter, KnowledgeCloneAttributesError.at, (attributesPath) =>
    KnowledgeOperationalError.new(`Failed to stat clone-local git attributes "${attributesPath}".`)
  );

const ROOT_COMMAND_MODULE = "packages/tooling/tool/cli/src/commands/Root.ts";
const PORTFOLIO_INDEX_MODULE = "packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts";

/**
 * Command-probe program text, bound to the executing checkout's command module.
 *
 * The probe module and its input live in the scratch root, never in the archive, so a scanned revision
 * cannot redirect either file. The command implementation is also loaded from the checkout already
 * executing the semantic-delta command. The archive is only the child process's working directory and
 * therefore contributes data, never executable modules.
 *
 * @param rootCommandModule - Absolute path of the current-checkout root command module.
 * @param inputPath - Absolute path of the tab-delimited command input file.
 * @returns Probe source ready to write into the scratch root.
 */
const commandProbeSource = (rootCommandModule: string, inputPath: string): string => `
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Effect, Result } from "effect"
import { Command } from "effect/unstable/cli"
import { rootCommand } from ${JSON.stringify(rootCommandModule)}

const input = await Bun.file(${JSON.stringify(inputPath)}).text()
// This file is scratch-owned. Its writer prepends one structural field to every row, making an empty
// file zero commands and a prefix-only row the root command without trusting archive data.
const commands = input === "" ? [] : input.split("\\n").map((line) => {
  const [, ...words] = line.split("\\t")
  return words
})
const children = (command) => command.subcommands.flatMap((group) => group.commands)
const resolve = (words) => {
  let command = rootCommand
  const canonical = []
  for (const word of words) {
    const available = children(command)
    if (available.length === 0 || word.startsWith("-")) break
    const child = available.find((candidate) => candidate.name === word || candidate.alias === word)
    if (child === undefined) return { status: "unknown", canonicalPath: [...canonical, word] }
    canonical.push(child.name)
    command = child
  }
  return { status: "resolved", canonicalPath: canonical }
}
const silent = Object.assign(Object.create(console), { log: () => {}, error: () => {} })
const program = Effect.gen(function*() {
  const results = []
  for (const words of commands) {
    const result = resolve(words)
    if (result.status === "resolved") {
      const help = yield* Effect.result(
        Command.runWith(rootCommand, { version: "0.0.0" })([...result.canonicalPath, "--help"]).pipe(
          Effect.provideService(Console.Console, silent)
        )
      )
      if (Result.isFailure(help) && help.failure?._tag !== "ShowHelp") yield* Effect.fail(help.failure)
    }
    results.push([result.status, ...result.canonicalPath].join("\\t"))
  }
  process.stdout.write(results.join("\\n"))
})
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
`;

/**
 * Index-probe program text, bound to the executing checkout's index builder.
 *
 * The projection still runs with the archive root as its working directory, so `"."` resolves to the
 * archive data. The module specifier and probe file are absolute paths outside the archive, preventing
 * an archived `PortfolioIndex.ts` (or one of its archived dependencies) from entering the module graph.
 *
 * @param portfolioIndexModule - Absolute path of the current-checkout portfolio index module.
 * @returns Probe source ready to write into the scratch root.
 */
const indexProbeSource = (portfolioIndexModule: string): string => `
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Effect } from "effect"
import { buildPortfolioIndexContent } from ${JSON.stringify(portfolioIndexModule)}
const program = Effect.flatMap(buildPortfolioIndexContent("."), (content) => Effect.sync(() => process.stdout.write(content)))
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
`;

const makeHermeticEnv = Effect.fn("Knowledge.makeHermeticEnv")(function* (scratchRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const envRoot = path.join(scratchRoot, "env");
  const directories = {
    HOME: path.join(envRoot, "home"),
    XDG_CONFIG_HOME: path.join(envRoot, "config"),
    XDG_CACHE_HOME: path.join(envRoot, "cache"),
    XDG_DATA_HOME: path.join(envRoot, "data"),
    XDG_STATE_HOME: path.join(envRoot, "state"),
    XDG_RUNTIME_DIR: path.join(envRoot, "runtime"),
    TMPDIR: path.join(envRoot, "tmp"),
  };
  for (const directory of R.values(directories)) {
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(KnowledgeOperationalError.mapError(`Failed to create hermetic process directory "${directory}".`));
  }
  return {
    ...directories,
    ...gitArchiveEnv,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
});

const probeStreamSection = (
  label: string,
  output: string,
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string
): O.Option<string> =>
  pipe(
    sanitizeProbeDiagnostic(output, currentCheckoutRoot, archiveRoot, scratchRoot),
    O.liftPredicate(Str.isNonEmpty),
    O.map((detail) => `${label}:\n${detail}`)
  );

const renderProbeStreams = (
  result: CapturedStreams,
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string
): string => {
  const sections = A.getSomes(
    A.make(
      probeStreamSection("stdout", result.stdout, currentCheckoutRoot, archiveRoot, scratchRoot),
      probeStreamSection("stderr", result.stderr, currentCheckoutRoot, archiveRoot, scratchRoot)
    )
  );
  return A.join(result.truncated ? A.append(sections, "capture: truncated") : sections, "\n");
};

const runArchiveProcess = Effect.fn("Knowledge.runArchiveProcess")(function* (
  probeLabel: string,
  runtimeExecutable: string,
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string,
  env: Readonly<Record<string, string>>,
  scriptPath: string,
  bunfigPath: string,
  tsconfigPath: string,
  envFilePath: string
) {
  const result = yield* runCapturedStreams({
    command: runtimeExecutable,
    args: [
      `--config=${bunfigPath}`,
      `--tsconfig-override=${tsconfigPath}`,
      "--no-env-file",
      `--env-file=${envFilePath}`,
      scriptPath,
    ],
    cwd: archiveRoot,
    env,
    extendEnv: false,
    bound: PROBE_STREAM_BOUND,
  }).pipe(
    KnowledgeOperationalError.mapError(`Failed to spawn current-checkout ${probeLabel} probe against archive data.`)
  );
  // The probe writes its structured output in one final call, so a non-zero exit means it never got
  // there: the current-checkout probe failed to load or the projection itself failed.
  if (result.exitCode !== 0) {
    const output = renderProbeStreams(result, currentCheckoutRoot, archiveRoot, scratchRoot);
    return yield* KnowledgeProbeBootError.make({
      message: `Current-checkout ${probeLabel} probe against archive data failed with exit ${result.exitCode}.${Str.isEmpty(output) ? "" : `\n${output}`}`,
    });
  }
  if (result.truncated) {
    const output = renderProbeStreams(result, currentCheckoutRoot, archiveRoot, scratchRoot);
    return yield* KnowledgeOperationalError.make({
      message: `Current-checkout ${probeLabel} probe emitted more than ${PROBE_STREAM_MAX_CHARS} characters for archive data; refusing to parse truncated structured output.${Str.isEmpty(output) ? "" : `\n${output}`}`,
    });
  }
  return result;
});

const commandProbeResultFromLine = (line: string): O.Option<KnowledgeCommandProbeResult> => {
  const fields = Str.split("\t")(line);
  const canonicalPath = A.drop(fields, 1);
  return O.flatMap(A.head(fields), (status) =>
    Match.value(status).pipe(
      Match.when("resolved", () => O.some(KnowledgeCommandResolved.make({ canonicalPath }))),
      Match.when("unknown", () => O.some(KnowledgeCommandUnknown.make({ canonicalPath }))),
      Match.orElse(O.none<KnowledgeCommandProbeResult>)
    )
  );
};

const decodeCommandProbeOutput = (
  result: CapturedStreams,
  expectedCount: number,
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string
): Effect.Effect<ReadonlyArray<KnowledgeCommandProbeResult>, KnowledgeOperationalError> => {
  const lines = Str.isEmpty(result.stdout) ? A.empty<string>() : Str.split(/\r?\n/u)(result.stdout);
  const actualCount = A.length(lines);
  const diagnostic = renderProbeStreams(result, currentCheckoutRoot, archiveRoot, scratchRoot);
  if (A.length(lines) !== expectedCount) {
    return KnowledgeOperationalError.make({
      message: `Current-checkout command probe emitted malformed output for archive data: expected ${expectedCount} line(s), received ${actualCount}.${Str.isEmpty(diagnostic) ? "" : `\n${diagnostic}`}`,
    });
  }
  return O.match(O.all(A.map(lines, commandProbeResultFromLine)), {
    onNone: () =>
      KnowledgeOperationalError.make({
        message: `Current-checkout command probe emitted an unknown status for archive data: expected ${expectedCount} recognized line(s), received ${actualCount}.${Str.isEmpty(diagnostic) ? "" : `\n${diagnostic}`}`,
      }),
    onSome: Effect.succeed,
  });
};

/**
 * Builds one archive-backed semantic-delta oracle without executing code from the archive.
 *
 * **Details**
 *
 * Probe programs import their command and index implementations from `currentCheckoutRoot`. They run
 * with `archiveRoot` as their working directory so those current implementations still inspect the
 * selected revision's data. A scratch-owned Bun config, TypeScript config, dependency link, and input
 * file prevent an archived config or module-resolution rule from injecting archive code before the
 * probe starts.
 *
 * **Gotchas**
 *
 * `archiveRoot` is intentionally a data boundary, not a code root. Do not place probe scripts,
 * dependency links, runtime configuration, or module specifiers beneath it.
 *
 * **Example** (Construct an archive-data oracle)
 *
 * ```ts
 * import { makeKnowledgeArchiveOracle } from "@beep/repo-cli/test/Knowledge"
 *
 * const program = makeKnowledgeArchiveOracle("/repo", "/tmp/archive", "/tmp/scratch", [])
 * console.log(program)
 * ```
 *
 * @internal
 * @param currentCheckoutRoot - Repository root containing the CLI code already executing this scan.
 * @param archiveRoot - Extracted revision used only as the probe working directory and data source.
 * @param scratchRoot - Isolated directory for generated programs, inputs, and runtime configuration.
 * @param trackedEntries - Git-tree entries belonging to the extracted revision.
 * @param runtimeExecutable - Bun executable running the generated probe; defaults to this process.
 * @returns An archive oracle whose executable module graph comes from the current checkout.
 * @category use-cases
 * @since 0.0.0
 */
export const makeKnowledgeArchiveOracle = Effect.fn("Knowledge.makeArchiveOracle")(function* (
  currentCheckoutRoot: string,
  archiveRoot: string,
  scratchRoot: string,
  trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>,
  runtimeExecutable = process.execPath
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>();
  yield* fs
    .makeDirectory(scratchRoot, { recursive: true })
    .pipe(KnowledgeOperationalError.mapError("Failed to create an archive scratch root."));
  const env = yield* makeHermeticEnv(scratchRoot);
  const bunfigPath = path.join(scratchRoot, "bunfig.toml");
  const tsconfigPath = path.join(scratchRoot, "tsconfig.json");
  const envFilePath = path.resolve(scratchRoot, "empty.env");
  yield* fs
    .writeFileString(bunfigPath, "# Semantic-delta probes intentionally ignore archive-local Bun configuration.\n")
    .pipe(KnowledgeOperationalError.mapError("Failed to write the semantic-delta Bun configuration."));
  yield* fs
    .writeFileString(tsconfigPath, "{}\n")
    .pipe(KnowledgeOperationalError.mapError("Failed to write the semantic-delta TypeScript configuration."));
  yield* fs
    .writeFileString(envFilePath, "")
    .pipe(KnowledgeOperationalError.mapError("Failed to write the semantic-delta empty environment file."));
  yield* fs
    .symlink(path.join(currentCheckoutRoot, "node_modules"), path.join(scratchRoot, "node_modules"))
    .pipe(KnowledgeOperationalError.mapError("Failed to link installed dependencies into an archive scratch root."));
  const readBytes = Effect.fn("Knowledge.archiveReadBytes")(function* (repoPath: string) {
    return yield* fs
      .readFile(path.join(archiveRoot, repoPath))
      .pipe(KnowledgeOperationalError.mapError(`Failed to read archived tracked file "${repoPath}".`));
  });

  const probeCommands = Effect.fn("Knowledge.archiveProbeCommands")(function* (
    commands: ReadonlyArray<ReadonlyArray<string>>
  ) {
    const inputPath = path.join(scratchRoot, "command-input");
    const scriptPath = path.join(scratchRoot, "command-probe.ts");
    yield* fs
      .writeFileString(
        inputPath,
        A.join(
          A.map(commands, (words) => A.join(A.prepend(words, COMMAND_INPUT_ROW_PREFIX), "\t")),
          "\n"
        )
      )
      .pipe(KnowledgeOperationalError.mapError("Failed to write current-checkout command probe input."));
    yield* fs
      .writeFileString(scriptPath, commandProbeSource(path.join(currentCheckoutRoot, ROOT_COMMAND_MODULE), inputPath))
      .pipe(KnowledgeOperationalError.mapError("Failed to write current-checkout command probe."));
    const result = yield* runArchiveProcess(
      "command",
      runtimeExecutable,
      currentCheckoutRoot,
      archiveRoot,
      scratchRoot,
      env,
      scriptPath,
      bunfigPath,
      tsconfigPath,
      envFilePath
    );
    return yield* decodeCommandProbeOutput(result, A.length(commands), currentCheckoutRoot, archiveRoot, scratchRoot);
  });

  const currentCommandTree = Effect.gen(function* () {
    const scriptPath = path.join(scratchRoot, "command-tree-probe.ts");
    yield* fs
      .writeFileString(
        scriptPath,
        KnowledgeCommandSurface.commandTreeProbeSource(path.join(currentCheckoutRoot, ROOT_COMMAND_MODULE))
      )
      .pipe(KnowledgeOperationalError.mapError("Failed to write current-checkout command tree probe."));
    const result = yield* runArchiveProcess(
      "command tree",
      runtimeExecutable,
      currentCheckoutRoot,
      archiveRoot,
      scratchRoot,
      env,
      scriptPath,
      bunfigPath,
      tsconfigPath,
      envFilePath
    );
    return yield* KnowledgeCommandSurface.decodeCurrentCommandTree(result.stdout);
  }).pipe(Effect.provide(runtime));

  const indexBytes = Effect.gen(function* () {
    const scriptPath = path.join(scratchRoot, "index-probe.ts");
    yield* fs
      .writeFileString(scriptPath, indexProbeSource(path.join(currentCheckoutRoot, PORTFOLIO_INDEX_MODULE)))
      .pipe(KnowledgeOperationalError.mapError("Failed to write current-checkout index probe."));
    const result = yield* runArchiveProcess(
      "index",
      runtimeExecutable,
      currentCheckoutRoot,
      archiveRoot,
      scratchRoot,
      env,
      scriptPath,
      bunfigPath,
      tsconfigPath,
      envFilePath
    );
    const expected = textEncoder.encode(result.stdout);
    const archived = trackedTreePathExists(trackedEntries, INDEX_PATH)
      ? yield* readBytes(INDEX_PATH)
      : new Uint8Array();
    return KnowledgeIndexBytes.make({ expected, archived });
  }).pipe(Effect.provide(runtime));

  return {
    commandTree: KnowledgeCommandSurface.buildStaticCommandTree(archiveRoot).pipe(Effect.provide(runtime)),
    currentCommandTree,
    trackedEntries,
    readBytes: (repoPath: string) => readBytes(repoPath).pipe(Effect.provide(runtime)),
    probeCommands: (commands: ReadonlyArray<ReadonlyArray<string>>) =>
      probeCommands(commands).pipe(Effect.provide(runtime)),
    indexBytes,
  } satisfies KnowledgeArchiveOracle;
});

const READABLE_ARCHIVE_ENTRY_TYPES = HashSet.make("File", "Directory");

/**
 * Materializes only the entry types the scan reads, so a hostile revision cannot aim extraction
 * anywhere.
 *
 * Regular files carry every scanned document and archive-data input; directories carry their
 * structure. Probe modules come exclusively from the current checkout. Links are dropped: the
 * tracked-path oracle already comes from `git ls-tree` rather than the extracted tree, documents whose
 * blob is a link are filtered out by mode before they are ever read, and a link entry in an untrusted
 * archive is the classic primitive for redirecting a later read or write out of the archive root.
 * Dropping them also keeps `strict` extraction meaningful — a repository that tracks a link through
 * another link would otherwise abort the whole scan on an entry nothing reads.
 *
 * The argument is read structurally because the library shares this filter signature with archive
 * creation, where the second parameter is a stat result carrying no entry type at all. Extraction
 * always supplies an entry; anything without a readable type is filtered out rather than admitted.
 *
 * @param _path - Archive-relative entry path, unused: the decision is by entry type alone.
 * @param entry - Tar entry offered for extraction, read structurally for its type name.
 * @returns True only for regular files and directories.
 */
const isReadableArchiveEntry = (_path: string, entry: unknown): boolean =>
  P.hasProperty(entry, "type") && P.isString(entry.type) && HashSet.has(READABLE_ARCHIVE_ENTRY_TYPES, entry.type);

const extractArchive = Effect.fn("Knowledge.extractArchive")(function* (archivePath: string, archiveRoot: string) {
  yield* Effect.tryPromise({
    try: () =>
      extractTar({
        file: archivePath,
        cwd: archiveRoot,
        strict: true,
        preservePaths: false,
        unlink: true,
        filter: isReadableArchiveEntry,
      }),
    catch: KnowledgeOperationalError.new(`Failed to safely extract Git archive "${archivePath}".`),
  });
});

/** GitHub Actions events whose checked-out revision can come from a repository we do not control. */
const PULL_REQUEST_EVENT_NAMES = HashSet.make("pull_request", "pull_request_target");

const GithubPullRequestEvent = S.Struct({
  pull_request: S.Struct({
    head: S.Struct({
      repo: S.NullishOr(S.Struct({ full_name: S.String })),
    }),
  }),
});

const decodeGithubPullRequestEvent = S.decodeUnknownEffect(S.fromJsonString(GithubPullRequestEvent));

/**
 * Full name of the repository the pull-request head branch lives in, when the event payload names one.
 *
 * @param eventPath - Value of `GITHUB_EVENT_PATH`, pointing at the runner's event payload file.
 * @returns The `owner/name` of the head repository, or `O.none()` when it cannot be read or decoded.
 */
const readHeadRepository = Effect.fn("Knowledge.readHeadRepository")(function* (eventPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const event = yield* fs.readFileString(eventPath).pipe(Effect.flatMap(decodeGithubPullRequestEvent), Effect.option);
  return O.flatMap(event, (payload) => O.fromNullishOr(payload.pull_request.head.repo)).pipe(
    O.map((repo) => Str.toLowerCase(repo.full_name))
  );
});

/**
 * Decides whether this invocation may run current-checkout `--help` and index probes on archive data.
 *
 * **Details**
 *
 * Probing runs code from the checkout already executing this command and supplies the selected
 * revision only as filesystem data. Locally, on `push`, and on a same-repo pull request, probes run.
 * On a pull request whose head branch lives in another repository — a fork of this public repository
 * — the probe substep remains skipped as defense in depth against data-driven behavior, and the
 * comparison degrades to the classes the tracked-tree oracle decides on its own.
 *
 * **Gotchas**
 *
 * Any pull-request event whose head repository cannot be established resolves to
 * `skipped-untrusted-context`: an unreadable or unexpected event payload must not be able to buy
 * execution. Because the decision keys on `GITHUB_EVENT_NAME` alone, exporting it locally reproduces a
 * fork run exactly.
 *
 * **Example** (A push build probes; a fork pull request does not)
 *
 * ```ts
 * import { resolveKnowledgeProbePolicy } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * const policy = resolveKnowledgeProbePolicy({ GITHUB_EVENT_NAME: "push" })
 *
 * console.log(Effect.isEffect(policy)) // true
 * ```
 *
 * @param env - Process environment to read the GitHub Actions context from.
 * @returns `"enabled"` when the scanned revision is ours, `"skipped-untrusted-context"` otherwise.
 * @see {@link KnowledgeProbePolicy} for what a skipped comparison stops checking.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveKnowledgeProbePolicy = Effect.fn("Knowledge.resolveProbePolicy")(function* (
  env: Readonly<Record<string, string | undefined>>
) {
  const read = (name: string): O.Option<string> => O.flatMap(R.get(env, name), O.fromNullishOr);
  if (!O.exists(read("GITHUB_EVENT_NAME"), (name) => HashSet.has(PULL_REQUEST_EVENT_NAMES, name))) {
    return KnowledgeProbePolicy.Enum.enabled;
  }
  const baseRepository = O.map(read("GITHUB_REPOSITORY"), Str.toLowerCase);
  const headRepository = yield* O.match(read("GITHUB_EVENT_PATH"), {
    onNone: () => Effect.succeedNone,
    onSome: readHeadRepository,
  });
  return O.isSome(baseRepository) && O.contains(headRepository, baseRepository.value)
    ? KnowledgeProbePolicy.Enum.enabled
    : KnowledgeProbePolicy.Enum["skipped-untrusted-context"];
});

const semanticDeltaLive = Effect.fn("Knowledge.semanticDelta")(function* (baseRef: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    KnowledgeOperationalError.mapError("Failed to locate the repository root for semantic-delta.")
  );
  yield* guardKnowledgeCloneAttributes(repoRoot);
  const gitRefNames = yield* readGitRefNames(repoRoot);
  const historyAdapter = historyGitAdapter(baseRef);
  const headCommit = yield* resolveGitCommit(repoRoot, "HEAD", historyAdapter);
  const baseCommit = yield* resolveGitMergeBase(repoRoot, baseRef, headCommit, historyAdapter);
  const probePolicy = yield* resolveKnowledgeProbePolicy(process.env);

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const tempRoot = yield* fs
        .makeTempDirectoryScoped({ prefix: "beep-knowledge-semantic-delta-" })
        .pipe(KnowledgeOperationalError.mapError("Failed to create semantic-delta temporary roots."));
      const baseRoot = path.join(tempRoot, "base");
      const headRoot = path.join(tempRoot, "head");
      const baseArchive = path.join(tempRoot, "base.tar");
      const headArchive = path.join(tempRoot, "head.tar");
      yield* fs
        .makeDirectory(baseRoot)
        .pipe(KnowledgeOperationalError.mapError("Failed to create the base archive root."));
      yield* fs
        .makeDirectory(headRoot)
        .pipe(KnowledgeOperationalError.mapError("Failed to create the HEAD archive root."));
      yield* writeGitArchive(repoRoot, baseCommit, baseArchive, gitAdapter);
      yield* writeGitArchive(repoRoot, headCommit, headArchive, gitAdapter);
      yield* extractArchive(baseArchive, baseRoot);
      yield* extractArchive(headArchive, headRoot);

      const baseTree = yield* readGitTree(repoRoot, baseCommit, gitAdapter, () =>
        KnowledgeOperationalError.make({ message: "Malformed NUL-delimited base ls-tree output." })
      );
      const headTree = yield* readGitTree(repoRoot, headCommit, gitAdapter, () =>
        KnowledgeOperationalError.make({ message: "Malformed NUL-delimited HEAD ls-tree output." })
      );
      const gitRenames = yield* readGitRenames(
        repoRoot,
        baseCommit,
        headCommit,
        KNOWLEDGE_SCANNER_SCOPE,
        gitAdapter,
        () => KnowledgeOperationalError.make({ message: "Malformed NUL-delimited rename-table output." })
      );
      const baseEntries = A.map(baseTree, (entry) =>
        KnowledgeTrackedEntry.make({ path: entry.path, mode: entry.mode, objectId: entry.objectId })
      );
      const headEntries = A.map(headTree, (entry) =>
        KnowledgeTrackedEntry.make({ path: entry.path, mode: entry.mode, objectId: entry.objectId })
      );
      const renames = A.map(gitRenames, (rename) =>
        KnowledgeRename.make({
          sourcePath: rename.sourcePath,
          targetPath: rename.targetPath,
          score: rename.score,
        })
      );
      const base = yield* makeKnowledgeArchiveOracle(
        repoRoot,
        baseRoot,
        path.join(tempRoot, "base-scratch"),
        baseEntries
      );
      const head = yield* makeKnowledgeArchiveOracle(
        repoRoot,
        headRoot,
        path.join(tempRoot, "head-scratch"),
        headEntries
      );
      return yield* scanKnowledgePair({ base, gitRefNames, head, probePolicy, renames });
    })
  );
});

/**
 * Materializes one commit-ish as an injectable census oracle, scoped to a temporary archive root.
 *
 * **Details**
 *
 * The tree-ish is resolved to a verified commit, archived, and extracted, and the tracked-entry
 * oracle is read from `git ls-tree` rather than from the extracted tree. That separation is what
 * keeps the census honest: extraction drops links and other non-readable entry types, while the
 * entry list still reports every tracked mode so symlinks and gitlinks can be recorded as skipped.
 *
 * **Gotchas**
 *
 * The archive root lives inside a scoped temporary directory, so the returned oracle is only valid
 * inside the `Effect.scoped` region that built it. Reading through it afterwards fails on a missing
 * file rather than returning stale bytes.
 *
 * **Example** (Build a census oracle for the working commit)
 *
 * ```ts
 * import { makeKnowledgeTreeOracle } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.scoped(makeKnowledgeTreeOracle("HEAD")))) // true
 * ```
 *
 * @param treeish - Any commit-ish; no fetch ever occurs.
 * @returns The tree oracle the census evaluator scans.
 * @category use-cases
 * @since 0.0.0
 */
export const makeKnowledgeTreeOracle = Effect.fn("Knowledge.makeTreeOracle")(function* (treeish: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
  const repoRoot = yield* findRepoRoot().pipe(
    KnowledgeOperationalError.mapError("Failed to locate the repository root for the reference census.")
  );
  yield* guardKnowledgeCloneAttributes(repoRoot);
  const commit = yield* resolveGitCommit(repoRoot, treeish, treeGitAdapter(treeish));
  const tempRoot = yield* fs
    .makeTempDirectoryScoped({ prefix: "beep-knowledge-refs-" })
    .pipe(KnowledgeOperationalError.mapError("Failed to create a reference-census temporary root."));
  const archiveRoot = path.join(tempRoot, "tree");
  const archivePath = path.join(tempRoot, "tree.tar");
  yield* fs
    .makeDirectory(archiveRoot)
    .pipe(KnowledgeOperationalError.mapError("Failed to create the reference-census archive root."));
  yield* writeGitArchive(repoRoot, commit, archivePath, gitAdapter);
  yield* extractArchive(archivePath, archiveRoot);
  const tree = yield* readGitTree(repoRoot, commit, gitAdapter, () =>
    KnowledgeOperationalError.make({ message: "Malformed NUL-delimited census ls-tree output." })
  );
  const readBytes = Effect.fn("Knowledge.treeReadBytes")(function* (repoPath: string) {
    return yield* fs
      .readFile(path.join(archiveRoot, repoPath))
      .pipe(KnowledgeOperationalError.mapError(`Failed to read archived tracked file "${repoPath}".`));
  });

  return {
    treeish,
    commit,
    trackedEntries: A.map(tree, (entry) =>
      KnowledgeTrackedEntry.make({ path: entry.path, mode: entry.mode, objectId: entry.objectId })
    ),
    readBytes: (repoPath: string) => readBytes(repoPath).pipe(Effect.provide(runtime)),
  } satisfies KnowledgeTreeOracle;
});

const refsTreeLive = (treeish: string) =>
  Effect.scoped(Effect.flatMap(makeKnowledgeTreeOracle(treeish), scanKnowledgeRefsTree));

type KnowledgeServiceRequirements =
  | Crypto
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

const makeKnowledgeService = Effect.fn("KnowledgeService.make")(function* () {
  const runtime = yield* Effect.context<KnowledgeServiceRequirements>();
  return KnowledgeService.of({
    scanPair: Effect.fn("KnowledgeService.scanPair")((input) => scanKnowledgePair(input).pipe(Effect.provide(runtime))),
    semanticDelta: Effect.fn("KnowledgeService.semanticDelta")((baseRef) =>
      semanticDeltaLive(baseRef).pipe(Effect.provide(runtime))
    ),
    refsTree: Effect.fn("KnowledgeService.refsTree")((treeish) => refsTreeLive(treeish).pipe(Effect.provide(runtime))),
  });
});

/**
 * Live layer that scans real Git archives extracted from the local repository.
 *
 * **Details**
 *
 * The layer never fails to build; the crypto, filesystem, path, and process-spawn dependencies stay
 * in its requirements so the caller's runtime supplies them, and every archive failure surfaces as a
 * {@link KnowledgeOperationalError} on the invoked operation instead.
 *
 * **Example** (Provide the live scanner to a program)
 *
 * ```ts
 * import { KnowledgeService, KnowledgeServiceLive } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 *
 * const scan = Effect.gen(function* () {
 *   const knowledge = yield* KnowledgeService
 *   return yield* knowledge.semanticDelta("origin/main")
 * }).pipe(Effect.provide(KnowledgeServiceLive))
 *
 * console.log(Effect.isEffect(scan)) // true
 * ```
 *
 * @see {@link KnowledgeService} for the tag this layer satisfies.
 * @category layers
 * @since 0.0.0
 */
export const KnowledgeServiceLive: Layer.Layer<KnowledgeService, never, KnowledgeServiceRequirements> = Layer.effect(
  KnowledgeService,
  makeKnowledgeService()
);
