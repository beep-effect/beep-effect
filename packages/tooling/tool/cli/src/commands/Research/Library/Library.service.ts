/**
 * Research library service contract and default live implementation.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { N3TurtleCodecLive } from "@beep/n3";
import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { PdfTools } from "@beep/pdf-tools";
import { ShaclValidationServiceLive } from "@beep/shacl";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { acquireLibrary } from "./Library.acquire.ts";
import { LibraryBoxLive } from "./Library.box.ts";
import { LibraryFirecrawlLive } from "./Library.firecrawl.ts";
import { importLibraryRoutedResult } from "./Library.importMethods.ts";
import { migrateLibrary } from "./Library.migrate.ts";
import { LibraryMineRunnerLive } from "./Library.mine.runner.ts";
import { mineLibraryRead, mineLibrarySynthesize, mineLibraryTriage } from "./Library.mine.ts";
import { renderLibraryOntology } from "./Library.ontology.ts";
import { qualifyLibrary } from "./Library.qualify.ts";
import { renderLibrary } from "./Library.render.ts";
import { acquireLibraryBox, inventoryLibraryWithHops, libraryHopReport } from "./Library.routes.ts";
import { LibraryInventoryOptions } from "./Library.schemas.ts";
import { libraryStatus } from "./Library.status.ts";
import { verifyLibrary } from "./Library.verify.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.service");

type Provided<A> = Effect.Effect<Effect.Success<A>, Effect.Error<A>>;
/**
 * Platform dependencies captured by the default library layer.
 * @category services
 * @since 0.0.0
 */
export type ResearchLibraryRequirements =
  | Effect.Services<ReturnType<typeof inventoryLibraryWithHops>>
  | Effect.Services<ReturnType<typeof qualifyLibrary>>
  | Effect.Services<ReturnType<typeof acquireLibrary>>
  | Effect.Services<ReturnType<typeof importLibraryRoutedResult>>
  | Effect.Services<ReturnType<typeof verifyLibrary>>
  | Effect.Services<ReturnType<typeof renderLibrary>>
  | Effect.Services<ReturnType<typeof renderLibraryOntology>>
  | Effect.Services<ReturnType<typeof libraryStatus>>
  | Effect.Services<ReturnType<typeof migrateLibrary>>
  | Effect.Services<ReturnType<typeof mineLibraryTriage>>
  | Effect.Services<ReturnType<typeof mineLibraryRead>>
  | Effect.Services<ReturnType<typeof mineLibrarySynthesize>>
  | Effect.Services<ReturnType<typeof acquireLibraryBox>>
  | Effect.Services<ReturnType<typeof libraryHopReport>>;

/**
 * Service contract for maintained library operations.
 *
 * **Example** (Use ResearchLibrary)
 * ```ts
 * import { ResearchLibrary } from "@beep/repo-cli/commands/Research"
 * import * as Effect from "effect/Effect"
 * const program = Effect.flatMap(ResearchLibrary, (library) => library.status("/library"))
 * console.log(program.pipe !== undefined)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ResearchLibrary extends Context.Service<
  ResearchLibrary,
  {
    readonly inventory: (
      root: string,
      options: LibraryInventoryOptions
    ) => Provided<ReturnType<typeof inventoryLibraryWithHops>>;
    readonly qualify: (...args: Parameters<typeof qualifyLibrary>) => Provided<ReturnType<typeof qualifyLibrary>>;
    readonly acquire: (...args: Parameters<typeof acquireLibrary>) => Provided<ReturnType<typeof acquireLibrary>>;
    readonly importResult: (
      ...args: Parameters<typeof importLibraryRoutedResult>
    ) => Provided<ReturnType<typeof importLibraryRoutedResult>>;
    readonly verify: (...args: Parameters<typeof verifyLibrary>) => Provided<ReturnType<typeof verifyLibrary>>;
    readonly render: (...args: Parameters<typeof renderLibrary>) => Provided<ReturnType<typeof renderLibrary>>;
    readonly renderOntology: (
      ...args: Parameters<typeof renderLibraryOntology>
    ) => Provided<ReturnType<typeof renderLibraryOntology>>;
    readonly migrate: (...args: Parameters<typeof migrateLibrary>) => Provided<ReturnType<typeof migrateLibrary>>;
    readonly status: (...args: Parameters<typeof libraryStatus>) => Provided<ReturnType<typeof libraryStatus>>;
    readonly mineTriage: (
      ...args: Parameters<typeof mineLibraryTriage>
    ) => Provided<ReturnType<typeof mineLibraryTriage>>;
    readonly mineRead: (...args: Parameters<typeof mineLibraryRead>) => Provided<ReturnType<typeof mineLibraryRead>>;
    readonly mineSynthesize: (
      ...args: Parameters<typeof mineLibrarySynthesize>
    ) => Provided<ReturnType<typeof mineLibrarySynthesize>>;
    readonly acquireBox: (
      ...args: Parameters<typeof acquireLibraryBox>
    ) => Provided<ReturnType<typeof acquireLibraryBox>>;
    readonly hops: (...args: Parameters<typeof libraryHopReport>) => Provided<ReturnType<typeof libraryHopReport>>;
  }
>()($I`ResearchLibrary`) {}

const makeResearchLibrary = Effect.fn("ResearchLibrary.make")(function* () {
  const runtimeContext = yield* Effect.context<ResearchLibraryRequirements>();
  return ResearchLibrary.of({
    inventory: Effect.fn("ResearchLibrary.inventory")((root, options) =>
      inventoryLibraryWithHops(LibraryInventoryOptions.make({ ...options, libraryRoot: root })).pipe(
        Effect.provide(runtimeContext)
      )
    ),
    qualify: Effect.fn("ResearchLibrary.qualify")((...args) =>
      qualifyLibrary(...args).pipe(Effect.provide(runtimeContext))
    ),
    acquire: Effect.fn("ResearchLibrary.acquire")((...args) =>
      acquireLibrary(...args).pipe(Effect.provide(runtimeContext))
    ),
    importResult: Effect.fn("ResearchLibrary.importResult")((...args) =>
      importLibraryRoutedResult(...args).pipe(Effect.provide(runtimeContext))
    ),
    verify: Effect.fn("ResearchLibrary.verify")((...args) =>
      verifyLibrary(...args).pipe(Effect.provide(runtimeContext))
    ),
    render: Effect.fn("ResearchLibrary.render")((...args) =>
      renderLibrary(...args).pipe(Effect.provide(runtimeContext))
    ),
    renderOntology: Effect.fn("ResearchLibrary.renderOntology")((...args) =>
      renderLibraryOntology(...args).pipe(Effect.provide(runtimeContext))
    ),
    migrate: Effect.fn("ResearchLibrary.migrate")((...args) =>
      migrateLibrary(...args).pipe(Effect.provide(runtimeContext))
    ),
    status: Effect.fn("ResearchLibrary.status")((...args) =>
      libraryStatus(...args).pipe(Effect.provide(runtimeContext))
    ),
    mineTriage: Effect.fn("ResearchLibrary.mineTriage")((...args) =>
      mineLibraryTriage(...args).pipe(Effect.provide(runtimeContext))
    ),
    mineRead: Effect.fn("ResearchLibrary.mineRead")((...args) =>
      mineLibraryRead(...args).pipe(Effect.provide(runtimeContext))
    ),
    mineSynthesize: Effect.fn("ResearchLibrary.mineSynthesize")((...args) =>
      mineLibrarySynthesize(...args).pipe(Effect.provide(runtimeContext))
    ),
    acquireBox: Effect.fn("ResearchLibrary.acquireBox")((...args) =>
      acquireLibraryBox(...args).pipe(Effect.provide(runtimeContext))
    ),
    hops: Effect.fn("ResearchLibrary.hops")((...args) =>
      libraryHopReport(...args).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Default live layer capturing the platform services used by library operations.
 *
 * **Example** (Use ResearchLibraryLive)
 * ```ts
 * import { ResearchLibraryLive } from "@beep/repo-cli/commands/Research"
 * console.log(ResearchLibraryLive !== undefined)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ResearchLibraryLive = Layer.effect(ResearchLibrary, makeResearchLibrary()).pipe(
  Layer.provide([
    N3TurtleCodecLive,
    ShaclValidationServiceLive,
    OxigraphSparqlQueryServiceLive,
    LibraryFirecrawlLive,
    LibraryBoxLive,
    LibraryMineRunnerLive,
    PdfTools.makeLayer(),
  ])
);
