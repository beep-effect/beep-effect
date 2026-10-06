/**
 * Wire shapes the account poller reads: the local proxy's stored-login files
 * and each provider's plan-limit usage response.
 *
 * **Gotchas**
 *
 * Both usage endpoints are undocumented: the providers' own CLIs call them for
 * their usage views, and either shape can change without notice. A response
 * that stops decoding surfaces as a `Failed` outcome for that account.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { AccountLabel, UsageWindow } from "./Accounts.schemas.ts";

const $I = $RepoCliId.create("commands/Accounts/Accounts.wire.schemas");

/**
 * The fields of a proxy stored-login file the poller needs.
 *
 * **Example** (Decode a login file)
 *
 * ```ts
 * import { ProxyAuthFileJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(ProxyAuthFileJson.decodeOption("{}"))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProxyAuthFile extends S.Class<ProxyAuthFile>($I`ProxyAuthFile`)(
  {
    type: S.String,
    email: AccountLabel,
    access_token: S.RedactedFromValue(S.String, { label: "access_token" }),
    account_id: S.optionalKey(S.String),
    disabled: S.optionalKey(S.Boolean),
  },
  $I.annote("ProxyAuthFile", { description: "Provider, identity, and access token of one proxy stored login." })
) {}

/**
 * JSON-string codec for {@link ProxyAuthFile}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const ProxyAuthFileJson = JsonStringCodec(ProxyAuthFile);

const ClaudeLimit = S.Struct({
  kind: S.String,
  percent: S.Finite,
  resets_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
  scope: S.OptionFromNullOr(
    S.Struct({ model: S.OptionFromNullOr(S.Struct({ display_name: S.OptionFromNullOr(S.String) })) })
  ),
});

const ClaudeLegacyWindow = S.Struct({
  utilization: S.OptionFromNullOr(S.Finite),
  resets_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
});

/**
 * Claude's plan-limit usage response.
 *
 * **Details**
 *
 * `limits` is the normalized list; `five_hour` and `seven_day` are the older
 * fields, read only when `limits` is absent. An expired login can answer with
 * an `error` body, so the error is part of the shape.
 *
 * **Example** (Decode an error body)
 *
 * ```ts
 * import { ClaudeUsageBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * const body = ClaudeUsageBodyJson.decodeOption('{"error":{"type":"authentication_error","message":"expired"}}')
 * console.log(O.isSome(body)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeUsageBody extends S.Class<ClaudeUsageBody>($I`ClaudeUsageBody`)(
  {
    limits: ClaudeLimit.pipe(S.Array, S.optionalKey),
    five_hour: ClaudeLegacyWindow.pipe(S.NullOr, S.optionalKey),
    seven_day: ClaudeLegacyWindow.pipe(S.NullOr, S.optionalKey),
    error: S.optionalKey(S.Struct({ type: S.String, message: S.String })),
  },
  $I.annote("ClaudeUsageBody", { description: "Claude plan-limit windows, or the error an expired login returns." })
) {}

/**
 * JSON-string codec for {@link ClaudeUsageBody}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const ClaudeUsageBodyJson = JsonStringCodec(ClaudeUsageBody);

const claudeLimitWindow = (limit: typeof ClaudeLimit.Type): O.Option<UsageWindow> => {
  const window = (kind: UsageWindow["kind"], scope: O.Option<string>) =>
    O.some(UsageWindow.make({ kind, scope, usedPercent: limit.percent, resetsAt: limit.resets_at }));
  if (limit.kind === "session") return window("session", O.none());
  if (limit.kind === "weekly_all") return window("weekly", O.none());
  if (limit.kind === "weekly_scoped") {
    return window(
      "weekly-scoped",
      limit.scope.pipe(
        O.flatMap((scope) => scope.model),
        O.flatMap((model) => model.display_name)
      )
    );
  }
  return O.none();
};

const claudeLegacyWindow = (
  kind: UsageWindow["kind"],
  legacy: typeof ClaudeLegacyWindow.Type | null | undefined
): O.Option<UsageWindow> =>
  O.fromNullishOr(legacy).pipe(
    O.flatMap((window) =>
      O.map(window.utilization, (usedPercent) =>
        UsageWindow.make({ kind, scope: O.none(), usedPercent, resetsAt: window.resets_at })
      )
    )
  );

/**
 * The usage windows in a Claude response.
 *
 * **Example** (Read no windows from an error body)
 *
 * ```ts
 * import { ClaudeUsageBody, claudeUsageWindows } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(claudeUsageWindows(ClaudeUsageBody.make({})).length) // 0
 * ```
 *
 * @param body - The decoded response.
 * @returns Session, weekly, and model-scoped weekly windows, in the provider's order.
 * @category utilities
 * @since 0.0.0
 */
export const claudeUsageWindows = (body: ClaudeUsageBody): ReadonlyArray<UsageWindow> =>
  O.fromNullishOr(body.limits).pipe(
    O.filter(A.isReadonlyArrayNonEmpty),
    O.map((limits) => A.getSomes(A.map(limits, claudeLimitWindow))),
    O.getOrElse(() =>
      A.getSomes([claudeLegacyWindow("session", body.five_hour), claudeLegacyWindow("weekly", body.seven_day)])
    )
  );

const CodexWindow = S.Struct({
  used_percent: S.Finite,
  limit_window_seconds: S.Finite,
  reset_at: S.Finite,
});

/**
 * Codex's plan-limit usage response.
 *
 * **Example** (Decode a response without limits)
 *
 * ```ts
 * import { CodexUsageBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(CodexUsageBodyJson.decodeOption('{"plan_type":"pro"}'))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodexUsageBody extends S.Class<CodexUsageBody>($I`CodexUsageBody`)(
  {
    plan_type: S.String.pipe(S.NullOr, S.optionalKey),
    rate_limit: S.Struct({
      primary_window: CodexWindow.pipe(S.NullOr, S.optionalKey),
      secondary_window: CodexWindow.pipe(S.NullOr, S.optionalKey),
    }).pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("CodexUsageBody", { description: "Codex plan type and its rate-limit windows." })
) {}

/**
 * JSON-string codec for {@link CodexUsageBody}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const CodexUsageBodyJson = JsonStringCodec(CodexUsageBody);

// Codex puts a window of any length in either slot (a Pro plan reports its
// weekly window as `primary_window`), so the kind comes from the duration.
const SESSION_WINDOW_MAX_SECONDS = 86_400;

const codexWindow = (wire: typeof CodexWindow.Type | null | undefined): O.Option<UsageWindow> =>
  O.map(O.fromNullishOr(wire), (window) =>
    UsageWindow.make({
      kind: window.limit_window_seconds <= SESSION_WINDOW_MAX_SECONDS ? "session" : "weekly",
      scope: O.none(),
      usedPercent: window.used_percent,
      resetsAt: O.some(DateTime.makeUnsafe(window.reset_at * 1000)),
    })
  );

/**
 * The usage windows in a Codex response.
 *
 * **Example** (Read no windows without limits)
 *
 * ```ts
 * import { CodexUsageBody, codexUsageWindows } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(codexUsageWindows(CodexUsageBody.make({})).length) // 0
 * ```
 *
 * @param body - The decoded response.
 * @returns The windows present, each classified by its duration.
 * @category utilities
 * @since 0.0.0
 */
export const codexUsageWindows = (body: CodexUsageBody): ReadonlyArray<UsageWindow> =>
  O.fromNullishOr(body.rate_limit).pipe(
    O.map((limit) => A.getSomes([codexWindow(limit.primary_window), codexWindow(limit.secondary_window)])),
    O.getOrElse(() => A.empty<UsageWindow>())
  );
