/**
 * Read-only integrity and coverage gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { requiredLibraryAdapters } from "./Library.acquire.ts";
import { encodeLibraryJson, runLibraryCommand } from "./Library.adapter.ts";
import { LibraryCaptureCorrection } from "./Library.corrections.ts";
import { LibraryError } from "./Library.errors.ts";
import { libraryEffectiveCaptures, libraryEffectiveCategory, librarySourceEvidenceValid } from "./Library.evidence.ts";
import { LibraryDispositionImportPayload, libraryDispositionValid } from "./Library.import.ts";
import { libraryArtifactIntegrity } from "./Library.integrity.ts";
import { extractLibraryReferences } from "./Library.inventory.ts";
import { decodeProviderEvents, validateProviderQualification } from "./Library.provenance.ts";
import { LibraryProbeEvidence } from "./Library.qualify.ts";
import { LibraryCapture, LibraryIntake } from "./Library.schemas.ts";
import { hashBytes, loadCatalog } from "./Library.store.ts";
import { libraryCitedRevisions } from "./Library.versions.ts";
import type {
  LibraryArtifact,
  LibraryIntakeFile,
  LibraryOccurrence,
  LibraryReference,
  LibrarySource,
} from "./Library.schemas.ts";

const LibraryIntakeJson = S.fromJsonString(LibraryIntake);
const LibraryCaptureCorrectionJson = S.fromJsonString(LibraryCaptureCorrection);
const LibraryCaptureJson = S.fromJsonString(LibraryCapture);
const LibraryDispositionImportPayloadJson = S.fromJsonString(LibraryDispositionImportPayload);
const LibraryProbeEvidenceJson = S.fromJsonString(LibraryProbeEvidence);

const $I = $RepoCliId.create("commands/Research/Library/Library.verify");
class RepositoryPin extends S.Class<RepositoryPin>($I`RepositoryPin`)(
  { remote: S.String, revision: S.String, clone: S.String, requestedRevision: S.String },
  $I.annote("RepositoryPin", {
    description: "A requested reference resolved to an immutable Git commit and local object database.",
  })
) {}
const RepositoryPinJson = S.fromJsonString(RepositoryPin);

const citationSpanMatches = (item: LibraryOccurrence, reference: LibraryReference) =>
  item.locator === reference.locator &&
  item.line === reference.line &&
  item.column === reference.column &&
  item.endLine === reference.endLine &&
  item.endColumn === reference.endColumn;
const citationSyntaxMatches = (item: LibraryOccurrence, reference: LibraryReference) =>
  item.form === reference.form &&
  item.citationText === reference.citationText &&
  item.referenceKey === reference.referenceKey;
const citationDefinitionMatches = (item: LibraryOccurrence, reference: LibraryReference) =>
  item.definitionLine === reference.definitionLine &&
  item.definitionColumn === reference.definitionColumn &&
  item.definitionEndLine === reference.definitionEndLine &&
  item.definitionEndColumn === reference.definitionEndColumn;

const correctionBeforeMatches = (
  before: LibraryCapture,
  capture: LibraryCapture,
  source: LibrarySource,
  receipt: LibraryCaptureCorrection
) =>
  before.status === "readable" &&
  before.id === capture.id &&
  before.sourceId === source.id &&
  receipt.captureId === capture.id &&
  receipt.sourceId === source.id;
const correctionDemotionMatches = (capture: LibraryCapture, receipt: LibraryCaptureCorrection) =>
  capture.status === "blocked" &&
  !capture.complete &&
  receipt.after.status === "blocked" &&
  !receipt.after.complete &&
  Str.isNonEmpty(Str.trim(receipt.recordedAt)) &&
  Str.isNonEmpty(Str.trim(receipt.reason));
const correctionRevisionMatches = (before: LibraryCapture, receipt: LibraryCaptureCorrection) =>
  receipt.after.requestedRevision === before.requestedRevision &&
  receipt.after.capturedRevision === before.capturedRevision &&
  receipt.after.method === before.method &&
  receipt.after.recordedAt === before.recordedAt;
const correctionOriginalsMatch = (before: LibraryCapture, receipt: LibraryCaptureCorrection) => {
  const retained = A.filter(receipt.after.artifacts, (item) => item.role !== "invalidated-capture-snapshot");
  return A.every(retained, (item) =>
    A.some(
      before.artifacts,
      (original) =>
        original.path === item.path &&
        original.sha256 === item.sha256 &&
        original.bytes === item.bytes &&
        original.role === item.role
    )
  );
};
const correctionSnapshotMatches = (receipt: LibraryCaptureCorrection) =>
  A.some(
    receipt.after.artifacts,
    (item) =>
      item.path === receipt.before.path && item.sha256 === receipt.before.sha256 && item.bytes === receipt.before.bytes
  );
const pinIdentityMatches = (
  pin: RepositoryPin,
  source: LibrarySource,
  capture: LibraryCapture,
  knownRevisions: ReadonlyArray<string>
) =>
  pin.revision === capture.capturedRevision &&
  A.contains(knownRevisions, pin.requestedRevision) &&
  pin.clone === `repos/github/${source.repository}` &&
  pin.remote === `https://github.com/${source.repository}.git`;
const targetRevision = (source: LibrarySource, capture: LibraryCapture) => {
  if (source.kind === "youtube")
    return { revision: capture.requestedRevision, reason: "video request differs from inventoried source target" };
  if (source.kind === "paper" && Str.startsWith("arxiv:")(source.identity))
    return { revision: capture.requestedRevision, reason: "paper requested revision differs from source versions" };
  return { revision: capture.capturedRevision, reason: "captured revision differs from source versions" };
};

const correctionRetainedStateMatches = (before: LibraryCapture, receipt: LibraryCaptureCorrection) =>
  correctionSnapshotMatches(receipt) &&
  correctionOriginalsMatch(before, receipt) &&
  correctionRevisionMatches(before, receipt);
const cloneWithinLibrary = (path: Path.Path, repository: string, cloneRelative: string) =>
  /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(repository) &&
  cloneRelative !== ".." &&
  !path.isAbsolute(cloneRelative) &&
  !Str.startsWith(`..${path.sep}`)(cloneRelative);
const qualifiedProbeIdentityMatches = (
  adapter: string,
  probe: LibraryProbeEvidence,
  source: LibrarySource,
  capture: LibraryCapture
) =>
  probe.adapter === adapter &&
  probe.status === "verified" &&
  probe.complete &&
  capture.complete &&
  capture.status === "readable" &&
  capture.sourceId === source.id;
const qualifiedProbeMethodMatches = (adapter: string, source: LibrarySource, capture: LibraryCapture) =>
  capture.method === adapter ||
  (adapter === "youtube" && source.kind === "youtube" && capture.method === "youtube-transcript-api");
const qualifiedProbeUrlMatches = (probe: LibraryProbeEvidence, source: LibrarySource) =>
  probe.sourceUrl === source.canonicalUrl ||
  A.some(source.versions, (version) => version.canonicalUrl === probe.sourceUrl);
const qualifiedProbeArtifactsMatch = (probe: LibraryProbeEvidence, capture: LibraryCapture) =>
  A.isReadonlyArrayNonEmpty(probe.artifacts) &&
  A.every(probe.artifacts, (item) =>
    A.some(
      capture.artifacts,
      (actual) => actual.path === item.path && actual.sha256 === item.sha256 && actual.bytes === item.bytes
    )
  );

const makeVerificationContext = Effect.fn("Library.verificationContext")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const catalog = yield* loadCatalog(root);
  const problems: Array<string> = [];
  const issue = (message: string) => {
    problems.push(message);
  };
  const unique = (ids: ReadonlyArray<string>, label: string) => {
    if (A.dedupe(ids).length !== ids.length) issue(`${label}: duplicate identities`);
  };
  unique(
    A.map(catalog.documents, (item) => item.id),
    "documents"
  );
  unique(
    A.map(catalog.sources, (item) => item.id),
    "sources"
  );
  unique(
    A.map(catalog.occurrences, (item) => item.id),
    "occurrences"
  );
  unique(
    A.map(catalog.captures, (item) => item.id),
    "captures"
  );
  unique(
    A.map(catalog.qualifications, (item) => item.id),
    "qualifications"
  );
  const artifactValid = Effect.fn("Research.Library.verifyArtifact")(function* (artifact: LibraryArtifact) {
    const problem = yield* libraryArtifactIntegrity(root, artifact);
    if (O.isSome(problem)) issue(`${artifact.path}: ${problem.value}`);
    return O.isNone(problem);
  });
  return { root, fs, path, catalog, problems, issue, artifactValid };
});
type VerificationContext = Effect.Success<ReturnType<typeof makeVerificationContext>>;
const verifyIntakeCensus = Effect.fn("Library.verifyIntakeCensus")(function* (context: VerificationContext) {
  const { root, fs, path, catalog, issue, artifactValid } = context;
  const verifyIntakeFile = Effect.fn("Library.verifyIntakeFile")(function* (file: LibraryIntakeFile) {
    yield* artifactValid({
      path: file.snapshotPath,
      sha256: file.sha256,
      bytes: file.bytes,
      role: "intake-input",
      mediaType: "application/octet-stream",
    });
    if (
      file.parseable &&
      !A.some(
        catalog.documents,
        (document) =>
          document.originalPath === file.originalPath &&
          document.snapshotPath === file.snapshotPath &&
          document.sha256 === file.sha256 &&
          document.bytes === file.bytes
      )
    )
      issue(`${file.originalPath}: parseable intake input missing from report census`);
  });
  const verifyIntakeManifest = Effect.fn("Library.verifyIntakeManifest")(function* (intake: LibraryIntake) {
    const manifestArtifact = A.findFirst(
      catalog.artifacts,
      (artifact) => artifact.path === intake.manifestPath && artifact.role === "intake-manifest"
    );
    if (O.isNone(manifestArtifact)) issue(`${intake.id}: intake manifest is not hash-bound`);
    else {
      const decoded = yield* fs
        .readFileString(path.resolve(root, intake.manifestPath))
        .pipe(Effect.flatMap(S.decodeEffect(LibraryIntakeJson)), Effect.option);
      if (
        O.isNone(decoded) ||
        (yield* S.encodeEffect(LibraryIntakeJson)(decoded.value)) !== (yield* S.encodeEffect(LibraryIntakeJson)(intake))
      )
        issue(`${intake.id}: catalog census differs from immutable intake`);
    }
  });
  for (const intake of catalog.intakes) {
    yield* verifyIntakeManifest(intake);
    for (const file of intake.files) yield* verifyIntakeFile(file);
  }
});
const verifyDocumentCitations = Effect.fn("Library.verifyDocumentCitations")(function* (context: VerificationContext) {
  const { root, fs, path, catalog, issue, artifactValid } = context;
  yield* Effect.forEach(catalog.artifacts, artifactValid, { concurrency: 1 });
  yield* Effect.forEach(
    catalog.documents,
    Effect.fnUntraced(function* (document) {
      const valid = yield* artifactValid({
        path: document.snapshotPath,
        sha256: document.sha256,
        bytes: document.bytes,
        mediaType: "text/markdown",
        role: "report",
      });
      if (!valid) return;
      const text = yield* fs
        .readFileString(path.resolve(root, document.snapshotPath))
        .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot read verified report", cause })));
      const expected = extractLibraryReferences(
        text,
        A.flatMap(catalog.sources, (source) => [source.repository, source.identity])
      );
      const actual = A.filter(catalog.occurrences, (item) => item.documentId === document.id);
      if (expected.length !== document.expectedOccurrences || actual.length !== expected.length)
        issue(`${document.id}: citation census mismatch`);
      yield* Effect.forEach(expected, (reference) =>
        Effect.sync(() => {
          const matches = A.filter(
            actual,
            (item) =>
              citationSpanMatches(item, reference) &&
              citationSyntaxMatches(item, reference) &&
              citationDefinitionMatches(item, reference)
          );
          if (matches.length !== 1)
            issue(`${document.id}:${reference.line}:${reference.column}: missing or ambiguous citation occurrence`);
        })
      );
    }),
    { concurrency: 1 }
  );
});
const verifyOccurrenceBindings = Effect.fn("Library.verifyOccurrenceBindings")(function* (
  context: VerificationContext
) {
  const { catalog, issue } = context;
  const verifyOccurrence = Effect.fn("Library.verifyOccurrence")(function* (occurrence: LibraryOccurrence) {
    if (!A.some(catalog.documents, (item) => item.id === occurrence.documentId))
      issue(`${occurrence.id}: unknown report`);
    const source = A.findFirst(catalog.sources, (item) => item.id === occurrence.sourceId);
    if (O.isNone(source)) issue(`${occurrence.id}: unknown source`);
    else if (!A.contains(source.value.locators, occurrence.locator))
      issue(`${occurrence.id}: locator absent from linked source`);
    else {
      const bound = A.filter(source.value.versions, (version) => A.contains(version.locators, occurrence.locator));
      if (A.isReadonlyArrayNonEmpty(bound) && !A.some(bound, (version) => version.revision === occurrence.revision))
        issue(`${occurrence.id}: citation revision differs from locator version`);
    }
  });
  for (const occurrence of catalog.occurrences) yield* verifyOccurrence(occurrence);
});
const verifySourceCoverage = Effect.fn("Library.verifySourceCoverage")(function* (context: VerificationContext) {
  const { root, fs, path, catalog, issue, artifactValid } = context;
  let readable = 0;
  let unavailable = 0;
  let nonReferences = 0;
  let missing = 0;
  let ambiguous = 0;
  let failed = 0;
  let interrupted = 0;
  let providerBlocked = 0;
  let incomplete = 0;
  let toolBlocked = 0;
  const versionCategories: Record<string, number> = {
    readable: 0,
    unavailable: 0,
    ambiguous: 0,
    incomplete: 0,
    "tool-blocked": 0,
    internal: 0,
    operational: 0,
    "non-reference": 0,
    missing: 0,
  };
  const verifyCaptureCorrections = Effect.fn("Library.verifyCaptureCorrections")(function* (
    source: LibrarySource,
    capture: LibraryCapture
  ) {
    const corrections = A.filter(capture.artifacts, (artifact) => artifact.role === "capture-correction");
    if (
      A.some(capture.artifacts, (artifact) => artifact.role === "invalidated-capture-snapshot") &&
      corrections.length !== 1
    )
      issue(`${capture.id}: invalidated reading claim lacks one correction receipt`);
    const verifyCorrection = Effect.fn("Library.verifyCorrection")(function* (artifact: LibraryArtifact) {
      const correction = yield* fs
        .readFileString(path.resolve(root, artifact.path))
        .pipe(Effect.flatMap(S.decodeEffect(LibraryCaptureCorrectionJson)), Effect.option);
      if (O.isNone(correction)) {
        issue(`${capture.id}: correction receipt invalid`);
        return;
      }
      const receipt = correction.value;
      const before = yield* fs
        .readFileString(path.resolve(root, receipt.before.path))
        .pipe(Effect.flatMap(S.decodeEffect(LibraryCaptureJson)), Effect.option);
      const current = LibraryCapture.make({
        ...capture,
        artifacts: A.filter(capture.artifacts, (item) => item.role !== "capture-correction"),
      });
      const afterText = yield* encodeLibraryJson(receipt.after);
      if (
        !(yield* artifactValid(receipt.before)) ||
        O.isNone(before) ||
        !correctionBeforeMatches(before.value, capture, source, receipt) ||
        !correctionDemotionMatches(capture, receipt) ||
        (yield* hashBytes(new TextEncoder().encode(afterText))) !== receipt.afterSha256 ||
        (yield* encodeLibraryJson(current)) !== afterText ||
        !correctionRetainedStateMatches(before.value, receipt)
      )
        issue(`${capture.id}: correction does not bind immutable before and demoted after state`);
    });
    for (const artifact of corrections) yield* verifyCorrection(artifact);
  });
  const verifyCaptureReview = Effect.fn("Library.verifyCaptureReview")(function* (
    source: LibrarySource,
    capture: LibraryCapture,
    validity: ReadonlyArray<boolean>
  ) {
    if (
      A.some(capture.artifacts, (artifact) => artifact.role === "reviewed-disposition") ||
      capture.status === "unavailable" ||
      capture.status === "non-reference"
    ) {
      const receipt = A.findFirst(capture.artifacts, (artifact) => artifact.role === "reviewed-disposition");
      const disposition = O.isSome(receipt)
        ? yield* fs
            .readFileString(path.resolve(root, receipt.value.path))
            .pipe(Effect.flatMap(S.decodeEffect(LibraryDispositionImportPayloadJson)), Effect.option)
        : O.none();
      const validReview = yield* libraryDispositionValid(root, catalog, source, capture).pipe(
        Effect.orElseSucceed(() => false)
      );
      if (validReview && O.isSome(disposition) && A.every(validity, (valid) => valid)) {
      } else issue(`${capture.id}: ${capture.status} status lacks a valid identity-bound reviewed disposition`);
    }
  });
  const verifyHistoricalCapture = Effect.fn("Library.verifyHistoricalCapture")(function* (
    source: LibrarySource,
    capture: LibraryCapture,
    knownRevisions: ReadonlyArray<string>
  ) {
    const validity = yield* Effect.forEach(capture.artifacts, artifactValid, { concurrency: 1 });
    yield* verifyCaptureCorrections(source, capture);
    let captureGood = true;
    const verifyReadingClaim = Effect.fn("Library.verifyReadingClaim")(function* () {
      captureGood =
        capture.complete && A.isReadonlyArrayNonEmpty(capture.artifacts) && A.every(validity, (valid) => valid);
      if (capture.status === "readable" && !captureGood)
        issue(`${capture.id}: partial or invalid capture marked readable`);
      if (capture.status === "readable" && captureGood) {
        const semantic = yield* librarySourceEvidenceValid(root, source, capture).pipe(Effect.option);
        if (O.isNone(semantic) || !semantic.value) {
          issue(`${capture.id}: source-kind evidence or target provenance missing`);
          captureGood = false;
        }
      }
    });
    yield* verifyReadingClaim();
    const verifyPinnedClone = Effect.fn("Library.verifyPinnedClone")(function* (pin: RepositoryPin) {
      const cloneReal = yield* fs.realPath(path.resolve(root, pin.clone)).pipe(Effect.option);
      const rootReal = yield* fs.realPath(root).pipe(Effect.option);
      const cloneRelative =
        O.isSome(cloneReal) && O.isSome(rootReal) ? path.relative(rootReal.value, cloneReal.value) : "..";
      const cloneSafe = cloneWithinLibrary(path, source.repository, cloneRelative);
      if (!cloneSafe) {
        issue(`${capture.id}: repository clone escapes library`);
        captureGood = false;
      }
      const object = cloneSafe
        ? yield* runLibraryCommand(
            root,
            "git",
            ["-C", path.resolve(root, pin.clone), "cat-file", "-t", pin.revision],
            1000
          ).pipe(Effect.option)
        : O.none();
      if (cloneSafe && (O.isNone(object) || Str.trim(object.value) !== "commit")) {
        issue(`${capture.id}: pinned commit unavailable in local repository`);
        captureGood = false;
      }
    });
    const verifyRepositoryPin = Effect.fn("Library.verifyRepositoryPin")(function* () {
      const pinArtifact = A.findFirst(capture.artifacts, (artifact) => artifact.role === "repository-pin");
      const pin = O.isSome(pinArtifact)
        ? yield* fs
            .readFileString(path.resolve(root, pinArtifact.value.path))
            .pipe(Effect.flatMap(S.decodeUnknownEffect(RepositoryPinJson)), Effect.option)
        : O.none();
      if (O.isNone(pin) || !pinIdentityMatches(pin.value, source, capture, knownRevisions)) {
        issue(`${capture.id}: repository pin does not bind requested revision and clone`);
        captureGood = false;
      } else {
        yield* verifyPinnedClone(pin.value);
      }
    });
    const verifyCapturedRevision = Effect.fn("Library.verifyCapturedRevision")(function* () {
      if (capture.status !== "readable") return;
      if (Str.startsWith("github-")(source.kind)) return yield* verifyRepositoryPin();
      const target = targetRevision(source, capture);
      if (!A.contains(knownRevisions, target.revision)) {
        issue(`${capture.id}: ${target.reason}`);
        captureGood = false;
      }
    });
    yield* verifyCapturedRevision();
    yield* verifyCaptureReview(source, capture, validity);
    if (capture.status === "blocked") providerBlocked++;
    if (capture.status === "failed") failed++;
    if (capture.status === "running" || capture.status === "interrupted") interrupted++;
  });
  for (const capture of catalog.captures) {
    if (!A.some(catalog.sources, (item) => item.id === capture.sourceId))
      issue(`${capture.id}: unknown capture source`);
  }
  const recordPrimaryCategory = (primary: string) => {
    if (primary === "ambiguous") ambiguous++;
    if (primary === "incomplete") incomplete++;
    if (primary === "tool-blocked") toolBlocked++;
    if (primary === "non-reference") nonReferences++;
    if (primary === "readable") readable++;
    if (A.contains(["unavailable", "internal", "operational"], primary)) unavailable++;
  };
  const recordMissingSource = (source: LibrarySource) => {
    versionCategories.missing = (versionCategories.missing ?? 0) + libraryCitedRevisions(catalog, source).length;
    if (source.kind === "unresolved" || source.ownership === "unresolved") {
      ambiguous++;
      issue(`${source.id}: unresolved source identity`);
    }
    missing++;
    issue(`${source.id}: no source capture or reviewed disposition`);
  };
  const verifySource = Effect.fn("Library.verifySource")(function* (source: LibrarySource) {
    const captures = A.filter(catalog.captures, (item) => item.sourceId === source.id);
    if (!A.isReadonlyArrayNonEmpty(captures)) {
      recordMissingSource(source);
      return;
    }
    const knownRevisions = A.dedupe([source.revision, ...A.map(source.versions, (version) => version.revision)]);
    for (const capture of captures) yield* verifyHistoricalCapture(source, capture, knownRevisions);
    const current = yield* libraryEffectiveCaptures(root, catalog, source);
    const categories = A.map(current, (item) => item.category);
    for (const category of categories) versionCategories[category] = (versionCategories[category] ?? 0) + 1;
    const primary = libraryEffectiveCategory(categories);
    if (primary === "missing") {
      missing++;
      issue(
        `${source.id}: missing readable capture or valid reviewed disposition for revisions ${A.join(
          A.map(
            A.filter(current, (item) => item.category === "missing"),
            (item) => item.revision
          ),
          ", "
        )}; provider failure does not prove source inaccessible`
      );
    }
    recordPrimaryCategory(primary);
  });
  for (const source of catalog.sources) yield* verifySource(source);
  return {
    readable,
    unavailable,
    nonReferences,
    missing,
    ambiguous,
    failed,
    interrupted,
    providerBlocked,
    incomplete,
    toolBlocked,
    versionCategories,
  };
});
const verifyRequiredQualifications = Effect.fn("Library.verifyRequiredQualifications")(function* (
  context: VerificationContext
) {
  const { root, fs, path, catalog, issue, artifactValid } = context;
  let requiredVerified = 0;
  let requiredFailed = 0;
  const verifyRequiredRoute = Effect.fn("Library.verifyRequiredRoute")(function* (adapter: string) {
    const qualification = A.findLast(catalog.qualifications, (item) => item.adapter === adapter && item.required);
    if (O.isNone(qualification)) {
      requiredFailed++;
      issue(`${adapter}: required route qualification missing`);
      return;
    }
    const receipt = qualification.value;
    const validity = yield* Effect.forEach(receipt.evidence, artifactValid, { concurrency: 1 });
    let validProbe = false;
    const verifyBoundProbe = Effect.fn("Library.verifyBoundProbe")(function* (probe: LibraryProbeEvidence) {
      const capture = A.findFirst(catalog.captures, (item) => item.id === probe.captureId);
      const source = A.findFirst(
        catalog.sources,
        (item) => item.id === probe.sourceId || A.contains(item.aliasIds, probe.sourceId)
      );
      if (
        O.isSome(capture) &&
        O.isSome(source) &&
        qualifiedProbeIdentityMatches(adapter, probe, source.value, capture.value) &&
        qualifiedProbeMethodMatches(adapter, source.value, capture.value) &&
        qualifiedProbeUrlMatches(probe, source.value) &&
        qualifiedProbeArtifactsMatch(probe, capture.value)
      )
        return true;
      return false;
    });
    const verifyProbeArtifact = Effect.fn("Library.verifyProbeArtifact")(function* (artifact: LibraryArtifact) {
      if (
        artifact.role === "raw-provider-events" &&
        A.contains(["grok-deep-research", "grok-x-import", "alphaxiv"], adapter)
      ) {
        const confirmed = yield* fs.readFileString(path.resolve(root, artifact.path)).pipe(
          Effect.flatMap(decodeProviderEvents),
          Effect.flatMap((events) => validateProviderQualification(adapter, events)),
          Effect.option
        );
        return O.isSome(confirmed) && confirmed.value;
      }
      if (
        artifact.role !== "qualification-probe" ||
        A.contains(["grok-deep-research", "grok-x-import", "alphaxiv"], adapter)
      )
        return false;
      const probe = yield* fs
        .readFileString(path.resolve(root, artifact.path))
        .pipe(Effect.flatMap(S.decodeUnknownEffect(LibraryProbeEvidenceJson)), Effect.option);
      if (O.isNone(probe)) return false;
      return yield* verifyBoundProbe(probe.value);
    });
    for (const artifact of receipt.evidence) if (yield* verifyProbeArtifact(artifact)) validProbe = true;
    if (
      receipt.status === "verified" &&
      validProbe &&
      A.every(validity, (valid) => valid) &&
      Str.isNonEmpty(receipt.recordedAt)
    )
      requiredVerified++;
    else {
      requiredFailed++;
      issue(`${adapter}: required route lacks verified source-bound probe evidence`);
    }
  });
  for (const adapter of A.dedupe([
    ...requiredLibraryAdapters(catalog),
    ...A.map(
      A.filter(catalog.qualifications, (qualification) => qualification.required),
      (qualification) => qualification.adapter
    ),
  ])) {
    yield* verifyRequiredRoute(adapter);
  }
  return { requiredVerified, requiredFailed };
});
/**
 * Verify snapshot bytes, complete captures, citation coverage and required probe evidence.
 * **Example** (Gate a local corpus)
 * ```ts
 * import { verifyLibrary } from "@beep/repo-cli/commands/Research"
 * const gate = verifyLibrary("/library")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const verifyLibrary = Effect.fn("Research.Library.verify")(function* (root: string) {
  const context = yield* makeVerificationContext(root);
  const { problems } = context;
  yield* verifyIntakeCensus(context);
  yield* verifyDocumentCitations(context);
  yield* verifyOccurrenceBindings(context);
  const {
    readable,
    unavailable,
    nonReferences,
    missing,
    ambiguous,
    failed,
    interrupted,
    providerBlocked,
    incomplete,
    toolBlocked,
    versionCategories,
  } = yield* verifySourceCoverage(context);
  const { requiredVerified, requiredFailed } = yield* verifyRequiredQualifications(context);
  yield* Console.log(
    `library verify: readable=${readable} unavailable=${unavailable} nonReferences=${nonReferences} missing=${missing} ambiguous=${ambiguous} incomplete=${incomplete} toolBlocked=${toolBlocked} failedAttempts=${failed} interruptedAttempts=${interrupted} providerBlockedAttempts=${providerBlocked} requiredVerified=${requiredVerified} requiredFailed=${requiredFailed} integrityFailures=${problems.length}`
  );
  yield* Console.log(
    `source/version coverage: ${A.join(
      A.map(R.toEntries(versionCategories), ([category, count]) => `${category}=${count}`),
      " "
    )}; historical attempt failures are reported separately`
  );
  if (A.isReadonlyArrayNonEmpty(problems))
    return yield* LibraryError.make({ message: A.join(problems, "\n"), cause: "Research library gate failed" });
});
