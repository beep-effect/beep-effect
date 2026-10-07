/** Maintained research library CLI commands.
 * @packageDocumentation
 *
 * @since 0.0.0
 */
import { Config, Console, Effect, Path } from "effect";
import * as A from "effect/Array";
import { Argument, Command, Flag } from "effect/cli";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { acquireLibrary } from "./Library.acquire.ts";
import { LibraryError } from "./Library.errors.ts";
import { importLibraryResult } from "./Library.import.ts";
import { inventoryLibrary } from "./Library.inventory.ts";
import { LibraryQualifyOptions, qualifyLibrary } from "./Library.qualify.ts";
import { renderLibrary } from "./Library.render.ts";
import { LibraryAcquireOptions, LibraryInventoryOptions } from "./Library.schemas.ts";
import { resolveLibraryRoot } from "./Library.service.ts";
import { libraryStatus } from "./Library.status.ts";
import { verifyLibrary } from "./Library.verify.ts";

const library = Flag.String("library").pipe(
  Flag.optional,
  Flag.withDescription("Reusable source library; default ~/YeeBois/research/beep-effect")
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
    const libraryRoot = yield* resolveLibraryRoot(library);
    const path = yield* Path.Path;
    const home = yield* Config.String("HOME").pipe(
      Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve default corpus roots.", cause }))
    );
    const inputRoots = A.match(input, {
      onEmpty: () => [path.resolve("research"), path.join(home, "Downloads/Research-10-6-26")],
      onNonEmpty: A.fromIterable,
    });
    const catalog = yield* inventoryLibrary(LibraryInventoryOptions.make({ libraryRoot, inputRoots }));
    yield* Console.log(
      `Inventoried ${catalog.documents.length} documents, ${catalog.sources.length} source identities, ${catalog.occurrences.length} citations in ${libraryRoot}`
    );
  })
).pipe(Command.withDescription("Snapshot all input documents and record citation provenance without fetching sources"));
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
    if (concurrency < 1 || concurrency > 8)
      return yield* LibraryError.make({ message: "Concurrency must be between 1 and 8.", cause: concurrency });
    const root = yield* resolveLibraryRoot(library);
    yield* acquireLibrary(root, LibraryAcquireOptions.make({ sourceIds: source, concurrency, retryFailed }));
    yield* Console.log(`Acquisition receipts recorded in ${root}; run verify for coverage.`);
  })
).pipe(
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
    const root = yield* resolveLibraryRoot(library);
    yield* qualifyLibrary(root, LibraryQualifyOptions.make({ adapters: adapter, sourceIds: source, maxProbes }));
    yield* Console.log(`Operational qualification receipts recorded in ${root}.`);
  })
).pipe(Command.withDescription("Probe actual adapter routes and record verified evidence or failures"));
const importResult = Command.make(
  "import-result",
  {
    library,
    result: Argument.String("result-file"),
  },
  Effect.fn("ResearchLibrary.importCommand")(function* ({ library, result }) {
    const root = yield* resolveLibraryRoot(library);
    yield* importLibraryResult(root, result);
    yield* Console.log(`Imported source-bound result into ${root}.`);
  })
).pipe(Command.withDescription("Import validated Grok, alphaXiv, transcript, or explicit disposition results"));
/** Render verification diagnostics and fail the process gate on incomplete coverage.
 * **Example** (Prepare the process failure gate)
 * ```ts
 * import { runLibraryVerificationCommand } from "@beep/repo-cli/test/ResearchLibrary"
 * import { Effect } from "effect"
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
  yield* verifyLibrary(root).pipe(
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
  Command.withDescription("Verify immutable bytes, citation coverage, repository clones, and qualification evidence")
);
const render = Command.make(
  "render",
  { library },
  Effect.fn("ResearchLibrary.renderCommand")(function* ({ library }) {
    const root = yield* resolveLibraryRoot(library);
    yield* renderLibrary(root);
    yield* Console.log(`Rendered Markdown and static HTML navigation in ${root}.`);
  })
).pipe(Command.withDescription("Generate report views and searchable Markdown/static HTML source navigation"));
const status = Command.make(
  "status",
  { library },
  Effect.fn("ResearchLibrary.statusCommand")(function* ({ library }) {
    yield* libraryStatus(yield* resolveLibraryRoot(library));
  })
).pipe(Command.withDescription("Report coverage and provider health separately"));

/** Source library command group, independent of the knowledge vault.
 * **Example** (Register library commands)
 * ```ts
 * import { libraryCommand } from "@beep/repo-cli/commands/Research"
 * console.log(libraryCommand !== undefined)
 * ```
 *
 * @category cli-commands
 *
 * @since 0.0.0
 */
export const libraryCommand = Command.make("library").pipe(
  Command.withDescription("Reusable, evidence-backed research source library"),
  Command.withSubcommands([inventory, qualify, acquire, importResult, verify, render, status])
);
