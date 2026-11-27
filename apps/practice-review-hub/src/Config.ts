/**
 * Settings of the review hub, from flags or the environment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeReviewHubId } from "@beep/identity/packages";
import { NoticeClaudeFolder } from "@beep/law-practice-server/NoticeMailbox";
import { Port } from "@beep/schema/Port";
import { splitCommaSeparatedTrimmed } from "@beep/utils/Text";
import * as Config from "effect/Config";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $PracticeReviewHubId.create("Config");

/**
 * **Example** (Decode the settings)
 *
 * ```ts
 * import { ReviewHubConfig } from "@/Config"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * const config = S.decodeUnknownEffect(ReviewHubConfig)({
 *   apiToken: Redacted.make("synthetic-test-token-with-32-characters"),
 *   allowedLogins: ["attorney@example.test"],
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   port: 8787
 * })
 * Effect.runPromise(config).then(({ port }) => console.log(port)) // 8787
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewHubConfig extends S.Opaque<ReviewHubConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    apiToken: S.Redacted(S.String.check(S.isMinLength(32), S.isMaxLength(256)), {
      disallowJsonEncode: true,
    }).annotateKey({
      description: "Independent application credential required in addition to the proxy login header.",
    }),
    allowedLogins: S.NonEmptyArray(S.NonEmptyString).annotateKey({
      description: "Tailscale logins (the Tailscale-User-Login header) allowed to call the hub; any other gets 403.",
    }),
    dataDirectory: S.NonEmptyString.annotateKey({
      description: "Directory of the hub's verdict, answer and item files.",
    }),
    port: Port.annotateKey({
      description: "Loopback port the hub listens on; tailscale serve exposes it on the tailnet.",
    }),
  }).pipe($I.annoteSchema("ReviewHubConfig", { description: "Resolved settings of the review hub." }))
) {}

const DEFAULT_PORT = 8787;

const dataDirectoryFlag = Flag.String("data-dir").pipe(
  Flag.withFallbackConfig(Config.String("PRACTICE_REVIEW_HUB_DATA_DIR")),
  Flag.withDescription("Directory of the hub's verdict, answer and item files.")
);

/**
 * Command-line flags of `serve`, each falling back to its environment
 * variable.
 *
 * **Details**
 *
 * `--port` falls back to `PORT`, then 8787; `--allowed-logins` (comma
 * separated) to `PRACTICE_REVIEW_HUB_ALLOWED_LOGINS`; `--data-dir` to
 * `PRACTICE_REVIEW_HUB_DATA_DIR`. The application token is read separately
 * from `PRACTICE_REVIEW_HUB_API_TOKEN` and is never a command-line flag.
 *
 * **Example** (List the flags)
 *
 * ```ts
 * import { reviewHubFlags } from "@/Config"
 *
 * console.log(Object.keys(reviewHubFlags)) // ["allowedLogins", "dataDirectory", "port"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const reviewHubFlags = {
  allowedLogins: Flag.String("allowed-logins").pipe(
    Flag.withFallbackConfig(Config.String("PRACTICE_REVIEW_HUB_ALLOWED_LOGINS")),
    Flag.withDescription("Comma-separated Tailscale logins allowed to call the hub.")
  ),
  dataDirectory: dataDirectoryFlag,
  port: Flag.Int("port").pipe(
    Flag.withFallbackConfig(Config.Int("PORT")),
    Flag.withDefault(DEFAULT_PORT),
    Flag.withDescription("Loopback port to listen on.")
  ),
};

/**
 * Decode the parsed flags into the hub's settings.
 *
 * **Example** (Decode parsed flags)
 *
 * ```ts
 * import { decodeReviewHubConfig } from "@/Config"
 * import * as Effect from "effect/Effect"
 *
 * import * as ConfigProvider from "effect/ConfigProvider"
 *
 * const config = decodeReviewHubConfig({
 *   allowedLogins: "attorney@example.test, paralegal@example.test",
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   port: 8787
 * })
 * const provider = ConfigProvider.fromUnknown({
 *   PRACTICE_REVIEW_HUB_API_TOKEN: "synthetic-test-token-with-32-characters"
 * })
 * Effect.runPromise(config.pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider)))
 *   .then(({ allowedLogins }) => console.log(allowedLogins.length)) // 2
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const decodeReviewHubConfig = Effect.fn("ReviewHubConfig.decode")(function* (flags: {
  readonly allowedLogins: string;
  readonly dataDirectory: string;
  readonly port: number;
}) {
  const apiToken = yield* Config.Redacted("PRACTICE_REVIEW_HUB_API_TOKEN");
  return yield* S.decodeUnknownEffect(ReviewHubConfig)({
    ...flags,
    apiToken,
    allowedLogins: splitCommaSeparatedTrimmed(flags.allowedLogins),
  });
});

/**
 * **Details**
 *
 * `claudeFolder` is the folder on the attorney's PC that the notice's
 * "Answer them in Claude Code" link opens; with none, the notice stays plain
 * text.
 *
 * **Example** (Decode the notice settings)
 *
 * ```ts
 * import { ReviewNoticeConfig } from "@/Config"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(ReviewNoticeConfig)({
 *   claudeFolder: O.some("C:/Users/attorney/Review"),
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   timeZone: "America/Chicago"
 * })
 * console.log(O.getOrElse(config.claudeFolder, () => "none")) // "C:/Users/attorney/Review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewNoticeConfig extends S.Opaque<ReviewNoticeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    claudeFolder: S.Option(NoticeClaudeFolder).annotateKey({
      description: "Absolute Windows folder the notice's Claude Code link opens; none sends the plain notice.",
    }),
    dataDirectory: S.NonEmptyString.annotateKey({
      description: "Directory of the hub's item and answer files, and of the notice's last-sent day.",
    }),
    timeZone: S.TimeZoneNamedFromString.annotateKey({
      description: "IANA time zone the notice's day is counted in.",
    }),
  }).pipe($I.annoteSchema("ReviewNoticeConfig", { description: "Resolved settings of the daily notice." }))
) {}

/**
 * Command-line flags of `notice`: `--data-dir` and `--time-zone`, falling
 * back to `PRACTICE_REVIEW_HUB_DATA_DIR` and `PRACTICE_REVIEW_HUB_TIME_ZONE`,
 * and the optional `--claude-folder`, falling back to
 * `PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER`.
 *
 * **Details**
 *
 * The mailbox connection is not a flag: it comes from the
 * `PRACTICE_REVIEW_NOTICE_*` environment variables, which `op run` resolves.
 * When neither `--claude-folder` nor its variable is set, `claudeFolder` is
 * none and the notice has no Claude Code link.
 *
 * **Example** (List the flags)
 *
 * ```ts
 * import { reviewNoticeFlags } from "@/Config"
 *
 * console.log(Object.keys(reviewNoticeFlags)) // ["claudeFolder", "dataDirectory", "timeZone"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const reviewNoticeFlags = {
  claudeFolder: Flag.String("claude-folder").pipe(
    Flag.withFallbackConfig(Config.String("PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER")),
    Flag.optional,
    Flag.withDescription(
      "Absolute Windows folder on the attorney's PC, such as C:/Users/attorney/Review, that the email's Claude Code answer link opens."
    )
  ),
  dataDirectory: dataDirectoryFlag,
  timeZone: Flag.String("time-zone").pipe(
    Flag.withFallbackConfig(Config.String("PRACTICE_REVIEW_HUB_TIME_ZONE")),
    Flag.withDescription("IANA time zone the notice's day is counted in, such as America/Chicago.")
  ),
};
