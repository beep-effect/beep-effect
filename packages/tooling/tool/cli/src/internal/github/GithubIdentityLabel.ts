/**
 * Derive the non-secret budget label of the identity a GitHub client speaks as.
 *
 * **Details**
 *
 * A label names the bucket owner, never the token. A GitHub App is
 * `app:<appId>/<installationId>`. A token resolves to `user:<login>` from, in
 * order: the `gh` CLI's local login (`gh config get -h github.com user`, no API
 * call), the alias map (`aliases.json`), a configured `OpRef` entry with the
 * same reference, and finally one `GET /user` on a client labelled with the
 * token's hash. Every successful token resolution records the alias, so the
 * `GET /user` happens once per token lineage per host; when it fails the label
 * is the degraded `token:<12 hex>`.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { GitHubClient } from "@beep/github/GitHubClient";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubLogin } from "./GithubIdentity.fields.ts";
import { GithubConfiguredIdentities, readGhCliLogin, userLabelOf } from "./GithubIdentityConfig.ts";
import {
  ConfiguredGithubIdentity,
  canonicalIdentity,
  GithubIdentityLabel,
  UNRESOLVED_IDENTITY,
} from "./GithubLedger.schemas.ts";
import { GithubBudgetLedger } from "./GithubLedger.service.ts";
import type { GitHubClientOptions } from "@beep/github/GitHubClient";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubIdentityKind } from "./GithubIdentity.ts";

const $I = $RepoCliId.create("internal/github/GithubIdentityLabel");

const textEncoder = new TextEncoder();

/**
 * The degraded `token:<12 hex>` label of a token: the first twelve hex digits
 * of its SHA-256. The token itself never leaves the `Redacted` wrapper except
 * into the digest.
 *
 * **Example** (Hash a fixture token)
 *
 * ```ts
 * import { tokenHashLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * import * as Digest from "effect/crypto/Digest"
 *
 * const label = await Effect.runPromise(
 *   tokenHashLabel(Redacted.make("fixture")).pipe(Effect.provide(Digest.layerWebCrypto))
 * )
 * console.log(label.startsWith("token:")) // true
 * ```
 *
 * @param token - The token.
 * @returns Its `token:` label.
 * @category constructors
 * @since 0.0.0
 */
export const tokenHashLabel = Effect.fn("GithubIdentityLabel.tokenHash")(function* (token: Redacted.Redacted<string>) {
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, textEncoder.encode(Redacted.value(token)));
  return GithubIdentityLabel.make(`token:${Str.slice(0, 12)(hex)}`);
});

const UserLogin = S.Struct({ login: GithubLogin }).pipe(
  $I.annoteSchema("UserLogin", { description: "The login field of GET /user." })
);

/**
 * What a label resolution needs: the identity kind and references, the token
 * the client will carry (none for an App), the working directory for `gh`,
 * and the transport settings for a `GET /user` fallback.
 *
 * @category models
 * @since 0.0.0
 */
export interface GithubIdentityLabelInput {
  readonly appId: O.Option<string>;
  readonly cwd: string;
  readonly installationId: O.Option<number>;
  readonly kind: GithubIdentityKind;
  readonly token: O.Option<Redacted.Redacted<string>>;
  readonly tokenRef: O.Option<string>;
  readonly transport: Omit<GitHubClientOptions.Encoded, "token">;
}

// gh reads GH_TOKEN, then GITHUB_TOKEN, before its hosts.yml login.
const ghEnvToken = Effect.gen(function* () {
  const ghToken = yield* configStringOption("GH_TOKEN");
  const githubToken = yield* configStringOption("GITHUB_TOKEN");
  return O.map(
    O.orElse(O.filter(ghToken, Str.isNonEmpty), () => O.filter(githubToken, Str.isNonEmpty)),
    Redacted.make
  );
});

/**
 * The label of the identity a spawned `gh` spends: the env token's identity
 * when `GH_TOKEN` or `GITHUB_TOKEN` is set, else the `gh` CLI's local login.
 *
 * **Details**
 *
 * An env token gets its `token:<12 hex>` label, which the ledger maps through
 * the alias map when it records the row, so a token this host has resolved
 * before lands on its `user:` bucket. It makes no request. Without an env
 * token it reads `gh config get -h github.com user`, and falls back to
 * `unresolved`.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { ghSpawnIdentity } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(ghSpawnIdentity(process.cwd()))) // true
 * ```
 *
 * @param cwd - The working directory for `gh`.
 * @returns The label `gh` children spend.
 * @category constructors
 * @since 0.0.0
 */
export const ghSpawnIdentity = Effect.fn("GithubIdentityLabel.ghSpawnIdentity")(function* (
  cwd: string
): Effect.fn.Return<GithubIdentityLabel, never, ChildProcessSpawner.ChildProcessSpawner | Digest.Digest> {
  const envToken = yield* ghEnvToken;
  if (O.isSome(envToken)) {
    return yield* tokenHashLabel(envToken.value);
  }
  const login = yield* readGhCliLogin(cwd);
  return O.getOrElse(login, () => UNRESOLVED_IDENTITY);
});

const lookupUser = Effect.fnUntraced(function* (
  token: Redacted.Redacted<string>,
  hash: GithubIdentityLabel,
  transport: Omit<GitHubClientOptions.Encoded, "token">
) {
  const context = yield* Layer.build(GitHubClient.layerFromToken({ ...transport, token, budgetLabel: hash }));
  const client = Context.get(context, GitHubClient);
  return yield* client.requestDecoded("GET /user", {}, UserLogin).pipe(
    Effect.map(({ login }) => userLabelOf(login)),
    Effect.orElseSucceed(O.none<GithubIdentityLabel>)
  );
}, Effect.scoped);

const appLabelOf = (input: GithubIdentityLabelInput): GithubIdentityLabel =>
  pipe(
    O.all({ appId: input.appId, installationId: input.installationId }),
    O.flatMap(({ appId, installationId }) => GithubIdentityLabel.makeOption(`app:${appId}/${installationId}`)),
    O.getOrElse(() => UNRESOLVED_IDENTITY)
  );

// gh's own login describes the gh token only when no env token overrides it.
const ghCliLoginOf = Effect.fnUntraced(function* (input: GithubIdentityLabelInput) {
  const envToken = yield* ghEnvToken;
  return input.kind === "gh-cli" && O.isNone(envToken)
    ? yield* readGhCliLogin(input.cwd)
    : O.none<GithubIdentityLabel>();
});

const opRefLoginOf = Effect.fnUntraced(function* (input: GithubIdentityLabelInput) {
  if (input.kind !== "op-ref" || O.isNone(input.tokenRef)) return O.none<GithubIdentityLabel>();
  const tokenRef = input.tokenRef.value;
  const entries = yield* Effect.flatten(GithubConfiguredIdentities);
  return pipe(
    entries,
    A.filter(ConfiguredGithubIdentity.guards.OpRef),
    A.findFirst((entry) => entry.tokenRef === tokenRef),
    O.flatMap((entry) => userLabelOf(entry.login))
  );
});

const resolveTokenLabel = Effect.fnUntraced(function* (
  ledger: GithubBudgetLedger["Service"],
  input: GithubIdentityLabelInput,
  token: Redacted.Redacted<string>
) {
  const hash = yield* tokenHashLabel(token);
  const remember = (user: GithubIdentityLabel) => Effect.as(ledger.recordAlias(hash, user), O.some(user));
  const login = yield* ghCliLoginOf(input);
  if (O.isSome(login)) return yield* remember(login.value);
  const known = yield* ledger.aliases;
  const aliased = canonicalIdentity(known)(hash);
  if (aliased !== hash) return O.some(aliased);
  const configured = yield* opRefLoginOf(input);
  if (O.isSome(configured)) return yield* remember(configured.value);
  const looked = yield* lookupUser(token, hash, input.transport);
  return O.isSome(looked) ? yield* remember(looked.value) : O.some(hash);
});

/**
 * Resolve the budget label of a client's identity, or none when no ledger is
 * provided (then nothing is spawned and no request is made).
 *
 * **Example** (No ledger, no label)
 *
 * ```ts
 * import { resolveGithubIdentityLabel } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const resolve = resolveGithubIdentityLabel({
 *   kind: "github-app", tokenRef: O.none(), appId: O.some("1"), installationId: O.some(2),
 *   token: O.none(), cwd: process.cwd(), transport: {}
 * })
 * console.log(Effect.isEffect(resolve)) // true
 * ```
 *
 * @param input - The identity, its token, the `gh` working directory and the transport settings.
 * @returns The label, or none without a ledger.
 * @category constructors
 * @since 0.0.0
 */
export const resolveGithubIdentityLabel = Effect.fn("GithubIdentityLabel.resolve")(function* (
  input: GithubIdentityLabelInput
): Effect.fn.Return<O.Option<GithubIdentityLabel>, never, ChildProcessSpawner.ChildProcessSpawner | Digest.Digest> {
  const ledger = yield* Effect.serviceOption(GithubBudgetLedger);
  if (O.isNone(ledger)) return O.none();
  if (input.kind === "github-app") return O.some(appLabelOf(input));
  if (O.isNone(input.token)) return O.some(UNRESOLVED_IDENTITY);
  return yield* resolveTokenLabel(ledger.value, input, input.token.value);
});
