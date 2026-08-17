/**
 * CLI: Workflow Commands
 *
 * **Details**
 *
 * Manage durable workflows, cleanup stale links, and re-enrich pending content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Clock, Console, DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { Command, Flag as Options } from "effect/unstable/cli";
import { LinkIngestionService } from "../../Service/LinkIngestionService.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const ontologyOption = Options.string("ontology").pipe(
  Options.withAlias("o"),
  Options.optional,
  Options.withDescription("Ontology ID to scope operations to")
);

const minutesOption = Options.integer("minutes").pipe(
  Options.withAlias("m"),
  Options.withDefault(30),
  Options.withDescription("Consider links stale after this many minutes (default: 30)")
);

const limitOption = Options.integer("limit").pipe(
  Options.withAlias("l"),
  Options.withDefault(100),
  Options.withDescription("Maximum links to list (default: 100)")
);

const linkIdOption = Options.string("link-id").pipe(Options.withDescription("Specific link ID to re-enrich"));

const dryRunOption = Options.boolean("dry-run").pipe(
  Options.withAlias("n"),
  Options.withDefault(false),
  Options.withDescription("Show what would be done without making changes")
);

// =============================================================================
// Subcommand: list-pending
// =============================================================================

const listPendingHandler = Effect.fn("listPendingHandler")(function* (ontology: O.Option<string>, limit: number) {
  const ingestion = yield* LinkIngestionService;
  yield* Console.log("Listing pending/failed links...");
  yield* Console.log("");
  const links = yield* ingestion.list({
    ...(O.isSome(ontology) ? { ontologyId: ontology.value } : {}),
    status: "pending",
    limit,
  });
  if (A.isReadonlyArrayEmpty(links)) {
    yield* Console.log("No pending links found.");
    return;
  }
  yield* Console.log(`Found ${links.length} pending links:\n`);
  for (const link of links) {
    yield* Console.log(`  ${link.id}`);
    yield* Console.log(`    URL: ${link.sourceUri}`);
    yield* Console.log(`    Status: ${link.status}`);
    yield* Console.log(`    Updated: ${link.updatedAt?.toISOString()}`);
    if (P.isNotNull(link.errorMessage)) {
      yield* Console.log(`    Error: ${link.errorMessage}`);
    }
    yield* Console.log("");
  }
});

const listPendingCommand = Command.make(
  "list-pending",
  { ontology: ontologyOption, limit: limitOption },
  ({ limit, ontology }) => withErrorHandler(listPendingHandler(ontology, limit))
).pipe(Command.withDescription("List pending and failed links"));

// =============================================================================
// Subcommand: cleanup-stale
// =============================================================================

const cleanupStaleHandler = Effect.fn("cleanupStaleHandler")(function* (
  ontology: O.Option<string>,
  minutes: number,
  dryRun: boolean
) {
  const ingestion = yield* LinkIngestionService;
  const ontologyId = O.getOrUndefined(ontology);
  yield* Console.log(`Looking for links stale for more than ${minutes} minutes...`);
  if (dryRun) {
    yield* Console.log("(dry-run mode - no changes will be made)");
    yield* Console.log("");
    const staleLinks = yield* ingestion.list({
      ...(O.isSome(ontology) ? { ontologyId: ontology.value } : {}),
      status: "pending",
      limit: 1000,
    });
    const cutoffDate = DateTime.toDateUtc(DateTime.makeUnsafe((yield* Clock.currentTimeMillis) - minutes * 60 * 1000));
    const staleCandidates = staleLinks.filter((link) => link.updatedAt && link.updatedAt < cutoffDate);
    if (A.isReadonlyArrayEmpty(staleCandidates)) {
      yield* Console.log("No stale links would be cleaned up.");
      return;
    }
    yield* Console.log(`Would mark ${staleCandidates.length} links as failed:\n`);
    for (const link of staleCandidates.slice(0, 20)) {
      yield* Console.log(`  ${link.id}: ${link.sourceUri}`);
    }
    if (staleCandidates.length > 20) {
      yield* Console.log(`  ... and ${staleCandidates.length - 20} more`);
    }
    return;
  }
  const result = yield* ingestion.cleanupStaleLinks(minutes, ontologyId);
  if (result.cleaned === 0) {
    yield* Console.log("No stale links found.");
  } else {
    yield* Console.log(`Marked ${result.cleaned} stale links as failed.`);
    yield* Console.log("Use 're-enrich' to retry them.");
  }
});

const cleanupStaleCommand = Command.make(
  "cleanup-stale",
  { ontology: ontologyOption, minutes: minutesOption, dryRun: dryRunOption },
  ({ dryRun, minutes, ontology }) => withErrorHandler(cleanupStaleHandler(ontology, minutes, dryRun))
).pipe(Command.withDescription("Mark stale pending links as failed"));

// =============================================================================
// Subcommand: re-enrich
// =============================================================================

const reEnrichHandler = Effect.fn("reEnrichHandler")(function* (linkId: string) {
  const ingestion = yield* LinkIngestionService;
  yield* Console.log(`Re-enriching link: ${linkId}...`);
  const result = yield* ingestion.reEnrich(linkId);
  if (O.isNone(result)) {
    yield* Console.log("Link not found or re-enrichment failed.");
    return;
  }
  const link = result.value;
  yield* Console.log("Successfully re-enriched!");
  yield* Console.log("");
  yield* Console.log(`  Status: ${link.status}`);
  yield* Console.log(`  Headline: ${link.headline}`);
  yield* Console.log(`  Topics: ${link.topics?.join(", ") || "(none)"}`);
  yield* Console.log(`  Key Entities: ${link.keyEntities?.join(", ") || "(none)"}`);
});

const reEnrichCommand = Command.make("re-enrich", { linkId: linkIdOption }, ({ linkId }) =>
  withErrorHandler(reEnrichHandler(linkId))
).pipe(Command.withDescription("Re-run enrichment on a specific link"));

// =============================================================================
// Subcommand: re-enrich-all
// =============================================================================

const reEnrichAllHandler = Effect.fn("reEnrichAllHandler")(function* (ontology: O.Option<string>, limit: number) {
  const ingestion = yield* LinkIngestionService;
  yield* Console.log("Finding failed links to re-enrich...");
  const links = yield* ingestion.list({
    ...(O.isSome(ontology) ? { ontologyId: ontology.value } : {}),
    status: "failed",
    limit,
  });
  if (A.isReadonlyArrayEmpty(links)) {
    yield* Console.log("No failed links found.");
    return;
  }
  yield* Console.log(`Found ${links.length} failed links. Re-enriching...\n`);
  let success = 0;
  let failed = 0;
  for (const link of links) {
    yield* Console.log(`  Processing: ${link.id}`);
    const result = yield* ingestion.reEnrich(link.id).pipe(
      Effect.catch(
        Effect.fnUntraced(function* (error) {
          yield* Console.log(`    Failed: ${error.message}`);
          return O.none();
        })
      )
    );
    if (O.isSome(result)) {
      yield* Console.log(`    Success: ${result.value.headline}`);
      success++;
    } else {
      failed++;
    }
  }
  yield* Console.log("");
  yield* Console.log(`Completed: ${success} success, ${failed} failed`);
});

const reEnrichAllCommand = Command.make(
  "re-enrich-all",
  { ontology: ontologyOption, limit: limitOption },
  ({ limit, ontology }) => withErrorHandler(reEnrichAllHandler(ontology, limit))
).pipe(Command.withDescription("Re-enrich all failed links"));

// =============================================================================
// Parent Command
// =============================================================================

/**
 * Exposes workflow command for composition by callers of this module.
 *
 * **Example** (Inspect workflow command)
 *
 * ```ts
 * import { workflowCommand } from "@effect-ontology/Cli/Commands/Workflow"
 *
 * console.log(workflowCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const workflowCommand = Command.make("workflow").pipe(
  Command.withSubcommands([listPendingCommand, cleanupStaleCommand, reEnrichCommand, reEnrichAllCommand]),
  Command.withDescription("Workflow management: cleanup stale links, re-enrich failed content")
);
