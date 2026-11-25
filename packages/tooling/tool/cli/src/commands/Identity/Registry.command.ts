/**
 * `beep identity registry`: the command over the registry generator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithPrintedExit, failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import {
  checkRegistry,
  IdentityRegistryGeneratorError,
  issueLine,
  resolveRegistryLayout,
  writeRegistry,
} from "./Registry.ts";
import { baseFlag, readBaseSnapshot } from "./RegistryBase.ts";
import type { IdentityRegistryIssue, RegistryLayout, RegistryWrite } from "./Registry.ts";

const reportIssues = Effect.fn("IdentityRegistry.reportIssues")(function* (
  issues: A.NonEmptyReadonlyArray<IdentityRegistryIssue>
) {
  yield* Console.error(`[identity:registry] found ${A.length(issues)} finding(s).`);
  for (const issue of issues) {
    yield* Console.error(issueLine(issue));
  }
  return yield* failWithReportedExit("identity registry: findings.");
});

const writeLines = ({ removed, written }: RegistryWrite): A.NonEmptyReadonlyArray<string> => {
  const lines = A.getSomes([
    O.map(O.liftPredicate(A.isReadonlyArrayNonEmpty)(written), (files) => `wrote ${A.join(files, ", ")}.`),
    O.map(O.liftPredicate(A.isReadonlyArrayNonEmpty)(removed), (files) => `removed ${A.join(files, ", ")}.`),
  ]);
  return A.isReadonlyArrayNonEmpty(lines) ? lines : ["up to date."];
};

const runRegistryWrite = Effect.fn("IdentityRegistry.runWrite")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  ref: O.Option<string>
) {
  const base = yield* readBaseSnapshot("identity:registry", repoRoot, layout, ref);
  if (Result.isFailure(base)) {
    return yield* reportIssues(A.of(base.failure));
  }
  const written = yield* writeRegistry(repoRoot, layout, base.success);
  if (Result.isFailure(written)) {
    return yield* reportIssues(written.failure);
  }
  for (const line of writeLines(written.success)) {
    yield* Console.log(`[identity:registry] ${line}`);
  }
});

const runIdentityRegistry = Effect.fn("IdentityRegistry.run")(function* (options: {
  readonly write: boolean;
  readonly check: boolean;
  readonly base: O.Option<string>;
}) {
  if (options.write && options.check) {
    return yield* failWithPrintedExit("identity registry: pass --write or --check, not both.");
  }
  if (!options.write && O.isSome(options.base)) {
    return yield* failWithPrintedExit(
      "identity registry: --base applies only to --write; --check compares the artifacts with the shards and reads no git state. Check against a base ref with `bun run beep lint identity-registry --base <ref>`."
    );
  }
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError((cause) =>
      IdentityRegistryGeneratorError.make({ message: "Cannot find the repository root.", cause })
    )
  );
  const layout = yield* resolveRegistryLayout(repoRoot);
  if (options.write) {
    return yield* runRegistryWrite(repoRoot, layout, options.base);
  }
  const issues = yield* checkRegistry(repoRoot, layout);
  if (A.isReadonlyArrayNonEmpty(issues)) {
    return yield* reportIssues(issues);
  }
  yield* Console.log("[identity:registry] OK: the generated registry artifacts match the shards.");
});

/**
 * `beep identity registry`: regenerate (`--write`) or check (`--check`, the default) the registry artifacts.
 *
 * **Details**
 *
 * `--write` releases the change against the base ref (`--base`, by default the
 * merge base of `HEAD` with `origin/main`). `--check` reads no git state.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { identityRegistryCommand } from "@beep/repo-cli/commands/Identity/Registry.command"
 *
 * console.log(identityRegistryCommand.name) // "registry"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const identityRegistryCommand = Command.make(
  "registry",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Write Registry.data.ts, term-snapshot.json and the projection modules from the source shards, and remove a projection module no shard targets"
      )
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write nothing; report shard, conflict and drift findings (the default)")
    ),
    base: baseFlag,
  },
  runIdentityRegistry
).pipe(Command.withDescription("Generate or check the identity registry artifacts from its source shards"));
