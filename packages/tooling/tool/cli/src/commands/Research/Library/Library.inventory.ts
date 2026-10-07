/** Exhaustive local citation inventory and immutable document snapshots.
 * @packageDocumentation
 *
 * @since 0.0.0
 */
import { DateTime, Effect, FileSystem, Match, Path } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as StepExec from "../../../internal/process/StepExec.ts";
import { LibraryError } from "./Library.errors.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryIntakeRoot,
  LibraryManifest,
  LibraryOccurrence,
  LibraryReference,
  LibrarySource,
  LibraryVersion,
} from "./Library.schemas.ts";
import { hashBytes, mergeLibraryVersions, saveImmutable, withCatalog } from "./Library.store.ts";
import type { LibraryInventoryOptions, LibraryOwnership, LibrarySourceKind } from "./Library.schemas.ts";

const classifyTopics = (evidence: string): ReadonlyArray<string> =>
  A.filter(
    [
      /\b(?:law|legal|patent|uspto|docket|citation|citator)\b/i.test(evidence) ? "law-practice" : "",
      /\b(?:effect|evolu|drizzle)\b/i.test(evidence) ? "effect" : "",
      /\b(?:tooling|turborepo|quality|graft|beep|repo|typescript)\b/i.test(evidence) ? "repo-tooling" : "",
      /\b(?:agent|agents|harness|memory|mcp|skills|oversight)\b/i.test(evidence) ? "agent-harness" : "",
      /\b(?:arxiv|paper|papers|preprint|benchmark|bench)\b/i.test(evidence) ? "papers" : "",
      /\b(?:local.first|sync|offline|crdt|pglite|jazz)\b/i.test(evidence) ? "local-first" : "",
    ],
    Str.isNonEmpty
  );
const documentTopicEvidence = (text: string) =>
  A.join(
    A.map(
      A.filter(Str.split(text, "\n"), (line) => /^##+\s|"axis"\s*:/.test(line)),
      (line) =>
        /^##+\s/.test(line)
          ? line
          : O.getOrElse(
              O.map(O.fromNullishOr(line.match(/"axis"\s*:\s*"([^"]+)"/)), (m) =>
                O.getOrElse(O.fromNullishOr(m[1]), () => "")
              ),
              () => ""
            )
    ),
    "\n"
  );
const hashText = (text: string) => hashBytes(new TextEncoder().encode(text));
const failure = (message: string) => Effect.mapError((cause: unknown) => LibraryError.make({ message, cause }));

/** Extract citation locators at exact one-based UTF-16 line and column positions.
 * **Details**
 * This text boundary recognizes HTTP locators, bare DOI/arXiv identifiers,
 * Markdown relative links, and unresolved repository shorthand. A locator inside
 * another locator is emitted only once; Markdown labels remain contextual text.
 * **Example** (Extract a URL)
 * ```ts
 * import { extractLibraryReferences } from "@beep/repo-cli/commands/Research"
 * console.log(extractLibraryReferences("See https://example.com/a").length) // 1
 * ```
 *
 * @category parsing
 *
 * @since 0.0.0
 */
export const extractLibraryReferences: {
  (text: string): ReadonlyArray<LibraryReference>;
  (text: string, knownReferences: ReadonlyArray<string>): ReadonlyArray<LibraryReference>;
  (knownReferences: ReadonlyArray<string>): (text: string) => ReadonlyArray<LibraryReference>;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, knownReferences: ReadonlyArray<string> = []): ReadonlyArray<LibraryReference> => {
    // RegExp match offsets are a text-parser boundary; they refer to the unchanged source.
    let references: ReadonlyArray<LibraryReference> = [];
    let covered: ReadonlyArray<readonly [number, number]> = [];
    const add = (
      locator: string,
      offset: number,
      form: string,
      citationText = locator,
      labelOverride = "",
      definition: O.Option<LibraryReference> = O.none(),
      sharedSpan = false
    ) => {
      if (!sharedSpan && A.some(covered, ([start, end]) => offset >= start && offset < end)) return;
      const before = Str.slice(0, offset)(text);
      const line = Str.split(before, "\n").length;
      const lastNewline = before.lastIndexOf("\n");
      const column = offset - lastNewline;
      const endOffset = offset + citationText.length;
      const endBefore = Str.slice(0, endOffset)(text);
      const endLine = Str.split(endBefore, "\n").length;
      const endColumn = endOffset - endBefore.lastIndexOf("\n");
      const context = Str.slice(lastNewline + 1, offset)(text);
      const labelMatch = context.match(/\[([^\]\n]+)\]\($/);
      const label = O.getOrElse(
        O.map(O.fromNullishOr(labelMatch), (m) => O.getOrElse(O.fromNullishOr(m[1]), () => "")),
        () => ""
      );
      references = A.append(
        references,
        LibraryReference.make({
          locator,
          label: labelOverride || label,
          form,
          line,
          column,
          endLine,
          endColumn,
          citationText,
          referenceKey: O.getOrElse(
            O.map(definition, (d) => d.referenceKey),
            () => ""
          ),
          definitionLine: O.getOrElse(
            O.map(definition, (d) => d.line),
            () => 0
          ),
          definitionColumn: O.getOrElse(
            O.map(definition, (d) => d.column),
            () => 0
          ),
          definitionEndLine: O.getOrElse(
            O.map(definition, (d) => d.endLine),
            () => 0
          ),
          definitionEndColumn: O.getOrElse(
            O.map(definition, (d) => d.endColumn),
            () => 0
          ),
        })
      );
      covered = A.append(covered, [offset, endOffset]);
    };
    const addWeb = (locator: string, offset: number, form: string) => {
      // A URL-shaped Markdown label describes its target; it is not another source.
      if (text[offset - 1] === "[" && /^\]\(/.test(Str.slice(offset + locator.length)(text))) {
        covered = A.append(covered, [offset, offset + locator.length]);
        return;
      }
      if (A.some(covered, ([start, end]) => offset >= start && offset < end)) return;
      const categories = locator.match(
        /^(?:https?:\/\/)?arxiv\.org\/list\/(cs\.[A-Za-z]+(?:\|cs\.[A-Za-z]+)+)\/(new|pastweek)$/
      );
      if (categories === null) {
        add(locator, offset, form);
        return;
      }
      const categoryList = Str.split(
        O.getOrElse(O.fromNullishOr(categories[1]), () => ""),
        "|"
      );
      for (const { index, category } of A.map(categoryList, (category, index) => ({ category, index })))
        add(
          `https://arxiv.org/list/${category}/${categories[2]}`,
          offset,
          "arxiv-category-list",
          locator,
          "",
          O.none(),
          index > 0
        );
    };
    const collectWebLocators = () => {
      for (const match of text.matchAll(/https?:\/\/[^\s\]<>"`\\，。；！？、]+/g)) {
        let locator = match[0];
        locator = Str.replace(/[.,;:!?]+$/, "")(locator);
        while (Str.endsWith(")")(locator) && Str.split(locator, ")").length > Str.split(locator, "(").length)
          locator = Str.slice(0, -1)(locator);
        locator = Str.replace(/\]+$/, "")(locator);
        addWeb(locator, match.index, "url");
      }
    };
    collectWebLocators();
    const collectIdentifierLocators = () => {
      for (const match of text.matchAll(/arxiv(?:\s*:\s*|\s+)\d{4}\.\d{4,5}(?:v\d+)?/gi))
        add(match[0], match.index, "arxiv-id");
      for (const match of text.matchAll(
        /arxiv(?:\s*:\s*|\s+)\d{4}\.\d{4,5}(?:v\d+)?(?:\s*[;,]\s*\d{4}\.\d{4,5}(?:v\d+)?)+/gi
      )) {
        for (const candidate of match[0].matchAll(/\d{4}\.\d{4,5}(?:v\d+)?/g))
          add(candidate[0], match.index + candidate.index, "arxiv-id");
      }
      for (const match of text.matchAll(/\bgithub\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^\s<>"`]+)?/g))
        add(Str.replace(/[.,;)]+$/, "")(match[0]), match.index, "bare-github-url");
      for (const match of text.matchAll(
        /\b(?:[A-Za-z0-9-]+\.)+(?:gov|com|org|net|edu|io|ai|dev|app)\/[^\s\]<>"`，。；！？、]+/g
      ))
        addWeb(Str.replace(/[.,;)]+$/, "")(match[0]), match.index, "bare-web-url");
      for (const match of text.matchAll(/\b10\.\d{4,9}\/[^\s\]<>"`]+/gi))
        add(Str.replace(/[.,;)]+$/, "")(match[0]), match.index, "doi");
    };
    collectIdentifierLocators();
    const collectMarkdownReferences = () => {
      const collectInlineMarkdownLinks = () => {
        for (const match of text.matchAll(/\]\((?!https?:\/\/)([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
          const locator = O.getOrElse(O.fromNullishOr(match[1]), () => "");
          add(locator, match.index + 2, "relative-link");
        }
        for (const match of text.matchAll(/`([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)`/g)) {
          const locator = O.getOrElse(O.fromNullishOr(match[1]), () => "");
          add(locator, match.index + 1, "repo-shorthand");
        }
      };
      collectInlineMarkdownLinks();
      const normalizeKey = (key: string) => Str.toLowerCase(Str.trim(Str.replace(/\s+/g, " ")(key)));
      let definitions: ReadonlyArray<LibraryReference> = [];
      const collectReferenceDefinitions = () => {
        for (const match of text.matchAll(/^ {0,3}\[([^\]\n]+)\]:\s*<?(https?:\/\/[^\s>]+)>?/gm)) {
          const key = O.getOrElse(O.fromNullishOr(match[1]), () => "");
          const locator = Str.replace(/[.,;]+$/, "")(O.getOrElse(O.fromNullishOr(match[2]), () => ""));
          const offset = match.index + match[0].indexOf(locator);
          const before = Str.slice(0, offset)(text);
          const line = Str.split(before, "\n").length;
          const column = offset - before.lastIndexOf("\n");
          definitions = A.append(
            definitions,
            LibraryReference.make({
              locator,
              label: key,
              referenceKey: normalizeKey(key),
              citationText: locator,
              form: "definition",
              line,
              column,
              endLine: line,
              endColumn: column + locator.length,
            })
          );
        }
      };
      collectReferenceDefinitions();
      for (const match of text.matchAll(/\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g)) {
        const following = text[match.index + match[0].length];
        if (following === "(" || following === ":" || text[match.index - 1] === "\\") continue;
        const label = O.getOrElse(O.fromNullishOr(match[1]), () => "");
        const explicitKey = O.getOrElse(O.fromNullishOr(match[2]), () => "");
        const key = normalizeKey(explicitKey || label);
        const definition = A.findFirst(definitions, (d) => d.referenceKey === key);
        if (O.isSome(definition))
          add(definition.value.locator, match.index, "reference-use", match[0], label, definition);
      }
    };
    collectMarkdownReferences();
    const collectContextualPaperIds = () => {
      const knownPaperIds = A.dedupe([
        ...A.flatMap(knownReferences, (reference) =>
          A.map(
            A.fromIterable(reference.matchAll(/(?:arxiv:|arxiv\.org\/(?:abs|pdf|html)\/)(\d{4}\.\d{4,5})/gi)),
            (match) => O.getOrElse(O.fromNullishOr(match[1]), () => "")
          )
        ),
        ...A.map(
          A.fromIterable(
            text.matchAll(/(?:arxiv(?:\s*:\s*|\s+)|arxiv\.org\/(?:abs|pdf|html)\/|"arxiv"\s*:\s*")(\d{4}\.\d{4,5})/gi)
          ),
          (match) => O.getOrElse(O.fromNullishOr(match[1]), () => "")
        ),
      ]);
      for (const match of text.matchAll(/\b(\d{4}\.\d{4,5})(?:v\d+)?\b/g)) {
        const before = Str.slice(0, match.index)(text);
        const after = Str.slice(match.index + match[0].length)(text);
        const numericLinkLabel = Str.endsWith("[")(before) && /^\]\s*(?:\(|\[)/.test(after);
        const context =
          A.join(A.takeRight(Str.split(before, "\n"), 1), "") + O.getOrElse(A.get(Str.split(after, "\n"), 0), () => "");
        if (
          !numericLinkLabel &&
          (A.contains(
            knownPaperIds,
            O.getOrElse(O.fromNullishOr(match[1]), () => "")
          ) ||
            /\barxiv\b/i.test(context))
        )
          add(match[0], match.index, "arxiv-id");
      }
    };
    collectContextualPaperIds();
    const collectRepositoryShorthand = () => {
      for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+#\d+\b/g))
        add(match[0], match.index, "repo-resource-shorthand");
      const explicitRepositories = A.dedupe([
        ...A.map(knownReferences, Str.toLowerCase),
        ...A.map(
          A.fromIterable(text.matchAll(/(?:https?:\/\/)?github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g)),
          (match) => Str.toLowerCase(O.getOrElse(O.fromNullishOr(match[1]), () => ""))
        ),
      ]);
      for (const match of text.matchAll(/\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/g)) {
        if (A.contains(explicitRepositories, Str.toLowerCase(match[0]))) add(match[0], match.index, "repo-shorthand");
      }
    };
    collectRepositoryShorthand();
    return A.sort(
      references,
      Order.combine(
        Order.mapInput(Order.Number, (r: LibraryReference) => r.line),
        Order.mapInput(Order.Number, (r: LibraryReference) => r.column)
      )
    );
  }
);

const pruneTrackingParameters = (url: URL) => {
  for (const key of A.fromIterable(url.searchParams.keys()))
    if (Str.startsWith("utm_")(key) || key === "fbclid" || key === "gclid") url.searchParams.delete(key);
};
const githubRequestedRevision = (parts: ReadonlyArray<string>, section: string) => {
  if (section === "blob" || section === "tree" || section === "commit") return O.getOrElse(A.get(parts, 3), () => "");
  if (section === "commits") return A.join(A.drop(parts, 3), "/");
  if (section === "releases" && O.contains("tag")(A.get(parts, 3))) return A.join(A.drop(parts, 4), "/");
  return "";
};
const classifyWebKind = (host: string, pathname: string): LibrarySourceKind =>
  Match.value(host).pipe(
    Match.when(
      (value) => /npmjs\.(?:com|org)$|pypi\.org$/.test(value),
      (): LibrarySourceKind => "registry"
    ),
    Match.when(
      (value) =>
        /^docs\.|^spec\.|w3\.org$|rfc-editor\.org$/.test(value) ||
        /\/(?:docs|documentation|specification)\//.test(pathname),
      (): LibrarySourceKind => "docs"
    ),
    Match.when(
      (value) => value !== "glama.ai" && value !== "lobehub.com" && /\/(?:mcp|api)(?:\/|$)/.test(pathname),
      (): LibrarySourceKind => "endpoint"
    ),
    Match.when(
      (value) => /\.pdf$/.test(pathname) || value === "openreview.net" || value === "aclanthology.org",
      (): LibrarySourceKind => "paper"
    ),
    Match.orElse((): LibrarySourceKind => "web")
  );
const isInternalLocator = (locator: string) =>
  Str.startsWith("./")(locator) ||
  Str.startsWith("../")(locator) ||
  Str.startsWith("/")(locator) ||
  Str.startsWith("#")(locator) ||
  /^(?:effect|packages|goals|apps|research|standards|docs|explorations|tests|beep)\//.test(locator);

/** Resolve explicit reference identities without title-based or speculative merges.
 * **Example** (Classify a paper)
 * ```ts
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * console.log(classifyLibraryReference("https://arxiv.org/abs/2610.00609v1", "document").pipe !== undefined)
 * ```
 *
 * @category normalization
 *
 * @since 0.0.0
 */
export const classifyLibraryReference = Effect.fn("ResearchLibrary.classifyReference")(function* (
  locator: string,
  documentId: string
) {
  let canonicalUrl = locator;
  let identity = locator;
  let revision = "";
  let repository = "";
  let kind: LibrarySourceKind = "unresolved";
  let ownership: LibraryOwnership = "unresolved";
  const classifyGithubUrl = (url: URL) => {
    const parts = A.filter(Str.split(url.pathname, "/"), Str.isNonEmpty);
    const owner = O.getOrElse(A.get(parts, 0), () => "");
    const repo = Str.replace(/\.git$/, "")(O.getOrElse(A.get(parts, 1), () => ""));
    if (Str.isNonEmpty(owner) && Str.isNonEmpty(repo)) {
      repository = Str.toLowerCase(`${owner}/${repo}`);
      const section = O.getOrElse(A.get(parts, 2), () => "");
      kind = Match.value(section).pipe(
        Match.when("issues", (): LibrarySourceKind => "github-issue"),
        Match.when("pull", (): LibrarySourceKind => "github-pr"),
        Match.when("releases", (): LibrarySourceKind => "github-release"),
        Match.when("discussions", (): LibrarySourceKind => "github-discussion"),
        Match.when(Match.is("blob", "tree", "commit", "commits"), (): LibrarySourceKind => "github-code"),
        Match.orElse((): LibrarySourceKind => "github-repository")
      );
      revision = githubRequestedRevision(parts, section);
      identity = Match.value(section).pipe(
        Match.when("", () => `github:${repository}`),
        Match.when(Match.is("blob", "tree"), () => `github:${repository}:${section}:${A.join(A.drop(parts, 4), "/")}`),
        Match.orElse(() => canonicalUrl)
      );
      if (section === "") canonicalUrl = `https://github.com/${repository}`;
      if (repository === "beep-effect/beep-effect") ownership = "project";
    }
  };
  const classifyYoutubeUrl = (url: URL, host: string) => {
    const video =
      host === "youtu.be"
        ? Str.slice(1)(url.pathname)
        : O.getOrElse(O.fromNullishOr(url.searchParams.get("v")), () =>
            O.getOrElse(A.get(A.filter(Str.split(url.pathname, "/"), Str.isNonEmpty), 1), () => "")
          );
    kind = "youtube";
    if (Str.isNonEmpty(video)) {
      revision = video;
      identity = `youtube:${video}`;
      canonicalUrl = `https://www.youtube.com/watch?v=${video}`;
    }
  };
  const classifyHttpLocator = Effect.fn("ResearchLibrary.classifyHttpLocator")(function* () {
    const parsed = yield* Effect.try({
      try: () => new URL(Str.startsWith("http")(locator) ? locator : `https://${locator}`),
      catch: (cause) => LibraryError.make({ message: "Invalid citation URL.", cause }),
    }).pipe(Effect.option);
    if (O.isSome(parsed)) {
      const url = parsed.value;
      const host = Str.toLowerCase(url.hostname);
      pruneTrackingParameters(url);
      canonicalUrl = url.href;
      identity = canonicalUrl;
      ownership = "external";
      kind = "web";
      Match.value(host).pipe(
        Match.when("github.com", () => classifyGithubUrl(url)),
        Match.when(
          (value) => value === "youtu.be" || /(^|\.)youtube\.com$/.test(value),
          () => classifyYoutubeUrl(url, host)
        ),
        Match.when(Match.is("x.com", "twitter.com"), () => {
          kind = "x";
          identity = Str.replace("twitter.com", "x.com")(canonicalUrl);
          canonicalUrl = identity;
        }),
        Match.orElse(() => {
          kind = classifyWebKind(host, url.pathname);
        })
      );
      if (host === "localhost" || host === "127.0.0.1" || Str.endsWith(".localhost")(host)) {
        kind = "internal";
        ownership = "internal";
      }
    }
  });
  const arxiv = locator.match(
    /^(?:(?:arxiv(?:\s*:\s*|\s+))?|https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/)(\d{4}\.\d{4,5})(v\d+)?(?:\.pdf)?$/i
  );
  const doi = locator.match(/^(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/.+)$/i);
  if (arxiv !== null) {
    const paperId = O.getOrElse(O.fromNullishOr(arxiv[1]), () => locator);
    revision = O.getOrElse(O.fromNullishOr(arxiv[2]), () => "");
    identity = `arxiv:${paperId}`;
    canonicalUrl = `https://arxiv.org/abs/${paperId}${revision}`;
    kind = "paper";
    ownership = "external";
  } else if (doi !== null) {
    const paperId = Str.toLowerCase(O.getOrElse(O.fromNullishOr(doi[1]), () => locator));
    identity = `doi:${paperId}`;
    canonicalUrl = `https://doi.org/${paperId}`;
    kind = "paper";
    ownership = "external";
  } else if (/^(?:https?:\/\/|(?:[A-Za-z0-9-]+\.)+(?:gov|com|org|net|edu|io|ai|dev|app)\/)/i.test(locator)) {
    yield* classifyHttpLocator();
  } else if (isInternalLocator(locator)) {
    kind = "internal";
    ownership = "internal";
    identity = `internal:${documentId}:${locator}`;
  } else identity = `unresolved:${documentId}:${locator}`;
  const id = yield* hashText(identity);
  return LibrarySource.make({
    id,
    kind,
    canonicalUrl,
    identity,
    revision,
    repository,
    ownership,
    locators: [locator],
    versions: [LibraryVersion.make({ revision, canonicalUrl, locators: [locator] })],
  });
});

const listInputs = Effect.fn("ResearchLibrary.listInputs")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let files: ReadonlyArray<string> = [];
  let visited: ReadonlyArray<string> = [];
  const visit = Effect.fn("ResearchLibrary.visit")(function* (
    directory: string
  ): Effect.fn.Return<void, LibraryError, FileSystem.FileSystem | Path.Path> {
    const realDirectory = yield* fs.realPath(directory).pipe(failure("Cannot resolve corpus directory."));
    if (A.contains(visited, realDirectory)) return;
    visited = A.append(visited, realDirectory);
    for (const entry of yield* fs.readDirectory(directory).pipe(failure("Cannot read corpus input directory."))) {
      const full = path.join(directory, entry);
      const stat = yield* fs.stat(full).pipe(failure("Cannot inspect corpus input."));
      if (stat.type === "Directory") yield* visit(full);
      else if (stat.type === "File") files = A.append(files, full);
    }
  });
  yield* visit(root);
  return A.sort(files, Order.String);
});

/** Snapshot input documents and record every extracted citation without fetching sources.
 * **Example** (Inventory two roots)
 * ```ts
 * import { inventoryLibrary, LibraryInventoryOptions } from "@beep/repo-cli/commands/Research"
 * console.log(inventoryLibrary(LibraryInventoryOptions.make({ libraryRoot: "/library", inputRoots: ["/reports"] })).pipe !== undefined)
 * ```
 *
 * @category use-cases
 *
 * @since 0.0.0
 */
export const inventoryLibrary = Effect.fn("ResearchLibrary.inventory")(function* (options: LibraryInventoryOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* withCatalog(options.libraryRoot, (catalog) =>
    Effect.gen(function* () {
      const createdAt = DateTime.formatIso(yield* DateTime.now);
      const date = Str.slice(0, 10)(createdAt);
      const canonicalManifestPath = path.join(options.libraryRoot, "library.json");
      const legacyManifestPath = path.join(options.libraryRoot, "manifest.json");
      const manifestPath = (yield* fs
        .exists(canonicalManifestPath)
        .pipe(failure("Cannot inspect canonical library manifest.")))
        ? canonicalManifestPath
        : legacyManifestPath;
      const libraryManifest = (yield* fs.exists(manifestPath).pipe(failure("Cannot inspect library manifest.")))
        ? yield* fs
            .readFileString(manifestPath)
            .pipe(
              failure("Cannot read library manifest."),
              Effect.flatMap(S.decodeEffect(S.fromJsonString(LibraryManifest))),
              failure("Invalid library manifest.")
            )
        : LibraryManifest.make({
            schema: "beep.research.library-manifest/v1",
            createdAt,
            catalogPath: "catalog/library.json",
            objectRoot: "objects/sha256",
            intakeRoot: "intakes",
          });
      const manifestText = yield* S.encodeEffect(S.fromJsonString(LibraryManifest))(libraryManifest).pipe(
        failure("Cannot encode library manifest.")
      );
      const rootArtifact = yield* saveImmutable(
        options.libraryRoot,
        "library.json",
        new TextEncoder().encode(manifestText)
      );

      let intakeFiles: ReadonlyArray<LibraryIntakeFile> = [];
      let intakeRoots: ReadonlyArray<LibraryIntakeRoot> = [];
      let documents = A.fromIterable(catalog.documents);
      let sources = A.fromIterable(catalog.sources);
      let occurrences = A.fromIterable(catalog.occurrences);
      // A read-only first pass establishes explicit paper identities independent of input order.
      let knownPaperReferences: ReadonlyArray<string> = [];
      const collectKnownPaperReferences = Effect.fn("ResearchLibrary.collectKnownPaperReferences")(function* () {
        for (const inputRoot of options.inputRoots) {
          for (const inputPath of yield* listInputs(path.resolve(inputRoot))) {
            if (!/\.(?:md|json|jsonl)$/i.test(inputPath)) continue;
            const inputText = yield* fs.readFileString(inputPath).pipe(failure("Cannot read paper identity census."));
            knownPaperReferences = A.dedupe([
              ...knownPaperReferences,
              ...A.map(
                A.fromIterable(
                  inputText.matchAll(
                    /(?:arxiv(?:\s*:\s*|\s+)|arxiv\.org\/(?:abs|pdf|html)\/|"arxiv"\s*:\s*")(\d{4}\.\d{4,5})/gi
                  )
                ),
                (match) => `arxiv:${O.getOrElse(O.fromNullishOr(match[1]), () => "")}`
              ),
            ]);
          }
        }
      });
      yield* collectKnownPaperReferences();
      const addSource = (source: LibrarySource) => {
        const existing = A.findFirst(sources, (s) => s.id === source.id);
        if (O.isNone(existing)) sources = A.append(sources, source);
        else {
          const citedCommitsRef = /github\.com\/[^/]+\/[^/]+\/commits\//.test(source.canonicalUrl);
          const priorVersions = citedCommitsRef
            ? A.map(existing.value.versions, (version) =>
                version.canonicalUrl === source.canonicalUrl
                  ? LibraryVersion.make({ ...version, revision: source.revision })
                  : version
              )
            : existing.value.versions;
          const merged = LibrarySource.make({
            ...existing.value,
            revision: citedCommitsRef ? source.revision : existing.value.revision,
            kind: source.kind,
            ownership: source.ownership,
            locators: A.dedupe([...existing.value.locators, ...source.locators]),
            topics: A.dedupe([...existing.value.topics, ...source.topics]),
            topicDerivation: source.topicDerivation,
            versions: mergeLibraryVersions([...priorVersions, ...source.versions]),
          });
          sources = A.map(sources, (item) => (item.id === merged.id ? merged : item));
        }
      };
      const snapshotInputFiles = Effect.fn("ResearchLibrary.snapshotInputFiles")(function* (inputRoot: string) {
        for (const originalPath of yield* listInputs(path.resolve(inputRoot))) {
          const bytes = yield* fs.readFile(originalPath).pipe(failure("Cannot read corpus input."));
          const sha256 = yield* hashBytes(bytes);
          const id = yield* hashText(`${originalPath}\n${sha256}`);
          const snapshotPath = `intakes/${date}/raw/${sha256}${path.extname(originalPath)}`;
          const parseable = /\.(?:md|json|jsonl)$/i.test(originalPath);
          intakeFiles = A.append(
            intakeFiles,
            LibraryIntakeFile.make({ originalPath, snapshotPath, sha256, bytes: bytes.byteLength, parseable })
          );
          yield* saveImmutable(options.libraryRoot, snapshotPath, bytes);
          // Recheck snapshot hashes even on reruns; preserved original paths retain provenance.
          if (!parseable) continue;
          documents = A.filter(documents, (document) => document.id !== id);
          occurrences = A.filter(occurrences, (occurrence) => occurrence.documentId !== id);
          const text = yield* Effect.try({
            try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
            catch: (cause) => LibraryError.make({ message: `Input is not valid UTF-8: ${originalPath}`, cause }),
          });
          const references = extractLibraryReferences(text, [
            ...knownPaperReferences,
            ...A.flatMap(sources, (source) => [source.repository, source.identity]),
          ]);
          const title = O.getOrElse(
            O.map(O.fromNullishOr(text.match(/^#\s+(.+)$/m)), (m) =>
              O.getOrElse(O.fromNullishOr(m[1]), () => path.basename(originalPath))
            ),
            () => path.basename(originalPath)
          );
          const reportDate = O.getOrElse(
            O.map(
              O.flatMap(O.fromNullishOr(text.match(/^#\s+(.+)$/m)), (heading) =>
                O.fromNullishOr(O.getOrElse(O.fromNullishOr(heading[1]), () => "").match(/\d{4}-\d{2}-\d{2}/))
              ),
              (m) => m[0]
            ),
            () => ""
          );
          documents = A.append(
            documents,
            LibraryDocument.make({
              id,
              originalPath,
              snapshotPath,
              sha256,
              bytes: bytes.byteLength,
              title,
              topics: classifyTopics(documentTopicEvidence(text)),
              topicDerivation:
                "library-topic-rules/v1: explicit section heading and structured axis keyword classification",
              reportDate,
              headingDate: O.getOrElse(
                O.map(O.fromNullishOr(title.match(/\d{4}-\d{2}-\d{2}|\d{1,2} [A-Za-z]+ \d{4}/)), (m) => m[0]),
                () => ""
              ),
              filenameDate: O.getOrElse(
                O.map(O.fromNullishOr(path.basename(originalPath).match(/\d{4}-\d{2}-\d{2}/)), (m) => m[0]),
                () => ""
              ),
              expectedOccurrences: references.length,
            })
          );
          const collectDocumentOccurrences = Effect.fn("ResearchLibrary.collectDocumentOccurrences")(function* () {
            for (const reference of references) {
              const originalClassified = yield* classifyLibraryReference(reference.locator, id);
              const classified = O.getOrElse(
                A.findFirst(sources, (source) => A.contains(source.aliasIds, originalClassified.id)),
                () => originalClassified
              );
              const lines = Str.split(text, "\n");
              const currentLine = O.getOrElse(A.get(lines, reference.line - 1), () => "");
              const previousHeading = O.getOrElse(
                A.findLast(A.take(lines, reference.line), (line) => /^##+\s/.test(line)),
                () => ""
              );
              const topicEvidence = /"axis"\s*:/.test(currentLine)
                ? O.getOrElse(
                    O.map(O.fromNullishOr(currentLine.match(/"axis"\s*:\s*"([^"]+)"/)), (m) =>
                      O.getOrElse(O.fromNullishOr(m[1]), () => "")
                    ),
                    () => ""
                  )
                : previousHeading;
              const source = LibrarySource.make({
                ...classified,
                topics: classifyTopics(topicEvidence),
                topicDerivation: "library-topic-rules/v1: nearest section heading or structured axis",
              });
              addSource(source);
              if (Str.isNonEmpty(source.repository) && source.ownership === "external") {
                const repositorySource = yield* classifyLibraryReference(`https://github.com/${source.repository}`, id);
                addSource(
                  LibrarySource.make({
                    ...repositorySource,
                    topics: source.topics,
                    topicDerivation: "library-topic-rules/v1: cited repository resource section or axis",
                  })
                );
              }
              const findingHeading = O.getOrElse(
                A.findLast(A.take(lines, reference.line), (line) => /^##+\s.*\bf-(?:law|effect|agents)-\d+/.test(line)),
                () => ""
              );
              const headingFindingId = O.getOrElse(
                O.map(O.fromNullishOr(findingHeading.match(/\bf-(?:law|effect|agents)-\d+/)), (m) => m[0]),
                () => ""
              );
              const occurrenceId = yield* hashText(`${id}:${reference.line}:${reference.column}:${reference.locator}`);
              occurrences = A.append(
                occurrences,
                LibraryOccurrence.make({
                  ...reference,
                  id: occurrenceId,
                  documentId: id,
                  sourceId: source.id,
                  revision: source.revision,
                  context: O.getOrElse(A.get(Str.split(text, "\n"), reference.line - 1), () => ""),
                  findingId: O.getOrElse(
                    O.map(
                      O.fromNullishOr(
                        O.getOrElse(A.get(Str.split(text, "\n"), reference.line - 1), () => "").match(
                          /"id"\s*:\s*"([^"]+)"/
                        )
                      ),
                      (m) => O.getOrElse(O.fromNullishOr(m[1]), () => "")
                    ),
                    () => headingFindingId
                  ),
                })
              );
            }
          });
          yield* collectDocumentOccurrences();
        }
      });
      const snapshotInputRoot = Effect.fn("ResearchLibrary.snapshotInputRoot")(function* (inputRoot: string) {
        const repo = yield* StepExec.runCaptured({
          command: "git",
          args: ["-C", path.resolve(inputRoot), "rev-parse", "HEAD"],
        }).pipe(Effect.option);
        const repoCommit = O.isSome(repo) && repo.value.exitCode === 0 ? Str.trim(repo.value.output) : "";
        intakeRoots = A.append(intakeRoots, LibraryIntakeRoot.make({ path: path.resolve(inputRoot), repoCommit }));
        const relativeLibrary = path.relative(path.resolve(inputRoot), path.resolve(options.libraryRoot));
        if (
          relativeLibrary === "" ||
          (!path.isAbsolute(relativeLibrary) &&
            relativeLibrary !== ".." &&
            !Str.startsWith(`..${path.sep}`)(relativeLibrary))
        ) {
          return yield* LibraryError.make({
            message: "Library output must not be inside an input corpus root.",
            cause: inputRoot,
          });
        }
        yield* snapshotInputFiles(path.resolve(inputRoot));
      });
      for (const inputRoot of options.inputRoots) yield* snapshotInputRoot(inputRoot);
      // Exact repository shorthand can resolve only against explicit URL evidence.
      const resolveExactAliases = Effect.fn("ResearchLibrary.resolveExactAliases")(function* () {
        for (const candidate of A.filter(sources, (source) => source.ownership === "unresolved")) {
          const webAlias = /^(?:[A-Za-z0-9-]+\.)+(?:gov|com|org|net|edu|io|ai|dev|app)\//.test(candidate.canonicalUrl)
            ? yield* classifyLibraryReference(candidate.canonicalUrl, "reviewed-existing-locator")
            : candidate;
          const repository = A.findFirst(
            sources,
            (source) =>
              (webAlias.ownership === "external" && source.id === webAlias.id) ||
              (source.kind === "github-repository" &&
                Str.toLowerCase(source.repository) === Str.toLowerCase(candidate.canonicalUrl))
          );
          if (O.isSome(repository)) {
            const resolved = repository.value;
            sources = A.filter(sources, (source) => source.id !== candidate.id);
            sources = A.map(sources, (source) =>
              source.id === resolved.id
                ? LibrarySource.make({
                    ...source,
                    aliasIds: A.dedupe([...source.aliasIds, candidate.id]),
                    locators: A.dedupe([...source.locators, ...candidate.locators]),
                  })
                : source
            );
            occurrences = A.map(occurrences, (occurrence) =>
              occurrence.sourceId === candidate.id
                ? LibraryOccurrence.make({ ...occurrence, sourceId: resolved.id })
                : occurrence
            );
          }
        }
      });
      yield* resolveExactAliases();
      sources = A.filter(
        sources,
        (source) =>
          source.kind === "github-repository" ||
          A.some(occurrences, (occurrence) => occurrence.sourceId === source.id) ||
          A.some(catalog.captures, (capture) => capture.sourceId === source.id)
      );
      const census = yield* LibraryIntakeFile.pipe(
        S.Array,
        S.fromJsonString,
        S.encodeEffect
      )(intakeFiles).pipe(failure("Cannot encode intake census."));
      const intakeId = yield* hashText(
        `${date}\n${census}\n${A.join(
          A.map(intakeRoots, (r) => `${r.path}:${r.repoCommit}`),
          "\n"
        )}`
      );
      const existingIntake = A.findFirst(catalog.intakes, (intake) => intake.id === intakeId);
      const intake = O.getOrElse(existingIntake, () =>
        LibraryIntake.make({
          id: intakeId,
          date,
          createdAt,
          repoCommit: O.getOrElse(
            O.map(
              A.findFirst(intakeRoots, (r) => Str.isNonEmpty(r.repoCommit)),
              (r) => r.repoCommit
            ),
            () => ""
          ),
          inputRoots: intakeRoots,
          manifestPath: `intakes/${date}/manifest-${intakeId}.json`,
          files: intakeFiles,
        })
      );
      const manifest = yield* S.encodeEffect(S.fromJsonString(LibraryIntake))(intake).pipe(
        failure("Cannot encode intake manifest.")
      );
      const intakeArtifact = yield* saveImmutable(
        options.libraryRoot,
        intake.manifestPath,
        new TextEncoder().encode(manifest)
      );
      const artifacts = A.dedupeWith(
        [
          ...catalog.artifacts,
          LibraryArtifact.make({ ...rootArtifact, mediaType: "application/json", role: "library-manifest" }),
          LibraryArtifact.make({ ...intakeArtifact, mediaType: "application/json", role: "intake-manifest" }),
        ],
        (a, b) => a.path === b.path
      );
      return LibraryCatalog.make({
        ...catalog,
        documents,
        sources,
        occurrences,
        captures: A.map(catalog.captures, (capture) => {
          const resolved = A.findFirst(sources, (source) => A.contains(source.aliasIds, capture.sourceId));
          return O.isSome(resolved) ? LibraryCapture.make({ ...capture, sourceId: resolved.value.id }) : capture;
        }),
        artifacts,
        intakes: O.isSome(existingIntake) ? catalog.intakes : A.append(catalog.intakes, intake),
      });
    })
  );
});
