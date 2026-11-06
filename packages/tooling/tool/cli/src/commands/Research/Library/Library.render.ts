/**
 * Portable escaped projections with lightweight navigation and separate source pages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { escapeHtml as escape } from "@beep/utils/Html";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryDocument,
  LibraryOccurrence,
  LibraryQualification,
  LibrarySource,
} from "./Library.schemas.ts";
import { hashBytes, loadCatalog } from "./Library.store.ts";
import {
  captureArtifacts,
  captureIndex,
  indirectBacklinks,
  LibraryViewRow,
  libraryViewDataset,
  occurrenceIndex,
  orderedSourceCaptures,
  qualificationIndex,
  readableSourceCaptures,
  relatedRepositories,
  reportIndex,
  reportOccurrences,
  runView,
  sourceBacklinks,
  sourceCaptures,
  sourceIndex,
  viewRecords,
} from "./Library.views.ts";
import type * as Rdf from "@beep/rdf/Rdf";

const selectedCatalog = Effect.fn("Library.selectedCatalog")(function* (dataset: Rdf.Dataset, includePrivate: boolean) {
  return {
    documents: yield* viewRecords(dataset, reportIndex, LibraryDocument, includePrivate),
    sources: yield* viewRecords(dataset, sourceIndex, LibrarySource, includePrivate),
    occurrences: yield* viewRecords(dataset, occurrenceIndex, LibraryOccurrence, includePrivate),
    captures: yield* viewRecords(dataset, captureIndex, LibraryCapture, includePrivate),
    qualifications: yield* viewRecords(dataset, qualificationIndex, LibraryQualification, includePrivate),
  };
});

const markdownText = flow(
  escape,
  Str.replaceAll("[", "&#91;"),
  Str.replaceAll("]", "&#93;"),
  Str.replaceAll("`", "&#96;"),
  Str.replaceAll("\n", " ")
);
const linkPath = flow(
  Str.split("/"),
  A.map(flow(encodeURIComponent, Str.replaceAll("(", "%28"), Str.replaceAll(")", "%29"))),
  A.join("/")
);
const sourcePage = (id: string) => `sources/${encodeURIComponent(id)}/index.html`;
const reportPage = (id: string) => `views/reports/${encodeURIComponent(id)}/index.html`;
const safeUrl = (url: string) => Str.startsWith("https://")(url) || Str.startsWith("http://")(url);
const css =
  "*{box-sizing:border-box}body{font:16px system-ui;width:100%;max-width:1164px;margin:auto;padding:2rem;background:#f8fafc;color:#152334;overflow-wrap:anywhere}header{background:#f8fafc;padding:1rem 0}label{display:inline-flex;flex-direction:column;vertical-align:top;gap:.35rem;margin:.4rem .5rem .4rem 0;max-width:100%}input,select{font:inherit;padding:.5rem;max-width:100%;min-width:0}article{background:white;padding:1.5rem;margin:1rem 0;border:1px solid #cbd5e1;border-radius:.5rem;min-width:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;padding:1rem}code{overflow-wrap:anywhere}a{color:#164fb5}details{margin:1rem 0}[hidden]{display:none}@media(max-width:700px){body{padding:1rem}article{padding:1rem}label{display:flex;width:100%;margin:.6rem 0}input,select{width:100%}}";
const page = (title: string, body: string, script = "") =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${css}</style>${body}${script}</html>`;

const navigationScript = `<script>const records=[...document.querySelectorAll('.record')];const search=document.getElementById('search'),kind=document.getElementById('kind'),status=document.getElementById('status'),topic=document.getElementById('topic'),repo=document.getElementById('repo'),report=document.getElementById('report');function filter(){let shown=0;for(const record of records){record.hidden=!(record.textContent.toLowerCase().includes(search.value.toLowerCase())&&(!kind.value||record.dataset.kind===kind.value)&&(!status.value||record.dataset.status===status.value)&&(!topic.value||record.dataset.topics.split('|').includes(topic.value))&&(!repo.value||record.dataset.repo===repo.value)&&(!report.value||record.dataset.reports.split('|').includes(report.value)));if(!record.hidden)shown++;}document.getElementById('count').textContent=shown+' records shown';}for(const control of [search,kind,status,topic,repo,report])control.addEventListener('input',filter);filter();</script>`;
// Only this static script becomes executable; callers supply already escaped projection markup.
const indexPage = (body: string) => page("Research library", body, navigationScript);

const renderProjection = Effect.fn("Research.Library.renderProjection")(function* (
  root: string,
  includePrivate: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const loaded = yield* loadCatalog(root);
  const dataset = yield* libraryViewDataset(root, loaded);
  const catalog = yield* selectedCatalog(dataset, includePrivate);
  const relative = (from: string, target: string) =>
    linkPath(path.relative(path.resolve(root, from), path.resolve(root, target)));
  const write = Effect.fn("Research.Library.writeProjection")(function* (target: string, content: string) {
    const absolute = path.join(root, target);
    const realRoot = yield* fs.realPath(root);
    let ancestor = path.dirname(absolute);
    while (!(yield* fs.exists(ancestor))) ancestor = path.dirname(ancestor);
    const resolved = yield* fs.realPath(ancestor);
    const within = path.relative(realRoot, resolved);
    if (path.isAbsolute(within) || within === ".." || Str.startsWith(`..${path.sep}`)(within)) {
      return yield* LibraryError.make({ message: "Projection directory escapes library", cause: target });
    }
    yield* fs
      .makeDirectory(path.dirname(absolute), { recursive: true })
      .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot create projection directory", cause })));
    const stage = Effect.fn("Library.stageProjection")(function* () {
      const temporary = yield* fs.makeTempFileScoped({
        directory: path.dirname(absolute),
        prefix: ".library-projection-",
      });
      yield* fs
        .writeFileString(temporary, content)
        .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot write projection", cause })));
      yield* fs
        .rename(temporary, absolute)
        .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot publish projection", cause })));
    });
    yield* Effect.scoped(stage());
  });
  const artifactText = Effect.fn("Research.Library.previewArtifact")(function* (artifact: LibraryArtifact) {
    const preview = Effect.fn("Library.preview")(function* () {
      const target = path.resolve(root, artifact.path);
      const realRoot = yield* fs.realPath(root);
      const realTarget = yield* fs.realPath(target);
      const inside = path.relative(realRoot, realTarget);
      if (
        path.isAbsolute(artifact.path) ||
        path.isAbsolute(inside) ||
        inside === ".." ||
        Str.startsWith(`..${path.sep}`)(inside)
      )
        return "Artifact unavailable: evidence path escapes library.";
      const bytes = yield* fs.readFile(target);
      if (bytes.length !== artifact.bytes || (yield* hashBytes(bytes)) !== artifact.sha256)
        return "Artifact unavailable: integrity mismatch.";
      if (
        Str.startsWith("text/")(artifact.mediaType) ||
        A.contains(["application/json", "application/x-ndjson"], artifact.mediaType)
      ) {
        const readFileString1 = yield* fs.readFileString(target);
        return escape(readFileString1);
      }
      return "Binary evidence: download the original artifact to inspect it.";
    });
    return yield* preview().pipe(
      Effect.catchTag("PlatformError", () => Effect.succeed("Artifact unavailable: read failed."))
    );
  });
  const repositories = yield* Effect.forEach(
    catalog.sources,
    Effect.fnUntraced(function* (source) {
      const related = yield* viewRecords(dataset, relatedRepositories(source.id), LibrarySource, includePrivate);
      return [source.id, A.head(related)] satisfies readonly [string, O.Option<LibrarySource>];
    })
  );
  const repositoryBySource = HashMap.fromIterable(repositories);
  const relatedRepository = (sourceId: string) => O.flatten(HashMap.get(repositoryBySource, sourceId));
  const repositoryLink = (sourceId: string, directory: string, markdown = false) =>
    O.match(relatedRepository(sourceId), {
      onNone: () => "",
      onSome: (repository) =>
        markdown
          ? ` · [Related repository](${relative(directory, path.join(path.dirname(sourcePage(repository.id)), "SOURCE.md"))}) (indirect provenance)`
          : ` · <a href="${relative(directory, sourcePage(repository.id))}">Related repository</a> (indirect provenance)`,
    });
  const documentsById = HashMap.fromIterable(
    A.map(catalog.documents, (document) => [document.id, document] satisfies readonly [string, LibraryDocument])
  );
  const reports = yield* Effect.forEach(
    catalog.documents,
    Effect.fnUntraced(function* (document) {
      const directory = path.dirname(reportPage(document.id));
      const occurrences = yield* viewRecords(
        dataset,
        reportOccurrences(document.id),
        LibraryOccurrence,
        includePrivate
      );
      const provenance = `Report ${escape(document.id)} · date ${escape(document.reportDate || "unrecorded")} · heading date ${escape(document.headingDate || "unrecorded")} · filename date ${escape(document.filenameDate || "unrecorded")} · SHA-256 <code>${escape(document.sha256)}</code>`;
      const citations = A.join(
        A.map(
          occurrences,
          (item) =>
            `<li><a href="${relative(directory, sourcePage(item.sourceId))}">${escape(item.label || item.locator)}</a> · ${item.line}:${item.column} · revision ${escape(item.revision || "unrecorded")} · finding ${escape(item.findingId || "unrecorded")} · ${escape(item.context)}${repositoryLink(item.sourceId, directory)}</li>`
        ),
        ""
      );
      const text = yield* artifactText(
        LibraryArtifact.make({
          path: document.snapshotPath,
          sha256: document.sha256,
          bytes: document.bytes,
          mediaType: "text/markdown",
          role: "report",
        })
      );
      yield* write(
        reportPage(document.id),
        page(
          document.title,
          `<header><a href="${relative(directory, "index.html")}">Library index</a><h1>${escape(document.title)}</h1><p>${provenance}</p><a download href="${relative(directory, document.snapshotPath)}">Immutable report snapshot</a> · <span>Input provenance: ${escape(document.originalPath)}</span> · <a href="REPORT.md">Markdown report card</a></header><main><h2>Cited sources</h2><ul>${citations}</ul><h2>Readable report</h2><pre>${text}</pre></main>`
        )
      );
      yield* write(
        path.join(directory, "REPORT.md"),
        `# ${markdownText(document.title)}\n\n[Library index](${relative(directory, "index.md")})\n\nSHA-256: ${document.sha256}\n\n[Report snapshot](${relative(directory, document.snapshotPath)}) · [Readable report](index.html)\n\n## Sources\n\n${A.join(
          A.map(
            occurrences,
            (item) =>
              `- [${markdownText(item.label || item.locator)}](${relative(directory, path.join(path.dirname(sourcePage(item.sourceId)), "SOURCE.md"))}) — ${item.line}:${item.column}; revision ${markdownText(item.revision || "unrecorded")}${repositoryLink(item.sourceId, directory, true)}`
          ),
          "\n"
        )}\n`
      );
      return `<article class="record" data-kind="report" data-status="inventoried" data-topics="${escape(A.join(document.topics, "|"))}" data-repo="" data-reports="${escape(document.id)}"><h2><a href="${relative("", reportPage(document.id))}">${escape(document.title)}</a></h2><p>${escape(path.basename(document.originalPath))} · ${occurrences.length} citation occurrences</p><details><summary>Report provenance and dates</summary><p>${provenance}</p></details></article>`;
    }),
    { concurrency: 4 }
  );
  const sourceRows = yield* runView(dataset, sourceIndex, LibraryViewRow, includePrivate);
  const sourceCategories = HashMap.fromIterable(
    A.map(
      catalog.sources,
      (source, i) => [source.id, A.getUnsafe(sourceRows, i).category ?? "missing"] satisfies readonly [string, string]
    )
  );
  const sources = yield* Effect.forEach(
    catalog.sources,
    Effect.fnUntraced(function* (source) {
      const directory = path.dirname(sourcePage(source.id));
      const selectedCaptures = yield* viewRecords(dataset, sourceCaptures(source.id), LibraryCapture, includePrivate);
      const captureRows = yield* runView(dataset, sourceCaptures(source.id), LibraryViewRow, includePrivate);
      const captures = yield* Effect.forEach(
        selectedCaptures,
        Effect.fnUntraced(function* (capture) {
          const artifacts = yield* viewRecords(dataset, captureArtifacts(capture.id), LibraryArtifact, includePrivate);
          return LibraryCapture.make({ ...capture, artifacts });
        })
      );
      const categories = HashMap.fromIterable(
        A.map(
          captures,
          (capture, i) =>
            [capture.id, A.getUnsafe(captureRows, i).category ?? capture.status] satisfies readonly [string, string]
        )
      );
      const captureCategory = (id: string) => O.getOrElse(HashMap.get(categories, id), () => "missing");
      const backlinks = yield* viewRecords(dataset, sourceBacklinks(source.id), LibraryOccurrence, includePrivate);
      const indirect = yield* viewRecords(dataset, indirectBacklinks(source.id), LibraryOccurrence, includePrivate);
      const reportLabel = (documentId: string) => {
        const document = HashMap.get(documentsById, documentId);
        return O.match(document, {
          onNone: () => `Report ${documentId}`,
          onSome: (item) => `${path.basename(item.originalPath)} · ${item.reportDate || "date unrecorded"}`,
        });
      };
      const indirectHtml = A.join(
        A.map(
          indirect,
          (item) =>
            `<li><a href="${relative(directory, reportPage(item.documentId))}">${escape(reportLabel(item.documentId))}</a> · indirect provenance through <a href="${relative(directory, sourcePage(item.sourceId))}">${escape(item.locator)}</a> · ${item.line}:${item.column}</li>`
        ),
        ""
      );
      const indirectMarkdown = A.join(
        A.map(
          indirect,
          (item) =>
            `- [${markdownText(item.documentId)}](${relative(directory, path.join(path.dirname(reportPage(item.documentId)), "REPORT.md"))}) — indirect provenance through [${markdownText(item.locator)}](${relative(directory, path.join(path.dirname(sourcePage(item.sourceId)), "SOURCE.md"))}); ${item.line}:${item.column}`
        ),
        "\n"
      );
      const backlinkHtml = A.join(
        A.map(
          backlinks,
          (item) =>
            `<li><a href="${relative(directory, reportPage(item.documentId))}">${escape(reportLabel(item.documentId))}</a> · ${item.line}:${item.column}<details><summary>Citation context and provenance</summary><p>Report ${escape(item.documentId)} · ${escape(item.locator)} · revision ${escape(item.revision || "unrecorded")} · finding ${escape(item.findingId || "unrecorded")} · ${escape(item.context)}</p></details></li>`
        ),
        ""
      );
      const readable = yield* viewRecords(dataset, readableSourceCaptures(source.id), LibraryCapture, includePrivate);
      const readableIds = A.map(readable, (capture) => capture.id);
      const ordered = yield* viewRecords(dataset, orderedSourceCaptures(source.id), LibraryCapture, includePrivate);
      const capturesById = HashMap.fromIterable(
        A.map(captures, (capture) => [capture.id, capture] satisfies readonly [string, LibraryCapture])
      );
      const orderedCaptures = A.map(ordered, (capture) => O.getOrThrow(HashMap.get(capturesById, capture.id)));
      const captureViews = yield* Effect.forEach(
        orderedCaptures,
        Effect.fnUntraced(function* (capture) {
          const artifacts = yield* Effect.forEach(
            capture.artifacts,
            Effect.fnUntraced(function* (artifact) {
              const viewName = `artifact-${encodeURIComponent(capture.id)}-${artifact.sha256}.html`;
              const viewPath = path.join(directory, viewName);
              const text = yield* artifactText(artifact);
              yield* write(
                viewPath,
                page(
                  artifact.role,
                  `<header><a href="index.html">Source card</a> · <a href="${relative(directory, "index.html")}">Library index</a><h1>${escape(artifact.role)}</h1><p>Capture ${escape(capture.id)} · ${escape(captureCategory(capture.id))} · ${escape(capture.recordedAt)} · revision ${escape(capture.capturedRevision || "unrecorded")} · complete ${capture.complete}</p><p>SHA-256 <code>${escape(artifact.sha256)}</code></p><a download href="${relative(directory, artifact.path)}">Download original evidence</a></header><main><pre>${text}</pre><h2>Citing reports</h2><ul>${backlinkHtml}${indirectHtml}</ul></main>`
                )
              );
              return `<li><a href="${linkPath(viewName)}">Readable ${escape(artifact.role)}</a> · ${escape(artifact.mediaType)} · SHA-256 <code>${escape(artifact.sha256)}</code></li>`;
            }),
            { concurrency: 2 }
          );
          const validated = A.contains(readableIds, capture.id);
          return `${validated ? "" : "<details><summary>Retained history — not validated reading evidence</summary>"}<section><h2>${escape(captureCategory(capture.id))} · ${escape(capture.method)}</h2><ul>${A.join(artifacts, "")}</ul><details><summary>Capture provenance and result</summary><p>Captured ${escape(capture.recordedAt)} · revision ${escape(capture.capturedRevision || "unrecorded")} · requested revision ${escape(capture.requestedRevision || "unrecorded")} · complete ${capture.complete}</p><p>${escape(capture.reason)}</p><p>Capture ${escape(capture.id)} · recorded state ${escape(capture.status)}</p></details></section>${validated ? "" : "</details>"}`;
        }),
        { concurrency: 2 }
      );
      const status = O.getOrElse(HashMap.get(sourceCategories, source.id), () => "missing");
      const metadata = `${escape(source.kind)} · ${escape(status)}${A.contains(["ambiguous", "incomplete", "tool-blocked"], status) ? " (reviewed; not read)" : ""} · ${escape(source.ownership)} · revision ${escape(source.revision || "unrecorded")}`;
      const repository = Str.startsWith("github-")(source.kind)
        ? `repos/github/${source.repository}`
        : source.repository;
      yield* write(
        sourcePage(source.id),
        page(
          source.identity,
          `<header><a href="${relative(directory, "index.html")}">Library index</a><h1>${escape(source.identity)}</h1><p>${metadata}</p>${safeUrl(source.canonicalUrl) ? `<a href="${escape(source.canonicalUrl)}">Upstream source</a> · ` : ""}${Str.isNonEmpty(repository) ? `<a href="${relative(directory, repository)}">Local repository</a> · ` : ""}<a href="SOURCE.md">Markdown source card</a></header><main><h2>Captured evidence</h2>${A.join(captureViews, "")}<h2>Citing reports</h2><ul>${backlinkHtml}${indirectHtml}</ul></main>`
        )
      );
      yield* write(
        path.join(directory, "SOURCE.md"),
        `# ${markdownText(source.identity)}\n\n[Library index](${relative(directory, "index.md")}) · [Readable source card](index.html)\n\nKind: ${source.kind}; status: ${status}; revision: ${markdownText(source.revision || "unrecorded")}.\n\n## Citing reports\n\n${A.join(
          A.map(
            backlinks,
            (item) =>
              `- [${markdownText(item.documentId)}](${relative(directory, path.join(path.dirname(reportPage(item.documentId)), "REPORT.md"))}) — ${item.line}:${item.column}; revision ${markdownText(item.revision || "unrecorded")}`
          ),
          "\n"
        )}\n\n## Related reports (indirect provenance)\n\n${indirectMarkdown}\n\n## Captures and evidence\n\n${A.join(
          A.map(
            captures,
            (capture) =>
              `### ${captureCategory(capture.id)} · ${markdownText(capture.method)}\n\n${markdownText(capture.recordedAt)}; complete=${capture.complete}; ${markdownText(capture.reason)}\n\n${A.join(
                A.map(
                  capture.artifacts,
                  (artifact) =>
                    `- [Readable ${markdownText(artifact.role)}](${linkPath(`artifact-${encodeURIComponent(capture.id)}-${artifact.sha256}.html`)}) — [original evidence](${artifact.mediaType === "text/html" ? linkPath(`artifact-${encodeURIComponent(capture.id)}-${artifact.sha256}.html`) : relative(directory, artifact.path)})${artifact.mediaType === "text/html" ? " (download preserved HTML from the escaped view)" : ""} — ${artifact.sha256}`
                ),
                "\n"
              )}`
          ),
          "\n\n"
        )}\n`
      );
      return `<article class="record" data-kind="${escape(source.kind)}" data-status="${escape(status)}" data-topics="${escape(A.join(source.topics, "|"))}" data-repo="${escape(source.repository)}" data-reports="${escape(A.join(A.dedupe(A.map([...backlinks, ...indirect], (item) => item.documentId)), "|"))}"><h2><a href="${relative("", sourcePage(source.id))}">${escape(source.identity)}</a></h2><p>${metadata} · repository ${escape(source.repository || "unrecorded")}</p><p>${backlinks.length} citation occurrences · ${captures.length} capture receipts</p><p>${escape(
        A.join(
          A.map(A.take(backlinks, 3), (item) => Str.slice(0, 240)(item.context)),
          " · "
        )
      )}</p></article>`;
    }),
    { concurrency: 4 }
  );
  const options = (values: ReadonlyArray<string>) =>
    A.join(
      A.map(values, (value) => `<option>${escape(value)}</option>`),
      ""
    );
  const selector = (id: string, label: string, values: ReadonlyArray<string>) =>
    `<label>${label} <select id="${id}"><option value="">All</option>${options(A.dedupe(values))}</select></label>`;
  const header = `<header><h1>Research library</h1><p>${catalog.documents.length} reports · ${catalog.sources.length} sources · ${catalog.occurrences.length} citation occurrences. Index search uses metadata and context snippets; readable originals live on separate pages.</p><label>Search <input id="search" type="search"></label> <label>Report <select id="report"><option value="">All</option>${A.join(
    A.map(catalog.documents, (document) => `<option value="${escape(document.id)}">${escape(document.title)}</option>`),
    ""
  )}</select></label> ${selector("kind", "Source type", ["report", ...A.map(catalog.sources, (item) => item.kind)])} ${selector("status", "Status", ["inventoried", "missing", "ambiguous", "incomplete", "tool-blocked", ...A.map(catalog.captures, (item) => item.status)])} ${selector("topic", "Topic", [...A.flatMap(catalog.documents, (item) => item.topics), ...A.flatMap(catalog.sources, (item) => item.topics)])} ${selector(
    "repo",
    "Repository",
    A.filter(
      A.map(catalog.sources, (item) => item.repository),
      Str.isNonEmpty
    )
  )}<p id="count" aria-live="polite"></p><a href="index.md">Markdown index</a></header>`;

  yield* write("index.html", indexPage(`${header}<main>${A.join(reports, "")}${A.join(sources, "")}</main>`));
  yield* write("index.md", indexMarkdown(catalog, path));
});

const indexMarkdown = (catalog: Effect.Success<ReturnType<typeof selectedCatalog>>, path: Path.Path) =>
  `# Research library\n\n${catalog.documents.length} reports; ${catalog.sources.length} sources; ${catalog.occurrences.length} citation occurrences.\n\n[Portable HTML navigation](index.html)\n\n## Reports\n\n${A.join(
    A.map(
      catalog.documents,
      (document) =>
        `- [${markdownText(document.title)}](${linkPath(path.join(path.dirname(reportPage(document.id)), "REPORT.md"))}) — ${document.sha256}`
    ),
    "\n"
  )}\n\n## Sources\n\n${A.join(
    A.map(
      catalog.sources,
      (source) =>
        `- [${markdownText(source.identity)}](${linkPath(path.join(path.dirname(sourcePage(source.id)), "SOURCE.md"))}) — ${source.kind}`
    ),
    "\n"
  )}\n\n## Operational qualification\n\n${A.join(
    A.map(
      catalog.qualifications,
      (receipt) =>
        `- ${markdownText(receipt.adapter)}: ${receipt.status}; ${markdownText(receipt.recordedAt)}; ${markdownText(receipt.reason)}`
    ),
    "\n"
  )}\n`;

/**
 * Render only the Markdown index in memory through the ordered SPARQL views.
 * **Example** (Inspect the memory renderer)
 * ```ts
 * import { libraryIndexMarkdown } from "@beep/repo-cli/commands/Research/Library/Library.render"
 * console.log(libraryIndexMarkdown !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const libraryIndexMarkdown = Effect.fn("Library.indexMarkdown")(function* (
  dataset: Rdf.Dataset,
  includePrivate = false
) {
  const path = yield* Path.Path;
  const catalog = yield* selectedCatalog(dataset, includePrivate);
  return indexMarkdown(catalog, path);
});

/**
 * Generate portable Markdown, lightweight navigation and escaped evidence pages.
 * **Example** (Render a local library)
 * ```ts
 * import { renderLibrary } from "@beep/repo-cli/commands/Research"
 * const projection = renderLibrary("/library")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const renderLibrary = Effect.fn("Research.Library.render")(function* (root: string, includePrivate = false) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lock = path.join(root, ".projection-lock");
  return yield* Effect.acquireUseRelease(
    fs.makeDirectory(lock).pipe(
      Effect.mapError((cause) =>
        LibraryError.make({
          message: "A projection writer is active; inspect interrupted locks before retrying",
          cause,
        })
      )
    ),
    () => renderProjection(root, includePrivate),
    () => fs.remove(lock, { recursive: true }).pipe(Effect.orDie)
  );
});
