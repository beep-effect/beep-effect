import { escapeHtml } from "@beep/utils/Html";
import { Effect, FileSystem, Layer, Match } from "effect";
import * as A from "effect/Array";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { HttpApiScalar, OpenApi } from "effect/unstable/httpapi";
import { ApiAudience } from "./Catalog.models.ts";
import { Catalog, resolveCatalogSpecPath } from "./Catalog.ts";
import type { CatalogEntry, CatalogSlug, CatalogSource, SpecFormat } from "./Catalog.models.ts";

const apiBasePath = (slug: CatalogSlug): `/${string}` => `/apis/${slug}`;
const docsPath = (slug: CatalogSlug): `/${string}` => `${apiBasePath(slug)}/docs`;

const rawSpecPath = (entry: CatalogEntry): HttpRouter.PathInput =>
  Match.value(entry.source).pipe(
    Match.tagsExhaustive({
      ContractSource: (): HttpRouter.PathInput => `${apiBasePath(entry.meta.slug)}/openapi.json`,
      SpecSource: (source): HttpRouter.PathInput => `${apiBasePath(entry.meta.slug)}/openapi.${source.format}`,
    })
  );

const docsLink = (entry: CatalogEntry): string =>
  Match.value(entry.source).pipe(
    Match.tagsExhaustive({
      ContractSource: () => `<a href="${docsPath(entry.meta.slug)}">docs UI</a>`,
      SpecSource: (source) =>
        Match.value(source.dialect).pipe(
          Match.when("json-schema-2020-12", () => ""),
          Match.orElse(() => `<a href="${docsPath(entry.meta.slug)}">docs UI</a>`)
        ),
    })
  );

const renderEntry = (entry: CatalogEntry): string => `<article>
  <h3>${escapeHtml(entry.meta.title)}</h3>
  <code>${entry.meta.slug}</code>
  <p>${escapeHtml(entry.meta.description)}</p>
  <nav>${docsLink(entry)}<a href="${rawSpecPath(entry)}">raw spec</a></nav>
</article>`;

const renderEntries = (entries: ReadonlyArray<CatalogEntry>): string => A.join(A.map(entries, renderEntry), "\n");

const indexHtml = (): string => {
  const served = A.filter(Catalog, (entry) => ApiAudience.is.served(entry.meta.audience));
  const consumed = A.filter(Catalog, (entry) => ApiAudience.is.consumed(entry.meta.audience));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>beep API docs</title>
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #07130d; color: #d9fbe7; }
      body { max-width: 72rem; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
      header { margin-bottom: 3rem; }
      h1, h2, h3 { color: #75f0a7; }
      h1 { margin-bottom: .5rem; font-size: clamp(2rem, 6vw, 4rem); }
      h2 { margin-top: 3rem; padding-bottom: .6rem; border-bottom: 1px solid #24543a; }
      section > div { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1rem; }
      article { padding: 1.2rem; border: 1px solid #24543a; border-radius: .75rem; background: #0b1d13; }
      article h3 { margin: 0 0 .45rem; }
      article p { min-height: 4.5rem; line-height: 1.5; color: #b8d8c4; }
      code { color: #97d7ae; }
      nav { display: flex; gap: 1rem; }
      a { color: #75f0a7; text-underline-offset: .2rem; }
      a:hover { color: #b8ffcf; }
    </style>
  </head>
  <body>
    <header>
      <h1>beep API docs</h1>
      <p>HttpApi contracts and committed specifications in one local catalog.</p>
    </header>
    <main>
      <section>
        <h2>APIs we serve</h2>
        <div>${renderEntries(served)}</div>
      </section>
      <section>
        <h2>APIs we consume</h2>
        <div>${renderEntries(consumed)}</div>
      </section>
    </main>
  </body>
</html>`;
};

const contentType = Match.type<SpecFormat>().pipe(
  Match.when("json", () => "application/json"),
  Match.when("yaml", () => "application/yaml"),
  Match.exhaustive
);

const readSpecResponse = Effect.fn("ApiDocs.readSpecResponse")(function* (
  source: Extract<CatalogSource, { readonly _tag: "SpecSource" }>
) {
  const fs = yield* FileSystem.FileSystem;
  const absolutePath = yield* resolveCatalogSpecPath(source.specPath);
  const bytes = yield* fs.readFile(absolutePath);
  return HttpServerResponse.uint8Array(bytes, { contentType: contentType(source.format) });
});

const specDocsHtml = (entry: CatalogEntry): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(entry.meta.title)}</title>
  </head>
  <body>
    <script id="api-reference" data-url="${rawSpecPath(entry)}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;

const contractLayer = (entry: CatalogEntry, source: Extract<CatalogSource, { readonly _tag: "ContractSource" }>) =>
  source.withApi((api) =>
    Layer.merge(
      HttpApiScalar.layer(api, { path: docsPath(entry.meta.slug) }),
      HttpRouter.add("GET", rawSpecPath(entry), HttpServerResponse.jsonUnsafe(OpenApi.fromApi(api)))
    )
  );

const specLayer = (entry: CatalogEntry, source: Extract<CatalogSource, { readonly _tag: "SpecSource" }>) => {
  const rawRoute = HttpRouter.add(
    "GET",
    rawSpecPath(entry),
    // `readSpecResponse` runs for every request, so a browser reload sees file edits.
    readSpecResponse(source)
  );
  const docsRoute = Match.value(source.dialect).pipe(
    Match.when("json-schema-2020-12", () => Layer.empty),
    Match.orElse(() => HttpRouter.add("GET", docsPath(entry.meta.slug), HttpServerResponse.html(specDocsHtml(entry))))
  );

  return Layer.merge(rawRoute, docsRoute);
};

const entryLayer = (entry: CatalogEntry) =>
  Match.value(entry.source).pipe(
    Match.tagsExhaustive({
      ContractSource: (source) => contractLayer(entry, source),
      SpecSource: (source) => specLayer(entry, source),
    })
  );

const IndexRoute = HttpRouter.add("GET", "/", HttpServerResponse.html(indexHtml()));

/** Index, documentation, and raw-spec routes for the complete catalog. */
export const CatalogRoutes = Layer.mergeAll(IndexRoute, ...A.map(Catalog, entryLayer));
