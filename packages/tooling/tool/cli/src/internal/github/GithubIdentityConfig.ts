/**
 * The configured GitHub identities (`identities.json`) and the `gh` CLI's
 * local login, read without any GitHub API call.
 *
 * **Details**
 *
 * This module stays free of the GitHub client so the CLI root can bind the
 * ledger without loading octokit for commands that never reach GitHub.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Run } from "@beep/commands/Run";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import { XdgBase } from "@beep/xdg/XdgBase";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubLogin } from "./GithubIdentity.fields.ts";
import { GithubIdentityConfigJson, GithubIdentityLabel, GithubLedgerError } from "./GithubLedger.schemas.ts";
import type { ConfiguredGithubIdentity } from "./GithubLedger.schemas.ts";

const $I = $RepoCliId.create("internal/github/GithubIdentityConfig");

/**
 * The `user:<login>` label of a login, when it is a valid login.
 *
 * **Example** (Label a login)
 *
 * ```ts
 * import { userLabelOf } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(userLabelOf("octocat"))) // "user:octocat"
 * ```
 *
 * @param login - A login.
 * @returns Its label, or none.
 * @category constructors
 * @since 0.0.0
 */
export const userLabelOf = (login: string): O.Option<GithubIdentityLabel> =>
  GithubIdentityLabel.makeOption(`user:${login}`);

/**
 * The configured identities a label resolution may consult; empty by default.
 * The CLI root binds it to `identities.json`.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { GithubConfiguredIdentities } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(Effect.flatten(GithubConfiguredIdentities)).length) // 0
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const GithubConfiguredIdentities: Context.Reference<Effect.Effect<ReadonlyArray<ConfiguredGithubIdentity>>> =
  Context.Reference<Effect.Effect<ReadonlyArray<ConfiguredGithubIdentity>>>($I`GithubConfiguredIdentities`, {
    defaultValue: () => Effect.succeed(A.empty<ConfiguredGithubIdentity>()),
  });

/**
 * Read `identities.json`: `BEEP_GITHUB_IDENTITIES_FILE`, else
 * `$XDG_CONFIG_HOME/beep/github/identities.json`. A missing file is empty; a
 * file that does not decode (a raw token in a reference field, for instance)
 * fails with reason `config`.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGithubIdentityConfig } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readGithubIdentityConfig)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const readGithubIdentityConfig: Effect.Effect<
  ReadonlyArray<ConfiguredGithubIdentity>,
  GithubLedgerError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configured = yield* configStringOption("BEEP_GITHUB_IDENTITIES_FILE");
  const override = O.filter(configured, Str.isNonEmpty);
  const configHome = O.isSome(override)
    ? ""
    : yield* XdgBase.require("config").pipe(
        Effect.mapError(GithubLedgerError.fromUnknown("state-dir", "resolve the configuration directory"))
      );
  const file = O.getOrElse(override, () => path.join(configHome, "beep", "github", "identities.json"));
  const text = yield* fs.readFileString(file).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeedNone
        : error.pipe(GithubLedgerError.fromUnknown("read", "read the configured GitHub identities"), Effect.fail)
    )
  );
  if (O.isNone(text)) return A.empty<ConfiguredGithubIdentity>();
  const config = yield* S.decodeEffect(GithubIdentityConfigJson)(text.value).pipe(
    Effect.mapError(GithubLedgerError.fromUnknown("config", "decode the configured GitHub identities"))
  );
  return config.identities;
}).pipe(Effect.withSpan("GithubIdentityConfig.read"));

/**
 * The `gh` CLI's logged-in user, read from its local configuration with no API call.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readGhCliLogin } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readGhCliLogin(process.cwd()))) // true
 * ```
 *
 * @param cwd - The working directory for `gh`.
 * @returns The `user:<login>` label, or none.
 * @category constructors
 * @since 0.0.0
 */
export const readGhCliLogin = Effect.fn("GithubIdentityConfig.readGhCliLogin")(function* (cwd: string) {
  // KEEP (D-05): the gh login's configured user is repo-cli identity policy; the read already runs on
  // `@beep/commands` `Run.text`, and `@beep/github` has no gh CLI configuration member.
  return yield* Run.text(ChildProcess.make("gh", ["config", "get", "-h", "github.com", "user"], { cwd })).pipe(
    Effect.map((output) => O.flatMap(O.liftPredicate(Str.trim(output), S.is(GithubLogin)), userLabelOf)),
    Effect.orElseSucceed(O.none<GithubIdentityLabel>)
  );
});
