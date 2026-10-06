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
import { resolveWorkstationStateDir } from "../../internal/state/WorkstationState.ts";
import { AccountsError } from "./Accounts.errors.ts";
import {
  AccountProvider,
  AccountRef,
  AccountSnapshotJson,
  AccountUsage,
  AccountUsageOutcome,
} from "./Accounts.schemas.ts";
import {
  ClaudeUsageBodyJson,
  CodexUsageBodyJson,
  claudeCreditBalances,
  claudeUsageWindows,
  codexCreditBalances,
  codexLimitResets,
  codexUsageWindows,
  grokUsageWindows,
  MuseKeyBodyJson,
  museUsageWindows,
  ProxyAuthFileJson,
} from "./Accounts.wire.schemas.ts";
import type { PlatformError } from "effect";
import type { AccountSnapshot } from "./Accounts.schemas.ts";
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
 * cannot hide the others. `snapshots` reads the usage a local collector wrote
 * for providers the poller cannot read itself; an unreadable snapshot file is
 * skipped.
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
  readonly snapshots: Effect.Effect<ReadonlyArray<AccountUsage>, AccountsError>;
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
const MUSE_KEY_URL = "https://api.meta.ai/muse-code/key";
const GROK_BILLING_URL = "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";
// An empty gRPC-web request: one uncompressed frame holding a zero-length message.
const GROK_EMPTY_REQUEST = new Uint8Array(5);
const REQUEST_TIMEOUT = Duration.seconds(20);
const POLL_CONCURRENCY = 4;

const isPolledProvider = S.is(AccountProvider);

// The proxy names a stored login by its upstream; the report names the product.
const providerOfLoginType = (type: string): O.Option<AccountProvider> =>
  type === "claude" || type === "codex"
    ? O.some(type)
    : type === "meta"
      ? O.some("muse")
      : type === "xai"
        ? O.some("grok")
        : O.none();

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
        credits: claudeCreditBalances(response.body),
        limitResets: O.none(),
        asOf: O.none(),
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
        credits: codexCreditBalances(body),
        limitResets: codexLimitResets(body),
        asOf: O.none(),
      }),
  });
};

/**
 * Turn a Muse Code key response into an outcome.
 *
 * **Example** (Read an idle account)
 *
 * ```ts
 * import { museUsageOutcome } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const outcome = museUsageOutcome({ identity: O.none(), status: 200, body: '{"subs_tier_name":"Muse Code Everyday Usage"}' })
 * console.log(outcome._tag) // "Ok"
 * ```
 *
 * @param response - The account's identity, the HTTP status, and the body text.
 * @returns The windows, a re-login request, or the failure.
 * @category utilities
 * @since 0.0.0
 */
export const museUsageOutcome = (response: {
  readonly identity: O.Option<string>;
  readonly status: number;
  readonly body: string;
}): AccountUsageOutcome => {
  if (isRejectedStatus(response.status)) return loginRejected;
  if (response.status !== 200) return failed(`Muse Code answered HTTP ${response.status}`);
  return O.match(MuseKeyBodyJson.decodeOption(response.body), {
    onNone: () => failed("Muse Code answered with a body this version cannot read"),
    onSome: (body) =>
      AccountUsageOutcome.cases.Ok.make({
        identity: response.identity,
        plan: O.fromNullishOr(body.subs_tier_name),
        windows: museUsageWindows(body),
        credits: [],
        limitResets: O.none(),
        asOf: O.none(),
      }),
  });
};

/**
 * Turn a Grok Build billing reply into an outcome.
 *
 * **Example** (Read a rejected login)
 *
 * ```ts
 * import { grokUsageOutcome } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(grokUsageOutcome({ identity: O.none(), status: 401, body: new Uint8Array(0) })._tag) // "NeedsLogin"
 * ```
 *
 * @param response - The account's identity, the HTTP status, and the body bytes.
 * @returns The weekly window, a re-login request, or the failure.
 * @category utilities
 * @since 0.0.0
 */
export const grokUsageOutcome = (response: {
  readonly identity: O.Option<string>;
  readonly status: number;
  readonly body: Uint8Array;
}): AccountUsageOutcome => {
  if (isRejectedStatus(response.status)) return loginRejected;
  if (response.status !== 200) return failed(`Grok billing answered HTTP ${response.status}`);
  return O.match(grokUsageWindows(response.body), {
    onNone: () => failed("Grok billing answered with a body this version cannot read"),
    onSome: (windows) =>
      AccountUsageOutcome.cases.Ok.make({
        identity: response.identity,
        plan: O.none(),
        windows,
        credits: [],
        limitResets: O.none(),
        asOf: O.none(),
      }),
  });
};

const sameAccount = (left: AccountUsage, right: AccountUsage): boolean =>
  left.account.provider === right.account.provider && left.account.label === right.account.label;

const isOk = (usage: AccountUsage): boolean => usage.outcome._tag === "Ok";

/**
 * Keep one row per account when the proxy holds several logins for it: a
 * readable login hides an unreadable duplicate, and the first readable one
 * wins.
 *
 * **Example** (Drop nothing from an empty poll)
 *
 * ```ts
 * import { dedupeAccountUsages } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(dedupeAccountUsages([]).length) // 0
 * ```
 *
 * @param usages - Every polled login.
 * @returns One usage per provider and label.
 * @category utilities
 * @since 0.0.0
 */
export const dedupeAccountUsages = (usages: ReadonlyArray<AccountUsage>): ReadonlyArray<AccountUsage> =>
  A.filter(usages, (usage, index) => {
    const twins = A.filter(usages, (other) => sameAccount(usage, other));
    const preferred = O.getOrElse(A.findFirst(twins, isOk), () => usage);
    return preferred === usage && A.findFirstIndex(usages, (other) => other === usage).pipe(O.contains(index));
  });

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

  const fetchText = (
    request: HttpClientRequest.HttpClientRequest,
    identity: O.Option<string>,
    toOutcome: (response: {
      readonly identity: O.Option<string>;
      readonly status: number;
      readonly body: string;
    }) => AccountUsageOutcome
  ) =>
    Effect.flatMap(client.execute(request), (response) =>
      Effect.map(response.text, (body) => toOutcome({ identity, status: response.status, body }))
    );

  const fetchOutcome = (provider: AccountProvider, login: ProxyAuthFile) => {
    const identity = O.some(login.email);
    const token = Redacted.value(login.access_token);
    return AccountProvider.$match(provider, {
      claude: () =>
        fetchText(
          HttpClientRequest.get(CLAUDE_USAGE_URL).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("anthropic-beta", "oauth-2025-04-20")
          ),
          identity,
          claudeUsageOutcome
        ),
      codex: () =>
        fetchText(
          HttpClientRequest.get(CODEX_USAGE_URL).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("user-agent", "codex-cli"),
            HttpClientRequest.setHeaders(
              O.match(O.fromNullishOr(login.account_id), {
                onNone: () => ({}),
                onSome: (accountId) => ({ "chatgpt-account-id": accountId }),
              })
            )
          ),
          identity,
          codexUsageOutcome
        ),
      // Meta's CLI reads its usage from the key endpoint, which answers with
      // the key the proxy already holds; the call changes nothing.
      muse: () =>
        O.match(O.fromNullishOr(login.dca_token), {
          onNone: () =>
            Effect.succeed(
              AccountUsageOutcome.cases.NeedsLogin.make({ detail: "the proxy's Muse login carries no device token" })
            ),
          onSome: (deviceToken) =>
            fetchText(
              HttpClientRequest.post(MUSE_KEY_URL).pipe(
                HttpClientRequest.bearerToken(Redacted.value(deviceToken)),
                HttpClientRequest.setHeader("user-agent", "muse-code/1.0.2"),
                HttpClientRequest.acceptJson,
                HttpClientRequest.bodyJsonUnsafe({ dca_token: Redacted.value(deviceToken) })
              ),
              identity,
              museUsageOutcome
            ),
        }),
      grok: () =>
        Effect.flatMap(
          client.execute(
            HttpClientRequest.post(GROK_BILLING_URL).pipe(
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.setHeader("x-grpc-web", "1"),
              HttpClientRequest.bodyUint8Array(GROK_EMPTY_REQUEST, "application/grpc-web+proto")
            )
          ),
          (response) =>
            Effect.map(response.arrayBuffer, (buffer) =>
              grokUsageOutcome({ identity, status: response.status, body: new Uint8Array(buffer) })
            )
        ),
    });
  };

  const accountAt = Effect.fnUntraced(function* (source: string) {
    const login = yield* readLogin(source);
    return O.flatMap(login, (file) =>
      file.disabled === true
        ? O.none()
        : O.map(providerOfLoginType(file.type), (provider) => AccountRef.make({ provider, label: file.email, source }))
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
    if (!isPolledProvider(account.provider)) {
      return AccountUsage.make({ account, outcome: failed(`${account.provider} is read from a snapshot, not polled`) });
    }
    const outcome = yield* fetchOutcome(account.provider, login.value).pipe(
      Effect.timeoutOption(REQUEST_TIMEOUT),
      Effect.map(O.getOrElse(() => failed(`no answer within ${Duration.format(REQUEST_TIMEOUT)}`))),
      Effect.catchTag("HttpClientError", (error) => Effect.succeed(failed(error.message)))
    );
    return AccountUsage.make({ account, outcome });
  });

  const snapshotDirectory = yield* resolveWorkstationStateDir({
    override: "BEEP_ACCOUNTS_SNAPSHOT_DIR",
    store: "accounts",
  }).pipe(
    Effect.mapError((cause) =>
      AccountsError.make({ reason: "usage", message: "Could not resolve the accounts snapshot directory.", cause })
    )
  );

  const snapshotAt = (source: string) =>
    fs.readFileString(source).pipe(
      Effect.map(AccountSnapshotJson.decodeOption),
      Effect.orElseSucceed(O.none<AccountSnapshot>),
      Effect.map(
        O.map((snapshot) =>
          AccountUsage.make({
            account: AccountRef.make({ provider: snapshot.provider, label: snapshot.label, source }),
            outcome: AccountUsageOutcome.cases.Ok.make({
              identity: O.some(snapshot.label),
              plan: snapshot.plan,
              windows: snapshot.windows,
              credits: [],
              limitResets: O.none(),
              asOf: O.some(snapshot.capturedAt),
            }),
          })
        )
      )
    );

  const snapshots = fs.readDirectory(snapshotDirectory).pipe(
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound" ? Effect.succeed(A.empty<string>()) : Effect.fail(mapPlatformError(error))
    ),
    Effect.map(A.filter(Str.endsWith(".json"))),
    Effect.flatMap(
      Effect.forEach((name) => snapshotAt(path.join(snapshotDirectory, name)), { concurrency: POLL_CONCURRENCY })
    ),
    Effect.map(A.getSomes),
    Effect.withSpan("AccountsUsage.snapshots")
  );

  return AccountsUsage.of({ accounts, poll, snapshots });
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
  const polled = yield* Effect.forEach(yield* usage.accounts, usage.poll, { concurrency: POLL_CONCURRENCY });
  return dedupeAccountUsages(A.appendAll(polled, yield* usage.snapshots));
}).pipe(Effect.withSpan("AccountsUsage.pollAll"));
