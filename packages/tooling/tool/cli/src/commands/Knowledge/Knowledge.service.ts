/**
 * Injectable Stage-1 knowledge semantic-delta service and live paired-archive implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { Context, Effect, FileSystem, HashSet, Layer, MutableHashMap, Order, Path, pipe } from "effect";
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
  KnowledgeCommandOccurrence,
  KnowledgeCommandResolved,
  KnowledgeCommandUnknown,
  KnowledgeFinding,
  KnowledgeFindingCandidate,
  KnowledgeFindingId,
  KnowledgeFindingLocation,
  KnowledgeIndexBytes,
  KnowledgeRename,
  KnowledgeSemanticDeltaReport,
  KnowledgeTrackedEntry,
} from "./Knowledge.schemas.ts";
import type { Crypto } from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";
import type { KnowledgeCommandProbeResult } from "./Knowledge.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.service");

const NORMALIZATION_VERSION = "knowledge-normalization/v1";
const FINDING_ID_PREFIX = "knowledge-finding/v1:";
const INDEX_PATH = "goals/INDEX.md";
const COMMAND_PREFIX = "bun run beep";
const textEncoder = new TextEncoder();
const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
const bytesEquivalent = S.toEquivalence(S.Uint8Array);
const decodeSha256 = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeFindingId = S.decodeUnknownEffect(KnowledgeFindingId);

const SCANNER_SCOPE: ReadonlyArray<string> = [
  "AGENTS.md",
  "CLAUDE.md",
  "goals",
  "explorations",
  "docs",
  ".claude",
  ".agents",
  ".codex",
  "standards",
  ".github",
];

const SCANNER_PREFIXES = A.map(A.drop(SCANNER_SCOPE, 2), (root) => `${root}/`);
const ARCHIVAL_SEGMENTS = HashSet.make(
  "history",
  "research",
  "reviews",
  "synthesis",
  "findings",
  "outputs",
  "reflections",
  "logs",
  ".proofs"
);
const GOVERNED_BARE_ROOTS = HashSet.make(
  ".agents",
  ".claude",
  ".codex",
  ".github",
  "apps",
  "docs",
  "explorations",
  "goals",
  "infra",
  "packages",
  "plugins",
  "scripts",
  "standards",
  "tools"
);
const GOVERNED_ROOT_FILES = HashSet.make(
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "package.json",
  "bun.lock",
  "turbo.json",
  "tsconfig.json"
);

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
 * @see {@link KnowledgeArchiveOracle} for the per-side read surface this input pairs.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgePairedOracleInput {
  readonly base: KnowledgeArchiveOracle;
  readonly head: KnowledgeArchiveOracle;
  readonly renames: ReadonlyArray<KnowledgeRename>;
}

/**
 * The two operations every knowledge semantic-delta implementation provides.
 *
 * **Details**
 *
 * `scanPair` takes an already-materialized comparison boundary and stays pure; `semanticDelta` builds
 * that boundary from local Git history for a base ref and then delegates to it.
 *
 * @see {@link KnowledgeService} for the service tag that carries this shape.
 * @category services
 * @since 0.0.0
 */
export interface KnowledgeServiceShape {
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

const sha256 = Effect.fn("Knowledge.sha256")(function* (bytes: Uint8Array) {
  return yield* decodeSha256(bytes).pipe(
    KnowledgeOperationalError.mapError("Failed to compute a semantic-delta SHA-256 digest.")
  );
});

const lengthPrefix = (value: string): string => {
  const normalized = nfc(value);
  return `${textEncoder.encode(normalized).byteLength}:${normalized}`;
};

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
    A.map([NORMALIZATION_VERSION, kind, nfc(documentId), nfc(subject), `${occurrence}`], lengthPrefix),
    ""
  );
  const digest = yield* sha256(textEncoder.encode(preimage));
  return yield* decodeFindingId(`${FINDING_ID_PREFIX}${digest}`).pipe(
    KnowledgeOperationalError.mapError("Computed knowledge finding id failed schema validation.")
  );
});

const isScannerMarkdownPath = (repoPath: string): boolean => {
  if (!Str.endsWith(".md")(repoPath)) {
    return false;
  }
  if (repoPath === "AGENTS.md" || repoPath === "CLAUDE.md") {
    return true;
  }
  if (!A.some(SCANNER_PREFIXES, (prefix) => Str.startsWith(prefix)(repoPath))) {
    return false;
  }
  if (Str.startsWith("docs/generated/")(repoPath) || Str.startsWith("docs/_internal/")(repoPath)) {
    return false;
  }
  return !A.some(Str.split("/")(repoPath), (segment) => HashSet.has(ARCHIVAL_SEGMENTS, segment));
};

const isRegularBlob = (entry: KnowledgeTrackedEntry): boolean => entry.mode === "100644" || entry.mode === "100755";

const trackedPathExists = (entries: ReadonlyArray<KnowledgeTrackedEntry>, repoPath: string): boolean => {
  const directoryPrefix = `${repoPath}/`;
  return A.some(entries, (entry) => entry.path === repoPath || Str.startsWith(directoryPrefix)(entry.path));
};

const stripQueryAndFragment = Str.replace(/[?#].*$/u, "");

const isGovernedPathSpelling = (raw: string): boolean => {
  const value = stripQueryAndFragment(nfc(raw));
  if (
    Str.isEmpty(value) ||
    /[\s\\]/u.test(value) ||
    /[*[\]{}<>|:]/u.test(value) ||
    /(?:^|\/)\.\.\.(?:\/|$)/u.test(value) ||
    Str.includes("…")(value) ||
    Str.startsWith("/")(value) ||
    Str.includes("://")(value)
  ) {
    return false;
  }
  if (Str.startsWith("./")(value) || Str.startsWith("../")(value)) {
    return true;
  }
  const first = A.head(Str.split("/")(value));
  return O.match(first, {
    onNone: () => false,
    onSome: (segment) => HashSet.has(GOVERNED_BARE_ROOTS, segment) || HashSet.has(GOVERNED_ROOT_FILES, value),
  });
};

/**
 * Normalizes one governed path spelling to a safe POSIX repository-relative path.
 *
 * **Details**
 *
 * Only spellings the repo governs survive: a bare governed root, a governed root file, or a `./` and
 * `../` path resolved against the containing document. URLs, globs, whitespace, ellipses, and
 * absolute paths return `O.none()`, and so does any relative path that escapes the repository root.
 *
 * **Example** (Resolve a relative link and reject a URL)
 *
 * ```ts
 * import { normalizeKnowledgeRepoPath } from "@beep/repo-cli/commands/Knowledge/Knowledge.service"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(normalizeKnowledgeRepoPath("docs/README.md", "./guides/intro.md")))
 * // "docs/guides/intro.md"
 * console.log(O.isNone(normalizeKnowledgeRepoPath("docs/README.md", "https://example.com/a.md")))
 * // true
 * ```
 *
 * @param documentPath - Repository-relative path of the document containing the spelling.
 * @param raw - Path spelling exactly as written inside the document.
 * @returns The normalized path when the spelling is governed and stays inside the repository.
 * @category normalization
 * @since 0.0.0
 */
export const normalizeKnowledgeRepoPath = (documentPath: string, raw: string): O.Option<string> => {
  if (!isGovernedPathSpelling(raw)) {
    return O.none();
  }
  const value = stripQueryAndFragment(nfc(raw));
  const relative = Str.startsWith("./")(value) || Str.startsWith("../")(value);
  let segments = relative ? A.dropRight(Str.split("/")(nfc(documentPath)), 1) : A.empty<string>();

  for (const segment of Str.split("/")(value)) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (A.isReadonlyArrayEmpty(segments)) {
        return O.none();
      }
      segments = A.dropRight(segments, 1);
      continue;
    }
    segments = A.append(segments, segment);
  }

  return A.isReadonlyArrayNonEmpty(segments) ? O.some(nfc(A.join(segments, "/"))) : O.none();
};

const decodeUtf8 = (bytes: Uint8Array, repoPath: string): Effect.Effect<string, KnowledgeOperationalError> =>
  Effect.try({
    try: () => strictUtf8Decoder.decode(bytes),
    catch: KnowledgeOperationalError.new(`Malformed UTF-8 in tracked Markdown file "${repoPath}".`),
  });

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

const isEligibleCommandSpan = (span: string): boolean =>
  /^bun run beep(?:$|[ \t])/u.test(span) && !/[|;&<>]|\$\(|(?:^|[ \t])#/u.test(span);

const commandWords = (span: string): ReadonlyArray<string> => {
  const tail = Str.trim(Str.slice(Str.length(COMMAND_PREFIX))(span));
  return Str.isEmpty(tail) ? A.empty<string>() : Str.split(/\s+/u)(tail);
};

const extractLineFindings = (
  lineText: string,
  lineNumber: number,
  documentPath: string,
  documentId: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): readonly [ReadonlyArray<KnowledgeFindingCandidate>, ReadonlyArray<KnowledgeCommandOccurrence>] => {
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();
  const assertionPattern = /<!-- beep:assert path-exists ([^\s]+) -->/gu;
  const inlinePattern = /(^|[^`\\])`([^`\r\n]+)`(?!`)/gu;
  let match = assertionPattern.exec(lineText);

  while (match !== null) {
    const raw = match[1];
    if (P.isString(raw)) {
      const normalized = normalizeKnowledgeRepoPath(documentPath, raw);
      if (O.isSome(normalized) && !trackedPathExists(entries, normalized.value)) {
        candidates = A.append(
          candidates,
          failedAssertionCandidate(documentId, documentPath, normalized.value, lineNumber, match.index + 1)
        );
      }
    }
    match = assertionPattern.exec(lineText);
  }

  match = inlinePattern.exec(lineText);
  while (match !== null) {
    const prefix = match[1];
    const span = match[2];
    if (P.isString(prefix) && P.isString(span)) {
      const column = match.index + Str.length(prefix) + 1;
      if (isEligibleCommandSpan(span)) {
        commands = A.append(
          commands,
          KnowledgeCommandOccurrence.make({
            documentId,
            location: findingLocation(documentPath, lineNumber, column),
            words: commandWords(span),
          })
        );
      } else {
        const normalized = normalizeKnowledgeRepoPath(documentPath, span);
        if (O.isSome(normalized) && !trackedPathExists(entries, normalized.value)) {
          candidates = A.append(
            candidates,
            missingPathCandidate(documentId, documentPath, normalized.value, lineNumber, column)
          );
        }
      }
    }
    match = inlinePattern.exec(lineText);
  }

  return [candidates, commands];
};

const extractDocument = Effect.fn("Knowledge.extractDocument")(function* (
  oracle: KnowledgeArchiveOracle,
  entry: KnowledgeTrackedEntry,
  documentId: string
) {
  const text = yield* oracle.readBytes(entry.path).pipe(Effect.flatMap((bytes) => decodeUtf8(bytes, entry.path)));
  const lines = Str.split(/\r?\n/u)(text);
  let candidates = A.empty<KnowledgeFindingCandidate>();
  let commands = A.empty<KnowledgeCommandOccurrence>();
  let fenceMarker = "";
  let fenceLength = 0;

  for (let index = 0; index < A.length(lines); index += 1) {
    const line = lines[index];
    if (!P.isString(line)) {
      continue;
    }
    const fence = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fenceMarker !== "") {
      if (
        fence !== null &&
        P.isString(fence[1]) &&
        P.isString(fence[2]) &&
        fence[1][0] === fenceMarker &&
        Str.length(fence[1]) >= fenceLength &&
        /^\s*$/u.test(fence[2])
      ) {
        fenceMarker = "";
        fenceLength = 0;
      }
      continue;
    }
    if (fence !== null && P.isString(fence[1]) && P.isString(fence[1][0])) {
      fenceMarker = fence[1][0];
      fenceLength = Str.length(fence[1]);
      continue;
    }
    const extracted = extractLineFindings(line, index + 1, entry.path, documentId, oracle.trackedEntries);
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
  indexDocumentId: string
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
  candidates = A.appendAll(candidates, yield* commandCandidates(oracle, commands));
  const index = yield* indexCandidate(oracle, indexDocumentId);
  return O.isSome(index) ? A.append(candidates, index.value) : candidates;
});

const candidateGroupKey = (candidate: KnowledgeFindingCandidate): string =>
  A.join(A.map([candidate.kind, candidate.documentId, candidate.subject], lengthPrefix), "");

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
 * const report = scanKnowledgePair({ base: emptyArchive, head: emptyArchive, renames: [] })
 *
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const scanKnowledgePair = Effect.fn("Knowledge.scanPair")(function* (input: KnowledgePairedOracleInput) {
  const baseCandidates = yield* candidatesForSide(
    input.base,
    (entry) => documentIdForBase(entry.path),
    documentIdForBase(INDEX_PATH)
  );
  const headIndexEntry = A.findFirst(input.head.trackedEntries, (entry) => entry.path === INDEX_PATH);
  const headIndexDocumentId = O.match(headIndexEntry, {
    onNone: () => `head-new:${INDEX_PATH}`,
    onSome: (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
  });
  const headCandidates = yield* candidatesForSide(
    input.head,
    (entry) => makeHeadDocumentId(input.base.trackedEntries, entry, input.renames),
    headIndexDocumentId
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

const gitAdapter: GitCommandErrorAdapter<KnowledgeOperationalError> = {
  onSpawnFailure: (commandLine) => KnowledgeOperationalError.new(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode, output }) =>
    KnowledgeOperationalError.make({
      message: `Knowledge archive Git command failed: ${commandLine} (exit ${exitCode}).${Str.isEmpty(output) ? "" : `\n${output}`}`,
    }),
  onTruncated: O.none(),
};

const COMMAND_PROBE_SOURCE = `
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Effect, Result } from "effect"
import { Command } from "effect/unstable/cli"
import { rootCommand } from "./packages/tooling/tool/cli/src/commands/Root.ts"

const input = await Bun.file(".beep-knowledge-command-input").text()
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

const INDEX_PROBE_SOURCE = `
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Effect } from "effect"
import { buildPortfolioIndexContent } from "./packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts"
const program = Effect.flatMap(buildPortfolioIndexContent("."), (content) => Effect.sync(() => process.stdout.write(content)))
BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
`;

const makeHermeticEnv = Effect.fn("Knowledge.makeHermeticEnv")(function* (archiveRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const envRoot = path.join(archiveRoot, ".beep-knowledge-env");
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

const decodeCommandProbeOutput = (
  output: string,
  expectedCount: number
): Effect.Effect<ReadonlyArray<KnowledgeCommandProbeResult>, KnowledgeOperationalError> => {
  const lines = Str.isEmpty(output) ? A.empty<string>() : Str.split(/\r?\n/u)(output);
  if (A.length(lines) !== expectedCount) {
    return KnowledgeOperationalError.make({ message: "Archive-local command probe emitted malformed output." });
  }
  let results = A.empty<KnowledgeCommandProbeResult>();
  for (const line of lines) {
    const fields = Str.split("\t")(line);
    const status = A.head(fields);
    if (O.isNone(status) || (status.value !== "resolved" && status.value !== "unknown")) {
      return KnowledgeOperationalError.make({ message: "Archive-local command probe emitted an unknown status." });
    }
    const canonicalPath = A.drop(fields, 1);
    results = A.append(
      results,
      status.value === "resolved"
        ? KnowledgeCommandResolved.make({ canonicalPath })
        : KnowledgeCommandUnknown.make({ canonicalPath })
    );
  }
  return Effect.succeed(results);
};

const makeLiveArchiveOracle = Effect.fn("Knowledge.makeLiveArchiveOracle")(function* (
  repoRoot: string,
  archiveRoot: string,
  trackedEntries: ReadonlyArray<KnowledgeTrackedEntry>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner>();
  const env = yield* makeHermeticEnv(archiveRoot);
  yield* fs
    .symlink(path.join(repoRoot, "node_modules"), path.join(archiveRoot, "node_modules"))
    .pipe(KnowledgeOperationalError.mapError("Failed to link installed dependencies into an archive root."));
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
    const inputPath = path.join(archiveRoot, ".beep-knowledge-command-input");
    const scriptPath = path.join(archiveRoot, ".beep-knowledge-command-probe.ts");
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
      .writeFileString(scriptPath, COMMAND_PROBE_SOURCE)
      .pipe(KnowledgeOperationalError.mapError("Failed to write archive-local command probe."));
    const output = yield* runArchiveProcess(archiveRoot, env, scriptPath);
    return yield* decodeCommandProbeOutput(output, A.length(commands));
  });

  const indexBytes = Effect.gen(function* () {
    const scriptPath = path.join(archiveRoot, ".beep-knowledge-index-probe.ts");
    yield* fs
      .writeFileString(scriptPath, INDEX_PROBE_SOURCE)
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

const extractArchive = Effect.fn("Knowledge.extractArchive")(function* (archivePath: string, archiveRoot: string) {
  yield* Effect.tryPromise({
    try: () => extractTar({ file: archivePath, cwd: archiveRoot, strict: true, preservePaths: false, unlink: true }),
    catch: KnowledgeOperationalError.new(`Failed to safely extract Git archive "${archivePath}".`),
  });
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
      const gitRenames = yield* readGitRenames(repoRoot, baseCommit, headCommit, SCANNER_SCOPE, gitAdapter, () =>
        KnowledgeOperationalError.make({ message: "Malformed NUL-delimited rename-table output." })
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
      const base = yield* makeLiveArchiveOracle(repoRoot, baseRoot, baseEntries);
      const head = yield* makeLiveArchiveOracle(repoRoot, headRoot, headEntries);
      return yield* scanKnowledgePair({ base, head, renames });
    })
  );
});

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
