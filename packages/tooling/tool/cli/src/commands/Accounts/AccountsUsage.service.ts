/**
 * The account usage poller: reads the local proxy's stored logins and asks
 * each provider how full that account's plan limits are.
 *
 * **Details**
 *
 * The poller never writes a login and never refreshes one. The proxy owns the
 * files under its auth directory and keeps their access tokens fresh; reading
 * them leaves no second copy of a refresh token that could invalidate the
 * proxy's own.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Config, Context, Duration, Effect, FileSystem, Layer, Path, Redacted } from "effect";
import * as A from "effect/Array";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AccountsError } from "./Accounts.errors.ts";
import { AccountProvider, AccountRef, AccountUsage, AccountUsageOutcome } from "./Accounts.schemas.ts";
import {
  ClaudeUsageBodyJson,
  CodexUsageBodyJson,
  claudeUsageWindows,
  codexUsageWindows,
  ProxyAuthFileJson,
} from "./Accounts.wire.schemas.ts";
import type { PlatformError } from "effect";
import type { ProxyAuthFile } from "./Accounts.wire.schemas.ts";

const $I = $RepoCliId.create("commands/Accounts/AccountsUsage.service");

/**
 * Service contract: list the accounts the proxy holds a login for, and poll
 * one account's plan limits.
 *
 * **Details**
 *
 * `poll` never fails: a missing login, a rejected token, a network error, or
 * an undecodable response becomes that account's outcome, so one bad account
 * cannot hide the others.
 *
 * **Example** (Poll every account)
 *
 * ```ts
 * import { pollAccounts } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(pollAccounts)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AccountsUsageShape {
  readonly accounts: Effect.Effect<ReadonlyArray<AccountRef>, AccountsError>;
  readonly poll: (account: AccountRef) => Effect.Effect<AccountUsage>;
}

/**
 * Context tag for the account usage poller.
 *
 * **Example** (Request the poller)
 *
 * ```ts
 * import { AccountsUsage } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* AccountsUsage }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AccountsUsage extends Context.Service<AccountsUsage, AccountsUsageShape>()($I`AccountsUsage`) {}

const CLAUDE_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const REQUEST_TIMEOUT = Duration.seconds(20);
const POLL_CONCURRENCY = 4;

const isProvider = S.is(AccountProvider);

const mapPlatformError = (cause: PlatformError.PlatformError): AccountsError =>
  AccountsError.make({
    reason: cause.reason._tag === "PermissionDenied" ? "denied" : "io",
    message: cause.message,
    cause,
  });

const byProviderThenLabel = Order.combine(
  Order.mapInput(Order.String, (account: AccountRef) => account.provider),
  Order.mapInput(Order.String, (account: AccountRef) => account.label)
);

const loginRejected = AccountUsageOutcome.cases.NeedsLogin.make({
  detail: "the provider rejected the proxy's stored login; sign this account in to the proxy again",
});

const failed = (detail: string) => AccountUsageOutcome.cases.Failed.make({ detail });

const isRejectedStatus = (status: number): boolean => status === 401 || status === 403;

/**
 * Turn a Claude usage response into an outcome.
 *
 * **Example** (Read an expired login)
 *
 * ```ts
 * import { claudeUsageOutcome } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const outcome = claudeUsageOutcome({
 *   identity: O.none(),
 *   status: 200,
 *   body: '{"error":{"type":"authentication_error","message":"expired"}}',
 * })
 * console.log(outcome._tag) // "NeedsLogin"
 * ```
 *
 * @param response - The account's identity, the HTTP status, and the body text.
 * @returns The windows, a re-login request, or the failure.
 * @category utilities
 * @since 0.0.0
 */
export const claudeUsageOutcome = (response: {
  readonly identity: O.Option<string>;
  readonly status: number;
  readonly body: string;
}): AccountUsageOutcome => {
  if (isRejectedStatus(response.status)) return loginRejected;
  return O.match(ClaudeUsageBodyJson.decodeOption(response.body), {
    onNone: () => failed(`Claude usage answered HTTP ${response.status} with a body this version cannot read`),
    onSome: (body) => {
      // Claude answers an expired token with HTTP 200 and an error body.
      if (body.error !== undefined) {
        return body.error.type === "authentication_error" ? loginRejected : failed(body.error.message);
      }
      return AccountUsageOutcome.cases.Ok.make({
        identity: response.identity,
        plan: O.none(),
        windows: claudeUsageWindows(body),
      });
    },
  });
};

/**
 * Turn a Codex usage response into an outcome.
 *
 * **Example** (Read a rejected login)
 *
 * ```ts
 * import { codexUsageOutcome } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(codexUsageOutcome({ identity: O.none(), status: 401, body: "" })._tag) // "NeedsLogin"
 * ```
 *
 * @param response - The account's identity, the HTTP status, and the body text.
 * @returns The windows, a re-login request, or the failure.
 * @category utilities
 * @since 0.0.0
 */
export const codexUsageOutcome = (response: {
  readonly identity: O.Option<string>;
  readonly status: number;
  readonly body: string;
}): AccountUsageOutcome => {
  if (isRejectedStatus(response.status)) return loginRejected;
  if (response.status !== 200) return failed(`Codex usage answered HTTP ${response.status}`);
  return O.match(CodexUsageBodyJson.decodeOption(response.body), {
    onNone: () => failed("Codex usage answered with a body this version cannot read"),
    onSome: (body) =>
      AccountUsageOutcome.cases.Ok.make({
        identity: response.identity,
        plan: O.fromNullishOr(body.plan_type),
        windows: codexUsageWindows(body),
      }),
  });
};

const usageRequest = (provider: AccountProvider, login: ProxyAuthFile): HttpClientRequest.HttpClientRequest => {
  const token = Redacted.value(login.access_token);
  return AccountProvider.$match(provider, {
    claude: () =>
      HttpClientRequest.get(CLAUDE_USAGE_URL).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("anthropic-beta", "oauth-2025-04-20")
      ),
    codex: () =>
      HttpClientRequest.get(CODEX_USAGE_URL).pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("user-agent", "codex-cli"),
        O.match(O.fromNullishOr(login.account_id), {
          onNone: () => (request: HttpClientRequest.HttpClientRequest) => request,
          onSome: (accountId) => HttpClientRequest.setHeader("chatgpt-account-id", accountId),
        })
      ),
  });
};

const toOutcome = (provider: AccountProvider) =>
  AccountProvider.$match(provider, { claude: () => claudeUsageOutcome, codex: () => codexUsageOutcome });

/**
 * Resolve the proxy's auth directory: `BEEP_ACCOUNTS_AUTH_DIR` when set, else
 * `$HOME/.cli-proxy-api`.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { resolveAccountsAuthDir } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveAccountsAuthDir)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveAccountsAuthDir = Effect.gen(function* () {
  const configured = yield* Config.option(Config.String("BEEP_ACCOUNTS_AUTH_DIR"));
  if (O.isSome(configured) && Str.isNonEmpty(Str.trim(configured.value))) return configured.value;
  return `${yield* Config.String("HOME")}/.cli-proxy-api`;
}).pipe(
  Effect.mapError((cause) =>
    AccountsError.make({ reason: "usage", message: "Could not resolve the proxy auth directory.", cause })
  ),
  Effect.withSpan("AccountsUsage.resolveAuthDir")
);

/**
 * Build the live poller over the proxy's auth directory and the HTTP client in
 * context.
 *
 * **Example** (Build the live poller effect)
 *
 * ```ts
 * import { makeAccountsUsageLive } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeAccountsUsageLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeAccountsUsageLive = Effect.fn("AccountsUsage.makeLive")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = yield* HttpClient.HttpClient;
  const directory = yield* resolveAccountsAuthDir;

  const readLogin = (source: string) =>
    fs
      .readFileString(source)
      .pipe(Effect.map(ProxyAuthFileJson.decodeOption), Effect.orElseSucceed(O.none<ProxyAuthFile>));

  const accountAt = Effect.fnUntraced(function* (source: string) {
    const login = yield* readLogin(source);
    return O.flatMap(login, (file) =>
      isProvider(file.type) && file.disabled !== true
        ? O.some(AccountRef.make({ provider: file.type, label: file.email, source }))
        : O.none()
    );
  });

  const accounts = fs.readDirectory(directory).pipe(
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound" ? Effect.succeed(A.empty<string>()) : Effect.fail(mapPlatformError(error))
    ),
    Effect.map(A.filter(Str.endsWith(".json"))),
    Effect.flatMap(Effect.forEach((name) => accountAt(path.join(directory, name)), { concurrency: POLL_CONCURRENCY })),
    Effect.map(A.getSomes),
    Effect.map(A.sort(byProviderThenLabel)),
    Effect.withSpan("AccountsUsage.accounts")
  );

  const poll = Effect.fn("AccountsUsage.poll")(function* (account: AccountRef) {
    const login = yield* readLogin(account.source);
    if (O.isNone(login)) {
      return AccountUsage.make({
        account,
        outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "the proxy holds no readable login for it" }),
      });
    }
    const outcome = yield* client.execute(usageRequest(account.provider, login.value)).pipe(
      Effect.flatMap((response) =>
        Effect.map(response.text, (body) =>
          toOutcome(account.provider)({ identity: O.some(login.value.email), status: response.status, body })
        )
      ),
      Effect.timeoutOption(REQUEST_TIMEOUT),
      Effect.map(O.getOrElse(() => failed(`no answer within ${Duration.format(REQUEST_TIMEOUT)}`))),
      Effect.catchTag("HttpClientError", (error) => Effect.succeed(failed(error.message)))
    );
    return AccountUsage.make({ account, outcome });
  });

  return AccountsUsage.of({ accounts, poll });
});

/**
 * Live poller layer. Requires `FileSystem`, `Path`, and `HttpClient`.
 *
 * **Example** (Provide the live poller)
 *
 * ```ts
 * import { AccountsUsage, layerAccountsUsageLive } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* AccountsUsage }).pipe(Effect.provide(layerAccountsUsageLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerAccountsUsageLive = Layer.effect(AccountsUsage, makeAccountsUsageLive());

/**
 * Poll every account the proxy holds a login for.
 *
 * **Example** (Build the poll effect)
 *
 * ```ts
 * import { pollAccounts } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(pollAccounts)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const pollAccounts = Effect.gen(function* () {
  const usage = yield* AccountsUsage;
  return yield* Effect.forEach(yield* usage.accounts, usage.poll, { concurrency: POLL_CONCURRENCY });
}).pipe(Effect.withSpan("AccountsUsage.pollAll"));
