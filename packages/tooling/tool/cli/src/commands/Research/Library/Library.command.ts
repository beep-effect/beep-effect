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
import * as O from "effect/Option";
import { LibraryBoxAcquireOptions } from "./Library.box.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import { LibraryMineOptions } from "./Library.mine.schemas.ts";
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
    privateInput: Flag.String("private-input").pipe(
      Flag.atLeast(0),
      Flag.withDescription(
        "Corpus directory inventoried into the private partition; repeat for every root. A private root may sit inside an --input root and wins for that subtree"
      )
    ),
  },
  Effect.fn("ResearchLibrary.inventoryCommand")(function* ({ library, input, privateInput }) {
    const research = yield* ResearchLibrary;
    const libraryRoot = yield* resolveLibraryRoot(library);
    // Explicit private roots alone must not pull in the default public corpus roots.
    const inputRoots =
      A.isReadonlyArrayEmpty(input) && A.isReadonlyArrayNonEmpty(privateInput)
        ? []
        : yield* resolveLibraryInputRoots(input);
    const catalog = yield* research.inventory(
      libraryRoot,
      LibraryInventoryOptions.make({ libraryRoot, inputRoots, privateInputRoots: privateInput })
    );
    const privateDocuments = A.filter(catalog.documents, (document) => document.accessClass === "private").length;
    yield* Console.log(
      `Inventoried ${catalog.documents.length} documents (${privateDocuments} private), ${catalog.sources.length} source identities, ${catalog.occurrences.length} citations in ${libraryRoot}`
    );
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription(
    "Snapshot input documents, record hop-1 citations and hop-2 identities from readable hop-1 captures, without fetching"
  )
);
const hopPolicyOf = Effect.fn("ResearchLibrary.hopPolicyOf")(function* (hop2DomainCap: number, hop2Limit: number) {
  if (hop2DomainCap < 0)
    return yield* LibraryError.make({ message: "--hop2-domain-cap must be zero or more.", cause: hop2DomainCap });
  if (hop2Limit < 0)
    return yield* LibraryError.make({ message: "--hop2-limit must be zero or more.", cause: hop2Limit });
  return LibraryHopPolicy.make({ domainCap: hop2DomainCap, hop2Limit });
});
const hop2LimitFlag = Flag.Int("hop2-limit").pipe(
  Flag.withDefault(400),
  Flag.withDescription("Acquired hop-2 sources allowed in total, most routed hop-1 parents first")
);
const validateAcquireFlags = Effect.fn("ResearchLibrary.validateAcquireFlags")(function* (
  concurrency: number,
  hop2DomainCap: number,
  hop2Limit: number
) {
  if (concurrency < 1 || concurrency > 8)
    return yield* LibraryError.make({ message: "Concurrency must be between 1 and 8.", cause: concurrency });
  return yield* hopPolicyOf(hop2DomainCap, hop2Limit);
});
const acquireBoxSelection = Effect.fn("ResearchLibrary.acquireBoxSelection")(function* (
  root: string,
  flags: {
    readonly boxFolder: ReadonlyArray<string>;
    readonly boxFile: ReadonlyArray<string>;
    readonly boxPublic: boolean;
    readonly retryFailed: boolean;
  }
) {
  if (A.isReadonlyArrayEmpty(flags.boxFolder) && A.isReadonlyArrayEmpty(flags.boxFile))
    return yield* LibraryError.make({ message: "--route box needs --box-folder or --box-file.", cause: "options" });
  const research = yield* ResearchLibrary;
  return yield* research.acquireBox(
    root,
    LibraryBoxAcquireOptions.make({
      folderIds: flags.boxFolder,
      fileIds: flags.boxFile,
      accessClass: flags.boxPublic ? "public" : "private",
      retryFailed: flags.retryFailed,
    })
  );
});
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
    hop2Limit: hop2LimitFlag,
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
    hop2Limit,
    concurrency,
    retryFailed,
  }) {
    const research = yield* ResearchLibrary;
    const hopPolicy = yield* validateAcquireFlags(concurrency, hop2DomainCap, hop2Limit);
    const root = yield* resolveLibraryRoot(library);
    yield* route === "box"
      ? acquireBoxSelection(root, { boxFolder, boxFile, boxPublic, retryFailed })
      : research.acquire(
          root,
          LibraryAcquireOptions.make({
            sourceIds: source,
            concurrency,
            retryFailed,
            hopPolicy,
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
    hop2Limit: hop2LimitFlag,
  },
  Effect.fn("ResearchLibrary.hopsCommand")(function* ({ library, limit, hop2DomainCap, hop2Limit }) {
    const research = yield* ResearchLibrary;
    const policy = yield* hopPolicyOf(hop2DomainCap, hop2Limit);
    const root = yield* resolveLibraryRoot(library);
    yield* research.hops(root, limit, policy);
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
    results: Argument.String("result-file").pipe(Argument.atLeast(1)),
  },
  Effect.fn("ResearchLibrary.importCommand")(function* ({ library, results }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    // One process imports the batch so every catalog write after the first reuses the decoded catalog.
    yield* Effect.forEach(results, (result) => research.importResult(root, result), { discard: true });
    yield* Console.log(`Imported ${results.length} source-bound result(s) into ${root}.`);
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

const mineFlags = {
  library,
  intake: Flag.String("intake").pipe(Flag.withDescription("Intake id or unique intake date")),
  limit: Flag.Int("limit").pipe(Flag.optional, Flag.withDescription("Run at most this many pending jobs")),
  concurrency: Flag.Int("concurrency").pipe(Flag.withDefault(2), Flag.withDescription("Parallel runners, 1 to 8")),
  dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false), Flag.withDescription("Print planned jobs only")),
  excludePrivate: Flag.Boolean("exclude-private").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Skip private-partition artifacts")
  ),
  onlyPrivate: Flag.Boolean("only-private").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Run only private-partition artifacts, so a private-capable profile can share an intake")
  ),
  repo: Flag.String("repo").pipe(
    Flag.optional,
    Flag.withDescription("Repository whose goal and exploration packets supply topic ids; default: enclosing repo")
  ),
};
const mineOptions = Effect.fn("ResearchLibrary.mineOptions")(function* (
  profile: LibraryMineOptions["profile"],
  flags: {
    readonly intake: string;
    readonly limit: O.Option<number>;
    readonly concurrency: number;
    readonly dryRun: boolean;
    readonly excludePrivate: boolean;
    readonly onlyPrivate: boolean;
    readonly repo: O.Option<string>;
  }
) {
  if (flags.concurrency < 1 || flags.concurrency > 8)
    return yield* LibraryError.make({ message: "Concurrency must be between 1 and 8.", cause: flags.concurrency });
  if (flags.excludePrivate && flags.onlyPrivate)
    return yield* LibraryError.make({
      message: "--exclude-private and --only-private exclude each other.",
      cause: "flags",
    });
  if (O.isSome(flags.limit) && flags.limit.value < 1)
    return yield* LibraryError.make({ message: "Limit must be at least 1.", cause: flags.limit.value });
  return LibraryMineOptions.make({
    intake: flags.intake,
    profile,
    limit: flags.limit,
    concurrency: flags.concurrency,
    dryRun: flags.dryRun,
    excludePrivate: flags.excludePrivate,
    onlyPrivate: flags.onlyPrivate,
    repoRoot: flags.repo,
  });
});
const mineTriage = Command.make(
  "triage",
  {
    ...mineFlags,
    profile: Flag.Literals("profile", ["codex-luna", "claude"]).pipe(
      Flag.withDefault("codex-luna"),
      Flag.withDescription("Runner profile: codex-luna (gpt-6-luna medium) or claude (claude-opus-5-5 medium)")
    ),
  },
  Effect.fn("ResearchLibrary.mineTriageCommand")(function* (flags) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(flags.library);
    const options = yield* mineOptions(flags.profile, flags);
    yield* research.mineTriage(root, options);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("T1: triage every readable artifact of an intake that has no triage record")
);
const mineRead = Command.make(
  "read",
  {
    ...mineFlags,
    profile: Flag.Literals("profile", ["junie", "claude", "codex-sol", "proxy-sol", "proxy-opus", "cursor"]).pipe(
      Flag.withDefault("junie"),
      Flag.withDescription("Runner profile; junie and cursor never receive private-partition artifacts")
    ),
  },
  Effect.fn("ResearchLibrary.mineReadCommand")(function* (flags) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(flags.library);
    const options = yield* mineOptions(flags.profile, flags);
    yield* research.mineRead(root, options);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("T2: deep-read every T1-selected artifact into span-checked CiTO findings")
);
const mineSynthesize = Command.make(
  "synthesize",
  {
    library,
    synthesis: Argument.String("synthesis-file"),
    repo: mineFlags.repo,
    dryRun: mineFlags.dryRun,
  },
  Effect.fn("ResearchLibrary.mineSynthesizeCommand")(function* ({ library, synthesis, repo, dryRun }) {
    const research = yield* ResearchLibrary;
    const root = yield* resolveLibraryRoot(library);
    yield* research.mineSynthesize(root, synthesis, repo, dryRun);
  })
).pipe(
  Command.provide(ResearchLibraryLive),
  Command.withDescription("T3: import a session-authored synthesis as findings with an orchestrator ModelRun")
);
const mine = Command.make("mine").pipe(
  Command.withDescription("Mine intake artifacts into source-bound findings: triage, read, synthesize"),
  Command.withSubcommands([mineTriage, mineRead, mineSynthesize])
);

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
  Command.withSubcommands([
    inventory,
    qualify,
    acquire,
    hops,
    importResult,
    verify,
    render,
    status,
    ontology,
    migrate,
    mine,
  ])
);
