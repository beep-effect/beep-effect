/**
 * Injectable Stage-1 knowledge semantic-delta service and live paired-archive implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { NonNegativeInt } from "@beep/schema";
import { Context, Effect, FileSystem, HashSet, Layer, Match, MutableHashMap, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { extract as extractTar } from "tar";
import { runCaptured } from "../../internal/process/StepExec.ts";
import {
  readGitRenames,
  readGitTree,
  resolveGitCommit,
  resolveGitMergeBase,
  writeGitArchive,
} from "../../internal/repo-run/GitExec.ts";
import { KNOWLEDGE_HISTORY_REMEDIATION, KnowledgeOperationalError } from "./Knowledge.errors.ts";
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
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
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
const INDEX_PATH = "goals/INDEX.md";
const COMMAND_PREFIX = "bun run beep";
const SEMANTIC_DELTA_DIGEST_FAILURE = "Failed to compute a semantic-delta SHA-256 digest.";
const textEncoder = new TextEncoder();
const bytesEquivalent = S.toEquivalence(S.Uint8Array);
const decodeFindingId = S.decodeUnknownEffect(KnowledgeFindingId);

/**
 * Everything the scanner may read from one side of a comparison.
 *
 * **Details**
 *
 * The scanner never touches the filesystem directly: both the live paired-archive implementation and
 * the golden tests satisfy this shape, which is what keeps a golden fixture and a real archive
 * indistinguishable to the scanning logic.
 *
 * @see {@link KnowledgePairedOracleInput} for the two-sided input that carries rename lineage.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeArchiveOracle {
  readonly indexBytes: Effect.Effect<KnowledgeIndexBytes, KnowledgeOperationalError>;
  readonly probeCommands: (
    commands: ReadonlyArray<ReadonlyArray<string>>
  ) => Effect.Effect<ReadonlyArray<KnowledgeCommandProbeResult>, KnowledgeOperationalError>;
  readonly readBytes: (repoPath: string) => Effect.Effect<Uint8Array, KnowledgeOperationalError>;
  readonly trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>;
}

/**
 * The complete comparison boundary handed to the pure paired scanner.
 *
 * **Details**
 *
 * `renames` is what lets a moved document keep its base-side identity; without it every finding in a
 * renamed file would report as one resolved and one introduced pair.
 *
 * **Gotchas**
 *
 * `probePolicy` is one value for the comparison rather than one per oracle on purpose. Probing only
 * the base would report every archive-local command and index finding as resolved, and probing only
 * HEAD would report every one of them as introduced.
 *
 * @see {@link KnowledgeArchiveOracle} for the per-side read surface this input pairs.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgePairedOracleInput {
  readonly base: KnowledgeArchiveOracle;
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
 * nothing either.
 *
 * @see {@link KnowledgeService} for the service tag that carries this shape.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeServiceShape {
  readonly refsTree: (treeish: string) => Effect.Effect<KnowledgeRefsReport, KnowledgeOperationalError>;
  readonly scanPair: (
    input: KnowledgePairedOracleInput
  ) => Effect.Effect<KnowledgeSemanticDeltaReport, KnowledgeOperationalError>;
  readonly semanticDelta: (baseRef: string) => Effect.Effect<KnowledgeSemanticDeltaReport, KnowledgeOperationalError>;
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

const trackedPathExists = (entries: ReadonlyArray<KnowledgeTrackedEntry>, repoPath: string): boolean => {
  const directoryPrefix = `${repoPath}/`;
  return A.some(entries, (entry) => entry.path === repoPath || Str.startsWith(directoryPrefix)(entry.path));
};

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
    path,
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
    O.filter((repoPath) => !trackedPathExists(entries, repoPath))
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

const inlinePathCandidate = (
  inline: KnowledgeInlineSpan,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): O.Option<KnowledgeFindingCandidate> =>
  isKnowledgeCommandSpan(inline.span)
    ? O.none()
    : O.map(brokenPathAt(inline.span, documentPath, entries), (repoPath) =>
        missingPathCandidate(documentId, documentPath, repoPath, lineNumber, inline.column)
      );

const extractLineFindings = (
  lineText: string,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): readonly [ReadonlyArray<KnowledgeFindingCandidate>, ReadonlyArray<KnowledgeCommandOccurrence>] => {
  const assertions = knowledgeLineMatches(/<!-- beep:assert path-exists ([^\s]+) -->/gu, lineText);
  const inlines = knowledgeInlineSpans(lineText);
  const candidates = A.appendAll(
    A.getSomes(A.map(assertions, (match) => assertionCandidate(match, lineNumber, documentPath, documentId, entries))),
    A.getSomes(A.map(inlines, (inline) => inlinePathCandidate(inline, lineNumber, documentPath, documentId, entries)))
  );
  const commands = A.getSomes(
    A.map(inlines, (inline) => commandOccurrence(inline, lineNumber, documentPath, documentId))
  );

  return [candidates, commands];
};

const extractDocument = Effect.fn("Knowledge.extractDocument")(function* (
  oracle: KnowledgeArchiveOracle,
  entry: KnowledgeTrackedEntry,
  documentId: string
) {
  const text = yield* oracle.readBytes(entry.path).pipe(Effect.flatMap((bytes) => decodeUtf8(bytes, entry.path)));
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();

  for (const line of knowledgeDocumentLines(text)) {
    if (!line.prose) {
      continue;
    }
    const extracted = extractLineFindings(line.text, line.number, entry.path, documentId, oracle.trackedEntries);
    candidates = A.appendAll(candidates, extracted[0]);
    commands = A.appendAll(commands, extracted[1]);
  }

  return { candidates, commands };
});

const commandCandidates = Effect.fn("Knowledge.commandCandidates")(function* (
  oracle: KnowledgeArchiveOracle,
  occurrences: ReadonlyArray<KnowledgeCommandOccurrence>
) {
  if (A.isReadonlyArrayEmpty(occurrences)) {
    return A.empty<KnowledgeFindingCandidate>();
  }
  const results = yield* oracle.probeCommands(A.map(occurrences, (occurrence) => occurrence.words));
  if (A.length(results) !== A.length(occurrences)) {
    return yield* KnowledgeOperationalError.make({
      message: "Archive-local command probe returned a result count that did not match its inputs.",
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
        remediation: "Update the inline command to a command available in the matching archive.",
      })
    );
  }
  return candidates;
});

const indexCandidate = Effect.fn("Knowledge.indexCandidate")(function* (
  oracle: KnowledgeArchiveOracle,
  documentId: string
) {
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
      message: "goals/INDEX.md differs from the archive-local manifest projection.",
      remediation: "Run `bun run beep goals index --write` and commit the regenerated index.",
    })
  );
});

const candidatesForSide = Effect.fn("Knowledge.candidatesForSide")(function* (
  oracle: KnowledgeArchiveOracle,
  documentId: (entry: KnowledgeTrackedEntry) => string,
  indexDocumentId: string,
  probePolicy: KnowledgeProbePolicy
) {
  const documents = pipe(
    oracle.trackedEntries,
    A.filter((entry) => isRegularBlob(entry) && isScannerMarkdownPath(entry.path)),
    A.sort(Order.mapInput(Order.String, (entry: KnowledgeTrackedEntry) => entry.path))
  );
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();
  for (const entry of documents) {
    const extracted = yield* extractDocument(oracle, entry, documentId(entry));
    candidates = A.appendAll(candidates, extracted.candidates);
    commands = A.appendAll(commands, extracted.commands);
  }
  // Both remaining evaluators run Bun on the scanned revision's own code, so an untrusted
  // comparison stops here with only the tracked-tree classes it derived without executing anything.
  if (!KnowledgeProbePolicy.is.enabled(probePolicy)) {
    return candidates;
  }
  candidates = A.appendAll(candidates, yield* commandCandidates(oracle, commands));
  const index = yield* indexCandidate(oracle, indexDocumentId);
  return O.isSome(index) ? A.append(candidates, index.value) : candidates;
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
        documentId: candidate.documentId,
        subject: candidate.subject,
        occurrence: NonNegativeInt.make(occurrence),
        location: candidate.location,
        message: candidate.message,
        remediation: candidate.remediation,
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
 * `input.probePolicy` is applied to both sides at once and echoed onto the report. A
 * `skipped-untrusted-context` scan still produces a well-formed delta, but one whose empty buckets
 * only cover the classes that need no archive-local execution.
 *
 * **Example** (Scan two empty archives)
 *
 * ```ts
 * import { KnowledgeIndexBytes } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { scanKnowledgePair } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import { Effect } from "effect"
 * import type { KnowledgeArchiveOracle } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 *
 * const emptyArchive: KnowledgeArchiveOracle = {
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
 *   head: emptyArchive,
 *   probePolicy: "enabled",
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
  const baseCandidates = yield* candidatesForSide(
    input.base,
    (entry) => documentIdForBase(entry.path),
    documentIdForBase(INDEX_PATH),
    input.probePolicy
  );
  const headIndexEntry = A.findFirst(input.head.trackedEntries, (entry) => entry.path === INDEX_PATH);
  const headIndexDocumentId = O.match(headIndexEntry, {
    onNone: () => `head-new:${INDEX_PATH}`,
    onSome: (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
  });
  const headCandidates = yield* candidatesForSide(
    input.head,
    (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
    headIndexDocumentId,
    input.probePolicy
  );
  const baseFindings = yield* findingsFromCandidates(baseCandidates);
  const headFindings = yield* findingsFromCandidates(headCandidates);
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
    probePolicy: input.probePolicy,
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

const ROOT_COMMAND_MODULE = "packages/tooling/tool/cli/src/commands/Root.ts";
const PORTFOLIO_INDEX_MODULE = "packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts";

/**
 * Command-probe program text, bound to absolute paths.
 *
 * The probe module and its input live in the scratch root, never in the archive, so a scanned branch
 * that tracks a symlink at a scratch file name cannot redirect a write out of the sandbox. Only the
 * archive module it imports is read from `archiveRoot`.
 *
 * @param rootCommandModule - Absolute path of the archive-local root command module.
 * @param inputPath - Absolute path of the tab-delimited command input file.
 * @returns Probe source ready to write into the scratch root.
 */
const commandProbeSource = (rootCommandModule: string, inputPath: string): string => `
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Effect, Result } from "effect"
import { Command } from "effect/unstable/cli"
import { rootCommand } from ${JSON.stringify(rootCommandModule)}

const input = await Bun.file(${JSON.stringify(inputPath)}).text()
const commands = input.split("\\n").map((line) => line === "" ? [] : line.split("\\t"))
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
    results.push(result.status + "\\t" + result.canonicalPath.join("\\t"))
  }
  process.stdout.write(results.join("\\n"))
})
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
`;

/**
 * Index-probe program text, bound to an absolute path.
 *
 * The projection still runs with the archive root as its working directory, so `"."` resolves to the
 * archive; only the module specifier and the probe file itself are absolute.
 *
 * @param portfolioIndexModule - Absolute path of the archive-local portfolio index module.
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
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
});

const runArchiveProcess = Effect.fn("Knowledge.runArchiveProcess")(function* (
  archiveRoot: string,
  env: Readonly<Record<string, string>>,
  scriptPath: string
) {
  const result = yield* runCaptured({
    command: process.execPath,
    args: [scriptPath],
    cwd: archiveRoot,
    env,
    extendEnv: false,
    source: "all",
  }).pipe(KnowledgeOperationalError.mapError(`Failed to spawn archive-local probe "${scriptPath}".`));
  if (result.exitCode !== 0) {
    return yield* KnowledgeOperationalError.make({
      message: `Archive-local probe "${scriptPath}" failed with exit ${result.exitCode}.${Str.isEmpty(result.output) ? "" : `\n${result.output}`}`,
    });
  }
  return result.output;
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
  output: string,
  expectedCount: number
): Effect.Effect<ReadonlyArray<KnowledgeCommandProbeResult>, KnowledgeOperationalError> => {
  const lines = Str.isEmpty(output) ? A.empty<string>() : Str.split(/\r?\n/u)(output);
  if (A.length(lines) !== expectedCount) {
    return KnowledgeOperationalError.make({ message: "Archive-local command probe emitted malformed output." });
  }
  return O.match(O.all(A.map(lines, commandProbeResultFromLine)), {
    onNone: () => KnowledgeOperationalError.make({ message: "Archive-local command probe emitted an unknown status." }),
    onSome: Effect.succeed,
  });
};

const makeLiveArchiveOracle = Effect.fn("Knowledge.makeLiveArchiveOracle")(function* (
  repoRoot: string,
  archiveRoot: string,
  scratchRoot: string,
  trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>();
  yield* fs
    .makeDirectory(scratchRoot, { recursive: true })
    .pipe(KnowledgeOperationalError.mapError("Failed to create an archive scratch root."));
  const env = yield* makeHermeticEnv(scratchRoot);
  yield* fs
    .symlink(path.join(repoRoot, "node_modules"), path.join(archiveRoot, "node_modules"))
    .pipe(KnowledgeOperationalError.mapError("Failed to link installed dependencies into an archive root."));
  yield* fs
    .symlink(path.join(repoRoot, "node_modules"), path.join(scratchRoot, "node_modules"))
    .pipe(KnowledgeOperationalError.mapError("Failed to link installed dependencies into an archive scratch root."));
  const readBytes = Effect.fn("Knowledge.archiveReadBytes")(function* (repoPath: string) {
    return yield* fs
      .readFile(path.join(archiveRoot, repoPath))
      .pipe(KnowledgeOperationalError.mapError(`Failed to read archived tracked file "${repoPath}".`));
  });

  const probeCommands = Effect.fn("Knowledge.archiveProbeCommands")(function* (
    commands: ReadonlyArray<ReadonlyArray<string>>
  ) {
    if (A.isReadonlyArrayEmpty(commands)) {
      return A.empty<KnowledgeCommandProbeResult>();
    }
    const inputPath = path.join(scratchRoot, "command-input");
    const scriptPath = path.join(scratchRoot, "command-probe.ts");
    yield* fs
      .writeFileString(
        inputPath,
        A.join(
          A.map(commands, (words) => A.join(words, "\t")),
          "\n"
        )
      )
      .pipe(KnowledgeOperationalError.mapError("Failed to write archive-local command probe input."));
    yield* fs
      .writeFileString(scriptPath, commandProbeSource(path.join(archiveRoot, ROOT_COMMAND_MODULE), inputPath))
      .pipe(KnowledgeOperationalError.mapError("Failed to write archive-local command probe."));
    const output = yield* runArchiveProcess(archiveRoot, env, scriptPath);
    return yield* decodeCommandProbeOutput(output, A.length(commands));
  });

  const indexBytes = Effect.gen(function* () {
    const scriptPath = path.join(scratchRoot, "index-probe.ts");
    yield* fs
      .writeFileString(scriptPath, indexProbeSource(path.join(archiveRoot, PORTFOLIO_INDEX_MODULE)))
      .pipe(KnowledgeOperationalError.mapError("Failed to write archive-local index probe."));
    const expected = textEncoder.encode(yield* runArchiveProcess(archiveRoot, env, scriptPath));
    const archived = trackedPathExists(trackedEntries, INDEX_PATH) ? yield* readBytes(INDEX_PATH) : new Uint8Array();
    return KnowledgeIndexBytes.make({ expected, archived });
  }).pipe(Effect.provide(runtime));

  return {
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
 * Regular files carry every scanned document and every module the probes import; directories carry
 * their structure. Links are dropped: the tracked-path oracle already comes from `git ls-tree` rather
 * than the extracted tree, documents whose blob is a link are filtered out by mode before they are
 * ever read, and a link entry in an untrusted archive is the classic primitive for redirecting a
 * later write out of the archive root. Dropping them also keeps `strict` extraction meaningful — a
 * repository that tracks a link through another link would otherwise abort the whole scan on an
 * entry nothing reads.
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
 * Decides whether this invocation may execute archive-local `--help` and index probes.
 *
 * **Details**
 *
 * Probing runs Bun on code taken from the scanned revision, which is the same trust boundary as
 * running that revision's tests. Locally, on `push`, and on a same-repo pull request that boundary is
 * already ours, so probes run. On a pull request whose head branch lives in another repository — a
 * fork of this public repository — probing would execute a contributor's code on our runner, so the
 * probe substep is skipped and the comparison degrades to the classes the tracked-tree oracle decides
 * on its own.
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
      const base = yield* makeLiveArchiveOracle(repoRoot, baseRoot, path.join(tempRoot, "base-scratch"), baseEntries);
      const head = yield* makeLiveArchiveOracle(repoRoot, headRoot, path.join(tempRoot, "head-scratch"), headEntries);
      return yield* scanKnowledgePair({ base, head, probePolicy, renames });
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
