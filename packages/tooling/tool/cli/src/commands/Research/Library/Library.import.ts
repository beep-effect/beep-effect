/** Identity-bound import of external acquisition results.
 * @packageDocumentation
 * @since 0.0.0 */
import { $RepoCliId } from "@beep/identity/packages";
import { DateTime, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeLibraryJson, saveLibraryText } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { readLibraryProviderEvents } from "./Library.events.ts";
import { libraryArtifactIntegrity } from "./Library.integrity.ts";
import { classifyLibraryReference } from "./Library.inventory.ts";
import { AlphaFullText, decodeProviderEvents, validateProviderQualification } from "./Library.provenance.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryOccurrence,
  LibraryQualification,
  LibrarySource,
} from "./Library.schemas.ts";
import { hashBytes, loadCatalog, mergeLibraryVersions, saveImmutable, withCatalog } from "./Library.store.ts";
import type { LibraryDocument } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.import");
/** Import envelope; artifact paths identify original local files and their expected hashes.
 * **Example** (Inspect the required provenance boundary)
 * ```ts
 * import { LibraryImportPayload } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryImportPayload.fields.sourceId !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0 */
export class LibraryImportPayload extends S.Class<LibraryImportPayload>($I`LibraryImportPayload`)(
  {
    sourceId: S.String,
    canonicalUrl: S.String,
    method: S.String,
    provider: S.String,
    toolName: S.String,
    toolCallId: S.String,
    complete: S.Boolean,
    capturedRevision: S.String,
    artifacts: S.Array(LibraryArtifact),
  },
  $I.annote("LibraryImportPayload", {
    description: "Hash-bound external evidence with target identity and explicit tool provenance.",
  })
) {}
/** Qualification import derives status from preserved authentic provider events.
 * **Example** (Inspect the required provenance boundary)
 * ```ts
 * import { LibraryQualificationImportPayload } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryQualificationImportPayload.fields.adapter !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0 */
export class LibraryQualificationImportPayload extends S.Class<LibraryQualificationImportPayload>(
  $I`LibraryQualificationImportPayload`
)(
  {
    kind: S.Literal("qualification"),
    adapter: S.Literals(["alphaxiv", "grok-deep-research", "grok-x-import"]),
    provider: S.Literals(["alphaxiv", "grok"]),
    artifacts: S.Array(LibraryArtifact),
  },
  $I.annote("LibraryQualificationImportPayload", {
    description: "Raw provider evidence import whose qualification is computed from real events.",
  })
) {}
/** Explicit reviewed source disposition with preserved evidence.
 * **Example** (Inspect the required provenance boundary)
 * ```ts
 * import { LibraryDispositionImportPayload } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryDispositionImportPayload.fields.locator !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0 */
export class LibraryDispositionImportPayload extends S.Class<LibraryDispositionImportPayload>(
  $I`LibraryDispositionImportPayload`
)(
  {
    kind: S.Literal("disposition"),
    sourceId: S.String,
    locator: S.String,
    disposition: S.Literals([
      "unavailable",
      "ambiguous",
      "incomplete",
      "tool-blocked",
      "internal",
      "operational",
      "non-reference",
    ]),
    reason: S.String.check(S.isMinLength(10), S.isPattern(/\S/)),
    reviewer: S.String.check(S.isMinLength(1), S.isPattern(/\S/)),
    reviewedAt: S.String.check(S.isMinLength(1), S.isPattern(/\S/)),
    artifacts: S.Array(LibraryArtifact).check(S.isMinLength(1)),
  },
  $I.annote("LibraryDispositionImportPayload", {
    description: "Reviewed source accounting distinct from reading or a generic provider failure.",
  })
) {}
const ToolCall = S.Struct({ type: S.Literal("tool_use"), id: S.String, name: S.String, input: S.Unknown });
const ToolResult = S.Struct({ type: S.Literal("tool_result"), tool_use_id: S.String, content: S.Unknown });
const ReturnedPost = S.Struct({ url: S.String, text: S.String, author: S.String });
const ReturnedPosts = S.Struct({ posts: S.Array(ReturnedPost) });

const retainImportedArtifact = Effect.fn("Library.retainImportedArtifact")(function* (
  root: string,
  resultPath: string,
  namespace: string,
  index: number,
  original: LibraryArtifact,
  failureMessage: string,
  role: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* fs.readFile(path.resolve(path.dirname(resultPath), original.path));
  if (bytes.byteLength !== original.bytes || (yield* hashBytes(bytes)) !== original.sha256)
    return yield* LibraryError.make({ message: failureMessage, cause: "integrity" });
  const saved = yield* saveImmutable(root, `${namespace}/${index}-${path.basename(original.path)}`, bytes);
  return { bytes, artifact: LibraryArtifact.make({ ...saved, mediaType: original.mediaType, role }) };
});
const sourceHasLocator = (source: LibrarySource, locator: string) =>
  source.canonicalUrl === locator ||
  A.contains(source.locators, locator) ||
  A.some(source.versions, (version) => version.canonicalUrl === locator || A.contains(version.locators, locator));
const nonReferenceSource = (source: LibrarySource) =>
  A.contains(["unresolved", "internal"], source.kind) || A.contains(["unresolved", "internal"], source.ownership);
const dispositionStatus = (disposition: LibraryDispositionImportPayload["disposition"]) =>
  disposition === "non-reference"
    ? "non-reference"
    : A.contains(["unavailable", "internal", "operational"], disposition)
      ? "unavailable"
      : "blocked";
const captureImportSourceMatches = (source: LibrarySource, payload: LibraryImportPayload) =>
  (source.canonicalUrl === payload.canonicalUrl ||
    A.some(source.versions, (version) => version.canonicalUrl === payload.canonicalUrl)) &&
  Str.isNonEmpty(payload.provider);

const validateDispositionTarget = Effect.fn("Library.validateDispositionTarget")(function* (
  source: LibrarySource,
  payload: LibraryDispositionImportPayload
) {
  if (payload.disposition === "internal" && source.ownership !== "internal") {
    return yield* LibraryError.make({
      message: "Internal disposition conflicts with source ownership.",
      cause: "identity",
    });
  }
  if (payload.disposition === "operational" && source.kind !== "endpoint") {
    return yield* LibraryError.make({
      message: "Operational disposition requires an endpoint source.",
      cause: "identity",
    });
  }
  if (payload.disposition === "non-reference" && !nonReferenceSource(source)) {
    return yield* LibraryError.make({
      message:
        "Non-reference disposition requires an unresolved or internal token source; external URLs cannot be dismissed as non-references.",
      cause: "identity",
    });
  }
});
const importDisposition = Effect.fn("Library.importDisposition")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryDispositionImportPayload
) {
  const catalog = yield* loadCatalog(root);
  const source = A.findFirst(
    catalog.sources,
    (s) => s.id === payload.sourceId || A.contains(s.aliasIds, payload.sourceId)
  );
  if (O.isNone(source) || !sourceHasLocator(source.value, payload.locator)) {
    return yield* LibraryError.make({
      message: "Disposition does not bind to an inventoried source locator.",
      cause: "identity",
    });
  }
  yield* validateDispositionTarget(source.value, payload);
  const id = yield* hashBytes(new TextEncoder().encode(raw));
  const artifacts: Array<LibraryArtifact> = [];
  for (const original of payload.artifacts) {
    const retained = yield* retainImportedArtifact(
      root,
      resultPath,
      `dispositions/${id}`,
      artifacts.length,
      original,
      "Disposition original hash or size mismatch.",
      original.role
    );
    artifacts.push(retained.artifact);
  }
  artifacts.push(
    yield* saveLibraryText(root, `dispositions/${id}/review.json`, raw, "application/json", "reviewed-disposition")
  );
  const status = dispositionStatus(payload.disposition);
  const capture = LibraryCapture.make({
    id,
    sourceId: source.value.id,
    requestedRevision: O.getOrElse(
      A.findFirst(
        source.value.versions,
        (version) => version.canonicalUrl === payload.locator || A.contains(version.locators, payload.locator)
      ),
      () => source.value
    ).revision,
    capturedRevision: "",
    complete: false,
    method: "reviewed-disposition",
    recordedAt: payload.reviewedAt,
    artifacts,
    status,
    reason: `${payload.disposition}: ${payload.reason} (reviewed by ${payload.reviewer}).`,
  });
  if (
    payload.disposition === "non-reference" &&
    !(yield* libraryNonReferenceContextValid(root, catalog, source.value, capture, payload))
  )
    return yield* LibraryError.make({
      message: "Non-reference review must bind every inventoried occurrence to preserved report context.",
      cause: "provenance",
    });
  return yield* withCatalog(root, (current) =>
    Effect.succeed(
      LibraryCatalog.make({
        ...current,
        captures: A.some(current.captures, (c) => c.id === id) ? current.captures : [...current.captures, capture],
      })
    )
  );
});
const importQualification = Effect.fn("Library.importQualification")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryQualificationImportPayload
) {
  if ((payload.adapter === "alphaxiv") !== (payload.provider === "alphaxiv")) {
    return yield* LibraryError.make({ message: "Qualification provider mismatch.", cause: "provenance" });
  }
  const id = yield* hashBytes(new TextEncoder().encode(raw));
  const evidence: Array<LibraryArtifact> = [];
  const events: Array<unknown> = [];
  for (const original of payload.artifacts) {
    const retained = yield* retainImportedArtifact(
      root,
      resultPath,
      `qualifications/${id}`,
      evidence.length,
      original,
      "Qualification original hash or size mismatch.",
      "raw-provider-events"
    );
    evidence.push(retained.artifact);
    events.push(...(yield* decodeProviderEvents(new TextDecoder("utf-8", { ignoreBOM: true }).decode(retained.bytes))));
  }
  yield* validateProviderQualification(payload.adapter, events);
  evidence.push(
    yield* saveLibraryText(root, `qualifications/${id}/import.json`, raw, "application/json", "qualification-import")
  );
  const qualification = LibraryQualification.make({
    id,
    adapter: payload.adapter,
    status: "verified",
    required: true,
    recordedAt: DateTime.formatIso(yield* DateTime.now),
    evidence,
    reason: "Authentic provider events validated independently of installed-version claims.",
  });
  return yield* withCatalog(root, (current) =>
    Effect.succeed(
      LibraryCatalog.make({
        ...current,
        qualifications: A.some(current.qualifications, (q) => q.id === id)
          ? current.qualifications
          : [...current.qualifications, qualification],
      })
    )
  );
});
const captureHasFullText = (
  payload: LibraryImportPayload,
  artifacts: ReadonlyArray<LibraryArtifact>,
  xReturnedBody: boolean,
  alphaFullText: boolean
) =>
  payload.complete &&
  xReturnedBody &&
  alphaFullText &&
  A.some(
    artifacts,
    (a) => A.contains(["raw-full-text", "extracted-full-text", "transcript-full-text"], a.role) && a.bytes > 0
  );
const importCapture = Effect.fn("Library.importCapture")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryImportPayload
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const catalog = yield* loadCatalog(root);
  const source = A.findFirst(
    catalog.sources,
    (candidate) => candidate.id === payload.sourceId || A.contains(candidate.aliasIds, payload.sourceId)
  );
  if (O.isNone(source) || !captureImportSourceMatches(source.value, payload)) {
    return yield* LibraryError.make({
      message: "Import source identity or provider provenance differs from inventory.",
      cause: "identity",
    });
  }
  const recordedAt = DateTime.formatIso(yield* DateTime.now);
  const id = yield* hashBytes(new TextEncoder().encode(raw));
  const artifacts: Array<LibraryArtifact> = [];
  let xReturnedBody = source.value.kind !== "x";
  let alphaFullText = payload.provider !== "alphaxiv";
  const retainCaptureOriginals = Effect.fn("Library.retainCaptureOriginals")(function* () {
    for (const original of payload.artifacts) {
      const retained = yield* retainImportedArtifact(
        root,
        resultPath,
        `imports/${id}`,
        artifacts.length,
        original,
        "Import original hash or size mismatch.",
        original.role
      );
      artifacts.push(retained.artifact);
    }
  });
  yield* retainCaptureOriginals();
  const validateXImport = Effect.fn("Library.validateXImport")(function* () {
    if (payload.provider !== "grok") {
      return yield* LibraryError.make({
        message: "X import requires an observed Grok X Search call.",
        cause: "provenance",
      });
    }
    const nativeEvidence = A.filter(artifacts, (a) => a.role === "raw-provider-events");
    const validateNativeX = Effect.fn("Library.validateNativeX")(function* () {
      const events = yield* Effect.forEach(
        nativeEvidence,
        (a) => fs.readFileString(path.join(root, a.path)).pipe(Effect.flatMap(decodeProviderEvents)),
        { concurrency: 1 }
      );
      yield* validateProviderQualification("grok-x-import", A.flatten(events));
      const returned = A.getSomes(A.map(events, (event) => S.decodeUnknownOption(ReturnedPosts)(event)));
      xReturnedBody = A.some(returned, (response) =>
        A.some(response.posts, (post) => post.url === source.value.canonicalUrl && Str.isNonEmpty(Str.trim(post.text)))
      );
    });
    const validateNamedX = Effect.fn("Library.validateNamedX")(function* () {
      const callArtifact = A.findFirst(artifacts, (a) => a.role === "raw-tool-call");
      const resultArtifact = A.findFirst(artifacts, (a) => a.role === "raw-tool-result");
      if (O.isNone(callArtifact) || O.isNone(resultArtifact))
        return yield* LibraryError.make({
          message: "X import requires raw tool call and result originals.",
          cause: "provenance",
        });
      const call = yield* decodeLibraryJson(ToolCall)(
        yield* fs.readFileString(path.join(root, callArtifact.value.path))
      );
      const result = yield* decodeLibraryJson(ToolResult)(
        yield* fs.readFileString(path.join(root, resultArtifact.value.path))
      );
      if (call.name !== payload.toolName || call.id !== payload.toolCallId || result.tool_use_id !== call.id) {
        return yield* LibraryError.make({ message: "X tool call/result provenance mismatch.", cause: "provenance" });
      }
      const returned = S.decodeUnknownOption(ReturnedPosts)(result.content);
      xReturnedBody =
        O.isSome(returned) &&
        A.some(
          returned.value.posts,
          (post) => post.url === source.value.canonicalUrl && Str.isNonEmpty(Str.trim(post.text))
        );
    });
    if (A.isReadonlyArrayNonEmpty(nativeEvidence)) yield* validateNativeX();
    else yield* validateNamedX();
  });
  if (source.value.kind === "x") yield* validateXImport();
  const retainAlphaFullText = Effect.fn("Library.retainAlphaFullText")(function* () {
    const originals = A.filter(artifacts, (artifact) => artifact.role === "raw-provider-events");
    const events = yield* readLibraryProviderEvents(root, originals);
    const fullText = A.getSomes(A.map(events, (event) => S.decodeUnknownOption(AlphaFullText)(event)));
    const matching = A.findFirst(
      fullText,
      (event) =>
        event.arguments.url === payload.canonicalUrl &&
        A.some(event.result.content, (block) => Str.length(Str.trim(block.text)) > 1000)
    );
    if (O.isSome(matching)) {
      artifacts.push(
        yield* saveLibraryText(
          root,
          `imports/${id}/alphaxiv-full-text.txt`,
          A.join(
            A.map(matching.value.result.content, (block) => block.text),
            "\n"
          ),
          "text/plain",
          "extracted-full-text"
        )
      );
      alphaFullText = true;
    }
  });
  if (payload.provider === "alphaxiv") yield* retainAlphaFullText();
  const finishCaptureImport = Effect.fn("Library.finishCaptureImport")(function* () {
    const readable = captureHasFullText(payload, artifacts, xReturnedBody, alphaFullText);
    artifacts.push(
      yield* saveLibraryText(root, `imports/${id}/provenance.json`, raw, "application/json", "import-provenance")
    );
    const capture = LibraryCapture.make({
      id,
      sourceId: source.value.id,
      requestedRevision: O.getOrElse(
        A.findFirst(source.value.versions, (version) => version.canonicalUrl === payload.canonicalUrl),
        () => source.value
      ).revision,
      method: payload.method,
      recordedAt,
      capturedRevision: payload.capturedRevision,
      complete: readable,
      artifacts,
      status: readable ? "readable" : "blocked",
      reason: readable
        ? "Original hashes, target identity, and provenance validated."
        : source.value.kind === "x" && !xReturnedBody
          ? "Observed X Search invocation retained; transport did not expose source post body, so reading remains incomplete."
          : "Originals preserved; incomplete evidence or AI interpretation cannot count as source reading.",
    });
    return yield* withCatalog(root, (current) =>
      Effect.succeed(
        LibraryCatalog.make({
          ...current,
          captures: A.some(current.captures, (c) => c.id === capture.id)
            ? current.captures
            : [...current.captures, capture],
        })
      )
    );
  });
  return yield* finishCaptureImport();
});
/** Import originals and provenance; AI interpretation never substitutes for source text.
 * **Example** (Build an import effect)
 * ```ts
 * import { importLibraryResult } from "@beep/repo-cli/commands/Research"
 * console.log(importLibraryResult("/library", "/receipts/import.json").pipe !== undefined)
 * ```
 *
 * @category use-cases
 *
 * @since 0.0.0
 */
export const importLibraryResult = Effect.fn("Library.importResult")(function* (root: string, resultPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(resultPath);
  const resolution = yield* decodeLibraryJson(LibraryReferenceResolutionPayload)(raw).pipe(Effect.option);
  if (O.isSome(resolution)) return yield* importReferenceResolution(root, resultPath, raw, resolution.value);
  const disposition = yield* decodeLibraryJson(LibraryDispositionImportPayload)(raw).pipe(Effect.option);
  if (O.isSome(disposition)) return yield* importDisposition(root, resultPath, raw, disposition.value);
  const qualification = yield* decodeLibraryJson(LibraryQualificationImportPayload)(raw).pipe(Effect.option);
  if (O.isSome(qualification)) return yield* importQualification(root, resultPath, raw, qualification.value);
  return yield* importCapture(root, resultPath, raw, yield* decodeLibraryJson(LibraryImportPayload)(raw));
});

const CitationContext = S.Struct({
  occurrenceId: S.String,
  documentId: S.String,
  snapshotPath: S.String,
  documentSha256: S.String,
  line: S.Finite,
  column: S.Finite,
  endLine: S.Finite,
  endColumn: S.Finite,
  locator: S.String,
  context: S.String,
  contextSha256: S.String,
});
const ReviewedContext = S.Struct({
  sourceId: S.String,
  locator: S.String,
  requestedRevision: S.String,
  occurrences: S.Array(CitationContext),
});
/** Reviewed GitHub shorthand resolution with immutable API and citation evidence.
 * **Example** (Inspect the resolution boundary)
 * ```ts
 * import { LibraryReferenceResolutionPayload } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryReferenceResolutionPayload.fields.context !== undefined)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryReferenceResolutionPayload extends S.Class<LibraryReferenceResolutionPayload>(
  $I`LibraryReferenceResolutionPayload`
)(
  {
    kind: S.Literal("reference-resolution"),
    sourceId: S.String,
    locator: S.String,
    canonicalUrl: S.String,
    reason: S.String.check(S.isMinLength(10), S.isPattern(/\S/)),
    reviewer: S.String.check(S.isMinLength(1), S.isPattern(/\S/)),
    reviewedAt: S.String.check(S.isMinLength(1), S.isPattern(/\S/)),
    evidence: LibraryArtifact,
    context: ReviewedContext,
  },
  $I.annote("LibraryReferenceResolutionPayload", {
    description: "Evidence-bound canonical identity resolution that retains original citation positions.",
  })
) {}
const citationPositionMatches = (entry: typeof CitationContext.Type, occurrence: LibraryOccurrence) =>
  entry.line === occurrence.line &&
  entry.column === occurrence.column &&
  entry.endLine === occurrence.endLine &&
  entry.endColumn === occurrence.endColumn;
const citationTextMatches = (entry: typeof CitationContext.Type, occurrence: LibraryOccurrence) =>
  entry.occurrenceId === occurrence.id &&
  entry.documentId === occurrence.documentId &&
  entry.locator === occurrence.locator &&
  entry.context === occurrence.context;
const citationContextMatches = (entry: typeof CitationContext.Type, occurrence: LibraryOccurrence) =>
  citationPositionMatches(entry, occurrence) && citationTextMatches(entry, occurrence);
const GithubResolutionObject = S.Struct({
  url: S.String,
  html_url: S.String,
  number: S.Int,
  pull_request: S.optionalKey(S.Struct({ html_url: S.String })),
});
const GithubResolutionResponse = S.Union([
  GithubResolutionObject,
  S.Array(GithubResolutionObject).check(S.isMinLength(1), S.isMaxLength(1)),
]);
const resolutionProofMatches = (
  proof: typeof GithubResolutionObject.Type,
  repository: string,
  number: string,
  canonicalUrl: string,
  requestedUrl: string
) =>
  Str.toLowerCase(proof.url) === `https://api.github.com/repos/${repository}/issues/${number}` &&
  proof.number.toString() === number &&
  Str.toLowerCase(proof.html_url) === canonicalUrl &&
  requestedUrl === canonicalUrl &&
  (proof.pull_request === undefined || Str.toLowerCase(proof.pull_request.html_url) === canonicalUrl);
const validateResolutionProof = Effect.fn("Library.validateResolutionProof")(function* (
  resultPath: string,
  payload: LibraryReferenceResolutionPayload,
  locator: RegExpMatchArray
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const proofBytes = yield* fs.readFile(path.resolve(path.dirname(resultPath), payload.evidence.path));
  if ((yield* hashBytes(proofBytes)) !== payload.evidence.sha256 || proofBytes.byteLength !== payload.evidence.bytes)
    return yield* LibraryError.make({ message: "Reference resolution API evidence hash differs.", cause: "hash" });
  const envelope = yield* decodeLibraryJson(GithubResolutionResponse)(new TextDecoder().decode(proofBytes));
  const proofObject = S.is(GithubResolutionObject)(envelope) ? O.some(envelope) : A.head(envelope);
  if (O.isNone(proofObject))
    return yield* LibraryError.make({ message: "Reference resolution API object is missing.", cause: "identity" });
  const proof = proofObject.value;
  const repository = Str.toLowerCase(O.getOrElse(O.fromNullishOr(locator[1]), () => ""));
  const number = O.getOrElse(O.fromNullishOr(locator[2]), () => "");
  const route = proof.pull_request === undefined ? "issues" : "pull";
  const canonicalUrl = `https://github.com/${repository}/${route}/${number}`;
  if (!resolutionProofMatches(proof, repository, number, canonicalUrl, payload.canonicalUrl))
    return yield* LibraryError.make({
      message: "Reference resolution GitHub object differs from shorthand.",
      cause: "identity",
    });
  return { proofBytes, repository, canonicalUrl };
});
const resolutionCitations = Effect.fn("Library.resolutionCitations")(function* (
  catalog: LibraryCatalog,
  source: LibrarySource,
  payload: LibraryReferenceResolutionPayload
) {
  let citations: ReadonlyArray<LibraryOccurrence> = [];
  for (const occurrence of A.filter(
    catalog.occurrences,
    (o) => o.sourceId === source.id && o.locator === payload.locator
  )) {
    const originalId = yield* hashBytes(
      new TextEncoder().encode(`unresolved:${occurrence.documentId}:${payload.locator}`)
    );
    if (originalId === payload.sourceId) citations = A.append(citations, occurrence);
  }
  if (A.isReadonlyArrayEmpty(citations) || citations.length !== payload.context.occurrences.length)
    return yield* LibraryError.make({ message: "Reference resolution citation census differs.", cause: "context" });
  return citations;
});
const readOriginalReportBytes = Effect.fn("Library.readOriginalReportBytes")(function* (
  root: string,
  snapshotPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFile(path.resolve(root, snapshotPath));
});
const validateResolutionReport = Effect.fn("Library.validateResolutionReport")(function* (
  root: string,
  document: LibraryDocument,
  occurrence: LibraryOccurrence
) {
  const bytes = yield* readOriginalReportBytes(root, document.snapshotPath);
  const line = O.getOrElse(A.get(Str.split(new TextDecoder().decode(bytes), "\n"), occurrence.line - 1), () => "");
  if (
    (yield* hashBytes(bytes)) !== document.sha256 ||
    bytes.byteLength !== document.bytes ||
    line !== occurrence.context ||
    occurrence.line !== occurrence.endLine ||
    Str.slice(occurrence.column - 1, occurrence.endColumn - 1)(line) !== occurrence.citationText
  )
    return yield* LibraryError.make({
      message: "Reference resolution preserved report bytes differ.",
      cause: "context",
    });
});
const validateResolutionCitation = Effect.fn("Library.validateResolutionCitation")(function* (
  root: string,
  catalog: LibraryCatalog,
  payload: LibraryReferenceResolutionPayload,
  occurrence: LibraryOccurrence
) {
  const entries = A.filter(payload.context.occurrences, (e) => e.occurrenceId === occurrence.id);
  const entry = A.head(entries);
  const document = A.findFirst(catalog.documents, (d) => d.id === occurrence.documentId);
  if (
    entries.length !== 1 ||
    O.isNone(entry) ||
    O.isNone(document) ||
    !citationContextMatches(entry.value, occurrence) ||
    !citationSnapshotMatches(entry.value, document.value) ||
    (yield* hashBytes(new TextEncoder().encode(entry.value.context))) !== entry.value.contextSha256
  )
    return yield* LibraryError.make({
      message: "Reference resolution original context differs.",
      cause: "context",
    });
  yield* validateResolutionReport(root, document.value, occurrence);
});
const resolutionSourceMatches = (source: LibrarySource, payload: LibraryReferenceResolutionPayload) =>
  payload.context.sourceId === payload.sourceId &&
  payload.context.locator === payload.locator &&
  payload.context.requestedRevision === "" &&
  (source.kind === "unresolved" || A.contains(source.aliasIds, payload.sourceId));
const importReferenceResolution = Effect.fn("Library.importReferenceResolution")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryReferenceResolutionPayload
) {
  return yield* withCatalog(root, (catalog) =>
    Effect.gen(function* () {
      const source = A.findFirst(
        catalog.sources,
        (s) => s.id === payload.sourceId || A.contains(s.aliasIds, payload.sourceId)
      );
      const locator = payload.locator.match(/^([A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+)#(\d+)$/);
      if (O.isNone(source) || locator === null || !resolutionSourceMatches(source.value, payload))
        return yield* LibraryError.make({
          message: "Reference resolution source or citation binding differs.",
          cause: "identity",
        });
      const { proofBytes, repository, canonicalUrl } = yield* validateResolutionProof(resultPath, payload, locator);
      const citations = yield* resolutionCitations(catalog, source.value, payload);
      for (const occurrence of citations) yield* validateResolutionCitation(root, catalog, payload, occurrence);
      const documentId = O.getOrElse(
        O.map(A.head(citations), (citation) => citation.documentId),
        () => ""
      );
      const classified = yield* classifyLibraryReference(canonicalUrl, documentId);
      const existing = O.getOrElse(
        A.findFirst(
          catalog.sources,
          (s) =>
            s.id === classified.id ||
            (s.kind === classified.kind && Str.toLowerCase(s.canonicalUrl) === Str.toLowerCase(classified.canonicalUrl))
        ),
        () => classified
      );
      const resolved = LibrarySource.make({
        ...existing,
        aliasIds: A.dedupe([
          ...existing.aliasIds,
          ...source.value.aliasIds,
          payload.sourceId,
          ...(existing.id === classified.id ? [] : [classified.id]),
        ]),
        locators: A.dedupe([...existing.locators, ...source.value.locators, payload.locator]),
        topics: A.dedupe([...existing.topics, ...source.value.topics]),
        versions: mergeLibraryVersions([...existing.versions, ...classified.versions]),
      });
      const repositorySource = yield* classifyLibraryReference(`https://github.com/${repository}`, documentId);
      const id = yield* hashBytes(new TextEncoder().encode(raw));
      const proofPath = `resolutions/${id}/github-object.json`;
      const immutableProof = yield* saveImmutable(root, proofPath, proofBytes);
      const proofArtifact = LibraryArtifact.make({
        ...payload.evidence,
        path: proofPath,
        sha256: immutableProof.sha256,
        role: "reference-resolution-evidence",
      });
      const decision = yield* saveLibraryText(
        root,
        `resolutions/${id}/decision.json`,
        raw,
        "application/json",
        "reference-resolution-decision"
      );
      const publishResolutionIdentity = () => {
        const remaining = A.filter(catalog.sources, (s) => s.id !== source.value.id || s.id === resolved.id);
        const sources = A.some(remaining, (s) => s.id === resolved.id)
          ? A.map(remaining, (s) => (s.id === resolved.id ? resolved : s))
          : A.append(remaining, resolved);
        return LibraryCatalog.make({
          ...catalog,
          sources: A.some(sources, (s) => s.id === repositorySource.id) ? sources : A.append(sources, repositorySource),
          occurrences: A.map(catalog.occurrences, (o) =>
            o.sourceId === source.value.id ? LibraryOccurrence.make({ ...o, sourceId: resolved.id }) : o
          ),
          captures: A.map(catalog.captures, (capture) =>
            capture.sourceId === source.value.id ? LibraryCapture.make({ ...capture, sourceId: resolved.id }) : capture
          ),
          artifacts: [
            ...A.filter(
              catalog.artifacts,
              (artifact) => artifact.path !== proofArtifact.path && artifact.path !== decision.path
            ),
            proofArtifact,
            decision,
          ],
        });
      };
      return publishResolutionIdentity();
    })
  );
});

const citationSnapshotMatches = (entry: typeof CitationContext.Type, document: LibraryDocument) =>
  entry.documentSha256 === document.sha256 && entry.snapshotPath === document.snapshotPath;
const snapshotWithinLibrary = (path: Path.Path, relative: string) =>
  !path.isAbsolute(relative) && relative !== ".." && !Str.startsWith(`..${path.sep}`)(relative);
const dispositionRevisionMatches = (
  source: LibrarySource,
  capture: LibraryCapture,
  disposition: LibraryDispositionImportPayload
) => {
  const versions = A.filter(
    source.versions,
    (version) => version.canonicalUrl === disposition.locator || A.contains(version.locators, disposition.locator)
  );
  return (
    A.some(versions, (version) => version.revision === capture.requestedRevision) ||
    (source.versions.length === 0 &&
      capture.requestedRevision === source.revision &&
      A.contains(source.locators, disposition.locator))
  );
};
const dispositionOriginalsMatch = (capture: LibraryCapture, disposition: LibraryDispositionImportPayload) =>
  A.every(disposition.artifacts, (original) =>
    A.some(
      capture.artifacts,
      (actual) =>
        (actual.role === original.role || actual.role === "disposition-evidence") &&
        actual.sha256 === original.sha256 &&
        actual.bytes === original.bytes
    )
  );
const dispositionTargetMatches = (
  source: LibrarySource,
  capture: LibraryCapture,
  disposition: LibraryDispositionImportPayload
) =>
  capture.status === dispositionStatus(disposition.disposition) &&
  !(disposition.disposition === "internal" && source.ownership !== "internal") &&
  !(disposition.disposition === "operational" && source.kind !== "endpoint");

const nonReferenceReportMatches = Effect.fn("Library.nonReferenceReportMatches")(function* (
  root: string,
  document: LibraryDocument,
  occurrence: LibraryOccurrence
) {
  const bytes = yield* readOriginalReportBytes(root, document.snapshotPath).pipe(Effect.option);
  if (
    O.isNone(bytes) ||
    (yield* hashBytes(bytes.value)) !== document.sha256 ||
    O.getOrElse(A.get(Str.split(new TextDecoder().decode(bytes.value), "\n"), occurrence.line - 1), () => "") !==
      occurrence.context
  )
    return false;
  return true;
});
const nonReferenceOccurrenceValid = Effect.fn("Library.nonReferenceOccurrenceValid")(function* (
  root: string,
  realRoot: string,
  catalog: LibraryCatalog,
  context: typeof ReviewedContext.Type,
  occurrence: LibraryOccurrence
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const document = A.findFirst(catalog.documents, (item) => item.id === occurrence.documentId);
  const entry = A.filter(context.occurrences, (item) => citationContextMatches(item, occurrence));
  const matched = A.head(entry);
  if (
    O.isNone(document) ||
    entry.length !== 1 ||
    O.isNone(matched) ||
    !citationSnapshotMatches(matched.value, document.value) ||
    (yield* hashBytes(new TextEncoder().encode(matched.value.context))) !== matched.value.contextSha256
  ) {
    return false;
  }
  const real = yield* fs.realPath(path.resolve(root, document.value.snapshotPath)).pipe(Effect.option);
  const relative = O.isSome(real) ? path.relative(realRoot, real.value) : "..";
  if (!snapshotWithinLibrary(path, relative)) {
    return false;
  }
  return yield* nonReferenceReportMatches(root, document.value, occurrence);
});
/** Validate a reviewed non-reference against preserved report lines and every source occurrence.
 * **Example** (Checking contextual evidence)
 * ```ts
 * import { libraryNonReferenceContextValid } from "@beep/repo-cli/commands/Research"
 * import type { LibraryCatalog, LibrarySource, LibraryCapture, LibraryDispositionImportPayload } from "@beep/repo-cli/commands/Research"
 * const validate = (catalog: LibraryCatalog, source: LibrarySource, capture: LibraryCapture, disposition: LibraryDispositionImportPayload) => libraryNonReferenceContextValid("/library", catalog, source, capture, disposition)
 * console.log(typeof validate) // function
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryNonReferenceContextValid = Effect.fn("Library.nonReferenceContextValid")(function* (
  root: string,
  catalog: LibraryCatalog,
  source: LibrarySource,
  capture: LibraryCapture,
  disposition: LibraryDispositionImportPayload
) {
  if (capture.complete || disposition.disposition !== "non-reference" || !nonReferenceSource(source)) return false;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const realRoot = yield* fs.realPath(root);
  const occurrences = A.filter(catalog.occurrences, (item) => item.sourceId === source.id);
  if (A.isReadonlyArrayEmpty(occurrences)) return false;
  const reviewedContextArtifactValid = Effect.fn("Library.reviewedContextArtifactValid")(function* (
    artifact: LibraryArtifact
  ) {
    const context = yield* fs
      .readFileString(path.resolve(root, artifact.path))
      .pipe(Effect.flatMap(decodeLibraryJson(ReviewedContext)), Effect.option);
    if (
      O.isNone(context) ||
      (context.value.sourceId !== source.id && !A.contains(source.aliasIds, context.value.sourceId)) ||
      context.value.locator !== disposition.locator ||
      context.value.requestedRevision !== capture.requestedRevision
    )
      return false;
    const validity = yield* Effect.forEach(
      occurrences,
      (occurrence) => nonReferenceOccurrenceValid(root, realRoot, catalog, context.value, occurrence),
      { concurrency: 1 }
    );
    const valid = context.value.occurrences.length === occurrences.length && A.every(validity, (value) => value);
    if (valid) return true;
    return false;
  });
  for (const artifact of A.filter(capture.artifacts, (item) => item.role === "disposition-evidence"))
    if (yield* reviewedContextArtifactValid(artifact)) return true;
  return false;
});

const readReviewedDisposition = Effect.fn("Library.readReviewedDisposition")(function* (
  root: string,
  capture: LibraryCapture
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (A.isReadonlyArrayEmpty(capture.artifacts)) return O.none();
  for (const artifact of capture.artifacts) {
    if (O.isSome(yield* libraryArtifactIntegrity(root, artifact))) return O.none();
  }
  const reviews = A.filter(capture.artifacts, (artifact) => artifact.role === "reviewed-disposition");
  if (reviews.length !== 1) return O.none();
  const review = A.head(reviews);
  if (O.isNone(review)) return O.none();
  const payload = yield* fs
    .readFileString(path.resolve(root, review.value.path))
    .pipe(Effect.flatMap(decodeLibraryJson(LibraryDispositionImportPayload)), Effect.option);
  return payload;
});

/** Revalidate an explicit reviewed disposition before acquisition preserves it.
 * **Example** (Respecting an existing source review)
 * ```ts
 * import { libraryDispositionValid } from "@beep/repo-cli/test/ResearchLibrary"
 * const check = (
 *   catalog: import("@beep/repo-cli/commands/Research").LibraryCatalog,
 *   capture: import("@beep/repo-cli/commands/Research").LibraryCapture
 * ) => libraryDispositionValid("/library", catalog, catalog.sources[0], capture)
 * ```
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const libraryDispositionValid = Effect.fn("Library.dispositionValid")(function* (
  root: string,
  catalog: LibraryCatalog,
  source: LibrarySource,
  capture: LibraryCapture
) {
  if (capture.complete || !A.contains(["unavailable", "non-reference", "blocked"], capture.status)) return false;
  const payload = yield* readReviewedDisposition(root, capture);
  if (O.isNone(payload)) return false;
  const disposition = payload.value;
  if (disposition.sourceId !== source.id && !A.contains(source.aliasIds, disposition.sourceId)) return false;
  if (
    !dispositionRevisionMatches(source, capture, disposition) ||
    !dispositionTargetMatches(source, capture, disposition) ||
    !dispositionOriginalsMatch(capture, disposition)
  )
    return false;
  return (
    disposition.disposition !== "non-reference" ||
    (yield* libraryNonReferenceContextValid(root, catalog, source, capture, disposition))
  );
});
