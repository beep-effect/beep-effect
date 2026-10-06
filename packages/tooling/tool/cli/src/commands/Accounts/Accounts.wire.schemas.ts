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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { AccountLabel, CreditBalance, UsageWindow } from "./Accounts.schemas.ts";

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
    dca_token: S.RedactedFromValue(S.String, { label: "dca_token" }).pipe(S.optionalKey),
    disabled: S.optionalKey(S.Boolean),
  },
  $I.annote("ProxyAuthFile", { description: "Provider, identity, and access token of one proxy stored login." })
) {}

/**
 * JSON-string codec for {@link ProxyAuthFile}.
 *
 * **Example** (Reject malformed text)
 *
 * ```ts
 * import { ProxyAuthFileJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(ProxyAuthFileJson.decodeOption("not-json"))) // true
 * ```
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
 * **Example** (Reject malformed text)
 *
 * ```ts
 * import { ClaudeUsageBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(ClaudeUsageBodyJson.decodeOption("not-json"))) // true
 * ```
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
    credits: S.Struct({
      has_credits: S.Boolean.pipe(S.NullOr, S.optionalKey),
      balance: S.FiniteFromString.pipe(S.NullOr, S.optionalKey),
    }).pipe(S.NullOr, S.optionalKey),
    rate_limit_reset_credits: S.Struct({ available_count: S.Finite }).pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("CodexUsageBody", { description: "Codex plan type and its rate-limit windows." })
) {}

/**
 * JSON-string codec for {@link CodexUsageBody}.
 *
 * **Example** (Reject malformed text)
 *
 * ```ts
 * import { CodexUsageBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(CodexUsageBodyJson.decodeOption("not-json"))) // true
 * ```
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
    O.getOrElse(A.empty<UsageWindow>)
  );

// Claude names its dollar pools with rotating code names, so every top-level
// entry shaped like a pool is read; the names known today get a plain label.
const ClaudeDollarPool = S.Struct({
  limit_dollars: S.Finite,
  remaining_dollars: S.Finite,
  resets_at: S.OptionFromNullOr(S.DateTimeUtcFromString),
});

const decodeClaudeDollarPool = S.decodeUnknownOption(ClaudeDollarPool);
const UnknownRecordJson = JsonStringCodec(S.Record(S.String, S.Unknown));

const claudePoolLabel = (key: string): string => (key === "iguana_necktie" ? "cloud session credits" : key);

/**
 * The dollar credit pools in a Claude usage response.
 *
 * **Example** (Read a pool)
 *
 * ```ts
 * import { claudeCreditBalances } from "@beep/repo-cli/test/Accounts"
 *
 * const pools = claudeCreditBalances('{"iguana_necktie":{"limit_dollars":250,"remaining_dollars":246.5,"resets_at":null}}')
 * console.log(pools.map((pool) => pool.label)) // ["cloud session credits"]
 * ```
 *
 * @param body - The raw response text.
 * @returns One balance per dollar pool, in the provider's order.
 * @category utilities
 * @since 0.0.0
 */
export const claudeCreditBalances = (body: string): ReadonlyArray<CreditBalance> =>
  UnknownRecordJson.decodeOption(body).pipe(
    O.map((record) =>
      A.getSomes(
        A.map(R.toEntries(record), ([key, value]) =>
          O.map(decodeClaudeDollarPool(value), (pool) =>
            CreditBalance.make({
              label: claudePoolLabel(key),
              unit: "usd",
              remaining: pool.remaining_dollars,
              limit: O.some(pool.limit_dollars),
              expiresAt: pool.resets_at,
            })
          )
        )
      )
    ),
    O.getOrElse(A.empty<CreditBalance>)
  );

/**
 * The credit balance in a Codex response, when the account holds credits.
 *
 * **Example** (Read no balance)
 *
 * ```ts
 * import { CodexUsageBody, codexCreditBalances } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(codexCreditBalances(CodexUsageBody.make({})).length) // 0
 * ```
 *
 * @param body - The decoded response.
 * @returns The balance as a one-element list, or nothing.
 * @category utilities
 * @since 0.0.0
 */
export const codexCreditBalances = (body: CodexUsageBody): ReadonlyArray<CreditBalance> =>
  O.fromNullishOr(body.credits).pipe(
    O.filter((credits) => credits.has_credits === true),
    O.flatMap((credits) => O.fromNullishOr(credits.balance)),
    O.map((remaining) =>
      CreditBalance.make({ label: "credits", unit: "credits", remaining, limit: O.none(), expiresAt: O.none() })
    ),
    O.toArray
  );

/**
 * The number of unused limit-reset grants in a Codex response.
 *
 * **Example** (Read no grants)
 *
 * ```ts
 * import { CodexUsageBody, codexLimitResets } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(codexLimitResets(CodexUsageBody.make({})))) // true
 * ```
 *
 * @param body - The decoded response.
 * @returns The count, when the provider reports one.
 * @category utilities
 * @since 0.0.0
 */
export const codexLimitResets = (body: CodexUsageBody): O.Option<number> =>
  O.map(O.fromNullishOr(body.rate_limit_reset_credits), (grants) => grants.available_count);

const MuseWindow = S.Struct({ used_percent: S.Finite, resets_at: S.Finite });

/**
 * Meta's Muse Code key response: the subscription tier and, while a session
 * window is active, the plan-limit usage.
 *
 * **Gotchas**
 *
 * Meta omits `subs_usage` while the five-hour window is idle, so an idle
 * account reads as having no windows.
 *
 * **Example** (Decode an idle response)
 *
 * ```ts
 * import { MuseKeyBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(MuseKeyBodyJson.decodeOption('{"subs_tier_name":"Muse Code Everyday Usage"}'))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MuseKeyBody extends S.Class<MuseKeyBody>($I`MuseKeyBody`)(
  {
    subs_tier_name: S.String.pipe(S.NullOr, S.optionalKey),
    subs_usage: S.Struct({
      window: MuseWindow.pipe(S.NullOr, S.optionalKey),
      weekly: MuseWindow.pipe(S.NullOr, S.optionalKey),
    }).pipe(S.NullOr, S.optionalKey),
  },
  $I.annote("MuseKeyBody", { description: "Muse Code subscription tier and its plan-limit usage." })
) {}

/**
 * JSON-string codec for {@link MuseKeyBody}.
 *
 * **Example** (Reject malformed text)
 *
 * ```ts
 * import { MuseKeyBodyJson } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(MuseKeyBodyJson.decodeOption("not-json"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const MuseKeyBodyJson = JsonStringCodec(MuseKeyBody);

const museWindow = (
  kind: UsageWindow["kind"],
  wire: typeof MuseWindow.Type | null | undefined
): O.Option<UsageWindow> =>
  O.map(O.fromNullishOr(wire), (window) =>
    UsageWindow.make({
      kind,
      scope: O.none(),
      usedPercent: window.used_percent,
      resetsAt: O.some(DateTime.makeUnsafe(window.resets_at * 1000)),
    })
  );

/**
 * The usage windows in a Muse Code key response.
 *
 * **Example** (Read no windows while idle)
 *
 * ```ts
 * import { MuseKeyBody, museUsageWindows } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(museUsageWindows(MuseKeyBody.make({})).length) // 0
 * ```
 *
 * @param body - The decoded response.
 * @returns The session and weekly windows, when Meta reports them.
 * @category utilities
 * @since 0.0.0
 */
export const museUsageWindows = (body: MuseKeyBody): ReadonlyArray<UsageWindow> =>
  O.fromNullishOr(body.subs_usage).pipe(
    O.map((usage) => A.getSomes([museWindow("session", usage.window), museWindow("weekly", usage.weekly)])),
    O.getOrElse(A.empty<UsageWindow>)
  );

// Protobuf wire types: 0 varint, 1 fixed 64-bit, 2 length-delimited, 5 fixed 32-bit.
const ProtoField = S.Struct({
  number: S.Finite,
  wireType: S.Finite,
  varint: S.Finite,
  bytes: S.Uint8Array,
});
type ProtoField = typeof ProtoField.Type;

const NO_BYTES = new Uint8Array(0);

// Read a base-128 varint with arithmetic, not bit shifts: a Unix timestamp in
// seconds already needs more than 31 bits.
const readVarint = (bytes: Uint8Array, start: number): O.Option<readonly [value: number, next: number]> => {
  let value = 0;
  let scale = 1;
  for (let index = start; index < bytes.length && index < start + 10; index += 1) {
    const byte = bytes[index] ?? 0;
    value += (byte % 128) * scale;
    if (byte < 128) return O.some([value, index + 1]);
    scale *= 128;
  }
  return O.none();
};

type ProtoRead = readonly [field: ProtoField, next: number];

const sliceProtoField = (
  bytes: Uint8Array,
  number: number,
  wireType: number,
  from: number,
  end: number
): O.Option<ProtoRead> =>
  end > bytes.length
    ? O.none()
    : O.some<ProtoRead>([{ number, wireType, varint: 0, bytes: bytes.subarray(from, end) }, end]);

const fixedProtoWidth = (wireType: number): O.Option<number> =>
  wireType === 5 ? O.some(4) : wireType === 1 ? O.some(8) : O.none();

const readProtoValue = (bytes: Uint8Array, number: number, wireType: number, start: number): O.Option<ProtoRead> => {
  if (wireType === 0) {
    return O.map(
      readVarint(bytes, start),
      ([varint, next]): ProtoRead => [{ number, wireType, varint, bytes: NO_BYTES }, next]
    );
  }
  if (wireType === 2) {
    return O.flatMap(readVarint(bytes, start), ([length, from]) =>
      sliceProtoField(bytes, number, wireType, from, from + length)
    );
  }
  return O.flatMap(fixedProtoWidth(wireType), (width) =>
    sliceProtoField(bytes, number, wireType, start, start + width)
  );
};

const readProtoField = (bytes: Uint8Array, offset: number): O.Option<ProtoRead> =>
  O.flatMap(readVarint(bytes, offset), ([key, afterTag]) =>
    readProtoValue(bytes, Math.floor(key / 8), key % 8, afterTag)
  );

// Split one protobuf message into its fields. A truncated or unknown field
// ends the read with what was decoded so far.
const protoFields = (bytes: Uint8Array): ReadonlyArray<ProtoField> => {
  let fields = A.empty<ProtoField>();
  let offset = 0;
  while (offset < bytes.length) {
    const read = readProtoField(bytes, offset);
    if (O.isNone(read)) return fields;
    fields = A.append(fields, read.value[0]);
    offset = read.value[1];
  }
  return fields;
};

const protoField = (fields: ReadonlyArray<ProtoField>, number: number, wireType: number): O.Option<ProtoField> =>
  A.findFirst(fields, (field) => field.number === number && field.wireType === wireType);

const float32 = (bytes: Uint8Array): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, true);

// A gRPC-web body is a run of frames: one flag byte (0 = message), a
// big-endian 32-bit length, then the payload. The first message frame is the reply.
const grpcWebMessage = (bytes: Uint8Array): O.Option<Uint8Array> => {
  if (bytes.length < 5 || bytes[0] !== 0) return O.none();
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
  return bytes.length >= 5 + length ? O.some(bytes.subarray(5, 5 + length)) : O.none();
};

/**
 * The weekly pool window in a Grok Build billing reply.
 *
 * **Details**
 *
 * The reply is a gRPC-web framed protobuf message with no published schema.
 * The fields read here were observed on 2026-10-06: message field 1 holds the
 * credits config, whose field 1 is the used percent as a 32-bit float (absent
 * means 0) and whose field 5 is the billing period end as a timestamp.
 *
 * **Example** (Reject a body that is not a gRPC-web frame)
 *
 * ```ts
 * import { grokUsageWindows } from "@beep/repo-cli/test/Accounts"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(grokUsageWindows(new Uint8Array([1, 2, 3])))) // true
 * ```
 *
 * @param body - The raw response bytes.
 * @returns The weekly window, or nothing when the reply cannot be read.
 * @category utilities
 * @since 0.0.0
 */
export const grokUsageWindows = (body: Uint8Array): O.Option<ReadonlyArray<UsageWindow>> =>
  grpcWebMessage(body).pipe(
    O.flatMap((message) => protoField(protoFields(message), 1, 2)),
    O.map((config) => protoFields(config.bytes)),
    O.map((fields) => [
      UsageWindow.make({
        kind: "weekly",
        scope: O.none(),
        usedPercent: O.match(protoField(fields, 1, 5), { onNone: () => 0, onSome: (field) => float32(field.bytes) }),
        resetsAt: protoField(fields, 5, 2).pipe(
          O.flatMap((end) => protoField(protoFields(end.bytes), 1, 0)),
          O.map((seconds) => DateTime.makeUnsafe(seconds.varint * 1000))
        ),
      }),
    ])
  );
