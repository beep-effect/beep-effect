/**
 * Schema-first contracts for argv-first lazy command dispatch.
 *
 * **Details**
 *
 * The dispatch manifest maps every top-level `beep` group to a dynamic import
 * of its `commands/<Group>` facade plus the static help fields the root help
 * page renders. These schemas are the data half of that manifest: the help
 * fields a group contributes to `beep --help`, the runtime services a group
 * needs built before it runs, and the dispatch decision read from argv. They
 * depend on nothing in repo-cli so the manifest can move to the composition
 * app (`goals/beep-cli-composition` D1) unchanged.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/dispatch/Dispatch.schemas");

/**
 * Repo-cli runtime services a command group may need beyond the platform base.
 *
 * **Details**
 *
 * The platform base (Bun services, HTTP client, crypto) is built for every
 * route. Each key here names one extra Layer the bin builds only when the
 * dispatched group declares it: `fs-utils` is `FsUtilsLive`, `ts-morph` is
 * `TSMorphServiceLive` and `memory-stats` is `MemoryStatsLive`.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const RuntimeService = LiteralKit(["fs-utils", "ts-morph", "memory-stats"]).pipe(
  $I.annoteSchema("RuntimeService", {
    description: "A repo-cli runtime Layer a command group needs built before it runs.",
  })
);

/**
 * Decoded {@link RuntimeService} value.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type RuntimeService = typeof RuntimeService.Type;

/**
 * The help fields one top-level group contributes to the root help page.
 *
 * **Details**
 *
 * These mirror the fields `effect/cli` reads from a subcommand when it renders
 * its parent's help and its unknown-subcommand suggestions: name, alias, short
 * description, description and the unlisted bit. A stub command built from
 * them renders `beep --help` byte-identically to the real group without
 * importing it. The manifest drift test compares every entry with the real
 * command tree.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CommandGroupHelp extends S.Class<CommandGroupHelp, { readonly brand: unique symbol }>(
  $I`CommandGroupHelp`
)(
  {
    name: S.NonEmptyString,
    description: S.optionalKey(S.String),
    shortDescription: S.optionalKey(S.String),
    alias: S.optionalKey(S.NonEmptyString),
    unlisted: S.optionalKey(S.Boolean),
  },
  $I.annote("CommandGroupHelp", {
    description: "Static root-help fields of one top-level beep command group.",
  })
) {}

/**
 * What argv asks the dispatcher to load.
 *
 * **Details**
 *
 * - `group`: one named group runs; only its facade is imported and only its
 *   runtime services are built.
 * - `root`: no group is named (`beep`, `beep --help`, `beep --version`) or the
 *   named group is unknown; the root renders from stubs alone, which keeps the
 *   unknown-subcommand suggestions identical.
 * - `full-tree`: a root flag that walks every group (`--completions`,
 *   `--wizard`) is present, so every group is imported as before.
 * - `quality-task`: a root quality task (`beep build`, `beep lint`, ...) that
 *   `commands/Quality/Tasks.ts` parses and runs without any command group.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const DispatchTarget = S.TaggedUnion({
  group: { name: S.NonEmptyString },
  root: {},
  "full-tree": {},
  "quality-task": {},
}).pipe(
  $I.annoteSchema("DispatchTarget", {
    description: "The command groups argv asks the lazy dispatcher to import.",
  })
);

/**
 * Decoded {@link DispatchTarget} value.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type DispatchTarget = typeof DispatchTarget.Type;
