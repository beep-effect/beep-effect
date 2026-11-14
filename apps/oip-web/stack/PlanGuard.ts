/**
 * Pre-deploy check of an `alchemy plan` log for the `OipWeb` stack: refuses a
 * plan that would replace or delete the Vercel project, an environment
 * variable, a domain, a DNS record or the assets bucket.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OipWebId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $OipWebId.create("stack/PlanGuard");

/** Per-resource action an `alchemy plan` line reports (`alchemy/src/Cli/LoggingCli.ts`, `formatPlanLines`). */
const PlanAction = LiteralKit(["create", "update", "adopted", "replace", "delete", "orphaned", "noop"]).pipe(
  $I.annoteSchema("PlanAction", {
    description: "Action an alchemy plan line reports for one resource.",
  })
);

/** Actions that remove a physical object: a replacement deletes the old generation, an orphan or a delete removes it. */
const DestructiveAction = PlanAction.pick(["replace", "delete", "orphaned"]);

/** Kinds of resource whose loss takes oip.law down or loses data. */
const GuardedKind = LiteralKit(["project", "envVar", "domain", "dns", "bucket"]).pipe(
  $I.annoteSchema("GuardedKind", {
    description: "Kind of OipWeb resource that a deploy may never replace or delete.",
  })
);

/**
 * Kind of resource a deploy may never replace or delete: `project`, `envVar`, `domain`, `dns` or `bucket`.
 *
 * @category models
 * @since 0.0.0
 */
export type GuardedKind = typeof GuardedKind.Type;

/** One resource line of a plan: the resource FQN and the action the plan reports for it. */
class PlanEntry extends S.Opaque<PlanEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    fqn: S.NonEmptyString,
    action: PlanAction,
  }).pipe(
    $I.annoteSchema("PlanEntry", {
      description: "Resource and action from one alchemy plan line.",
    })
  )
) {}

/** Raised when a plan replaces, deletes or orphans a guarded resource. */
class PlanRefused extends S.TaggedError<PlanRefused, { readonly brand: unique symbol }>($I`PlanRefused`)(
  "PlanRefused",
  {
    refused: S.Array(PlanEntry).annotateKey({ description: "The guarded resources the plan would remove." }),
  },
  $I.annoteError<PlanRefused>("PlanRefused", {
    description:
      "The plan replaces or deletes the OipWeb project, a variable, a domain, a DNS record or the assets bucket.",
  })
) {}

/** Raised when the plan cannot be read with certainty, so nothing can be judged; the check fails closed. */
class PlanUnreadable extends S.TaggedError<PlanUnreadable, { readonly brand: unique symbol }>($I`PlanUnreadable`)(
  "PlanUnreadable",
  {
    reason: S.String.annotateKey({ description: "What could not be read: names FQNs, actions and counts only." }),
  },
  $I.annoteError<PlanUnreadable>("PlanUnreadable", {
    description: "The plan log has no summary, an unreadable resource line, or counts that disagree with its lines.",
  })
) {}

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** The logger's line prefix in CI and other non-TTY runs: `[20:33:03.096] INFO: ` (or `INFO (#1): `). */
const logPrefixPattern = /^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\] [A-Z]+(?: \(#\d+\))?: /;

const planSummaryPattern = /^Plan:\s/;

const planLinePattern = /^\[([^\]]+)\] ([a-z]+)\b/;

/** Any line the renderer writes for a resource: `[<fqn>] ...`. */
const resourceLinePattern = /^\[([^\]]+)\] /;

/** One per-action count of the summary: `12 to adopted`. */
const summaryCountPattern = /(\d+) to ([a-z]+)/g;

/**
 * Remove terminal color codes; the CI renderer colors actions.
 *
 * @param line - A raw log line.
 * @returns The line without escape sequences.
 */
const stripAnsi = (line: string): string => Str.replace(ansiPattern, "")(line);

/**
 * A log line as the plan renderer wrote it: color codes, surrounding space and the
 * logger's timestamp-and-level prefix removed.
 *
 * @param line - A raw log line.
 * @returns The rendered plan text of the line.
 */
const cleanLine: (line: string) => string = flow(stripAnsi, Str.trim, Str.replace(logPrefixPattern, ""));

/**
 * The resource line a log line carries, if any.
 *
 * @param line - A log line without color codes.
 * @returns The entry, or `None` for any other line.
 */
const toEntry = (line: string): O.Option<PlanEntry> =>
  pipe(
    O.fromNullishOr(planLinePattern.exec(line)),
    O.flatMap((match) => S.decodeUnknownOption(PlanEntry)({ fqn: match[1], action: match[2] }))
  );

/**
 * The resource lines of a plan log.
 *
 * **Example** (Parse a plan)
 *
 * ```ts
 * import { parsePlanLog } from "./PlanGuard.ts"
 *
 * const entries = parsePlanLog("Plan: 1 to update\n[Project] update\n")
 * console.log(entries) // [{ fqn: "Project", action: "update" }]
 * ```
 *
 * @param log - The text `alchemy plan` printed.
 * @returns One entry per resource line, in log order.
 * @category constructors
 * @since 0.0.0
 */
export const parsePlanLog: (log: string) => ReadonlyArray<PlanEntry> = flow(
  Str.split("\n"),
  A.map(flow(cleanLine, toEntry)),
  A.getSomes
);

/**
 * The guarded kind of a resource, from the last segment of its FQN.
 *
 * **Example** (Classify a DNS record)
 *
 * ```ts
 * import { guardedKindOf } from "./PlanGuard.ts"
 *
 * console.log(guardedKindOf("Dns-www-oip-law")) // { _tag: "Some", value: "dns" }
 * ```
 *
 * @param fqn - The resource FQN as the plan prints it.
 * @returns The kind, or `None` for a resource outside the guarded set.
 * @category constructors
 * @since 0.0.0
 */
export const guardedKindOf = (fqn: string): O.Option<GuardedKind> => {
  const id = pipe(
    Str.split("/")(fqn),
    A.last,
    O.getOrElse(() => fqn)
  );
  if (id === "Project") return O.some(GuardedKind.Enum.project);
  if (id === "AssetsBucket") return O.some(GuardedKind.Enum.bucket);
  if (Str.startsWith("Domain-")(id)) return O.some(GuardedKind.Enum.domain);
  if (Str.startsWith("Dns-")(id)) return O.some(GuardedKind.Enum.dns);
  if (Str.startsWith("Env")(id)) return O.some(GuardedKind.Enum.envVar);
  return O.none();
};

/**
 * Total count per action.
 *
 * @param counts - Pairs of an action and a count, one per resource line or per summary count.
 * @returns The count per action.
 */
const countActions = (counts: ReadonlyArray<readonly [string, number]>): HashMap.HashMap<string, number> =>
  A.reduce(counts, HashMap.empty<string, number>(), (acc, [action, count]) =>
    HashMap.set(acc, action, O.getOrElse(HashMap.get(acc, action), () => 0) + count)
  );

/**
 * Check a plan log before a deploy.
 *
 * **Details**
 *
 * Passes a plan whose guarded resources are only created, updated, adopted
 * or unchanged; fails with {@link PlanRefused} when any is replaced, deleted
 * or orphaned. It fails closed with {@link PlanUnreadable} when the log has
 * no `Plan:` summary (a crashed or empty plan), when a resource line
 * (`[<fqn>] ...`) carries an action outside the known set or another shape,
 * and when the per-action counts of the summary differ from the resource
 * lines it lists, so a silently dropped line never passes. The engine's own
 * `RemovalPolicy.protect` refuses the same plans on live stages; this check
 * is the workflow's independent second gate. Failures name resource FQNs and
 * counts only, never line text.
 *
 * **Example** (A passing plan)
 *
 * ```ts
 * import { checkPlan } from "./PlanGuard.ts"
 * import * as Effect from "effect/Effect"
 *
 * const program = checkPlan("Plan: 1 to update\n[Dns-oip-law] update\n")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param log - The text `alchemy plan` printed.
 * @returns The plan's entries when it passes.
 * @category constructors
 * @since 0.0.0
 */
export const checkPlan = Effect.fn("OipWeb.checkPlan")(function* (log: string) {
  const lines = A.map(Str.split("\n")(log), cleanLine);
  const summary = A.findFirst(lines, (line) => planSummaryPattern.test(line));
  if (O.isNone(summary)) {
    return yield* PlanUnreadable.make({ reason: "the log has no Plan: summary line" });
  }
  const unreadable = A.filterMap(lines, (line) =>
    pipe(
      O.fromNullishOr(resourceLinePattern.exec(line)),
      O.filter(() => O.isNone(toEntry(line))),
      O.map((match) => match[1] ?? ""),
      Result.fromOption(() => line)
    )
  );
  if (A.isReadonlyArrayNonEmpty(unreadable)) {
    return yield* PlanUnreadable.make({ reason: `unreadable resource line for ${A.join(unreadable, ", ")}` });
  }
  const entries = parsePlanLog(log);
  const summaryCounts = A.map(
    A.fromIterable(Str.matchAll(summaryCountPattern)(summary.value)),
    (match) => [match[2] ?? "", Number(match[1] ?? "0")] as const
  );
  const unknownSummaryActions = A.filter(summaryCounts, ([action]) => !S.is(PlanAction)(action));
  if (A.isReadonlyArrayNonEmpty(unknownSummaryActions)) {
    return yield* PlanUnreadable.make({
      reason: `the Plan: summary counts an unknown action (${A.join(
        A.map(unknownSummaryActions, ([action]) => action),
        ", "
      )})`,
    });
  }
  const declared = countActions(summaryCounts);
  const listed = countActions(
    A.map(
      A.filter(entries, (entry) => !PlanAction.is.noop(entry.action)),
      (entry) => [entry.action, 1] as const
    )
  );
  const mismatched = A.filter(
    PlanAction.literals,
    (action) =>
      O.getOrElse(HashMap.get(declared, action), () => 0) !== O.getOrElse(HashMap.get(listed, action), () => 0)
  );
  if (A.isReadonlyArrayNonEmpty(mismatched)) {
    return yield* PlanUnreadable.make({
      reason: `the Plan: summary and the resource lines disagree on ${A.join(mismatched, ", ")}`,
    });
  }
  const refused = A.filter(
    entries,
    (entry) => S.is(DestructiveAction)(entry.action) && O.isSome(guardedKindOf(entry.fqn))
  );
  if (A.isReadonlyArrayNonEmpty(refused)) {
    return yield* PlanRefused.make({ refused });
  }
  return entries;
});
