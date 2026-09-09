/**
 * CLI entry points for seeding clone-local Graft meaning artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { printCommandJson } from "../../internal/cli/Json.ts";
import { GraftCacheIoError, GraftCacheTargetError } from "./Graft.errors.ts";
import { GraftCacheSyncAction, GraftCacheSyncPlan, GraftCacheSyncReport } from "./Graft.schemas.ts";
import { GraftCacheSync, GraftCacheSyncLive } from "./Graft.service.ts";

const flags = {
  from: Flag.string("from").pipe(Flag.withDescription("Source clone containing graft/.cache/summaries.json")),
  to: Flag.string("to").pipe(Flag.atLeast(0), Flag.withDescription("Target clone root; repeat for multiple targets")),
  siblings: Flag.boolean("siblings").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Discover sibling clones matching the source basename without trailing digits")
  ),
  dryRun: Flag.boolean("dry-run").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Print the plan without writing files")
  ),
  json: Flag.boolean("json").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Print a schema-encoded JSON plan or report")
  ),
};

const renderPlan = (plan: GraftCacheSyncPlan): string =>
  A.join(
    [
      `Graft cache source: ${plan.source}`,
      ...A.map(
        plan.entries,
        (entry) =>
          `${entry.action} ${entry.artifact} ${entry.targetPath}${O.getOrElse(
            O.map(O.fromUndefinedOr(entry.reason), (reason) => `: ${reason}`),
            () => ""
          )}`
      ),
    ],
    "\n"
  );

const syncCommand = Command.make(
  "sync",
  flags,
  Effect.fn("GraftCommand.sync")(function* (options) {
    if (options.siblings === A.isReadonlyArrayNonEmpty(options.to)) {
      return yield* GraftCacheTargetError.make({
        path: options.from,
        message: "Select exactly one of --to <cloneDir> (repeatable) or --siblings.",
      });
    }
    const sync = yield* GraftCacheSync;
    const targets = options.siblings ? yield* sync.discoverSiblings(options.from) : options.to;
    const plan = yield* sync.plan(options.from, targets);
    const encodeError = (cause: unknown) =>
      GraftCacheIoError.make({ path: plan.source, message: "Failed to encode Graft cache sync output.", cause });
    // JSON goes through the shared chunked stdout writer: a plain Console.log of a
    // multi-target plan exceeds the 64 KiB pipe buffer and is cut off at exit.
    if (options.dryRun) {
      if (options.json) {
        const encoded = yield* S.encodeEffect(GraftCacheSyncPlan)(plan).pipe(Effect.mapError(encodeError));
        yield* printCommandJson(encoded).pipe(Effect.mapError(encodeError));
      } else {
        yield* Console.log(renderPlan(plan));
      }
    } else {
      const report = yield* sync.apply(plan);
      if (options.json) {
        const encoded = yield* S.encodeEffect(GraftCacheSyncReport)(report).pipe(Effect.mapError(encodeError));
        yield* printCommandJson(encoded).pipe(Effect.mapError(encodeError));
      } else {
        yield* Console.log(
          `${renderPlan(report.plan)}\nCopied: ${report.copied}; skipped: ${report.skipped}; refused: ${report.refused}; bytes: ${report.bytes}`
        );
      }
    }
    if (A.some(plan.entries, (entry) => GraftCacheSyncAction.is.refuse(entry.action))) {
      return yield* GraftCacheTargetError.make({
        path: plan.source,
        message: "Graft cache sync refused one or more destinations; see the report.",
      });
    }
  })
).pipe(
  Command.withDescription("Seed the Graft meaning tier into other local clones"),
  Command.provide(GraftCacheSyncLive)
);

const cacheCommand = Command.make("cache", {}, () =>
  Console.log("Graft cache commands: sync --from <cloneDir> (--to <cloneDir>... | --siblings) [--dry-run] [--json]")
).pipe(Command.withDescription("Manage clone-local Graft meaning artifacts"), Command.withSubcommands([syncCommand]));

/**
 * Registers `beep graft cache sync` for local meaning-tier seeding.
 *
 * **Details**
 *
 * JSON output precedes failure on refused targets. Dry runs never create directories or files.
 *
 * **Example** (Inspect the command identity)
 *
 * ```ts import.meta.vitest name="Inspect the command identity"
 * import { graftCommand } from "@beep/repo-cli/commands/Graft"
 * graftCommand.name // => "graft"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const graftCommand = Command.make("graft", {}, () => Console.log("Graft commands: cache sync")).pipe(
  Command.withDescription("Repo-owned operations on clone-local Graft caches"),
  Command.withSubcommands([cacheCommand])
);
