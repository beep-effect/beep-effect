/**
 * Maintained research library CLI commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { LibraryError } from "./Library.errors.ts";
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
  Command.withDescription("Snapshot all input documents and record citation provenance without fetching sources")
);
const acquire = Command.make(
  "acquire",
  {
    library,
    source: Flag.String("source").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Source ID; repeat, or omit for all sources")
    ),
    concurrency: Flag.Int("concurrency").pipe(Flag.withDefault(2)),
    retryFailed: Flag.Boolean("retry-failed").pipe(Flag.withDefault(false)),
  },
  Effect.fn("ResearchLibrary.acquireCommand")(function* ({ library, source, concurrency, retryFailed }) {
    const research = yield* ResearchLibrary;
    if (concurrency < 1 || concurrency > 8)
      return yield* LibraryError.make({ message: "Concurrency must be between 1 and 8.", cause: concurrency });
    const root = yield* resolveLibraryRoot(library);
    yield* research.acquire(root, LibraryAcquireOptions.make({ sourceIds: source, concurrency, retryFailed }));
    yield* Console.log(`Acquisition receipts recorded in ${root}; run verify for coverage.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Acquire referenced sources, clone every external repository, and retain per-source receipts")
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
  Command.withDescription("Import validated Grok, alphaXiv, transcript, or explicit disposition results")
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
const render = Command.make(
  "render",
  { library },
  Effect.fn("ResearchLibrary.renderCommand")(function* ({ library }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.render(root);
    yield* Console.log(`Rendered Markdown and static HTML navigation in ${root}.`);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("Generate report views and searchable Markdown/static HTML source navigation")
);
const status = Command.make(
  "status",
  { library },
  Effect.fn("ResearchLibrary.statusCommand")(function* ({ library }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.status(root);
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
  Command.withSubcommands([inventory, qualify, acquire, importResult, verify, render, status])
);
