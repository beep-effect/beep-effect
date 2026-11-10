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
  if (input.kind === "github-app") {
    return O.some(
      pipe(
        O.all({ appId: input.appId, installationId: input.installationId }),
        O.flatMap(({ appId, installationId }) => GithubIdentityLabel.makeOption(`app:${appId}/${installationId}`)),
        O.getOrElse(() => UNRESOLVED_IDENTITY)
      )
    );
  }
  if (O.isNone(input.token)) return O.some(UNRESOLVED_IDENTITY);
  const token = input.token.value;
  const hash = yield* tokenHashLabel(token);
  const remember = (user: GithubIdentityLabel) => Effect.as(ledger.value.recordAlias(hash, user), O.some(user));
  // gh's own login describes the gh token only when no env token overrides it.
  const ghToken = yield* configStringOption("GH_TOKEN");
  const githubToken = yield* configStringOption("GITHUB_TOKEN");
  const envToken = O.orElse(O.filter(ghToken, Str.isNonEmpty), () => O.filter(githubToken, Str.isNonEmpty));
  if (input.kind === "gh-cli" && O.isNone(envToken)) {
    const login = yield* readGhCliLogin(input.cwd);
    if (O.isSome(login)) return yield* remember(login.value);
  }
  const known = yield* ledger.value.aliases;
  const aliased = canonicalIdentity(known)(hash);
  if (aliased !== hash) return O.some(aliased);
  if (input.kind === "op-ref" && O.isSome(input.tokenRef)) {
    const tokenRef = input.tokenRef.value;
    const entries = yield* Effect.flatten(GithubConfiguredIdentities);
    const configured = pipe(
      entries,
      A.findFirst((entry) => ConfiguredGithubIdentity.guards.OpRef(entry) && entry.tokenRef === tokenRef),
      O.flatMap((entry) => (ConfiguredGithubIdentity.guards.OpRef(entry) ? userLabelOf(entry.login) : O.none()))
    );
    if (O.isSome(configured)) return yield* remember(configured.value);
  }
  const looked = yield* lookupUser(token, hash, input.transport);
  return O.isSome(looked) ? yield* remember(looked.value) : O.some(hash);
});
