/**
 * `research library mine`: T1 triage, T2 deep reads and T3 synthesis import.
 *
 * **Details**
 *
 * Each job spawns a configured runner, decodes its JSON answer with the tier schema,
 * rejects findings whose span is not verbatim in the bound capture text, and records a
 * `LibraryModelRun` with model, effort, route and exact launch argv. Job records are
 * immutable files under the library `ops/mine/`; one serialized catalog write per run
 * imports every record not yet in the catalog, so an interrupted run resumes cleanly.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { encodeLibraryJson } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { libraryEffectiveCaptures } from "./Library.evidence.ts";
import {
  LibraryMineBatchError,
  LibraryMinePrivateRouteError,
  LibraryMineRunnerError,
  LibraryMineSpanError,
  LibraryMineUnreadError,
} from "./Library.mine.errors.ts";
import {
  LibraryMineLaunchPaths,
  LibraryMineRunner,
  LibraryMineRunRequest,
  libraryMineAnswerJson,
  libraryMineArgv,
  libraryMineProfile,
  libraryMineProfileServes,
} from "./Library.mine.runner.ts";
import {
  LibraryAffirmativeCitoRelation,
  LibraryMineJob,
  LibraryMineReceipt,
  LibraryReadingOutput,
  LibraryReadingRecord,
  LibrarySynthesisImport,
  LibraryTriageOutput,
  LibraryTriageRecord,
} from "./Library.mine.schemas.ts";
import {
  deriveLibraryMinePdfText,
  readLibraryMineDerivedText,
  readLibraryMineDerivedTextBody,
} from "./Library.mine.text.ts";
import { libraryTopics } from "./Library.projection.ts";
import {
  LibraryArtifact,
  LibraryCatalog,
  LibraryDocument,
  LibraryFinding,
  LibraryModelRun,
} from "./Library.schemas.ts";
import { hashBytes, loadCatalog, saveImmutable, withCatalog } from "./Library.store.ts";
import type { PdfTools } from "@beep/pdf-tools";
import type * as Digest from "effect/crypto/Digest";
import type { LibraryMineProfile } from "./Library.mine.runner.ts";
import type { LibraryMineDerivedText, LibraryMineOptions, LibraryMineTier } from "./Library.mine.schemas.ts";
import type { LibraryTopic } from "./Library.projection.ts";
import type { LibraryCapture, LibraryDerivation, LibraryIntakeFile } from "./Library.schemas.ts";

const MINE_ROOT = "ops/mine";
const T1_TEXT_CAP = 24_000;
const T2_TEXT_CAP = 200_000;
const textRoles = ["extracted-full-text", "transcript-full-text", "raw-full-text"];
const isAffirmative = S.is(LibraryAffirmativeCitoRelation);
const mapFailure = (message: string) => Effect.mapError((cause: unknown) => LibraryError.make({ message, cause }));
const TriageRecordJson = S.fromJsonString(LibraryTriageRecord);
const ReadingRecordJson = S.fromJsonString(LibraryReadingRecord);
const ReceiptJson = S.fromJsonString(LibraryMineReceipt);
const SynthesisJson = S.fromJsonString(LibrarySynthesisImport);
const TriageOutputJson = S.fromJsonString(LibraryTriageOutput);
const ReadingOutputJson = S.fromJsonString(LibraryReadingOutput);
const DocumentJson = S.fromJsonString(LibraryDocument);
const DOCUMENTS_DIR = `${MINE_ROOT}/documents`;

type MineFailure = LibraryError | LibraryMineRunnerError | LibraryMineSpanError | LibraryMineUnreadError;
type JobOutcome = {
  readonly key: string;
  readonly outcome: "completed" | "failed" | "paused" | "skipped-unreadable";
  readonly label: string;
};

const isTextArtifact = (artifact: LibraryArtifact) =>
  A.contains(textRoles, artifact.role) &&
  (Str.startsWith("text/plain")(artifact.mediaType) || Str.startsWith("text/markdown")(artifact.mediaType));

/**
 * Pick the text artifact a capture's findings are bound to.
 *
 * **Details**
 *
 * Extracted full text wins over transcripts, which win over raw plain text. HTML, PDF and
 * JSON originals are never bound text.
 *
 * **Example** (A capture without text has no mining unit)
 * ```ts
 * import { libraryMineTextArtifact } from "@beep/repo-cli/test/ResearchLibrary"
 * import { LibraryCapture } from "@beep/repo-cli/commands/Research"
 * const capture = LibraryCapture.make({ id: "c", sourceId: "s", status: "readable", method: "fixture", recordedAt: "", capturedRevision: "", complete: true, artifacts: [], reason: "" })
 * console.log(libraryMineTextArtifact(capture)) // none
 * ```
 *
 * @internal
 * @param capture - Effective readable capture.
 * @returns The bound text artifact, if any.
 * @category utilities
 * @since 0.0.0
 */
export const libraryMineTextArtifact = (capture: LibraryCapture): O.Option<LibraryArtifact> =>
  A.findFirst(
    A.flatMap(textRoles, (role) => A.filter(capture.artifacts, (artifact) => artifact.role === role)),
    isTextArtifact
  );

const isPdfArtifact = (artifact: LibraryArtifact) => Str.startsWith("application/pdf")(artifact.mediaType);

/**
 * Pick the PDF a capture's findings are bound to when it has no text artifact.
 *
 * **Details**
 *
 * Box captures store a PDF under a text role with no extracted text. Such a capture is
 * mined through text derived from the PDF; a capture with a text artifact never is.
 *
 * **Example** (A capture without artifacts has no PDF unit)
 * ```ts
 * import { libraryMinePdfArtifact } from "@beep/repo-cli/test/ResearchLibrary"
 * import { LibraryCapture } from "@beep/repo-cli/commands/Research"
 * const capture = LibraryCapture.make({ id: "c", sourceId: "s", status: "readable", method: "fixture", recordedAt: "", capturedRevision: "", complete: true, artifacts: [], reason: "" })
 * console.log(libraryMinePdfArtifact(capture)) // none
 * ```
 *
 * @internal
 * @param capture - Effective readable capture.
 * @returns The bound PDF artifact, if the capture has no text artifact.
 * @category utilities
 * @since 0.0.0
 */
export const libraryMinePdfArtifact = (capture: LibraryCapture): O.Option<LibraryArtifact> =>
  O.isSome(libraryMineTextArtifact(capture))
    ? O.none()
    : A.findFirst(
        A.flatMap(textRoles, (role) => A.filter(capture.artifacts, (artifact) => artifact.role === role)),
        isPdfArtifact
      );

const sourceById = (catalog: LibraryCatalog, id: string) =>
  A.findFirst(catalog.sources, (source) => source.id === id || A.contains(source.aliasIds, id));

const resolveIntake = Effect.fn("Library.mine.resolveIntake")(function* (catalog: LibraryCatalog, wanted: string) {
  const matches = A.filter(catalog.intakes, (intake) => intake.id === wanted || intake.date === wanted);
  if (matches.length === 1) return matches[0]!;
  return yield* LibraryError.make({
    message:
      matches.length === 0
        ? `No intake matches ${wanted}; pass an intake id or date from the catalog.`
        : `Intake date ${wanted} is ambiguous; pass the intake id.`,
    cause: A.map(matches, (intake) => intake.id),
  });
});

const documentMediaTypes: ReadonlyArray<readonly [RegExp, string]> = [
  [/\.md$/i, "text/markdown"],
  [/\.jsonl$/i, "application/x-ndjson"],
  [/\.json$/i, "application/json"],
];

const documentMediaType = (snapshotPath: string) =>
  O.getOrElse(
    O.map(
      A.findFirst(documentMediaTypes, ([pattern]) => pattern.test(snapshotPath)),
      ([, mediaType]) => mediaType
    ),
    () => "text/plain"
  );

const dedupeBy = <A>(items: ReadonlyArray<A>, key: (item: A) => string): ReadonlyArray<A> => {
  let seen = HashSet.empty<string>();
  return A.filter(items, (item) => {
    if (HashSet.has(seen, key(item))) return false;
    seen = HashSet.add(seen, key(item));
    return true;
  });
};

const documentJob = (
  document: LibraryDocument,
  file: Pick<LibraryIntakeFile, "accessClass">,
  pdf: O.Option<LibraryDocument> = O.none()
) => {
  const accessClass = document.accessClass === "private" || file.accessClass === "private" ? "private" : "public";
  return LibraryMineJob.make({
    key: `document-${document.id}-${document.sha256}`,
    kind: "document",
    artifactId: `document:${document.id}:${document.sha256}`,
    sourceId: "",
    captureId: "",
    documentId: document.id,
    accessClass,
    artifact: LibraryArtifact.make({
      accessClass,
      path: document.snapshotPath,
      sha256: document.sha256,
      bytes: document.bytes,
      mediaType: O.isSome(pdf) ? "application/pdf" : documentMediaType(document.snapshotPath),
      role: "intake-snapshot",
    }),
    textSource: O.isSome(pdf) ? "pdf" : "text",
    pdfDocument: pdf,
  });
};

const isPdfIntakeFile = (file: LibraryIntakeFile) =>
  /\.pdf$/i.test(file.originalPath) && file.retention === "snapshot" && Str.isNonEmpty(file.snapshotPath);

// A PDF intake file has no parsed report; it binds to a report registered from the file itself,
// with the id rule `inventory` uses for parsed reports (sha256 of `<originalPath>\n<sha256>`).
const pdfDocument = Effect.fn("Library.mine.pdfDocument")(function* (
  catalog: LibraryCatalog,
  file: LibraryIntakeFile,
  accessClass: LibraryIntakeFile["accessClass"]
) {
  const path = yield* Path.Path;
  const existing = A.findFirst(
    catalog.documents,
    (document) => document.snapshotPath === file.snapshotPath && document.sha256 === file.sha256
  );
  if (O.isSome(existing)) return existing.value;
  const name = path.basename(file.originalPath);
  return LibraryDocument.make({
    id: yield* hashBytes(new TextEncoder().encode(`${file.originalPath}\n${file.sha256}`)),
    accessClass,
    originalPath: file.originalPath,
    snapshotPath: file.snapshotPath,
    sha256: file.sha256,
    bytes: file.bytes,
    title: name,
    reportDate: "",
    filenameDate: O.getOrElse(
      O.map(Str.match(/\d{4}-\d{2}-\d{2}/)(name), (match) => match[0]),
      () => ""
    ),
    expectedOccurrences: 0,
  });
});

/**
 * Plan every mining unit of an intake: one bound text or PDF artifact per effective
 * readable capture, then one job per parseable or PDF hop-0 intake document.
 *
 * **Details**
 *
 * Sources come from citations in the intake's documents and from derivations recorded
 * against the intake. Only complete, readable captures with a text artifact qualify;
 * an unread or incomplete source yields no job and therefore no finding. Every parseable
 * document snapshot of the intake is its own job bound to the snapshot bytes, except a
 * document whose sha256 equals a planned capture text artifact: those are the same bytes,
 * already read through the source. Document jobs inherit the document's access class.
 *
 * PDFs are mined through derived text. A readable capture whose only text-role artifact is
 * a PDF becomes a `pdf` source job. Each snapshotted `.pdf` intake file becomes a `pdf`
 * document job bound to a report registered from the file (one job per PDF sha256 per
 * intake, private if any byte-identical copy is private), unless a planned job already
 * reads the same bytes.
 *
 * **Example** (Prepare a plan)
 * ```ts
 * import { planLibraryMine } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(planLibraryMine("/library", "2026-11-06").pipe !== undefined)
 * ```
 *
 * @internal
 * @param root - Directory holding the catalog, object store and `ops/mine` records.
 * @param intakeRef - Intake id or unique intake date.
 * @returns Planned jobs in catalog source order.
 * @category use-cases
 * @since 0.0.0
 */
export const planLibraryMine = Effect.fn("Library.mine.plan")(function* (root: string, intakeRef: string) {
  const catalog = yield* loadCatalog(root);
  const intake = yield* resolveIntake(catalog, intakeRef);
  const snapshots = HashSet.fromIterable(A.map(intake.files, (file) => file.snapshotPath));
  const intakeDocuments = A.filter(catalog.documents, (document) => HashSet.has(snapshots, document.snapshotPath));
  const documentIds = HashSet.fromIterable(A.map(intakeDocuments, (document) => document.id));
  const cited = HashSet.fromIterable([
    ...A.map(
      A.filter(catalog.occurrences, (occurrence) => HashSet.has(documentIds, occurrence.documentId)),
      (occurrence) => occurrence.sourceId
    ),
    ...A.flatMap(
      A.filter(catalog.derivations, (derivation) => derivation.intakeId === intake.id),
      (derivation: LibraryDerivation) => [derivation.sourceId, derivation.derivedId]
    ),
  ]);
  const sources = A.filter(
    catalog.sources,
    (source) => HashSet.has(cited, source.id) || A.some(source.aliasIds, (alias) => HashSet.has(cited, alias))
  );
  const jobs = yield* Effect.forEach(
    sources,
    Effect.fnUntraced(function* (source) {
      const claims = yield* libraryEffectiveCaptures(root, catalog, source);
      return A.flatMap(claims, (claim) => {
        const capture = claim.capture;
        if (claim.category !== "readable" || capture === null || !capture.complete) return [];
        const text = O.map(libraryMineTextArtifact(capture), (artifact) => [artifact, "text"] as const);
        const bound = O.orElse(text, () =>
          O.map(libraryMinePdfArtifact(capture), (artifact) => [artifact, "pdf"] as const)
        );
        return A.map(A.fromOption(bound), ([artifact, textSource]) =>
          LibraryMineJob.make({
            key: `${capture.id}-${artifact.sha256}`,
            kind: "source",
            artifactId: `${capture.id}:${artifact.sha256}`,
            sourceId: source.id,
            captureId: capture.id,
            documentId: "",
            accessClass: source.accessClass === "private" || artifact.accessClass === "private" ? "private" : "public",
            artifact,
            textSource,
          })
        );
      });
    })
  );
  const pdfFiles = A.filter(intake.files, isPdfIntakeFile);
  const allSourceJobs = A.flatten(jobs);
  const privatePdfs = HashSet.fromIterable([
    ...A.map(
      A.filter(pdfFiles, (file) => file.accessClass === "private"),
      (file) => file.sha256
    ),
    ...A.map(
      A.filter(allSourceJobs, (job) => job.textSource === "pdf" && job.accessClass === "private"),
      (job) => job.artifact.sha256
    ),
  ]);
  const sourceJobs = A.map(
    dedupeBy(allSourceJobs, (job) => (job.textSource === "pdf" ? `pdf-${job.artifact.sha256}` : job.key)),
    (job) =>
      job.textSource === "pdf" && HashSet.has(privatePdfs, job.artifact.sha256)
        ? LibraryMineJob.make({ ...job, accessClass: "private" })
        : job
  );
  const captured = HashSet.fromIterable(A.map(sourceJobs, (job) => job.artifact.sha256));
  const parseableFiles = HashMap.fromIterable(
    A.map(
      A.filter(intake.files, (file) => file.parseable && Str.isNonEmpty(file.snapshotPath)),
      (file) => [file.snapshotPath, file] as const
    )
  );
  const documentJobs = A.flatMap(intakeDocuments, (document) =>
    HashSet.has(captured, document.sha256)
      ? []
      : A.map(A.fromOption(HashMap.get(parseableFiles, document.snapshotPath)), (file) => documentJob(document, file))
  );
  const textDocumentJobs = dedupeBy(documentJobs, (job) => job.artifact.sha256);
  const planned = HashSet.union(captured, HashSet.fromIterable(A.map(textDocumentJobs, (job) => job.artifact.sha256)));
  const pdfJobs = yield* Effect.forEach(
    A.filter(
      dedupeBy(pdfFiles, (file) => file.sha256),
      (file) => !HashSet.has(planned, file.sha256)
    ),
    Effect.fnUntraced(function* (file) {
      const accessClass = HashSet.has(privatePdfs, file.sha256) ? "private" : file.accessClass;
      const document = yield* pdfDocument(catalog, file, accessClass);
      return documentJob(document, { accessClass }, O.some(document));
    })
  );
  return [...sourceJobs, ...textDocumentJobs, ...pdfJobs];
});

const tierDir = (tier: LibraryMineTier, kind: "records" | "receipts" | "prompts" | "outputs" | "scratch") =>
  `${MINE_ROOT}/${tier}/${kind}`;

const readRecords = <A>(
  root: string,
  tier: LibraryMineTier,
  decode: (text: string) => Effect.Effect<A, S.SchemaError>
) => readJsonFiles(root, tierDir(tier, "records"), decode);

const readJsonFiles = Effect.fn("Library.mine.readJsonFiles")(function* <A>(
  root: string,
  relative: string,
  decode: (text: string) => Effect.Effect<A, S.SchemaError>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, relative);
  if (!(yield* fs.exists(directory).pipe(mapFailure("Cannot inspect mining records.")))) return [];
  const listed = yield* fs.readDirectory(directory).pipe(mapFailure("Cannot list mining records."));
  const entries = A.sort(A.filter(listed, Str.endsWith(".json")), Str.Order);
  return yield* Effect.forEach(entries, (entry) =>
    fs
      .readFileString(path.join(directory, entry))
      .pipe(Effect.flatMap(decode), mapFailure(`Invalid mining record ${relative}/${entry}.`))
  );
});

const recordExists = Effect.fn("Library.mine.recordExists")(function* (
  root: string,
  tier: LibraryMineTier,
  key: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(root, tierDir(tier, "records"), `${key}.json`))
    .pipe(mapFailure("Cannot inspect mining record."));
});

const readBoundText = Effect.fn("Library.mine.readBoundText")(function* (
  root: string,
  artifact: LibraryArtifact,
  kind: LibraryMineJob["kind"] = "source"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Capture text is content-addressed; a hop-0 document is read from its intake snapshot.
  const location =
    kind === "document" ? path.join(root, artifact.path) : path.join(root, "objects/sha256", artifact.sha256);
  const bytes = yield* fs.readFile(location).pipe(mapFailure("Cannot read bound capture text."));
  if ((yield* hashBytes(bytes)) !== artifact.sha256)
    return yield* LibraryError.make({ message: "Bound capture text differs from its digest.", cause: artifact.path });
  return new TextDecoder().decode(bytes);
});

type BoundText = { readonly text: string; readonly derivedTextSha256: string };

// Resolve a job's bound text; a PDF without text fails with its `no-text` receipt.
const jobText = Effect.fn("Library.mine.jobText")(function* (
  root: string,
  job: LibraryMineJob
): Effect.fn.Return<
  Result.Result<BoundText, LibraryMineDerivedText>,
  LibraryError,
  FileSystem.FileSystem | Path.Path | Digest.Digest | PdfTools
> {
  if (job.textSource === "text") {
    const text = yield* readBoundText(root, job.artifact, job.kind);
    return Result.succeed({ text, derivedTextSha256: "" });
  }
  const receipt = yield* deriveLibraryMinePdfText(root, job.artifact.sha256);
  if (receipt.outcome === "no-text") return Result.fail(receipt);
  const text = yield* readLibraryMineDerivedTextBody(root, receipt);
  return Result.succeed({ text, derivedTextSha256: receipt.textSha256 });
});

const saveDocumentBinding = Effect.fn("Library.mine.saveDocumentBinding")(function* (
  root: string,
  document: LibraryDocument
) {
  const encoded = yield* S.encodeEffect(DocumentJson)(document).pipe(mapFailure("Cannot encode PDF report binding."));
  yield* saveText(root, `${DOCUMENTS_DIR}/${document.id}.json`, encoded);
});

const loadTopics = Effect.fn("Library.mine.topics")(function* (repoRoot: O.Option<string>) {
  const root = O.isSome(repoRoot)
    ? repoRoot.value
    : yield* findRepoRoot().pipe(mapFailure("Cannot locate the repository for packet topics; pass --repo."));
  return yield* libraryTopics(root, false).pipe(mapFailure("Cannot read packet topics."));
});

const topicIdsOf = (topics: ReadonlyArray<LibraryTopic>) =>
  HashSet.fromIterable(A.flatMap(topics, (topic) => [topic.id, topic.initiativeId]));

const partitionTopics = (known: HashSet.HashSet<string>, ids: ReadonlyArray<string>) => ({
  kept: A.dedupe(A.filter(ids, (id) => HashSet.has(known, id))),
  dropped: A.filter(ids, (id) => !HashSet.has(known, id)),
});

const topicList = (topics: ReadonlyArray<LibraryTopic>) =>
  A.join(
    A.map(topics, (topic) => `- ${topic.id}: ${topic.title}`),
    "\n"
  );

const boundExcerpt = (text: string, cap: number) => ({
  excerpt: Str.slice(0, cap)(text),
  truncated: text.length > cap,
  header:
    text.length > cap
      ? `Capture text (first ${cap} of ${text.length} characters; the rest was not shown):`
      : `Capture text (complete, ${text.length} characters):`,
});

const jobSubject = (job: LibraryMineJob) =>
  job.kind === "document" ? "one hop-0 intake report" : "one captured source";

const sourceLine = (catalog: LibraryCatalog, job: LibraryMineJob) =>
  job.kind === "document"
    ? O.match(
        A.findFirst(catalog.documents, (document) => document.id === job.documentId),
        {
          onNone: () => `Hop-0 intake report ${job.documentId}`,
          onSome: (document) =>
            `Hop-0 intake report ${document.id}: ${document.title}${Str.isNonEmpty(document.reportDate) ? ` (${document.reportDate})` : ""}`,
        }
      )
    : O.match(
        A.findFirst(catalog.sources, (source) => source.id === job.sourceId),
        {
          onNone: () => `Source ${job.sourceId}`,
          onSome: (source) => `Source ${source.id}: ${source.canonicalUrl} (${source.kind})`,
        }
      );

const triagePrompt = (
  catalog: LibraryCatalog,
  job: LibraryMineJob,
  topics: ReadonlyArray<LibraryTopic>,
  text: string
) => {
  const bound = boundExcerpt(text, T1_TEXT_CAP);
  return `You are triaging ${jobSubject(job)} for the beep-effect research library (tier T1).
Decide whether a deep read (T2) is worth spending on it for any live packet topic below.
Reply with only a JSON object: {"decision": "select" | "skip" | "defer", "reason": string, "topicIds": string[]}.
- select: the text bears on at least one listed topic and deserves a deep read.
- skip: off-topic or no value for any listed topic.
- defer: possibly relevant, but the text shown is too thin to judge.
topicIds must be ids from the topic list; use [] when none apply.

Topics:
${topicList(topics)}

${sourceLine(catalog, job)}
${bound.header}
<<<CAPTURE
${bound.excerpt}
CAPTURE>>>
`;
};

const readingPrompt = (
  catalog: LibraryCatalog,
  job: LibraryMineJob,
  topics: ReadonlyArray<LibraryTopic>,
  text: string
) => {
  const bound = boundExcerpt(text, T2_TEXT_CAP);
  return `You are deep-reading ${jobSubject(job)} for the beep-effect research library (tier T2).
Reply with only a JSON object:
{"coverage": "complete" | "partial" | "unread", "summary": string, "findings": [{"citoRelation": string, "span": string, "summary": string, "topicIds": string[]}]}
Rules:
- coverage is "complete" only if you read the entire capture text below; "partial" if it was truncated or you skimmed; "unread" if it is not readable prose.
- Every finding's span is copied verbatim, character for character, from the capture text: no paraphrase, no ellipsis, no added quotes. Keep spans short (one sentence or less). Findings with non-verbatim spans reject the whole reading.
- citoRelation is one of: citesAsEvidence, citesAsRelated, extends, usesMethodIn, usesDataFrom, critiques, supports, disputes, discusses. Affirmative relations (citesAsEvidence, supports, extends, usesMethodIn, usesDataFrom) are kept only for complete readings.
- topicIds are ids from the topic list that the finding is skos:related to; [] when none apply.

Topics:
${topicList(topics)}

${sourceLine(catalog, job)}
${bound.header}
<<<CAPTURE
${bound.excerpt}
CAPTURE>>>
`;
};

const writeOutputSchema = Effect.fn("Library.mine.writeOutputSchema")(function* (root: string, tier: LibraryMineTier) {
  const path = yield* Path.Path;
  const schema: S.Top = tier === "t1" ? LibraryTriageOutput : LibraryReadingOutput;
  // Structured-output endpoints require an inline `type: "object"` root, so no named `$ref` root is allowed.
  const document = S.toJsonSchemaDocument(schema, { onExcessProperty: "error", referencePolicy: () => undefined });
  const text = yield* encodeLibraryJson({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...document.schema,
    ...(R.isEmptyRecord(document.definitions) ? {} : { $defs: document.definitions }),
  }).pipe(mapFailure("Cannot encode mining output schema."));
  const hash = yield* hashBytes(new TextEncoder().encode(text));
  const relative = `${MINE_ROOT}/schemas/${tier}-${Str.slice(0, 16)(hash)}.schema.json`;
  yield* saveImmutable(root, relative, new TextEncoder().encode(text));
  return path.join(root, relative);
});

const saveText = (root: string, relative: string, text: string) =>
  saveImmutable(root, relative, new TextEncoder().encode(text));

const now = DateTime.now.pipe(Effect.map(DateTime.formatIso));

/**
 * Check every span is a verbatim substring of the bound capture text.
 *
 * **Details**
 *
 * A span that differs from the text only in whitespace runs (PDF line breaks a
 * reader rendered as spaces) resolves to the exact slice of the text, so the
 * returned spans are always verbatim. Any other difference is an offender.
 *
 * **Example** (Reject an invented span)
 * ```ts
 * import { checkLibraryMineSpans } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect"
 * const exit = Effect.runSyncExit(checkLibraryMineSpans("capture:abc", "the source text", ["invented"]))
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @internal
 * @param artifactId - Mining unit the spans are bound to.
 * @param text - Full bound capture text.
 * @param spans - Spans proposed by a runner or synthesis.
 * @returns The verbatim text slice for each span, otherwise a span error naming the offenders.
 * @category validation
 * @since 0.0.0
 */
export const checkLibraryMineSpans = Effect.fn("Library.mine.checkSpans")(function* (
  artifactId: string,
  text: string,
  spans: ReadonlyArray<string>
) {
  const resolved = A.map(spans, (span) => [span, resolveSpan(text, span)] as const);
  const offenders = A.filterMap(resolved, ([span, slice]) =>
    O.isNone(slice) ? Result.succeed(span) : Result.failVoid
  );
  if (A.isReadonlyArrayNonEmpty(offenders))
    return yield* LibraryMineSpanError.make({
      artifactId,
      spans: offenders,
      message: `${offenders.length} finding span(s) are not verbatim in the bound capture text.`,
    });
  return A.map(resolved, ([span, slice]) => O.getOrElse(slice, () => span));
});

const escapeRegExp = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveSpan = (text: string, span: string): O.Option<string> => {
  const words = A.filter(Str.split(Str.trim(span), /\s+/), Str.isNonEmpty);
  if (!A.isReadonlyArrayNonEmpty(words)) return O.none();
  if (Str.includes(span)(text)) return O.some(span);
  return O.map(O.fromNullishOr(new RegExp(A.join(A.map(words, escapeRegExp), "\\s+")).exec(text)), (match) => match[0]);
};

type JobContext = {
  readonly root: string;
  readonly tier: "t1" | "t2";
  readonly profile: LibraryMineProfile;
  readonly schemaPath: string;
  readonly catalog: LibraryCatalog;
  readonly topics: ReadonlyArray<LibraryTopic>;
  readonly known: HashSet.HashSet<string>;
  readonly paused: Ref.Ref<boolean>;
};

const launch = Effect.fn("Library.mine.launch")(function* (context: JobContext, job: LibraryMineJob, prompt: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runner = yield* LibraryMineRunner;
  const startedAt = yield* now;
  const stamp = Str.replace(/[^0-9]/g, "")(startedAt);
  const scratch = path.join(context.root, tierDir(context.tier, "scratch"), `${job.key}-${stamp}`);
  yield* fs.makeDirectory(scratch, { recursive: true }).pipe(mapFailure("Cannot create mining scratch directory."));
  const paths = LibraryMineLaunchPaths.make({
    cwd: scratch,
    schemaPath: context.schemaPath,
    outputPath: path.join(scratch, "answer.json"),
    promptPath: path.join(scratch, "job.md"),
  });
  if (context.profile.transport === "prompt-file")
    yield* fs.writeFileString(paths.promptPath, prompt).pipe(mapFailure("Cannot stage mining prompt."));
  const argv = libraryMineArgv(context.profile, paths);
  const modelRun = LibraryModelRun.make({
    id: `mine:${context.tier}:${job.key}:${startedAt}`,
    model: context.profile.model,
    effort: context.profile.effort,
    route: context.profile.route,
    startedAt,
    argv,
  });
  const promptArtifact = yield* saveText(
    context.root,
    `${tierDir(context.tier, "prompts")}/${job.key}/${stamp}.md`,
    prompt
  );
  const answer = yield* runner
    .run(
      LibraryMineRunRequest.make({
        tier: context.tier,
        jobKey: job.key,
        profile: context.profile,
        argv,
        cwd: scratch,
        prompt,
        outputPath: context.profile.outputFile ? O.some(paths.outputPath) : O.none(),
        timeoutMinutes: context.tier === "t1" ? 15 : 30,
      })
    )
    .pipe(Effect.ensuring(fs.remove(scratch, { recursive: true }).pipe(Effect.ignore)), Effect.result);
  return { modelRun, stamp, promptSha256: promptArtifact.sha256, answer };
});

const writeReceipt = Effect.fn("Library.mine.writeReceipt")(function* (
  root: string,
  tier: LibraryMineTier,
  key: string,
  stamp: string,
  receipt: LibraryMineReceipt
) {
  const text = yield* S.encodeEffect(ReceiptJson)(receipt).pipe(mapFailure("Cannot encode mining receipt."));
  yield* saveText(root, `${tierDir(tier, "receipts")}/${key}/${stamp}.json`, text);
});

const failureTag = (error: MineFailure) => error._tag;

const runJob = Effect.fn("Library.mine.runJob")(function* (context: JobContext, job: LibraryMineJob) {
  if (yield* Ref.get(context.paused))
    return { key: job.key, outcome: "paused", label: `${job.artifactId} paused` } satisfies JobOutcome;
  const resolved = yield* jobText(context.root, job).pipe(Effect.result);
  if (resolved._tag === "Failure")
    return {
      key: job.key,
      outcome: "failed",
      label: `${job.artifactId} ${resolved.failure._tag}: ${resolved.failure.message}`,
    } satisfies JobOutcome;
  if (resolved.success._tag === "Failure")
    return {
      key: job.key,
      outcome: "skipped-unreadable",
      label: `${job.artifactId} skipped-unreadable: ${resolved.success.failure.message}`,
    } satisfies JobOutcome;
  const { text, derivedTextSha256 } = resolved.success.success;
  if (O.isSome(job.pdfDocument)) yield* saveDocumentBinding(context.root, job.pdfDocument.value);
  const prompt =
    context.tier === "t1"
      ? triagePrompt(context.catalog, job, context.topics, text)
      : readingPrompt(context.catalog, job, context.topics, text);
  const launched = yield* launch(context, job, prompt);
  const { modelRun, stamp } = launched;
  const receipt = (fields: {
    readonly outcome: LibraryMineReceipt["outcome"];
    readonly errorTag?: string;
    readonly message?: string;
    readonly outputSha256?: string;
    readonly findingIds?: ReadonlyArray<string>;
    readonly droppedTopicIds?: ReadonlyArray<string>;
    readonly recordedAt: string;
  }) =>
    LibraryMineReceipt.make({
      tier: context.tier,
      jobKey: job.key,
      artifactId: job.artifactId,
      profile: context.profile.id,
      modelRun,
      outcome: fields.outcome,
      errorTag: fields.errorTag ?? "",
      message: fields.message ?? "",
      promptSha256: launched.promptSha256,
      outputSha256: fields.outputSha256 ?? "",
      findingIds: fields.findingIds ?? [],
      droppedTopicIds: fields.droppedTopicIds ?? [],
      recordedAt: fields.recordedAt,
    });
  const process = Effect.fnUntraced(function* (answer: string) {
    const output = yield* saveText(context.root, `${tierDir(context.tier, "outputs")}/${job.key}/${stamp}.txt`, answer);
    const json = libraryMineAnswerJson(answer);
    const recordedAt = yield* now;
    if (context.tier === "t1") {
      const triage = yield* S.decodeEffect(TriageOutputJson)(json).pipe(
        Effect.mapError((cause) =>
          LibraryMineRunnerError.make({ quota: false, message: `T1 answer failed its schema: ${cause.message}` })
        )
      );
      const topics = partitionTopics(context.known, triage.topicIds);
      const record = LibraryTriageRecord.make({
        artifactId: job.artifactId,
        sourceId: job.sourceId,
        captureId: job.captureId,
        documentId: job.documentId,
        artifactSha256: job.artifact.sha256,
        derivedTextSha256,
        decision: triage.decision,
        reason: triage.reason,
        topicIds: topics.kept,
        modelRunId: modelRun.id,
        modelRun,
        recordedAt,
      });
      const encoded = yield* S.encodeEffect(TriageRecordJson)(record).pipe(mapFailure("Cannot encode triage record."));
      yield* saveText(context.root, `${tierDir("t1", "records")}/${job.key}.json`, encoded);
      return receipt({
        outcome: "completed",
        outputSha256: output.sha256,
        droppedTopicIds: topics.dropped,
        recordedAt,
      });
    }
    const reading = yield* S.decodeEffect(ReadingOutputJson)(json).pipe(
      Effect.mapError((cause) =>
        LibraryMineRunnerError.make({ quota: false, message: `T2 answer failed its schema: ${cause.message}` })
      )
    );
    const spans = yield* checkLibraryMineSpans(
      job.artifactId,
      text,
      A.map(reading.findings, (finding) => finding.span)
    );
    const coverage = reading.coverage === "complete" && text.length > T2_TEXT_CAP ? "partial" : reading.coverage;
    const kept = A.filter(
      A.zipWith(reading.findings, spans, (finding, span) => ({ ...finding, span })),
      (finding) => coverage === "complete" || !isAffirmative(finding.citoRelation)
    );
    const dropped = A.flatMap(kept, (finding) => partitionTopics(context.known, finding.topicIds).dropped);
    const findings = A.map(kept, (finding, index) =>
      LibraryFinding.make({
        id: `mine:t2:${job.key}:${index}`,
        sourceId: job.sourceId,
        captureId: job.captureId,
        documentId: job.documentId,
        citoRelation: finding.citoRelation,
        span: finding.span,
        summary: finding.summary,
        topicIds: partitionTopics(context.known, finding.topicIds).kept,
        modelRunId: modelRun.id,
        recordedAt,
      })
    );
    const record = LibraryReadingRecord.make({
      artifactId: job.artifactId,
      sourceId: job.sourceId,
      captureId: job.captureId,
      documentId: job.documentId,
      artifactSha256: job.artifact.sha256,
      derivedTextSha256,
      coverage,
      summary: reading.summary,
      findings,
      modelRunId: modelRun.id,
      modelRun,
      recordedAt,
    });
    const encoded = yield* S.encodeEffect(ReadingRecordJson)(record).pipe(mapFailure("Cannot encode reading record."));
    yield* saveText(context.root, `${tierDir("t2", "records")}/${job.key}.json`, encoded);
    return receipt({
      outcome: "completed",
      outputSha256: output.sha256,
      findingIds: A.map(findings, (finding) => finding.id),
      droppedTopicIds: dropped,
      message:
        kept.length < reading.findings.length
          ? `${reading.findings.length - kept.length} affirmative finding(s) dropped: coverage ${coverage}.`
          : "",
      recordedAt,
    });
  });
  const settled = yield* Effect.result(
    launched.answer._tag === "Success" ? process(launched.answer.success) : Effect.fail(launched.answer.failure)
  );
  if (settled._tag === "Success") {
    yield* writeReceipt(context.root, context.tier, job.key, stamp, settled.success);
    return { key: job.key, outcome: "completed", label: job.artifactId } satisfies JobOutcome;
  }
  const error: MineFailure = settled.failure;
  const quota = error._tag === "LibraryMineRunnerError" && error.quota;
  if (quota) yield* Ref.set(context.paused, true);
  const failedAt = yield* now;
  yield* writeReceipt(
    context.root,
    context.tier,
    job.key,
    stamp,
    receipt({
      outcome: quota ? "paused" : error._tag === "LibraryMineRunnerError" ? "failed" : "rejected",
      errorTag: failureTag(error),
      message: error.message,
      recordedAt: failedAt,
    })
  );
  return {
    key: job.key,
    outcome: quota ? "paused" : "failed",
    label: `${job.artifactId} ${failureTag(error)}: ${error.message}`,
  } satisfies JobOutcome;
});

/**
 * Import every mining record not yet in the catalog under the single catalog writer.
 *
 * **Details**
 *
 * PDF intake files bind their findings to a report registered from the file: each binding
 * under `ops/mine/documents/` not yet in the catalog is added to `documents` in the same write.
 *
 * **Example** (Prepare an import)
 * ```ts
 * import { importLibraryMineRecords } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(importLibraryMineRecords("/library").pipe !== undefined)
 * ```
 *
 * @internal
 * @param root - Directory holding the catalog, object store and `ops/mine` records.
 * @returns The number of model runs, findings and PDF report bindings added.
 * @category use-cases
 * @since 0.0.0
 */
export const importLibraryMineRecords = Effect.fn("Library.mine.importRecords")(function* (root: string) {
  const triage = yield* readRecords(root, "t1", S.decodeEffect(TriageRecordJson));
  const readings = yield* readRecords(root, "t2", S.decodeEffect(ReadingRecordJson));
  const bindings = yield* readJsonFiles(root, DOCUMENTS_DIR, S.decodeEffect(DocumentJson));
  let added = { modelRuns: 0, findings: 0, documents: 0 };
  yield* withCatalog(
    root,
    Effect.fnUntraced(function* (catalog) {
      const runIds = HashSet.fromIterable(A.map(catalog.modelRuns, (run) => run.id));
      const documentIds = HashSet.fromIterable(A.map(catalog.documents, (document) => document.id));
      const documents = A.filter(bindings, (document) => !HashSet.has(documentIds, document.id));
      const findingIds = HashSet.fromIterable(A.map(catalog.findings, (finding) => finding.id));
      const runs = A.filter(
        [...A.map(triage, (record) => record.modelRun), ...A.map(readings, (record) => record.modelRun)],
        (run) => !HashSet.has(runIds, run.id)
      );
      const findings = A.filter(
        A.flatMap(readings, (record) => record.findings),
        (finding) => !HashSet.has(findingIds, finding.id)
      );
      added = { modelRuns: runs.length, findings: findings.length, documents: documents.length };
      return runs.length === 0 && findings.length === 0 && documents.length === 0
        ? catalog
        : catalogWith(catalog, runs, findings, documents);
    })
  );
  return added;
});

const catalogWith = (
  catalog: LibraryCatalog,
  runs: ReadonlyArray<LibraryModelRun>,
  findings: ReadonlyArray<LibraryFinding>,
  documents: ReadonlyArray<LibraryDocument> = []
): LibraryCatalog =>
  LibraryCatalog.make({
    ...catalog,
    documents: [...catalog.documents, ...documents],
    modelRuns: [...catalog.modelRuns, ...runs],
    findings: [...catalog.findings, ...findings],
  });

const pendingJobs = Effect.fn("Library.mine.pendingJobs")(function* (
  root: string,
  tier: "t1" | "t2",
  options: LibraryMineOptions
) {
  const planned = yield* planLibraryMine(root, options.intake);
  const triage = tier === "t1" ? [] : yield* readRecords(root, "t1", S.decodeEffect(TriageRecordJson));
  const selected =
    tier === "t1"
      ? O.none<HashSet.HashSet<string>>()
      : O.some(
          HashSet.fromIterable(
            A.map(
              A.filter(triage, (record) => record.decision === "select"),
              (record) => record.artifactId
            )
          )
        );
  const eligible = A.filter(
    planned,
    (job) =>
      O.match(selected, { onNone: () => true, onSome: (ids) => HashSet.has(ids, job.artifactId) }) &&
      !(options.excludePrivate && job.accessClass === "private")
  );
  const done = yield* Effect.filter(eligible, (job) => recordExists(root, tier, job.key));
  const doneKeys = HashSet.fromIterable(A.map(done, (job) => job.key));
  // A PDF already known to hold no text is skipped without a launch; reruns do not retry it.
  const unreadable = yield* Effect.filter(eligible, (job) =>
    job.textSource === "pdf" && !HashSet.has(doneKeys, job.key)
      ? Effect.map(
          readLibraryMineDerivedText(root, job.artifact.sha256),
          O.exists((receipt) => receipt.outcome === "no-text")
        )
      : Effect.succeed(false)
  );
  const unreadableKeys = HashSet.fromIterable(A.map(unreadable, (job) => job.key));
  const open = A.filter(eligible, (job) => !HashSet.has(doneKeys, job.key) && !HashSet.has(unreadableKeys, job.key));
  const pending = O.match(options.limit, { onNone: () => open, onSome: (limit) => A.take(open, limit) });
  return { planned, eligible, done: done.length, unreadable: unreadable.length, pending };
});

const runTier = Effect.fn("Library.mine.runTier")(function* (
  root: string,
  tier: "t1" | "t2",
  options: LibraryMineOptions
) {
  const profile = libraryMineProfile(options.profile);
  if (!libraryMineProfileServes(profile, tier))
    return yield* LibraryError.make({
      message: `Runner profile ${profile.id} does not serve ${tier}.`,
      cause: profile.tiers,
    });
  const { planned, eligible, done, unreadable, pending } = yield* pendingJobs(root, tier, options);
  const privateJobs = A.filter(pending, (job) => job.accessClass === "private");
  if (profile.externalLane && A.isReadonlyArrayNonEmpty(privateJobs))
    return yield* LibraryMinePrivateRouteError.make({
      profile: profile.id,
      artifactIds: A.map(privateJobs, (job) => job.artifactId),
      message: `${privateJobs.length} private-partition artifact(s) cannot route to the ${profile.id} lane; use --profile claude or --exclude-private.`,
    });
  yield* Console.log(
    `library mine ${tier}: planned=${planned.length} eligible=${eligible.length} completed=${done} unreadable=${unreadable} pending=${pending.length} pdf=${A.filter(pending, (job) => job.textSource === "pdf").length} private=${privateJobs.length} profile=${profile.id} model=${profile.model} effort=${profile.effort} route=${profile.route}`
  );
  if (options.dryRun) {
    const placeholder = LibraryMineLaunchPaths.make({
      cwd: `<library>/${tierDir(tier, "scratch")}/<job>`,
      schemaPath: `<library>/${MINE_ROOT}/schemas/${tier}-<hash>.schema.json`,
      outputPath: "<scratch>/answer.json",
      promptPath: "<scratch>/job.md",
    });
    yield* Console.log(`argv: ${A.join(libraryMineArgv(profile, placeholder), " ")}`);
    yield* Effect.forEach(
      pending,
      (job) =>
        Console.log(
          `${job.artifactId} ${job.kind === "document" ? `document=${job.documentId}` : `source=${job.sourceId}`} access=${job.accessClass}${job.textSource === "pdf" ? ` text=pdf path=${job.artifact.path}` : ""}`
        ),
      {
        discard: true,
      }
    );
    return { completed: 0, failed: 0, paused: 0, skippedUnreadable: 0 };
  }
  const catalog = yield* loadCatalog(root);
  const topics = yield* loadTopics(options.repoRoot);
  const context: JobContext = {
    root,
    tier,
    profile,
    schemaPath: yield* writeOutputSchema(root, tier),
    catalog,
    topics,
    known: topicIdsOf(topics),
    paused: yield* Ref.make(false),
  };
  const outcomes = yield* Effect.forEach(pending, (job) => runJob(context, job), { concurrency: options.concurrency });
  const imported = yield* importLibraryMineRecords(root);
  const count = (outcome: JobOutcome["outcome"]) => A.filter(outcomes, (entry) => entry.outcome === outcome).length;
  yield* Console.log(
    `library mine ${tier}: completed=${count("completed")} failed=${count("failed")} paused=${count("paused")} skippedUnreadable=${count("skipped-unreadable")} importedModelRuns=${imported.modelRuns} importedFindings=${imported.findings} importedPdfReports=${imported.documents}; receipts in ${MINE_ROOT}/${tier}/receipts, derived PDF text in ${MINE_ROOT}/text`
  );
  const failed = A.filter(outcomes, (entry) => entry.outcome !== "completed" && entry.outcome !== "skipped-unreadable");
  if (A.isReadonlyArrayNonEmpty(failed))
    return yield* LibraryMineBatchError.make({
      failed: A.map(failed, (entry) => entry.label),
      paused: count("paused") > 0,
      message: `${failed.length} ${tier} job(s) did not complete; rerun resumes from the receipts.`,
    });
  return { completed: count("completed"), failed: 0, paused: 0, skippedUnreadable: count("skipped-unreadable") };
});

/**
 * T1: give every readable artifact of an intake without a triage record one.
 *
 * **Example** (Prepare a dry run)
 * ```ts
 * import { mineLibraryTriage, LibraryMineOptions } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * const options = LibraryMineOptions.make({ intake: "2026-11-06", profile: "codex-luna", limit: O.none(), concurrency: 2, dryRun: true, excludePrivate: false, repoRoot: O.none() })
 * console.log(mineLibraryTriage("/library", options).pipe !== undefined)
 * ```
 *
 * @param root - Directory holding the catalog, object store and `ops/mine` records.
 * @param options - Intake, runner profile and batch controls.
 * @returns Job counts for the run.
 * @category use-cases
 * @since 0.0.0
 */
export const mineLibraryTriage = Effect.fn("Library.mine.triage")(function* (
  root: string,
  options: LibraryMineOptions
) {
  return yield* runTier(root, "t1", options);
});

/**
 * T2: give every T1-selected artifact of an intake a span-checked reading.
 *
 * **Details**
 *
 * Private-partition artifacts are refused for external lanes (`junie`, `cursor`) with
 * `LibraryMinePrivateRouteError` before any runner launches.
 *
 * **Example** (Prepare a dry run)
 * ```ts
 * import { mineLibraryRead, LibraryMineOptions } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * const options = LibraryMineOptions.make({ intake: "2026-11-06", profile: "claude", limit: O.some(5), concurrency: 2, dryRun: true, excludePrivate: false, repoRoot: O.none() })
 * console.log(mineLibraryRead("/library", options).pipe !== undefined)
 * ```
 *
 * @param root - Directory holding the catalog, object store and `ops/mine` records.
 * @param options - Intake, runner profile and batch controls.
 * @returns Job counts for the run.
 * @category use-cases
 * @since 0.0.0
 */
export const mineLibraryRead = Effect.fn("Library.mine.read")(function* (root: string, options: LibraryMineOptions) {
  return yield* runTier(root, "t2", options);
});

// T3 never extracts: a PDF capture is bound only through text an earlier T1/T2 run derived.
const synthesisText = Effect.fn("Library.mine.synthesisText")(function* (
  root: string,
  captureId: string,
  artifact: LibraryArtifact
) {
  if (!isPdfArtifact(artifact)) return yield* readBoundText(root, artifact);
  const receipt = yield* readLibraryMineDerivedText(root, artifact.sha256);
  if (O.isNone(receipt) || receipt.value.outcome === "no-text")
    return yield* LibraryMineUnreadError.make({
      artifactId: `${captureId}:t3`,
      message: O.isNone(receipt)
        ? `Capture ${captureId} is a PDF without derived text; run mine triage first.`
        : `Capture ${captureId} is a PDF without extractable text.`,
    });
  return yield* readLibraryMineDerivedTextBody(root, receipt.value);
});

/**
 * T3: import a session-authored synthesis as findings with a ModelRun naming the orchestrator.
 *
 * **Details**
 *
 * Every finding must bind an effective readable capture of its source and quote a
 * verbatim span of that capture's text. Re-importing the same synthesis id is a no-op.
 *
 * **Example** (Prepare an import)
 * ```ts
 * import { mineLibrarySynthesize } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * console.log(mineLibrarySynthesize("/library", "/tmp/t3.json", O.none(), true).pipe !== undefined)
 * ```
 *
 * @param root - Directory holding the catalog, object store and `ops/mine` records.
 * @param file - Synthesis JSON file.
 * @param repoRoot - Repository whose packets supply topic ids; default: the enclosing repository.
 * @param dryRun - Validate and report without writing.
 * @returns The number of findings imported.
 * @category use-cases
 * @since 0.0.0
 */
export const mineLibrarySynthesize = Effect.fn("Library.mine.synthesize")(function* (
  root: string,
  file: string,
  repoRoot: O.Option<string>,
  dryRun: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(file).pipe(mapFailure("Cannot read synthesis file."));
  const synthesis = yield* S.decodeEffect(SynthesisJson)(raw).pipe(mapFailure("Synthesis file failed its schema."));
  const runId = `mine:t3:${synthesis.id}`;
  const catalog = yield* loadCatalog(root);
  if (A.some(catalog.modelRuns, (run) => run.id === runId)) {
    yield* Console.log(`library mine t3: ${synthesis.id} already imported; nothing to do.`);
    return { findings: 0 };
  }
  const captures = HashMap.fromIterable(A.map(catalog.captures, (capture) => [capture.id, capture] as const));
  const readable = yield* Effect.forEach(
    A.dedupe(A.map(synthesis.findings, (finding) => finding.sourceId)),
    Effect.fnUntraced(function* (sourceId) {
      const source = sourceById(catalog, sourceId);
      if (O.isNone(source)) return [];
      const claims = yield* libraryEffectiveCaptures(root, catalog, source.value);
      return A.flatMap(claims, (claim) =>
        claim.category === "readable" && claim.capture !== null && claim.capture.complete
          ? [`${sourceId}\u0000${claim.capture.id}`]
          : []
      );
    })
  ).pipe(Effect.map((ids) => HashSet.fromIterable(A.flatten(ids))));
  const topics = yield* loadTopics(repoRoot);
  const known = topicIdsOf(topics);
  const startedAt = yield* now;
  const modelRun = LibraryModelRun.make({
    id: runId,
    model: synthesis.author.model,
    effort: synthesis.author.effort,
    route: synthesis.author.route,
    startedAt,
    argv: synthesis.author.argv,
  });
  const findings = yield* Effect.forEach(
    synthesis.findings,
    Effect.fnUntraced(function* (finding, index) {
      const artifactId = `${finding.captureId}:t3`;
      const capture = HashMap.get(captures, finding.captureId);
      const source = sourceById(catalog, finding.sourceId);
      if (
        O.isNone(capture) ||
        O.isNone(source) ||
        !HashSet.has(readable, `${finding.sourceId}\u0000${finding.captureId}`)
      )
        return yield* LibraryMineUnreadError.make({
          artifactId,
          message: `Finding ${index} binds capture ${finding.captureId}, which is not an effective readable capture of ${finding.sourceId}.`,
        });
      const artifact = O.orElse(libraryMineTextArtifact(capture.value), () => libraryMinePdfArtifact(capture.value));
      if (O.isNone(artifact))
        return yield* LibraryMineUnreadError.make({
          artifactId,
          message: `Capture ${finding.captureId} has no bound text artifact.`,
        });
      const text = yield* synthesisText(root, finding.captureId, artifact.value);
      const [span = finding.span] = yield* checkLibraryMineSpans(
        `${finding.captureId}:${artifact.value.sha256}`,
        text,
        [finding.span]
      );
      return LibraryFinding.make({
        id: `mine:t3:${synthesis.id}:${index}`,
        sourceId: source.value.id,
        captureId: finding.captureId,
        citoRelation: finding.citoRelation,
        span,
        summary: finding.summary,
        topicIds: partitionTopics(known, finding.topicIds).kept,
        modelRunId: runId,
        recordedAt: startedAt,
      });
    })
  );
  const dropped = A.flatMap(synthesis.findings, (finding) => partitionTopics(known, finding.topicIds).dropped);
  yield* Console.log(
    `library mine t3: ${synthesis.id} findings=${findings.length} droppedTopicIds=${dropped.length} author=${modelRun.model}/${modelRun.effort}/${modelRun.route}${dryRun ? " (dry run)" : ""}`
  );
  if (dryRun) return { findings: 0 };
  const stamp = Str.replace(/[^0-9]/g, "")(startedAt);
  const input = yield* saveText(root, `${tierDir("t3", "outputs")}/${synthesis.id}/${stamp}.json`, raw);
  yield* writeReceipt(
    root,
    "t3",
    synthesis.id,
    stamp,
    LibraryMineReceipt.make({
      tier: "t3",
      jobKey: synthesis.id,
      artifactId: synthesis.id,
      profile: "orchestrator",
      modelRun,
      outcome: "completed",
      errorTag: "",
      message: "",
      promptSha256: "",
      outputSha256: input.sha256,
      findingIds: A.map(findings, (finding) => finding.id),
      droppedTopicIds: dropped,
      recordedAt: startedAt,
    })
  );
  yield* withCatalog(root, (current) =>
    Effect.succeed(
      A.some(current.modelRuns, (run) => run.id === runId) ? current : catalogWith(current, [modelRun], findings)
    )
  );
  return { findings: findings.length };
});
