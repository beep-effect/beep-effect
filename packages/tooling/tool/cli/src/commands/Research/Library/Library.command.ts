/**
 * Maintained research library CLI commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { LibraryBoxAcquireOptions } from "./Library.box.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import { resolveLibraryInputRoots, resolveLibraryRoot } from "./Library.paths.ts";
import { LibraryQualifyOptions } from "./Library.qualify.ts";
import { LibraryAcquireOptions, LibraryInventoryOptions } from "./Library.schemas.ts";
import { ResearchLibrary, ResearchLibraryLive } from "./Library.service.ts";

const library = Flag.String("library").pipe(
  Flag.optional,
  Flag.withDescription("Reusable source library; default: BEEP_RESEARCH_LIBRARY or XDG data home")
);
const inventory = Command.make(
  "inventory",
  {
    library,
    input: Flag.String("input").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Corpus directory; repeat to include every root")
    ),
  },
  Effect.fn("ResearchLibrary.inventoryCommand")(function* ({ library, input }) {
    const research = yield* ResearchLibrary;
    const libraryRoot = yield* resolveLibraryRoot(library);
    const inputRoots = yield* resolveLibraryInputRoots(input);
    const catalog = yield* research.inventory(libraryRoot, LibraryInventoryOptions.make({ libraryRoot, inputRoots }));
    yield* Console.log(
      `Inventoried ${catalog.documents.length} documents, ${catalog.sources.length} source identities, ${catalog.occurrences.length} citations in ${libraryRoot}`
    );
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription(
    "Snapshot input documents, record hop-1 citations and hop-2 identities from readable hop-1 captures, without fetching"
  )
);
const acquire = Command.make(
  "acquire",
  {
    library,
    route: Flag.Literals("route", ["catalog", "box"]).pipe(
      Flag.withDefault("catalog"),
      Flag.withDescription("catalog: every catalogued source by its kind; box: list and download Box files")
    ),
    source: Flag.String("source").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Source ID; repeat, or omit for all sources")
    ),
    boxFolder: Flag.String("box-folder").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Box folder ID for --route box; repeat; subfolders are included")
    ),
    boxFile: Flag.String("box-file").pipe(Flag.atLeast(0), Flag.withDescription("Box file ID for --route box; repeat")),
    boxPublic: Flag.Boolean("box-public").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Record Box sources in the public partition instead of the private default")
    ),
    hop2DomainCap: Flag.Int("hop2-domain-cap").pipe(
      Flag.withDefault(25),
      Flag.withDescription("Acquired hop-2 sources allowed per domain per intake")
    ),
    concurrency: Flag.Int("concurrency").pipe(Flag.withDefault(2)),
    retryFailed: Flag.Boolean("retry-failed").pipe(Flag.withDefault(false)),
  },
  Effect.fn("ResearchLibrary.acquireCommand")(function* ({
    library,
    route,
    source,
    boxFolder,
    boxFile,
    boxPublic,
    hop2DomainCap,
    concurrency,
    retryFailed,
  }) {
    const research = yield* ResearchLibrary;
    if (concurrency < 1 || concurrency > 8)
      return yield* LibraryError.make({ message: "Concurrency must be between 1 and 8.", cause: concurrency });
    if (hop2DomainCap < 0)
      return yield* LibraryError.make({ message: "--hop2-domain-cap must be zero or more.", cause: hop2DomainCap });
    const root = yield* resolveLibraryRoot(library);
    if (route === "box") {
      if (A.isReadonlyArrayEmpty(boxFolder) && A.isReadonlyArrayEmpty(boxFile))
        return yield* LibraryError.make({ message: "--route box needs --box-folder or --box-file.", cause: "options" });
      yield* research.acquireBox(
        root,
        LibraryBoxAcquireOptions.make({
          folderIds: boxFolder,
          fileIds: boxFile,
          accessClass: boxPublic ? "public" : "private",
          retryFailed,
        })
      );
    } else
      yield* research.acquire(
        root,
        LibraryAcquireOptions.make({
          sourceIds: source,
          concurrency,
          retryFailed,
          hopPolicy: LibraryHopPolicy.make({ domainCap: hop2DomainCap }),
        })
      );
    yield* Console.log(`Acquisition receipts recorded in ${root}; run verify for coverage.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription(
    "Acquire referenced sources (web/docs/registry via Firecrawl, papers, GitHub, YouTube, gated hop 2) or a Box selection, with per-source receipts"
  )
);
const hops = Command.make(
  "hops",
  {
    library,
    limit: Flag.Int("limit").pipe(Flag.withDefault(50), Flag.withDescription("Hop-2 gate decisions to print")),
    hop2DomainCap: Flag.Int("hop2-domain-cap").pipe(Flag.withDefault(25)),
  },
  Effect.fn("ResearchLibrary.hopsCommand")(function* ({ library, limit, hop2DomainCap }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.hops(root, limit, LibraryHopPolicy.make({ domainCap: hop2DomainCap }));
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Report per-hop totals and the routed-finding hop-2 gate decisions without acquiring")
);
const qualify = Command.make(
  "qualify",
  {
    library,
    adapter: Flag.String("adapter").pipe(Flag.atLeast(0)),
    source: Flag.String("source").pipe(Flag.atLeast(0)),
    maxProbes: Flag.Int("max-probes").pipe(Flag.withDefault(3)),
  },
  Effect.fn("ResearchLibrary.qualifyCommand")(function* ({ library, adapter, source, maxProbes }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.qualify(root, LibraryQualifyOptions.make({ adapters: adapter, sourceIds: source, maxProbes }));
    yield* Console.log(`Operational qualification receipts recorded in ${root}.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Probe actual adapter routes and record verified evidence or failures")
);
const importResult = Command.make(
  "import-result",
  {
    library,
    result: Argument.String("result-file"),
  },
  Effect.fn("ResearchLibrary.importCommand")(function* ({ library, result }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.importResult(root, result);
    yield* Console.log(`Imported source-bound result into ${root}.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription(
    "Import validated Grok, alphaXiv, VidBee, transcript, web-scrape, or explicit disposition results"
  )
);
/**
 * Render verification diagnostics and fail the process gate on incomplete coverage.
 * **Example** (Prepare the process failure gate)
 * ```ts
 * import { runLibraryVerificationCommand } from "@beep/repo-cli/test/ResearchLibrary"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runLibraryVerificationCommand("/library")))
 * ```
 *
 * @internal
 * @category cli-commands
 * @since 0.0.0
 */
export const runLibraryVerificationCommand = Effect.fn("ResearchLibrary.runVerificationCommand")(function* (
  root: string
) {
  const research = yield* ResearchLibrary;
  yield* research
    .verify(root)
    .pipe(
      Effect.catchTag("LibraryError", (error) =>
        Console.error(error.message).pipe(Effect.andThen(failWithReportedExit("Research library gate failed", 1)))
      )
    );
});
const verify = Command.make(
  "verify",
  { library },
  Effect.fn("ResearchLibrary.verifyCommand")(function* ({ library }) {
    const root = yield* resolveLibraryRoot(library);
    yield* runLibraryVerificationCommand(root);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Verify immutable bytes, citation coverage, repository clones, and qualification evidence")
);
const includePrivate = Flag.Boolean("include-private").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Include the private partition")
);
const migrate = Command.make(
  "migrate",
  { library, dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)) },
  Effect.fn("ResearchLibrary.migrateCommand")(function* ({ library, dryRun }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.migrate(root, dryRun);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Migrate to catalog v2 after SHACL and hash-equal index checks")
);
const render = Command.make(
  "render",
  { library, includePrivate },
  Effect.fn("ResearchLibrary.renderCommand")(function* ({ library, includePrivate }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.render(root, includePrivate);
    yield* Console.log(`Rendered Markdown and static HTML navigation in ${root}.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Generate report views and searchable Markdown/static HTML source navigation")
);
const ontologyRender = Command.make(
  "render",
  { library },
  Effect.fn("ResearchLibrary.ontologyRenderCommand")(function* ({ library }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.renderOntology(root);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Generate and parse the library T-Box and SHACL shapes")
);
const ontology = Command.make("ontology").pipe(Command.withSubcommands([ontologyRender]));
const status = Command.make(
  "status",
  { library, includePrivate },
  Effect.fn("ResearchLibrary.statusCommand")(function* ({ library, includePrivate }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.status(root, includePrivate);
  })
).pipe(Command.provide(ResearchLibraryLive), Command.withDescription("Report coverage and provider health separately"));

/**
 * Source library command group, independent of the knowledge vault.
 * **Example** (Register library commands)
 * ```ts
 * import { libraryCommand } from "@beep/repo-cli/commands/Research"
 * console.log(libraryCommand !== undefined)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const libraryCommand = Command.make("library").pipe(
  Command.withDescription("Reusable, evidence-backed research source library"),
  Command.withSubcommands([inventory, qualify, acquire, hops, importResult, verify, render, status, ontology, migrate])
);
