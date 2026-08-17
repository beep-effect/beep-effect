/**
 * Lab-app lifecycle inspection commands (`beep labs`).
 *
 * `beep labs list` is the D9 truth surface for `apps/labs/*`: it enumerates
 * every lab workspace, decodes each `lab.manifest.json` through the
 * {@link LabManifest} schema, and renders one row per lab. A missing or
 * undecodable manifest still renders as a row but flips the exit code
 * non-zero so drifted labs never pass silently.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, Order, Path, pipe, Result } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import {
  decodeLabManifestJson,
  isLabsWorkspacePath,
  LAB_MANIFEST_FILENAME,
  LABS_WORKSPACE_ROOT,
  LabManifest,
} from "../../internal/cli/Labs/index.ts";
import { printJsonOrLines } from "../../internal/cli/Printer.ts";

const $I = $RepoCliId.create("commands/Labs/Labs.command");

/**
 * One `beep labs list` row: the lab workspace identity plus either its
 * decoded manifest or the issue that prevented decoding it.
 *
 * **Example** (Construct a drifted-lab row)
 *
 * ```ts
 * import { LabsListRow } from "@beep/repo-cli/commands/Labs"
 * import * as O from "effect/Option"
 *
 * const row = LabsListRow.make({
 *   name: "@beep/probe-lab",
 *   directory: "apps/labs/probe-lab",
 *   manifest: O.none(),
 *   issue: O.some("missing lab.manifest.json"),
 * })
 * console.log(row.name) // "@beep/probe-lab"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LabsListRow extends S.Class<LabsListRow>($I`LabsListRow`)(
  {
    name: S.NonEmptyString,
    directory: S.NonEmptyString,
    manifest: S.OptionFromOptionalKey(LabManifest),
    issue: S.OptionFromOptionalKey(S.NonEmptyString),
  },
  $I.annote("LabsListRow", {
    description:
      "One labs-list row: workspace name, repo-relative directory, and the decoded lab manifest or the manifest issue.",
  })
) {}

const encodeLabsListRows = S.encodeEffect(S.Array(LabsListRow));

const firstLine = (text: string): string =>
  pipe(
    Str.indexOf("\n")(text),
    O.match({
      onNone: () => text,
      onSome: (index) => Str.slice(0, index)(text),
    })
  );

const manifestRow = Effect.fnUntraced(function* (name: string, repoRelativeDir: string, absoluteDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifestPath = path.join(absoluteDir, LAB_MANIFEST_FILENAME);
  const exists = yield* fs.exists(manifestPath).pipe(Effect.orElseSucceed(thunkFalse));

  if (!exists) {
    return LabsListRow.make({
      name,
      directory: repoRelativeDir,
      manifest: O.none(),
      issue: O.some(`missing ${LAB_MANIFEST_FILENAME}`),
    });
  }

  const decoded = yield* Effect.result(fs.readFileString(manifestPath).pipe(Effect.flatMap(decodeLabManifestJson)));

  return Result.match(decoded, {
    onFailure: (error) =>
      LabsListRow.make({
        name,
        directory: repoRelativeDir,
        manifest: O.none(),
        issue: O.some(`invalid ${LAB_MANIFEST_FILENAME} (${firstLine(error.message)})`),
      }),
    onSuccess: (manifest) =>
      LabsListRow.make({
        name,
        directory: repoRelativeDir,
        manifest: O.some(manifest),
        issue: O.none(),
      }),
  });
});

const renderRowLine = (row: LabsListRow): string =>
  pipe(
    row.manifest,
    O.match({
      onNone: () => `${row.name} | ${row.directory} | manifest: ${O.getOrElse(row.issue, () => "unreadable")}`,
      onSome: (manifest) => {
        const base = `${row.name} | ${manifest.disposition} | created ${manifest.created.toISOString()} | ${manifest.purpose}`;
        return pipe(
          manifest.postgresSchema,
          O.match({
            onNone: () => base,
            onSome: (schema) => `${base} | postgres: ${schema}`,
          })
        );
      },
    })
  );

const labsListHandler = Effect.fn("Labs.list")(function* (options: { readonly json: boolean }) {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot();
  const workspaces = yield* resolveWorkspaceDirs(repoRoot);

  let labEntries = A.empty<readonly [string, string, string]>();
  for (const [name, dir] of workspaces) {
    const repoRelativeDir = path.relative(repoRoot, dir);
    if (isLabsWorkspacePath(repoRelativeDir)) {
      labEntries = A.append(labEntries, [name, repoRelativeDir, dir] as const);
    }
  }
  const sortedEntries = A.sortWith(labEntries, ([name]) => name, Order.String);

  if (A.isReadonlyArrayEmpty(sortedEntries)) {
    yield* printJsonOrLines(options.json, A.empty(), [`No labs under ${LABS_WORKSPACE_ROOT}/.`]);
    return;
  }

  const rows = yield* Effect.forEach(sortedEntries, ([name, repoRelativeDir, absoluteDir]) =>
    manifestRow(name, repoRelativeDir, absoluteDir)
  );
  const encodedRows = yield* encodeLabsListRows(rows);
  yield* printJsonOrLines(options.json, encodedRows, A.map(rows, renderRowLine));

  const issueCount = A.length(A.filter(rows, (row) => O.isSome(row.issue)));
  if (issueCount > 0) {
    yield* Console.error(
      `[labs] ${issueCount} lab manifest issue(s) under ${LABS_WORKSPACE_ROOT}/ — fix or delete the flagged labs.`
    );
    return yield* failWithReportedExit(`labs list found ${issueCount} manifest issue(s)`);
  }
});

/**
 * `beep labs list`: render one row per lab workspace under `apps/labs/*`.
 *
 * **Details**
 *
 * Rows come from decoding each lab's `lab.manifest.json` through the
 * {@link LabManifest} schema; `--json` emits the schema-encoded rows. Labs
 * with a missing or invalid manifest still render and flip the exit code
 * non-zero, because this listing is the D9 lifecycle truth surface.
 *
 * **Example** (Build the CLI program for the subcommand)
 *
 * ```ts
 * import { labsListCommand } from "@beep/repo-cli/commands/Labs"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(labsListCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const labsListCommand = Command.make(
  "list",
  {
    json: Flag.boolean("json").pipe(Flag.withDescription("Emit schema-encoded JSON rows instead of text lines")),
  },
  labsListHandler
).pipe(Command.withDescription("List lab apps under apps/labs with their manifest state"));

/**
 * `beep labs`: lab-app lifecycle command group.
 *
 * **Example** (Build the CLI program for the group)
 *
 * ```ts
 * import { labsCommand } from "@beep/repo-cli/commands/Labs"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(labsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const labsCommand = Command.make("labs", {}, () =>
  Console.log(A.join(["Labs commands:", "- bun run beep labs list [--json]"], "\n"))
).pipe(Command.withDescription("Inspect lab apps under apps/labs"), Command.withSubcommands([labsListCommand]));
