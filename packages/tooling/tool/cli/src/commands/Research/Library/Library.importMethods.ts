/**
 * VidBee and alphaXiv `import-result` methods.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeLibraryJson, encodeLibraryJson, saveLibraryText } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { librarySourceHopDepth } from "./Library.hops.ts";
import { importLibraryResult } from "./Library.import.ts";
import { classifyLibraryReference } from "./Library.inventory.ts";
import { LibraryAlphaxivBinding, LibraryVidbeeBinding } from "./Library.routeEvidence.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDerivation,
  LibraryModelRun,
} from "./Library.schemas.ts";
import { hashBytes, loadCatalog, saveImmutable, withCatalog } from "./Library.store.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.importMethods");

/**
 * Local original named by an import manifest: path relative to the manifest, size, type and SHA-256.
 *
 * **Example** (Describe an original)
 *
 * ```ts
 * import { LibraryImportOriginal } from "@beep/repo-cli/commands/Research"
 *
 * const original = LibraryImportOriginal.make({ path: "0.en.vtt", sha256: "a".repeat(64), bytes: 10, mediaType: "text/vtt" })
 * console.log(original.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryImportOriginal extends S.Opaque<LibraryImportOriginal, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.check(S.isMinLength(1)),
    sha256: S.String.check(S.isPattern(/^[a-f0-9]{64}$/)),
    bytes: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    mediaType: S.String,
  }).pipe($I.annoteSchema("LibraryImportOriginal", { description: "Hash-bound local original of an import." }))
) {}

/**
 * VidBee bundle import: transcript as raw text, FAQ as AI interpretation, both bound to the media hash.
 *
 * **Example** (Inspect the manifest tag)
 *
 * ```ts
 * import { LibraryVidbeeImportPayload } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryVidbeeImportPayload.fields.kind !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryVidbeeImportPayload extends S.Opaque<
  LibraryVidbeeImportPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("vidbee"),
    sourceId: S.String,
    canonicalUrl: S.String,
    media: LibraryImportOriginal,
    transcript: LibraryImportOriginal,
    faq: LibraryImportOriginal,
  }).pipe(
    $I.annoteSchema("LibraryVidbeeImportPayload", {
      description: "VidBee transcript and FAQ bound by SHA-256 to a referenced, never copied, media file.",
    })
  )
) {}

/**
 * One reference from an alphaXiv paper's bibliography.
 *
 * **Example** (Describe an arXiv reference)
 *
 * ```ts
 * import { LibraryAlphaxivReference } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryAlphaxivReference.make({ arxivId: "2610.00609", url: "", title: "Example" }).arxivId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryAlphaxivReference extends S.Opaque<LibraryAlphaxivReference, { readonly brand: unique symbol }>()(
  S.Struct({
    arxivId: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
    url: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
    title: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
  }).pipe($I.annoteSchema("LibraryAlphaxivReference", { description: "Bibliography entry of an alphaXiv paper." }))
) {}

/**
 * alphaXiv paper import: full text bound to the arXiv id and version, references as hop-2 identities.
 *
 * **Example** (Inspect the manifest tag)
 *
 * ```ts
 * import { LibraryAlphaxivImportPayload } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryAlphaxivImportPayload.fields.arxivId !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryAlphaxivImportPayload extends S.Opaque<
  LibraryAlphaxivImportPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("alphaxiv"),
    sourceId: S.String,
    canonicalUrl: S.String,
    arxivId: S.String.check(S.isPattern(/^\d{4}\.\d{4,5}$/)),
    version: S.String.check(S.isPattern(/^v\d+$/)),
    fullText: LibraryImportOriginal,
    references: S.Array(LibraryAlphaxivReference).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("LibraryAlphaxivImportPayload", {
      description: "alphaXiv full text for one arXiv version plus its catalogued reference list.",
    })
  )
) {}

const integrity = (message: string) => LibraryError.make({ message, cause: "integrity" });
const identity = (message: string) => LibraryError.make({ message, cause: "identity" });

const readOriginal = Effect.fn("Library.importMethods.readOriginal")(function* (
  resultPath: string,
  original: LibraryImportOriginal,
  label: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* fs
    .readFile(path.resolve(path.dirname(resultPath), original.path))
    .pipe(Effect.mapError(() => integrity(`${label} original is missing: ${original.path}`)));
  if (bytes.byteLength !== original.bytes || (yield* hashBytes(bytes)) !== original.sha256)
    return yield* integrity(`${label} original hash or size mismatch: ${original.path}`);
  return bytes;
});

const retain = Effect.fn("Library.importMethods.retain")(function* (
  root: string,
  namespace: string,
  original: LibraryImportOriginal,
  bytes: Uint8Array,
  role: string
) {
  const path = yield* Path.Path;
  const saved = yield* saveImmutable(root, `${namespace}/${path.basename(original.path)}`, bytes);
  return LibraryArtifact.make({ ...saved, mediaType: original.mediaType, role });
});

const findSource = Effect.fn("Library.importMethods.findSource")(function* (
  catalog: LibraryCatalog,
  sourceId: string,
  canonicalUrl: string
) {
  const source = A.findFirst(
    catalog.sources,
    (candidate) => candidate.id === sourceId || A.contains(candidate.aliasIds, sourceId)
  );
  if (O.isNone(source)) return yield* identity(`Import source ${sourceId} is not in the inventory.`);
  const matches =
    source.value.canonicalUrl === canonicalUrl ||
    A.contains(source.value.locators, canonicalUrl) ||
    A.some(source.value.versions, (version) => version.canonicalUrl === canonicalUrl);
  if (!matches) return yield* identity("Import canonical URL differs from the inventoried source.");
  return source.value;
});

/**
 * Parse `key: value` frontmatter from a Markdown document.
 *
 * **Example** (Read FAQ frontmatter)
 *
 * ```ts
 * import { libraryFrontmatter } from "@beep/repo-cli/commands/Research"
 *
 * console.log(libraryFrontmatter('---\nmodel: "gpt-6.1-sol"\n---\n# FAQ'))
 * ```
 *
 * @param text - Markdown text.
 * @returns Frontmatter values with surrounding quotes removed; empty when there is no frontmatter.
 * @category parsing
 * @since 0.0.0
 */
export const libraryFrontmatter = (text: string): ReadonlyArray<readonly [string, string]> =>
  O.match(Str.match(/^---\r?\n([\s\S]*?)\r?\n---/)(text), {
    onNone: A.empty,
    onSome: (match) =>
      A.flatMap(Str.split(match[1] ?? "", /\r?\n/), (line) =>
        O.match(Str.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)(line), {
          onNone: A.empty,
          onSome: (pair) => [[pair[1] ?? "", Str.replace(/^"(.*)"$/, "$1")(Str.trim(pair[2] ?? ""))] as const],
        })
      ),
  });
const frontmatterValue = (entries: ReadonlyArray<readonly [string, string]>, key: string) =>
  O.map(
    A.findFirst(entries, ([name]) => name === key),
    ([, value]) => value
  );

const appendCapture = (root: string, capture: LibraryCapture, extra: (catalog: LibraryCatalog) => LibraryCatalog) =>
  withCatalog(root, (current) =>
    Effect.succeed(
      extra(
        LibraryCatalog.make({
          ...current,
          captures: A.some(current.captures, (item) => item.id === capture.id)
            ? current.captures
            : [...current.captures, capture],
        })
      )
    )
  );

/**
 * Import a VidBee bundle for a cited video.
 *
 * **Details**
 *
 * The `.vtt` transcript is retained as `raw-full-text` and the FAQ `.md` as `ai-interpretation`.
 * The media file is hashed in place and never copied into `objects/`. The FAQ frontmatter must name
 * the same media file and, when it records one, the same source URL; its `model` and `effort`
 * (or a `model(effort)` pin) become the `ModelRun` agent.
 *
 * **Example** (Prepare a VidBee import)
 *
 * ```ts
 * import { importLibraryVidbee } from "@beep/repo-cli/commands/Research"
 *
 * console.log(typeof importLibraryVidbee)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const importLibraryVidbee = Effect.fn("Library.importVidbee")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryVidbeeImportPayload
) {
  const path = yield* Path.Path;
  const catalog = yield* loadCatalog(root);
  const source = yield* findSource(catalog, payload.sourceId, payload.canonicalUrl);
  yield* readOriginal(resultPath, payload.media, "VidBee media");
  const transcriptBytes = yield* readOriginal(resultPath, payload.transcript, "VidBee transcript");
  const faqBytes = yield* readOriginal(resultPath, payload.faq, "VidBee FAQ");
  const faq = new TextDecoder().decode(faqBytes);
  const frontmatter = libraryFrontmatter(faq);
  const media = frontmatterValue(frontmatter, "media");
  if (O.isNone(media) || path.basename(media.value) !== path.basename(payload.media.path))
    return yield* identity("VidBee FAQ frontmatter does not bind the referenced media file.");
  const sourceUrl = frontmatterValue(frontmatter, "source_url");
  if (O.isSome(sourceUrl) && sourceUrl.value !== payload.canonicalUrl && !A.contains(source.locators, sourceUrl.value))
    return yield* identity("VidBee FAQ frontmatter names a different source URL.");
  const pinned = O.getOrElse(frontmatterValue(frontmatter, "model"), () => "");
  if (Str.isEmpty(pinned)) return yield* identity("VidBee FAQ frontmatter omits the generating model.");
  const pin = Str.match(/^(.+?)\(([^)]+)\)$/)(pinned);
  const model = O.isSome(pin) ? (pin.value[1] ?? pinned) : pinned;
  const effort = O.getOrElse(frontmatterValue(frontmatter, "effort"), () =>
    O.isSome(pin) ? (pin.value[2] ?? "unrecorded") : "unrecorded"
  );
  const generatedAt = O.getOrElse(frontmatterValue(frontmatter, "generated_at"), () => "");
  if (Str.isEmpty(Str.trim(new TextDecoder().decode(transcriptBytes))))
    return yield* integrity("VidBee transcript is empty.");
  const id = yield* hashBytes(new TextEncoder().encode(raw));
  const namespace = `imports/${id}`;
  const transcript = yield* retain(root, namespace, payload.transcript, transcriptBytes, "raw-full-text");
  const interpretation = yield* retain(root, namespace, payload.faq, faqBytes, "ai-interpretation");
  const bindingText = yield* encodeLibraryJson(
    LibraryVidbeeBinding.make({
      sourceUrl: payload.canonicalUrl,
      mediaPath: payload.media.path,
      mediaSha256: payload.media.sha256,
      mediaBytes: payload.media.bytes,
      transcriptSha256: transcript.sha256,
      faqSha256: interpretation.sha256,
      model,
      effort,
      generatedAt,
    })
  );
  const binding = yield* saveLibraryText(
    root,
    `${namespace}/media-binding.json`,
    bindingText,
    "application/json",
    "media-binding"
  );
  const manifest = yield* saveLibraryText(
    root,
    `${namespace}/manifest.json`,
    raw,
    "application/json",
    "import-manifest"
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const run = LibraryModelRun.make({
    id: yield* hashBytes(new TextEncoder().encode(`vidbee\n${model}\n${effort}\n${interpretation.sha256}`)),
    model,
    effort,
    route: "vidbee",
    startedAt: Str.isEmpty(generatedAt) ? recordedAt : generatedAt,
  });
  const requested = O.getOrElse(
    A.findFirst(source.versions, (version) => version.canonicalUrl === payload.canonicalUrl),
    () => source
  ).revision;
  const capture = LibraryCapture.make({
    id,
    sourceId: source.id,
    requestedRevision: requested,
    method: "vidbee",
    recordedAt,
    capturedRevision: requested,
    complete: true,
    status: "readable",
    artifacts: [manifest, binding, transcript, interpretation],
    reason:
      "VidBee transcript and FAQ hash-bound to the referenced media file; FAQ is interpretation, not source text.",
  });
  return yield* appendCapture(root, capture, (current) =>
    LibraryCatalog.make({
      ...current,
      modelRuns: A.some(current.modelRuns, (item) => item.id === run.id)
        ? current.modelRuns
        : [...current.modelRuns, run],
    })
  );
});

/**
 * Import alphaXiv full text for one arXiv version and catalogue its references at hop 2.
 *
 * **Details**
 *
 * The source must be the inventoried `arxiv:<id>` paper and the version must match any cited
 * version; a mismatch fails with an identity error. References become hop-2 `Source` identities
 * with a `Derivation` edge and no capture. A paper that is itself a hop-2 identity records no
 * references, because hop 3 is never catalogued.
 *
 * **Example** (Prepare an alphaXiv import)
 *
 * ```ts
 * import { importLibraryAlphaxiv } from "@beep/repo-cli/commands/Research"
 *
 * console.log(typeof importLibraryAlphaxiv)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const importLibraryAlphaxiv = Effect.fn("Library.importAlphaxiv")(function* (
  root: string,
  resultPath: string,
  raw: string,
  payload: LibraryAlphaxivImportPayload
) {
  const catalog = yield* loadCatalog(root);
  const source = yield* findSource(catalog, payload.sourceId, payload.canonicalUrl);
  if (source.identity !== `arxiv:${payload.arxivId}`)
    return yield* identity(`alphaXiv arXiv id ${payload.arxivId} does not match source ${source.identity}.`);
  const requested = O.getOrElse(
    A.findFirst(source.versions, (version) => version.canonicalUrl === payload.canonicalUrl),
    () => source
  ).revision;
  if (Str.isNonEmpty(requested) && requested !== payload.version)
    return yield* identity(`alphaXiv version ${payload.version} differs from the cited version ${requested}.`);
  const bytes = yield* readOriginal(resultPath, payload.fullText, "alphaXiv full text");
  if (Str.length(Str.trim(new TextDecoder().decode(bytes))) < 1000)
    return yield* integrity("alphaXiv full text is shorter than 1000 characters; abstracts are not full text.");
  const id = yield* hashBytes(new TextEncoder().encode(raw));
  const namespace = `imports/${id}`;
  const fullText = yield* retain(root, namespace, payload.fullText, bytes, "extracted-full-text");
  const bindingText = yield* encodeLibraryJson(
    LibraryAlphaxivBinding.make({
      canonicalUrl: payload.canonicalUrl,
      arxivId: payload.arxivId,
      version: payload.version,
      fullTextSha256: fullText.sha256,
      references: payload.references.length,
    })
  );
  const binding = yield* saveLibraryText(
    root,
    `${namespace}/alphaxiv-binding.json`,
    bindingText,
    "application/json",
    "alphaxiv-binding"
  );
  const manifest = yield* saveLibraryText(
    root,
    `${namespace}/manifest.json`,
    raw,
    "application/json",
    "import-manifest"
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const parentDepth = O.getOrElse(librarySourceHopDepth(catalog, source.id), () => 1);
  const parentEdge = A.findFirst(catalog.derivations, (edge) => edge.derivedId === source.id);
  const children: Array<LibrarySource> = [];
  if (parentDepth < 2)
    for (const reference of payload.references) {
      const locator = Str.isNonEmpty(reference.arxivId) ? `https://arxiv.org/abs/${reference.arxivId}` : reference.url;
      if (Str.isEmpty(locator)) continue;
      const child = yield* classifyLibraryReference(locator, source.id);
      if (child.ownership === "external" && child.id !== source.id) children.push(child);
    }
  const unique = A.dedupeWith(children, (a, b) => a.id === b.id);
  const edges = yield* Effect.forEach(unique, (child) =>
    Effect.gen(function* () {
      const intakeId = O.getOrElse(
        O.map(parentEdge, (edge) => edge.intakeId),
        () => ""
      );
      return LibraryDerivation.make({
        id: yield* hashBytes(new TextEncoder().encode(`${intakeId}\n${parentDepth + 1}\n${source.id}\n${child.id}`)),
        derivedId: child.id,
        sourceId: source.id,
        intakeId,
        rootId: O.getOrElse(
          O.map(parentEdge, (edge) => edge.rootId),
          () => ""
        ),
        hopDepth: parentDepth + 1,
        recordedAt,
      });
    })
  );
  const capture = LibraryCapture.make({
    id,
    sourceId: source.id,
    requestedRevision: requested,
    method: "alphaxiv",
    recordedAt,
    capturedRevision: payload.version,
    complete: true,
    status: "readable",
    artifacts: [manifest, binding, fullText],
    reason: `alphaXiv full text bound to arXiv ${payload.arxivId}${payload.version}; ${edges.length} references catalogued at hop ${parentDepth + 1}.`,
  });
  return yield* appendCapture(root, capture, (current) =>
    LibraryCatalog.make({
      ...current,
      sources: [
        ...current.sources,
        ...A.filter(
          unique,
          (child) => !A.some(current.sources, (item) => item.id === child.id || A.contains(item.aliasIds, child.id))
        ),
      ],
      derivations: [
        ...current.derivations,
        ...A.filter(edges, (edge) => !A.some(current.derivations, (item) => item.id === edge.id)),
      ],
    })
  );
});

/**
 * Import any supported result manifest, including the VidBee and alphaXiv methods.
 *
 * **Details**
 *
 * `kind: "vidbee"` and `kind: "alphaxiv"` manifests are decoded first; every other manifest is
 * handled by the reference-resolution, disposition, qualification and capture importers.
 *
 * **Example** (Build an import effect)
 *
 * ```ts
 * import { importLibraryRoutedResult } from "@beep/repo-cli/commands/Research"
 *
 * console.log(importLibraryRoutedResult("/library", "/receipts/import.json").pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const importLibraryRoutedResult = Effect.fn("Library.importRoutedResult")(function* (
  root: string,
  resultPath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs
    .readFileString(resultPath)
    .pipe(
      Effect.mapError((cause) => LibraryError.make({ message: `Cannot read import manifest ${resultPath}.`, cause }))
    );
  const kind = yield* decodeLibraryJson(S.Struct({ kind: S.String }))(raw).pipe(Effect.option);
  if (O.isSome(kind) && kind.value.kind === "vidbee") {
    const payload = yield* decodeLibraryJson(LibraryVidbeeImportPayload)(raw);
    return yield* importLibraryVidbee(root, resultPath, raw, LibraryVidbeeImportPayload.make(payload));
  }
  if (O.isSome(kind) && kind.value.kind === "alphaxiv") {
    const payload = yield* decodeLibraryJson(LibraryAlphaxivImportPayload)(raw);
    return yield* importLibraryAlphaxiv(root, resultPath, raw, LibraryAlphaxivImportPayload.make(payload));
  }
  return yield* importLibraryResult(root, resultPath);
});
