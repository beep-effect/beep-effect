/** Resume admission evidence checks.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { XMLParser } from "fast-xml-parser";
import { decodeLibraryJson, encodeLibraryJson, runLibraryCommand } from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { readLibraryProviderEvents } from "./Library.events.ts";
import { LibraryDispositionImportPayload, LibraryImportPayload, libraryDispositionValid } from "./Library.import.ts";
import { libraryArtifactIntegrity } from "./Library.integrity.ts";
import { AlphaFullText, validateProviderQualification } from "./Library.provenance.ts";
import { LibraryArtifact, LibraryCapture } from "./Library.schemas.ts";
import { hashBytes } from "./Library.store.ts";
import { libraryCitedRevisions } from "./Library.versions.ts";
import { validateLibraryScrape } from "./Library.web.ts";
import type { LibraryCatalog, LibraryQualification, LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.evidence");
/** Source-bound probe evidence.
 * **Example** (Prepare source-bound verification)
 * ```ts
 * import { LibraryProbeEvidence } from "@beep/repo-cli/commands/Research"
 * console.log(LibraryProbeEvidence.fields.sourceId !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0 */
export class LibraryProbeEvidence extends S.Class<LibraryProbeEvidence>($I`LibraryProbeEvidence`)(
  {
    adapter: S.String,
    sourceId: S.String,
    sourceUrl: S.String,
    status: S.Literals(["verified", "failed"]),
    captureId: S.String,
    complete: S.Boolean,
    artifacts: S.Array(LibraryArtifact),
  },
  $I.annote("LibraryProbeEvidence", {
    description: "Operational probe referring to an actual complete source capture and hashed evidence.",
  })
) {}

/** Check hashed evidence and reject path or symlink escapes before resume.
 * **Example** (Prepare source-bound verification)
 * ```ts
 * import { libraryArtifactsValid } from "@beep/repo-cli/test/ResearchLibrary"
 * import { Effect } from "effect"
 * console.log(Effect.isEffect(libraryArtifactsValid("/library", [])))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0 */
export const libraryArtifactsValid = Effect.fn("Library.artifactsValid")(function* (
  root: string,
  artifacts: ReadonlyArray<LibraryArtifact>
) {
  if (A.isReadonlyArrayEmpty(artifacts)) return false;
  for (const artifact of artifacts) {
    if (O.isSome(yield* libraryArtifactIntegrity(root, artifact))) return false;
  }
  return true;
});

const qualificationMethodMatches = (adapter: string, source: LibrarySource, capture: LibraryCapture) =>
  capture.method === adapter ||
  (adapter === "youtube" && source.kind === "youtube" && capture.method === "youtube-transcript-api");
const qualificationProbeStatusMatches = (qualification: LibraryQualification, probe: LibraryProbeEvidence) =>
  probe.adapter === qualification.adapter && probe.status === "verified" && probe.complete;
const qualificationProbeCaptureMatches = (
  qualification: LibraryQualification,
  source: LibrarySource,
  capture: LibraryCapture
) =>
  qualificationMethodMatches(qualification.adapter, source, capture) &&
  capture.status === "readable" &&
  capture.complete;
const validateQualificationProbe = Effect.fn("Library.validateQualificationProbe")(function* (
  root: string,
  catalog: LibraryCatalog,
  qualification: LibraryQualification,
  probe: LibraryProbeEvidence
) {
  if (!qualificationProbeStatusMatches(qualification, probe)) return false;
  const source = A.findFirst(
    catalog.sources,
    (entry) => entry.id === probe.sourceId || A.contains(entry.aliasIds, probe.sourceId)
  );
  if (O.isNone(source)) return false;
  const capture = A.findFirst(
    catalog.captures,
    (entry) => entry.id === probe.captureId && entry.sourceId === source.value.id
  );
  if (O.isNone(capture)) return false;
  if (!qualificationProbeCaptureMatches(qualification, source.value, capture.value)) return false;
  if (
    !A.some(
      [source.value.canonicalUrl, ...A.map(source.value.versions, (entry) => entry.canonicalUrl)],
      (url) => url === probe.sourceUrl
    )
  )
    return false;
  if (
    !A.every(probe.artifacts, (entry) =>
      A.some(
        capture.value.artifacts,
        (bound) => bound.path === entry.path && bound.sha256 === entry.sha256 && bound.bytes === entry.bytes
      )
    )
  )
    return false;
  if (!(yield* libraryArtifactsValid(root, capture.value.artifacts))) return false;
  if (!(yield* libraryArtifactsValid(root, probe.artifacts))) return false;
  return yield* librarySourceEvidenceValid(root, source.value, capture.value);
});
/** Revalidate operational qualification before it admits another acquisition.
 * **Example** (Prepare source-bound verification)
 * ```ts
 * import { libraryQualificationValid } from "@beep/repo-cli/test/ResearchLibrary"
 * import { LibraryCatalog, LibraryQualification } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const catalog = LibraryCatalog.make({schema: "beep.research.library/v1", documents: [], sources: [], occurrences: [], captures: [], qualifications: []})
 * const receipt = LibraryQualification.make({id: "probe", adapter: "paper", status: "failed", required: true, recordedAt: "2026-10-06T00:00:00Z", evidence: [], reason: "No source-bound probe evidence"})
 * console.log(Effect.isEffect(libraryQualificationValid("/library", catalog, receipt)))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0 */
export const libraryQualificationValid = Effect.fn("Library.qualificationValid")(function* (
  root: string,
  catalog: LibraryCatalog,
  qualification: LibraryQualification
) {
  if (qualification.status !== "verified" || !(yield* libraryArtifactsValid(root, qualification.evidence)))
    return false;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const originals = A.filter(qualification.evidence, (artifact) => artifact.role === "raw-provider-events");
  if (A.isArrayNonEmpty(originals)) {
    const events = yield* readLibraryProviderEvents(root, originals);
    return yield* validateProviderQualification(qualification.adapter, events).pipe(Effect.orElseSucceed(() => false));
  }
  if (A.contains(["grok-deep-research", "grok-x-import", "alphaxiv"], qualification.adapter)) return false;
  for (const artifact of A.filter(qualification.evidence, (entry) => entry.role === "qualification-probe")) {
    const probe = yield* fs
      .readFileString(path.join(root, artifact.path))
      .pipe(Effect.flatMap(decodeLibraryJson(LibraryProbeEvidence)), Effect.option);
    if (O.isSome(probe) && (yield* validateQualificationProbe(root, catalog, qualification, probe.value))) return true;
  }
  return false;
});

const TargetMetadata = S.Struct({
  requestedUrl: S.String,
  pdfUrl: S.String,
  status: S.Finite,
  requestedRevision: S.optionalKey(S.String),
  capturedRevision: S.optionalKey(S.String),
  paperId: S.optionalKey(S.String),
});
class WebRedirectProof extends S.Class<WebRedirectProof>($I`WebRedirectProof`)(
  {
    requestedUrl: S.String,
    resolvedUrl: S.String,
    status: S.Finite,
    providerSourceUrl: S.String,
    identityMerged: S.Literal(false),
  },
  $I.annote("WebRedirectProof", {
    description:
      "Retained HTTP confirmation linking a requested page to the provider's resolved URL without merging identities.",
  })
) {}
const CitationResolution = S.Struct({
  sourceId: S.String,
  citedUrl: S.String,
  pdfUrl: S.String,
  observedCitationPdfUrl: S.String,
  landingHtmlSha256: S.String,
  landingMetadataSha256: S.String,
  pdfSha256: S.String,
  pdfMetadataSha256: S.String,
  reason: S.String,
});
const RepositoryIdentity = S.Struct({ id: S.Finite, node_id: S.String, full_name: S.String, html_url: S.String });
const RepositoryIdentityReceipts = S.Array(
  S.Struct({
    requestedEndpoint: S.String,
    observedAt: S.String,
    exitCode: S.Finite,
    id: S.Finite,
    node_id: S.String,
    full_name: S.String,
    html_url: S.String,
    sha256: S.String,
    bytes: S.Finite,
  })
);
const ListingItem = S.Struct({ html_url: S.String, sha: S.optionalKey(S.String) });
const PullTarget = S.Struct({
  html_url: S.String,
  base: S.Struct({ sha: S.String }),
  head: S.Struct({ sha: S.String }),
  changed_files: S.optionalKey(S.Finite),
  additions: S.optionalKey(S.Finite),
  deletions: S.optionalKey(S.Finite),
});
const normalizeGithubRepositoryCase = (input: string) =>
  A.reduce(
    O.getOrElse(Str.match(/https:\/\/github\.com\/[^/\s"\\]+\/[^/\s"\\]+(?=\/|$)/g)(input), () => []),
    input,
    (text, prefix) => Str.replaceAll(prefix, Str.toLowerCase(prefix))(text)
  );
const ReleaseTargetsJson = S.Array(S.Struct({ html_url: S.String, tag_name: S.String })).pipe(S.fromJsonString);
const releaseTarget = (input: string) => {
  const target = Str.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/(.+?)(?:[?#]|$)/)(input);
  if (O.isNone(target)) return O.none<string>();
  try {
    return O.some(
      `${Str.toLowerCase(target.value[1] ?? "")}/${Str.toLowerCase(target.value[2] ?? "")}/releases/tag/${decodeURIComponent(target.value[3] ?? "")}`
    );
  } catch {
    return O.none<string>();
  }
};
const PullTargetsJson = S.Array(PullTarget).pipe(S.fromJsonString);
const PaginationMetadata = S.Struct({ endpoint: S.String, pages: S.Finite, exhausted: S.Boolean, pageSize: S.Finite });
const DiffProvenance = S.Struct({
  method: S.String,
  base: S.String,
  head: S.String,
  endpoint: S.optionalKey(S.String),
  accept: S.optionalKey(S.String),
});
const ArxivVersionProof = S.Struct({
  metadataUrl: S.String,
  metadataStatus: S.Finite,
  metadataSha256: S.String,
  paperId: S.String,
  observedRevision: S.String,
  explicitUrl: S.String,
  resolvedUrl: S.String,
  status: S.Finite,
  originalPdfSha256: S.String,
  versionedPdfSha256: S.String,
  identicalPdf: S.Boolean,
});
const VideoMetadata = S.Struct({ id: S.String, webpage_url: S.String, originalPlayerSha256: S.optionalKey(S.String) });
const CaptionHttpReceipts = S.Array(
  S.Struct({ path: S.String, url: S.String, status: S.Finite, sha256: S.String, bytes: S.Finite })
);
const CaptionPlayer = S.Struct({
  videoDetails: S.Struct({ videoId: S.String }),
  captions: S.Struct({
    playerCaptionsTracklistRenderer: S.Struct({
      captionTracks: S.Array(S.Struct({ baseUrl: S.String, languageCode: S.String, kind: S.optionalKey(S.String) })),
    }),
  }),
});
const CaptionApi = S.Struct({
  videoId: S.String,
  languageCode: S.String,
  isGenerated: S.Boolean,
  snippets: S.Array(
    S.Struct({
      text: S.String,
      start: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
      duration: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    })
  ),
});
const XmlCaptionCue = S.Struct({ "#text": S.String, start: S.FiniteFromString, dur: S.FiniteFromString });
const XmlCaptionCues = S.Array(XmlCaptionCue);
const XmlCaptionTranscript = S.Struct({
  transcript: S.Struct({ text: S.Union([XmlCaptionCue, XmlCaptionCues]) }),
});
const CaptionTextNode = S.Struct({ r: S.String });
const captionXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  textNodeName: "#text",
  trimValues: false,
  htmlEntities: true,
});
const parseCaptionXml = (text: string) =>
  Effect.try({
    try: () => captionXmlParser.parse(text, true),
    catch: (cause) => LibraryError.make({ message: "Malformed retained caption XML.", cause }),
  });
const TranscriptProvenance = S.Array(
  S.Struct({
    language: S.String,
    url: S.String,
    format: S.String,
    origin: S.Literals(["creator", "automatic", "manual"]),
    sourceSha256: S.optionalKey(S.String),
  })
);
const RepositoryTarget = S.Struct({
  remote: S.String,
  revision: S.String,
  clone: S.String,
  requestedRevision: S.String,
});
const ReturnedPosts = S.Struct({ posts: S.Array(S.Struct({ url: S.String, text: S.String, author: S.String })) });

const makeEvidenceContext = Effect.fn("Library.evidenceContext")(function* (
  root: string,
  source: LibrarySource,
  capture: LibraryCapture
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const selected = A.findFirst(source.versions, (version) => version.revision === capture.requestedRevision);
  const url = O.isSome(selected) ? selected.value.canonicalUrl : source.canonicalUrl;
  const artifacts = capture.artifacts;
  const role = (name: string) => A.filter(artifacts, (artifact) => artifact.role === name && artifact.bytes > 0);
  const read = (artifact: LibraryArtifact) =>
    fs
      .readFile(path.resolve(root, artifact.path))
      .pipe(Effect.map((bytes) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)));
  const texts = (name: string) => Effect.forEach(role(name), read, { concurrency: 1 });
  const json = <T, I>(name: string, schema: S.Codec<T, I>) =>
    Effect.forEach(
      role(name),
      (artifact) => read(artifact).pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(schema)))),
      { concurrency: 1 }
    );
  const nonempty = (values: ReadonlyArray<string>) => A.some(values, (value) => Str.isNonEmpty(Str.trim(value)));
  const webResponseValid = Effect.fn(function* () {
    const responses = yield* json("raw-response", S.Struct({ data: S.Unknown }));
    const markdown = yield* texts("extracted-full-text");
    const html = yield* texts("raw-full-text");
    const redirects = yield* Effect.forEach(
      role("target-metadata"),
      (artifact) => read(artifact).pipe(Effect.flatMap(decodeLibraryJson(WebRedirectProof)), Effect.option),
      { concurrency: 1 }
    );
    const targets = A.prepend(
      A.map(
        A.filter(
          A.getSomes(redirects),
          (proof) =>
            proof.requestedUrl === url &&
            successfulStatus(proof.status) &&
            proof.resolvedUrl === proof.providerSourceUrl
        ),
        (proof) => proof.resolvedUrl
      ),
      url
    );
    for (const response of responses) {
      for (const target of targets) {
        const document = yield* validateLibraryScrape(target, response.data).pipe(Effect.option);
        if (
          O.isSome(document) &&
          A.contains(markdown, document.value.markdown) &&
          A.contains(html, document.value.rawHtml)
        )
          return true;
      }
    }
    return false;
  });
  const paperHeader = (text: string) => Str.match(/arXiv:\s*(\d{4}\.\d{4,5})(v\d+)/i)(text);
  const paperHeaderMatches = (text: string) => {
    const header = paperHeader(text);
    return (
      O.isSome(header) &&
      header.value[1] === Str.slice(6)(source.identity) &&
      header.value[2] === capture.capturedRevision
    );
  };
  return {
    root,
    source,
    capture,
    fs,
    path,
    url,
    artifacts,
    role,
    read,
    texts,
    json,
    nonempty,
    webResponseValid,
    paperHeaderMatches,
    paperHeader,
  };
});
type EvidenceContext = Effect.Success<ReturnType<typeof makeEvidenceContext>>;
const importedArtifactBound = (artifacts: ReadonlyArray<LibraryArtifact>, original: LibraryArtifact) =>
  A.some(
    artifacts,
    (actual) => actual.sha256 === original.sha256 && actual.bytes === original.bytes && actual.role === original.role
  );
const importedCaptureBound = (context: EvidenceContext, item: LibraryImportPayload) =>
  item.canonicalUrl === context.url &&
  item.capturedRevision === context.capture.capturedRevision &&
  item.complete &&
  item.method === context.capture.method &&
  (item.sourceId === context.source.id || A.contains(context.source.aliasIds, item.sourceId)) &&
  A.every(item.artifacts, (original) => importedArtifactBound(context.artifacts, original));
const repositoryIdentitiesAgree = (
  requested: typeof RepositoryIdentity.Type,
  canonical: typeof RepositoryIdentity.Type
) =>
  requested.id === canonical.id &&
  requested.node_id === canonical.node_id &&
  requested.full_name === canonical.full_name;
const repositoryIdentityCanonicalValid = (identity: typeof RepositoryIdentity.Type) =>
  identity.html_url === `https://github.com/${identity.full_name}` &&
  /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(identity.full_name);
const repositoryIdentityReceiptsValid = (
  requested: (typeof RepositoryIdentityReceipts.Type)[number],
  canonical: (typeof RepositoryIdentityReceipts.Type)[number],
  bound: (receipt: (typeof RepositoryIdentityReceipts.Type)[number]) => boolean
) =>
  bound(requested) &&
  bound(canonical) &&
  repositoryIdentitiesAgree(requested, canonical) &&
  repositoryIdentityCanonicalValid(requested);
const repositoryIdentityReceiptBound = (
  identities: ReadonlyArray<{ readonly artifact: LibraryArtifact; readonly item: typeof RepositoryIdentity.Type }>,
  receipt: (typeof RepositoryIdentityReceipts.Type)[number]
) =>
  receipt.exitCode === 0 &&
  Str.isNonEmpty(receipt.observedAt) &&
  A.some(
    identities,
    ({ artifact, item }) =>
      artifact.sha256 === receipt.sha256 &&
      artifact.bytes === receipt.bytes &&
      item.id === receipt.id &&
      item.node_id === receipt.node_id &&
      item.full_name === receipt.full_name &&
      item.html_url === receipt.html_url
  );
const observeGithubRepositoryIdentity = Effect.fn("Library.observeGithubRepositoryIdentity")(function* (
  context: EvidenceContext
) {
  const { source, json, role, read } = context;
  let observedRepository = source.repository;
  const identityProofs = yield* json("repository-identity-provenance", RepositoryIdentityReceipts);
  if (A.isReadonlyArrayEmpty(identityProofs)) return observedRepository;

  const identities = yield* Effect.forEach(role("repository-identity-response"), (artifact) =>
    read(artifact).pipe(
      Effect.flatMap(decodeLibraryJson(RepositoryIdentity)),
      Effect.map((item) => ({ artifact, item }))
    )
  );
  for (const receipts of identityProofs) {
    const requested = A.findFirst(
      receipts,
      (item) => item.requestedEndpoint === `https://api.github.com/repos/${source.repository}`
    );
    if (O.isNone(requested)) continue;
    const identity = requested.value;
    const canonical = A.findFirst(
      receipts,
      (item) => item.requestedEndpoint === `https://api.github.com/repos/${identity.full_name}`
    );
    const bound = (receipt: typeof identity) => repositoryIdentityReceiptBound(identities, receipt);
    if (O.isSome(canonical) && repositoryIdentityReceiptsValid(identity, canonical.value, bound))
      observedRepository = identity.full_name;
  }
  return observedRepository;
});
const prepareGithubContext = Effect.fn("Library.prepareGithubContext")(function* (context: EvidenceContext) {
  const { root, source, capture, fs, path, url, texts, json } = context;

  const pins = yield* json("repository-pin", RepositoryTarget);
  const pin = A.findFirst(
    pins,
    (item) =>
      item.revision === capture.capturedRevision &&
      item.requestedRevision === capture.requestedRevision &&
      item.clone === `repos/github/${source.repository}` &&
      item.remote === `https://github.com/${source.repository}.git`
  );
  if (O.isNone(pin) || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(source.repository)) return O.none();
  const observedRepository = yield* observeGithubRepositoryIdentity(context);
  const observedUrl = Str.replace(
    /^https:\/\/github\.com\/[^/]+\/[^/]+(?=\/|$)/,
    `https://github.com/${observedRepository}`
  )(url);
  const clone = path.resolve(root, pin.value.clone);
  const realRoot = yield* fs.realPath(root);
  const realClone = yield* fs.realPath(clone);
  const relative = path.relative(realRoot, realClone);
  if (path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative)) return O.none();
  const git = (args: ReadonlyArray<string>) =>
    runLibraryCommand(root, "git", ["-c", "core.hooksPath=/dev/null", "-C", clone, ...args]);
  if (
    Str.trim(yield* git(["remote", "get-url", "origin"])) !== pin.value.remote ||
    Str.trim(yield* git(["cat-file", "-t", pin.value.revision])) !== "commit"
  )
    return O.none();
  const tree = yield* git(["ls-tree", "-r", "--name-only", pin.value.revision]);
  if (!A.contains(yield* texts("repository-tree"), tree)) return O.none();
  return O.some({ ...context, pin: pin.value, observedRepository, observedUrl, realRoot, git });
});
type GithubEvidenceContext = O.Option.Value<Effect.Success<ReturnType<typeof prepareGithubContext>>>;
const exactGithubPatch = (context: GithubEvidenceContext, args: ReadonlyArray<string>) => {
  const { root, fs, path, realRoot, git, role } = context;
  return Effect.scoped(
    Effect.gen(function* () {
      const staging = path.join(root, ".staging");
      yield* fs.makeDirectory(staging, { recursive: true });
      const realStaging = yield* fs.realPath(staging);
      const relativeStaging = path.relative(realRoot, realStaging);
      if (
        path.isAbsolute(relativeStaging) ||
        relativeStaging === ".." ||
        Str.startsWith(`..${path.sep}`)(relativeStaging)
      )
        return false;
      const temporary = yield* fs.makeTempDirectoryScoped({ directory: staging, prefix: "verify-git-patch-" });
      const output = path.join(temporary, "patch.diff");
      yield* git([...args, `--output=${output}`]);
      const stat = yield* fs.stat(output);
      if (stat.size > BigInt(100_000_000)) return false;
      const bytes = yield* fs.readFile(output);
      const hash = yield* hashBytes(bytes);
      return A.some(role("raw-diff"), (artifact) => artifact.bytes === bytes.byteLength && artifact.sha256 === hash);
    })
  );
};
const githubListingPageSizeValid = (length: number, number: number, pages: number) =>
  length <= 100 && (number >= pages || length === 100) && (number !== pages || length < 100);
const githubListingFirstCommitValid = (
  label: string,
  number: number,
  targets: ReadonlyArray<O.Option<typeof ListingItem.Type>>,
  revision: string
) =>
  label !== "commits" ||
  number !== 1 ||
  A.some(A.take(targets, 1), (item) => O.isSome(item) && item.value.sha === revision);
const readGithubListingPage = Effect.fn("Library.readGithubListingPage")(function* (
  context: GithubEvidenceContext,
  label: string,
  number: number,
  pageCount: number
) {
  const { source, path, role, read, pin } = context;

  const artifact = A.findFirst(
    role("raw-discussion"),
    (item) => path.basename(item.path) === `${label}-page-${number}.json`
  );
  if (O.isNone(artifact)) return O.none();
  const items = yield* read(artifact.value).pipe(Effect.flatMap(decodeLibraryJson(S.Array(S.Unknown))));
  if (!githubListingPageSizeValid(items.length, number, pageCount)) return O.none();
  const targets = A.map(items, (item) => S.decodeUnknownOption(ListingItem)(item));
  const targetPrefix = `https://github.com/${source.repository}/${label === "commits" ? "commit/" : "releases/tag/"}`;
  if (
    !A.every(
      targets,
      (item) => O.isSome(item) && Str.startsWith(Str.toLowerCase(targetPrefix))(Str.toLowerCase(item.value.html_url))
    )
  )
    return O.none();
  if (!githubListingFirstCommitValid(label, number, targets, pin.revision)) return O.none();
  return O.some(items);
});
const githubListingValid = Effect.fn("Library.githubListingValid")(function* (
  context: GithubEvidenceContext,
  label: string,
  endpoint: string
) {
  const { path, json, role, read } = context;
  const pagination = yield* json("pagination-metadata", PaginationMetadata);
  const proof = A.findFirst(
    pagination,
    (item) =>
      item.endpoint === endpoint &&
      item.exhausted &&
      item.pageSize === 100 &&
      Number.isInteger(item.pages) &&
      item.pages >= 1 &&
      item.pages <= 100
  );
  if (O.isNone(proof)) return false;
  const pages: Array<ReadonlyArray<unknown>> = [];
  for (const number of A.range(1, proof.value.pages)) {
    const items = yield* readGithubListingPage(context, label, number, proof.value.pages);
    if (O.isNone(items)) return false;
    pages.push(items.value);
  }
  const aggregate = A.findFirst(role("raw-discussion"), (item) => path.basename(item.path) === `${label}.json`);
  if (O.isNone(aggregate)) return false;
  const retained = yield* read(aggregate.value).pipe(Effect.flatMap(decodeLibraryJson(S.Array(S.Array(S.Unknown)))));
  return (yield* encodeLibraryJson(retained)) === (yield* encodeLibraryJson(pages));
});
const validateGithubCode = Effect.fn("Library.validateGithubCode")(function* (context: GithubEvidenceContext) {
  const { source, url, texts, pin, git } = context;

  if (O.isSome(Str.match(/\/commits(?:\/[^?#]+)?(?:[?#]|$)/)(url)))
    return yield* githubListingValid(
      context,
      "commits",
      `repos/${source.repository}/commits?sha=${pin.revision}&per_page=100`
    );
  const blob = Str.match(/\/blob\/[^/]+\/(.+?)(?:#|$)/)(url);
  if (O.isSome(blob))
    return A.contains(yield* texts("raw-full-text"), yield* git(["show", `${pin.revision}:${blob.value[1]}`]));
  const directory = Str.match(/\/tree\/[^/]+(?:\/(.+?))?(?:[?#]|$)/)(url);
  if (O.isSome(directory)) {
    const target = directory.value[1] ?? "";
    return A.contains(
      yield* texts("cited-repository-tree"),
      yield* git(["ls-tree", "-r", "--name-only", Str.isEmpty(target) ? pin.revision : `${pin.revision}:${target}`])
    );
  }
  if (O.isSome(Str.match(/\/commit\/[0-9a-f]{40}(?:[?#]|$)/)(url)))
    return yield* exactGithubPatch(context, [
      "show",
      "--no-ext-diff",
      "--no-textconv",
      "--format=fuller",
      pin.revision,
    ]);
  return false;
});
const githubDiffPinsValid = (item: typeof DiffProvenance.Type) =>
  /^[0-9a-f]{40}$/.test(item.base) && /^[0-9a-f]{40}$/.test(item.head);
const githubDiffApiTargetValid = (context: GithubEvidenceContext, item: typeof DiffProvenance.Type) =>
  item.endpoint ===
    `repos/${context.source.repository}/pulls/${O.getOrElse(Str.match(/\/pull\/(\d+)/)(context.url), () => ["", ""])[1]}` &&
  item.accept === "application/vnd.github.diff";
const githubDiffMethodValid = Effect.fn("Library.githubDiffMethodValid")(function* (
  context: GithubEvidenceContext,
  item: typeof DiffProvenance.Type
) {
  if (item.method === "git-diff")
    return yield* exactGithubPatch(context, ["diff", "--no-ext-diff", "--no-textconv", `${item.base}...${item.head}`]);
  return githubDiffApiTargetValid(context, item);
});
const validateGithubDiffProvenance = Effect.fn("Library.validateGithubDiffProvenance")(function* (
  context: GithubEvidenceContext
) {
  const { texts, json, observedUrl } = context;

  const provenance = yield* json("diff-provenance", DiffProvenance);
  for (const item of provenance) {
    if (!A.contains(["git-diff", "gh-api-diff"], item.method)) return false;
    const pulls = yield* texts("raw-discussion");
    const bound = A.some(pulls, (text) => {
      const decoded = S.decodeOption(PullTargetsJson)(text);
      return (
        O.isSome(decoded) &&
        A.some(
          decoded.value,
          (pull) =>
            normalizeGithubRepositoryCase(pull.html_url) ===
              normalizeGithubRepositoryCase(Str.replace(/#.*$/, "")(observedUrl)) &&
            pull.base.sha === item.base &&
            pull.head.sha === item.head
        )
      );
    });
    if (!bound || !githubDiffPinsValid(item) || !(yield* githubDiffMethodValid(context, item))) return false;
  }

  return true;
});
const githubDiscussionTargetPresent = (context: GithubEvidenceContext, discussion: ReadonlyArray<string>) => {
  const { source, observedRepository, observedUrl } = context;
  // Discussion originals must contain the cited target, not just clone metadata or a README.
  const target = source.kind === "github-release" ? observedUrl : Str.replace(/#.*$/, "")(observedUrl);
  const citedRelease = releaseTarget(target);
  const targetPresent =
    source.kind === "github-release" && O.isSome(citedRelease)
      ? A.some(discussion, (text) => {
          const releases = S.decodeOption(ReleaseTargetsJson)(text);
          return (
            O.isSome(releases) &&
            A.some(releases.value, (release) => {
              const observed = releaseTarget(release.html_url);
              return (
                O.isSome(observed) &&
                observed.value === citedRelease.value &&
                citedRelease.value === `${Str.toLowerCase(observedRepository)}/releases/tag/${release.tag_name}`
              );
            })
          );
        })
      : A.some(discussion, (text) =>
          Str.includes(normalizeGithubRepositoryCase(target))(normalizeGithubRepositoryCase(text))
        );
  return targetPresent;
};
const pullDeclaresNoChanges = (context: GithubEvidenceContext, pull: (typeof PullTargetsJson.Type)[number]) =>
  normalizeGithubRepositoryCase(pull.html_url) ===
    normalizeGithubRepositoryCase(Str.replace(/#.*$/, "")(context.observedUrl)) &&
  pull.changed_files === 0 &&
  pull.additions === 0 &&
  pull.deletions === 0;
const validateGithubEmptyPull = Effect.fn("Library.validateGithubEmptyPull")(function* (
  context: GithubEvidenceContext,
  pull: (typeof PullTargetsJson.Type)[number],
  empty: LibraryArtifact
) {
  const { source, path, url, role, read, git } = context;

  if (!pullDeclaresNoChanges(context, pull)) return false;
  const number = O.getOrElse(Str.match(/\/pull\/(\d+)/)(url), () => ["", ""])[1];
  const files = yield* githubListingValid(
    context,
    "files",
    `repos/${source.repository}/pulls/${number}/files?per_page=100`
  );
  const aggregate = A.findFirst(role("raw-discussion"), (artifact) => path.basename(artifact.path) === "files.json");
  const emptyFiles = O.isSome(aggregate)
    ? yield* read(aggregate.value).pipe(
        Effect.flatMap(decodeLibraryJson(S.Array(S.Array(S.Unknown)))),
        Effect.map((pages) => A.every(pages, A.isReadonlyArrayEmpty))
      )
    : false;
  const noChanges = yield* git([
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--quiet",
    `${pull.base.sha}...${pull.head.sha}`,
  ]).pipe(Effect.option);
  if (files && emptyFiles && O.isSome(noChanges) && empty.sha256 === (yield* hashBytes(new Uint8Array()))) return true;
  return false;
});
const validateGithubEmptyDiff = Effect.fn("Library.validateGithubEmptyDiff")(function* (
  context: GithubEvidenceContext,
  discussion: ReadonlyArray<string>
) {
  const empty = A.findFirst(context.artifacts, (artifact) => artifact.role === "raw-diff" && artifact.bytes === 0);
  const pulls = A.getSomes(A.map(discussion, (text) => S.decodeOption(PullTargetsJson)(text)));
  if (O.isNone(empty)) return false;
  const validity = yield* Effect.forEach(
    A.flatten(pulls),
    (pull) => validateGithubEmptyPull(context, pull, empty.value),
    { concurrency: 1 }
  );
  return A.some(validity, (valid) => valid);
});
const validateGithubDiscussion = Effect.fn("Library.validateGithubDiscussion")(function* (
  context: GithubEvidenceContext
) {
  const { source, role, texts, nonempty } = context;
  const discussion = yield* texts("raw-discussion");
  if (!nonempty(discussion)) return false;
  const targetPresent = githubDiscussionTargetPresent(context, discussion);
  let diffPresent = A.isReadonlyArrayNonEmpty(role("raw-diff"));
  if (source.kind === "github-pr" && !diffPresent) diffPresent = yield* validateGithubEmptyDiff(context, discussion);
  return targetPresent && (source.kind !== "github-pr" || diffPresent);
});
const validateGithubEvidence = Effect.fn("Library.validateGithubEvidence")(function* (evidence: EvidenceContext) {
  const prepared = yield* prepareGithubContext(evidence);
  if (O.isNone(prepared)) return false;
  const context = prepared.value;
  const { source, url, role } = context;
  if (source.kind === "github-repository") return true;
  if (source.kind === "github-code") return yield* validateGithubCode(context);
  if (source.kind === "github-release" && !Str.includes("/releases/tag/")(url))
    return yield* githubListingValid(context, "release", `repos/${source.repository}/releases?per_page=100`);
  if (
    source.kind === "github-pr" &&
    A.isReadonlyArrayNonEmpty(role("diff-provenance")) &&
    !(yield* validateGithubDiffProvenance(context))
  )
    return false;
  return yield* validateGithubDiscussion(context);
});
type CaptionArtifactLookup = (sha: string, bytes: number, expectedRole: string) => O.Option<LibraryArtifact>;
const resolveTimedCaptionArtifact = Effect.fn("Library.resolveTimedCaptionArtifact")(function* (
  context: EvidenceContext,
  record: (typeof TranscriptProvenance.Type)[number],
  receipts: typeof CaptionHttpReceipts.Type,
  receiptArtifact: CaptionArtifactLookup
) {
  const { capture } = context;
  const timed = A.findFirst(
    receipts,
    (item) => item.url === record.url && item.sha256 === record.sourceSha256 && successfulStatus(item.status)
  );
  if (O.isNone(timed) || !/^https:\/\/www\.youtube\.com\/api\/timedtext\?/.test(record.url)) return O.none();
  const timedUrl = yield* Effect.try({
    try: () => new URL(record.url),
    catch: (cause) => LibraryError.make({ message: "Malformed retained timed-caption URL.", cause }),
  });
  if (
    timedUrl.searchParams.get("v") !== capture.capturedRevision ||
    timedUrl.searchParams.get("lang") !== record.language ||
    timedUrl.searchParams.has("tlang")
  )
    return O.none();
  const xmlArtifact = receiptArtifact(timed.value.sha256, timed.value.bytes, "raw-transcript");
  return xmlArtifact;
});
const readYoutubeCaptionPlayer = Effect.fn("Library.readYoutubeCaptionPlayer")(function* (
  context: EvidenceContext,
  metadata: ReadonlyArray<typeof VideoMetadata.Type>,
  receipts: typeof CaptionHttpReceipts.Type,
  receiptArtifact: CaptionArtifactLookup
) {
  const { read } = context;
  const playerReceipt = A.findFirst(
    receipts,
    (item) =>
      /^https:\/\/www\.youtube\.com\/youtubei\/v1\/player(?:\?|$)/.test(item.url) &&
      successfulStatus(item.status) &&
      A.some(metadata, (target) => target.originalPlayerSha256 === item.sha256)
  );
  if (O.isNone(playerReceipt)) return O.none();
  const playerArtifact = receiptArtifact(playerReceipt.value.sha256, playerReceipt.value.bytes, "raw-response");
  if (O.isNone(playerArtifact)) return O.none();
  const player = yield* read(playerArtifact.value).pipe(Effect.flatMap(decodeLibraryJson(CaptionPlayer)));
  return O.some(player);
});
const captionPlayerTrackMatches = (
  capture: LibraryCapture,
  record: (typeof TranscriptProvenance.Type)[number],
  player: typeof CaptionPlayer.Type
) =>
  player.videoDetails.videoId === capture.capturedRevision &&
  A.some(
    player.captions.playerCaptionsTracklistRenderer.captionTracks,
    (track) =>
      Str.replace(/&fmt=srv3(?=&|$)/, "")(track.baseUrl) === record.url &&
      track.languageCode === record.language &&
      (track.kind === "asr") === (record.origin === "automatic")
  );
const readXmlCaptionCues = Effect.fn("Library.readXmlCaptionCues")(function* (xml: string) {
  const parsed = yield* parseCaptionXml(xml).pipe(Effect.flatMap(S.decodeUnknownEffect(XmlCaptionTranscript)));
  const cues = S.is(XmlCaptionCues)(parsed.transcript.text) ? parsed.transcript.text : [parsed.transcript.text];
  const cueTexts = yield* Effect.forEach(cues, (cue) =>
    parseCaptionXml(`<r>${Str.replaceAll(">", "&gt;")(Str.replaceAll("<", "&lt;")(cue["#text"]))}</r>`).pipe(
      Effect.flatMap(S.decodeUnknownEffect(CaptionTextNode)),
      Effect.map((item) => item.r)
    )
  );
  return { cues, cueTexts };
});
const captionApiCuesMatch = (
  capture: LibraryCapture,
  record: (typeof TranscriptProvenance.Type)[number],
  api: typeof CaptionApi.Type,
  cues: typeof XmlCaptionCues.Type,
  cueTexts: ReadonlyArray<string>
) => {
  if (
    api.videoId !== capture.capturedRevision ||
    api.languageCode !== record.language ||
    api.isGenerated !== (record.origin === "automatic") ||
    api.snippets.length !== cues.length
  )
    return false;
  if (
    !A.every(api.snippets, (snippet, index) => {
      const cue = cues[index];
      return (
        cue !== undefined &&
        snippet.start === cue.start &&
        snippet.duration === cue.dur &&
        snippet.text === cueTexts[index]
      );
    })
  )
    return false;
  return true;
};
const youtubeApiTranscriptMatches = (
  capture: LibraryCapture,
  record: (typeof TranscriptProvenance.Type)[number],
  apis: ReadonlyArray<typeof CaptionApi.Type>,
  cues: typeof XmlCaptionCues.Type,
  cueTexts: ReadonlyArray<string>,
  transcript: ReadonlyArray<string>
) => {
  for (const api of apis) {
    if (!captionApiCuesMatch(capture, record, api, cues, cueTexts)) continue;
    const text = `${A.join(
      A.map(
        api.snippets,
        (snippet) => `[${snippet.start.toFixed(3)} - ${(snippet.start + snippet.duration).toFixed(3)}] ${snippet.text}`
      ),
      "\n"
    )}\n`;
    if (A.contains(transcript, text)) return true;
  }
  return false;
};
const validateYoutubeApiRecord = Effect.fn("Library.validateYoutubeApiRecord")(function* (
  context: EvidenceContext,
  record: (typeof TranscriptProvenance.Type)[number],
  metadata: ReadonlyArray<typeof VideoMetadata.Type>,
  receipts: typeof CaptionHttpReceipts.Type,
  apis: ReadonlyArray<typeof CaptionApi.Type>,
  transcript: ReadonlyArray<string>,
  receiptArtifact: (sha: string, bytes: number, expectedRole: string) => O.Option<LibraryArtifact>
) {
  const { capture, read } = context;

  if (record.format !== "xml" || !A.contains(["creator", "automatic"], record.origin)) return O.none();
  const xmlArtifact = yield* resolveTimedCaptionArtifact(context, record, receipts, receiptArtifact);
  if (O.isNone(xmlArtifact)) return O.none();
  const player = yield* readYoutubeCaptionPlayer(context, metadata, receipts, receiptArtifact);
  if (O.isNone(player) || !captionPlayerTrackMatches(capture, record, player.value)) return O.none();
  const xml = yield* read(xmlArtifact.value);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) return O.some(false);
  const { cues, cueTexts } = yield* readXmlCaptionCues(xml);
  if (A.isReadonlyArrayEmpty(cues)) return O.none();
  if (youtubeApiTranscriptMatches(capture, record, apis, cues, cueTexts, transcript)) return O.some(true);

  return O.none<boolean>();
});
const validateYoutubeApi = Effect.fn("Library.validateYoutubeApi")(function* (
  context: EvidenceContext,
  metadata: ReadonlyArray<typeof VideoMetadata.Type>,
  provenance: ReadonlyArray<typeof TranscriptProvenance.Type>,
  transcript: ReadonlyArray<string>
) {
  const { url, artifacts, role, json } = context;

  if (A.some(artifacts, (item) => item.bytes > 8_000_000)) return false;
  const envelopes = yield* json("import-provenance", LibraryImportPayload);
  if (!A.some(envelopes, (item) => item.provider === "youtube-transcript-api" && importedCaptureBound(context, item)))
    return false;
  const receipts = A.flatten(yield* json("http-response-provenance", CaptionHttpReceipts));
  const apis = yield* json("raw-api-response", CaptionApi);
  const receiptArtifact = (sha: string, bytes: number, expectedRole: string) =>
    A.findFirst(role(expectedRole), (item) => item.sha256 === sha && item.bytes === bytes);
  const watch = A.findFirst(
    receipts,
    (item) =>
      item.url === url &&
      successfulStatus(item.status) &&
      O.isSome(receiptArtifact(item.sha256, item.bytes, "raw-response"))
  );
  if (O.isNone(watch)) return false;
  for (const record of A.flatten(provenance)) {
    const result = yield* validateYoutubeApiRecord(
      context,
      record,
      metadata,
      receipts,
      apis,
      transcript,
      receiptArtifact
    );
    if (O.isSome(result)) return result.value;
  }
  return false;
});
const nativeVttMatchesTranscript = (vtt: string, transcript: ReadonlyArray<string>) => {
  if (!Str.startsWith("WEBVTT")(vtt) || !Str.includes("-->")(vtt)) return false;
  const lines = Str.split(vtt, "\n");
  const cues = A.filter(
    lines,
    (line) =>
      Str.isNonEmpty(Str.trim(line)) &&
      !Str.includes("-->")(line) &&
      !/^(?:WEBVTT|Kind:|Language:|NOTE|\d+$)/.test(line)
  );
  if (A.isReadonlyArrayEmpty(cues)) return false;
  const extracted = A.join(
    A.filter(
      lines,
      (line) =>
        Str.includes("-->")(line) ||
        (Str.isNonEmpty(Str.trim(line)) && !/^(?:WEBVTT|Kind:|Language:|NOTE|\d+$)/.test(line))
    ),
    "\n"
  );
  return A.contains(transcript, extracted);
};
const validateNativeCaptionRecord = Effect.fn("Library.validateNativeCaptionRecord")(function* (
  context: EvidenceContext,
  record: (typeof TranscriptProvenance.Type)[number],
  transcript: ReadonlyArray<string>
) {
  const { url, role, read, nonempty } = context;
  if (Str.isEmpty(record.language) || !/^https?:\/\//.test(record.url)) return false;
  if (record.origin === "manual")
    return record.url === url && A.contains(["text", "txt", "text/plain"], record.format) && nonempty(transcript);
  if (record.format !== "vtt") return false;
  for (const artifact of A.filter(role("transcript-full-text"), (item) => item.mediaType === "text/vtt")) {
    if (nativeVttMatchesTranscript(yield* read(artifact), transcript)) return true;
  }
  return false;
});
const validateYoutubeEvidence = Effect.fn("Library.validateYoutubeEvidence")(function* (context: EvidenceContext) {
  const { source, capture, url, texts, json } = context;

  const metadata = yield* json("target-metadata", VideoMetadata);
  const provenance = yield* json("transcript-provenance", TranscriptProvenance);
  const transcript = yield* texts("transcript-full-text");
  if (
    !A.some(
      metadata,
      (item) =>
        source.identity === `youtube:${item.id}` && capture.capturedRevision === item.id && item.webpage_url === url
    )
  )
    return false;
  if (capture.method === "youtube-transcript-api")
    return yield* validateYoutubeApi(context, metadata, provenance, transcript);
  for (const records of provenance)
    for (const record of records) {
      if (yield* validateNativeCaptionRecord(context, record, transcript)) return true;
    }
  return false;
});
const validateAlphaImport = Effect.fn("Library.validateAlphaImport")(function* (
  context: EvidenceContext,
  events: ReadonlyArray<unknown>
) {
  const { source, url, texts, paperHeaderMatches } = context;

  const alpha = A.getSomes(A.map(events, (event) => S.decodeUnknownOption(AlphaFullText)(event)));
  const extracted = yield* texts("extracted-full-text");
  return A.some(
    alpha,
    (event) =>
      event.arguments.url === url &&
      (!Str.startsWith("arxiv:")(source.identity) ||
        A.some(event.result.content, (block) => paperHeaderMatches(block.text))) &&
      A.some(event.result.content, (block) => Str.length(Str.trim(block.text)) > 1000) &&
      A.contains(
        extracted,
        A.join(
          A.map(event.result.content, (block) => block.text),
          "\n"
        )
      )
  );
});
const validateXImport = Effect.fn("Library.validateXImport")(function* (
  context: EvidenceContext,
  imported: LibraryImportPayload,
  events: ReadonlyArray<unknown>
) {
  const { url, texts, nonempty } = context;

  yield* validateProviderQualification("grok-x-import", events);
  const posts = A.getSomes(A.map(events, (event) => S.decodeUnknownOption(ReturnedPosts)(event)));
  return (
    imported.provider === "grok" &&
    A.some(posts, (item) => A.some(item.posts, (post) => post.url === url && Str.isNonEmpty(Str.trim(post.text)))) &&
    nonempty(yield* texts("extracted-full-text"))
  );
});
const publisherProofTargetMatches = (context: EvidenceContext, proof: typeof CitationResolution.Type) =>
  (proof.sourceId === context.source.id || A.contains(context.source.aliasIds, proof.sourceId)) &&
  proof.citedUrl === context.url &&
  proof.pdfUrl === proof.observedCitationPdfUrl &&
  Str.isNonEmpty(Str.trim(proof.reason));
const publisherCitationPdfMatches = (html: string, pdfUrl: string) => {
  const tags = O.getOrElse(Str.match(/<meta\b[^>]*>/gi)(html), () => []);
  return A.some(
    tags,
    (tag) =>
      /\bname\s*=\s*(?:"citation_pdf_url"|'citation_pdf_url'|citation_pdf_url)(?:\s|>)/i.test(tag) &&
      (Str.includes(`content="${pdfUrl}"`)(tag) ||
        Str.includes(`content='${pdfUrl}'`)(tag) ||
        Str.includes(`content=${pdfUrl}>`)(tag))
  );
};
const publisherResponseTargetsMatch = (
  url: string,
  pdfUrl: string,
  metadata: { readonly requestedUrl: string; readonly status: number },
  request: typeof TargetMetadata.Type
) =>
  metadata.requestedUrl === url &&
  successfulStatus(metadata.status) &&
  request.requestedUrl === pdfUrl &&
  request.pdfUrl === pdfUrl &&
  successfulStatus(request.status);
const validatePublisherProof = Effect.fn("Library.validatePublisherProof")(function* (
  context: EvidenceContext,
  proof: typeof CitationResolution.Type
) {
  const { url, role, read } = context;

  if (!publisherProofTargetMatches(context, proof)) return false;
  const find = (name: string, hash: string) => A.findFirst(role(name), (artifact) => artifact.sha256 === hash);
  const landing = find("publisher-landing-page", proof.landingHtmlSha256);
  const landingMeta = find("publisher-target-metadata", proof.landingMetadataSha256);
  const pdfMeta = find("pdf-request-metadata", proof.pdfMetadataSha256);
  if (
    O.isNone(landing) ||
    O.isNone(landingMeta) ||
    O.isNone(pdfMeta) ||
    O.isNone(find("raw-full-text", proof.pdfSha256))
  )
    return false;
  const metadata = yield* read(landingMeta.value).pipe(
    Effect.flatMap(decodeLibraryJson(S.Struct({ requestedUrl: S.String, status: S.Finite })))
  );
  const request = yield* read(pdfMeta.value).pipe(Effect.flatMap(decodeLibraryJson(TargetMetadata)));
  const html = yield* read(landing.value);
  const relation = publisherCitationPdfMatches(html, proof.pdfUrl);
  if (relation && publisherResponseTargetsMatch(url, proof.pdfUrl, metadata, request)) return true;
  return false;
});
const validatePublisherImport = Effect.fn("Library.validatePublisherImport")(function* (context: EvidenceContext) {
  const resolutions = yield* context.json("citation-resolution", CitationResolution);
  const validity = yield* Effect.forEach(resolutions, (proof) => validatePublisherProof(context, proof), {
    concurrency: 1,
  });
  return A.some(validity, (valid) => valid);
});
const importedFirecrawlMatches = (context: EvidenceContext, imported: LibraryImportPayload) =>
  imported.provider === "firecrawl" &&
  context.capture.method === "firecrawl" &&
  A.contains(["web", "docs", "endpoint"], context.source.kind);
const validateImportedPaper = Effect.fn("Library.validateImportedPaper")(function* (
  context: EvidenceContext,
  imported: LibraryImportPayload,
  events: ReadonlyArray<unknown>
) {
  if (imported.provider === "alphaxiv") return yield* validateAlphaImport(context, events);
  if (imported.provider === "publisher-http" && context.capture.method === "paper") {
    if (!(yield* validatePublisherImport(context))) return false;
    return undefined;
  }
  return false;
});
const validateImportedEvidence = Effect.fn("Library.validateImportedEvidence")(function* (context: EvidenceContext) {
  const { source, role, json, webResponseValid } = context;
  const imports = yield* json("import-provenance", LibraryImportPayload);
  if (A.isReadonlyArrayEmpty(imports)) return undefined;
  const imported = A.findFirst(imports, (item) => importedCaptureBound(context, item));
  if (O.isNone(imported)) return false;
  const events = yield* readLibraryProviderEvents(context.root, role("raw-provider-events"));
  if (source.kind === "paper") return yield* validateImportedPaper(context, imported.value, events);
  if (source.kind === "x") return yield* validateXImport(context, imported.value, events);
  if (importedFirecrawlMatches(context, imported.value)) return yield* webResponseValid();
  // A generic interpretation envelope is not independent source evidence.
  return false;
});
const successfulStatus = (status: number) => status >= 200 && status < 300;
const arxivProofTargetMatches = (context: EvidenceContext, proof: typeof ArxivVersionProof.Type) => {
  const { source, capture } = context;
  const paperId = Str.slice(6)(source.identity);
  const explicitUrl = `https://arxiv.org/pdf/${paperId}${capture.capturedRevision}`;
  return (
    proof.paperId === paperId &&
    proof.observedRevision === capture.capturedRevision &&
    proof.metadataUrl ===
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(`${paperId}${capture.requestedRevision}`)}` &&
    proof.explicitUrl === explicitUrl &&
    proof.resolvedUrl === explicitUrl
  );
};
const arxivProofResponseMatches = (proof: typeof ArxivVersionProof.Type) =>
  proof.identicalPdf &&
  successfulStatus(proof.metadataStatus) &&
  successfulStatus(proof.status) &&
  proof.originalPdfSha256 === proof.versionedPdfSha256;
const arxivPdfArtifactBound = (context: EvidenceContext, role: string, hash: string) =>
  A.some(
    context.role(role),
    (item) => item.mediaType === "application/pdf" && item.sha256 === hash && item.bytes <= 50_000_000
  );
const validateArxivVersionProof = Effect.fn("Library.validateArxivVersionProof")(function* (
  context: EvidenceContext,
  proof: typeof ArxivVersionProof.Type
) {
  if (!arxivProofTargetMatches(context, proof) || !arxivProofResponseMatches(proof)) return false;
  if (
    !arxivPdfArtifactBound(context, "raw-full-text", proof.originalPdfSha256) ||
    !arxivPdfArtifactBound(context, "versioned-pdf-response", proof.versionedPdfSha256)
  )
    return false;
  const atom = A.findFirst(context.role("arxiv-version-metadata"), (item) => item.sha256 === proof.metadataSha256);
  if (O.isNone(atom)) return false;
  const observed = Str.match(/<id>\s*https?:\/\/arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)\s*<\/id>/i)(
    yield* context.read(atom.value)
  );
  return (
    O.isSome(observed) &&
    observed.value[1] === Str.slice(6)(context.source.identity) &&
    observed.value[2] === context.capture.capturedRevision
  );
});
const arxivMetadataTargetMatches = (context: EvidenceContext, item: typeof TargetMetadata.Type) =>
  item.paperId === Str.slice(6)(context.source.identity) &&
  item.requestedRevision === context.capture.requestedRevision &&
  item.capturedRevision === context.capture.capturedRevision &&
  arxivCapturedRevisionValid(context.capture);
const paperMetadataTargetMatches = (context: EvidenceContext, item: typeof TargetMetadata.Type) =>
  item.requestedUrl === context.url &&
  successfulStatus(item.status) &&
  (!Str.startsWith("arxiv:")(context.source.identity) || arxivMetadataTargetMatches(context, item));
const resolveArxivIdentity = Effect.fn("Library.resolveArxivIdentity")(function* (
  context: EvidenceContext,
  extractedTexts: ReadonlyArray<string>
) {
  const { source, paperHeaderMatches, paperHeader, json } = context;
  const headerValid = !Str.startsWith("arxiv:")(source.identity) || A.some(extractedTexts, paperHeaderMatches);
  if (headerValid || A.some(extractedTexts, (text) => O.isSome(paperHeader(text)))) return headerValid;
  const proofs = yield* json("arxiv-version-proof", ArxivVersionProof);
  const validity = yield* Effect.forEach(proofs, (proof) => validateArxivVersionProof(context, proof), {
    concurrency: 1,
  });
  return A.some(validity, (valid) => valid);
});
const validatePaperEvidence = Effect.fn("Library.validatePaperEvidence")(function* (context: EvidenceContext) {
  const { root, fs, path, role, texts, json, nonempty } = context;
  const metadata = yield* json("target-metadata", TargetMetadata);
  const pdfs = yield* Effect.forEach(
    A.filter(role("raw-full-text"), (artifact) => artifact.mediaType === "application/pdf"),
    (artifact) => fs.readFile(path.resolve(root, artifact.path)),
    { concurrency: 1 }
  );
  const extractedTexts = yield* texts("extracted-full-text");
  const arxivIdentityValid = yield* resolveArxivIdentity(context, extractedTexts);
  return (
    A.some(metadata, (item) => paperMetadataTargetMatches(context, item)) &&
    A.some(pdfs, (bytes) => new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-") &&
    nonempty(yield* texts("extracted-full-text")) &&
    arxivIdentityValid
  );
});
const arxivCapturedRevisionValid = (capture: LibraryCapture) =>
  /^v\d+$/.test(capture.capturedRevision) &&
  (capture.requestedRevision === "" || capture.capturedRevision === capture.requestedRevision);
const sourceCapturedRevisionValid = (source: LibrarySource, capture: LibraryCapture) => {
  if (source.kind === "youtube" || Str.startsWith("github-")(source.kind)) return true;
  if (source.kind === "paper" && Str.startsWith("arxiv:")(source.identity)) return arxivCapturedRevisionValid(capture);
  return capture.capturedRevision === capture.requestedRevision;
};
/** Revalidate source-specific target and content provenance.
 * **Example** (Checking a retained source)
 * ```ts
 * import { librarySourceEvidenceValid } from "@beep/repo-cli/test/ResearchLibrary"
 * import type { LibrarySource, LibraryCapture } from "@beep/repo-cli/commands/Research"
 * const validate = (source: LibrarySource, capture: LibraryCapture) => librarySourceEvidenceValid("/library", source, capture)
 * console.log(typeof validate) // function
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const librarySourceEvidenceValid = Effect.fn("Research.Library.verifySourceEvidence")(function* (
  root: string,
  source: LibrarySource,
  capture: LibraryCapture
) {
  const revisions = A.dedupe([source.revision, ...A.map(source.versions, (version) => version.revision)]);
  if (!A.contains(revisions, capture.requestedRevision) || !sourceCapturedRevisionValid(source, capture)) return false;
  if (!(yield* libraryArtifactsValid(root, capture.artifacts))) return false;
  const context = yield* makeEvidenceContext(root, source, capture);
  if (Str.startsWith("github-")(source.kind)) return yield* validateGithubEvidence(context);
  if (source.kind === "youtube") return yield* validateYoutubeEvidence(context);
  const imported = yield* validateImportedEvidence(context);
  if (imported !== undefined) return imported;
  if (
    source.kind === "paper" &&
    A.some(context.role("raw-full-text"), (artifact) => artifact.mediaType === "application/pdf")
  )
    return yield* validatePaperEvidence(context);
  return yield* context.webResponseValid();
});

const currentCaptureClaim = Effect.fn("Library.currentCaptureClaim")(function* (
  root: string,
  catalog: LibraryCatalog,
  source: LibrarySource,
  capture: LibraryCapture,
  revision: string
) {
  if (
    capture.status === "readable" &&
    capture.complete &&
    (yield* librarySourceEvidenceValid(root, source, capture).pipe(Effect.orElseSucceed(() => false)))
  )
    return O.some(LibraryEffectiveCapture.make({ revision, capture, category: "readable" }));
  if (!(yield* libraryDispositionValid(root, catalog, source, capture).pipe(Effect.orElseSucceed(() => false))))
    return O.none();
  const receipt = A.findFirst(capture.artifacts, (artifact) => artifact.role === "reviewed-disposition");
  if (O.isNone(receipt)) return O.none();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const review = yield* fs
    .readFileString(path.resolve(root, receipt.value.path))
    .pipe(Effect.flatMap(decodeLibraryJson(LibraryDispositionImportPayload)));
  return O.some(LibraryEffectiveCapture.make({ revision, capture, category: review.disposition }));
});
/** Validated current claim for one requested revision.
 * **Example** (Inspect the selection shape)
 * ```ts
 * import { LibraryEffectiveCapture } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(LibraryEffectiveCapture.fields.revision)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryEffectiveCapture extends S.Class<LibraryEffectiveCapture>($I`LibraryEffectiveCapture`)(
  {
    revision: S.String,
    capture: S.NullOr(LibraryCapture),
    category: S.String,
  },
  $I.annote("LibraryEffectiveCapture", {
    description:
      "Validated current claim for one requested revision: its capture, if any, and the category it settles on.",
  })
) {}

/** Select the latest validated claim in immutable catalog append order for each required revision.
 * **Details**
 * Failed attempts do not erase a valid claim. A hash-bound review supersedes an earlier readable claim;
 * a later valid readable capture restores it. Callers still verify every historical artifact independently.
 * Append order is authoritative: imported provider timestamps may predate a later local revalidation.
 * **Example** (Select current claims)
 * ```ts
 * import { libraryEffectiveCaptures } from "@beep/repo-cli/test/ResearchLibrary"
 * const current = (catalog: import("@beep/repo-cli/commands/Research").LibraryCatalog) =>
 *   libraryEffectiveCaptures("/library", catalog, catalog.sources[0])
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const libraryEffectiveCaptures = Effect.fn("Library.effectiveCaptures")(function* (
  root: string,
  catalog: LibraryCatalog,
  source: LibrarySource
) {
  const revisions = libraryCitedRevisions(catalog, source);
  return yield* Effect.forEach(revisions, (revision) =>
    Effect.gen(function* () {
      let selected = LibraryEffectiveCapture.make({ revision, capture: null, category: "missing" });
      for (const capture of catalog.captures) {
        if (capture.sourceId !== source.id || capture.requestedRevision !== revision) continue;
        const claim = yield* currentCaptureClaim(root, catalog, source, capture, revision);
        if (O.isSome(claim)) selected = claim.value;
      }
      return selected;
    })
  );
});

/** Classify a source by its least complete required version.
 * **Example** (Prefer an unread version over a readable version)
 * ```ts
 * import { libraryEffectiveCategory } from "@beep/repo-cli/test/ResearchLibrary"
 * console.log(libraryEffectiveCategory(["readable", "incomplete"]))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const libraryEffectiveCategory = (categories: ReadonlyArray<string>): string =>
  O.getOrElse(
    A.findFirst(
      [
        "missing",
        "ambiguous",
        "tool-blocked",
        "incomplete",
        "unavailable",
        "internal",
        "operational",
        "non-reference",
        "readable",
      ],
      (category) => A.contains(categories, category)
    ),
    () => "missing"
  );
