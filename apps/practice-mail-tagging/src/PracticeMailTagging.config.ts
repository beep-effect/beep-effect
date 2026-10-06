/**
 * Typed settings of the practice mail-tagging job, read through `effect/Config`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BoxCcgConfig, BoxDeveloperTokenConfig } from "@beep/box";
import { $PracticeMailTaggingId } from "@beep/identity/packages";
import { M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365";
import { Config } from "effect";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PracticeMailTaggingId.create("PracticeMailTagging.config");

const defaultPageSize = 50;
const defaultRunLabel = "practice-mail-tagging";
const defaultSince = DateTime.makeUnsafe("2026-07-01T00:00:00Z");
const defaultPollInterval = Duration.minutes(5);
const defaultMaxBackoff = Duration.hours(1);
const minimumPollInterval = Duration.minutes(1);
const stateDirectoryUnderHome = ".local/state/beep/practice-mail-tagging";

const PageSize = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive page size" })).annotate({
  identifier: $I`PageSize`,
  title: "PageSize",
  description: "Messages requested per mailbox listing page; an integer greater than zero.",
});

/**
 * Every setting of the mail-tagging job that this app owns.
 *
 * **Details**
 *
 * The paths are private operator state. None has a default except the state
 * directory, which falls back to a directory under `HOME`. `pollInterval` is
 * never shorter than one minute, whatever the environment says.
 *
 * **Example** (Build the settings by hand)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import { PracticeMailTaggingConfig } from "@/PracticeMailTagging.config"
 *
 * const config = PracticeMailTaggingConfig.make({
 *   stateDirectory: "state/practice-mail-tagging",
 *   mailboxUserId: "attorney@example.test",
 *   kgBundleDirectory: "state/practice-kg-bundle",
 *   folderMapPath: "state/box-onboarding/matter-folders.json",
 *   knownDocumentsPath: "state/box-onboarding/box-files.jsonl",
 *   boxCallLedgerPath: "state/box-api-calls.jsonl",
 *   excludedFolderIds: [],
 *   runLabel: "practice-mail-tagging",
 *   pageSize: 50,
 *   since: DateTime.makeUnsafe("2026-07-01T00:00:00Z"),
 *   pollInterval: Duration.minutes(5),
 *   maxBackoff: Duration.hours(1)
 * })
 * console.log(config.pageSize) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class PracticeMailTaggingConfig extends S.Class<PracticeMailTaggingConfig>($I`PracticeMailTaggingConfig`)(
  {
    stateDirectory: S.NonEmptyString.annotateKey({
      description: "Directory holding the ledgers, the checkpoint, and the contacts overlay.",
    }),
    mailboxUserId: S.NonEmptyString.annotateKey({
      description: "Mailbox address or object id the job tags.",
    }),
    kgBundleDirectory: S.NonEmptyString.annotateKey({
      description: "Directory of the practice knowledge-graph bundle; its DuckDB file is opened read-only.",
    }),
    folderMapPath: S.NonEmptyString.annotateKey({
      description: "Full path of the matter folder-id map JSON file.",
    }),
    knownDocumentsPath: S.NonEmptyString.annotateKey({
      description: "Full path of the known-documents JSONL index.",
    }),
    boxCallLedgerPath: S.NonEmptyString.annotateKey({
      description: "Full path of the shared Box API-call JSONL ledger.",
    }),
    excludedFolderIds: S.Array(S.String).annotateKey({
      description: "Graph ids of extra mail folders to leave out, besides Deleted Items and Junk.",
    }),
    runLabel: S.NonEmptyString.annotateKey({
      description: "Prefix of each pass's label in the Box API-call ledger.",
    }),
    pageSize: PageSize.annotateKey({
      description: "Messages requested per mailbox listing page.",
    }),
    since: S.DateTimeUtcFromString.annotateKey({
      description: "Instant the backfill starts from when no checkpoint exists.",
    }),
    pollInterval: S.Duration.annotateKey({
      description: "Pause between two watch passes; at least one minute.",
    }),
    maxBackoff: S.Duration.annotateKey({
      description: "Longest pause after consecutive failed watch passes.",
    }),
  },
  $I.annote("PracticeMailTaggingConfig", {
    description: "Every setting of the mail-tagging job that this app owns.",
  })
) {}

/**
 * Reads the state directory: the configured one, or the default under `HOME`.
 *
 * **When to use**
 *
 * Use when a command needs the ledgers and the checkpoint only, such as
 * `report`, so it runs without mailbox or Box settings.
 *
 * **Example** (Read the state directory from a provider)
 *
 * ```ts
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import { stateDirectoryConfig } from "@/PracticeMailTagging.config"
 *
 * const program = stateDirectoryConfig.parse(ConfigProvider.fromUnknown({ HOME: "/home/operator" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const stateDirectoryConfig: Config.Config<string> = Config.NonEmptyString(
  "PRACTICE_MAIL_TAGGING_STATE_DIRECTORY"
).pipe(
  Config.orElse(() =>
    Config.map(Config.NonEmptyString("HOME"), (home) => `${Str.replace(/\/+$/, "")(home)}/${stateDirectoryUnderHome}`)
  )
);

/**
 * Reads every app-owned setting of the mail-tagging job.
 *
 * **Details**
 *
 * The mailbox falls back to the docket-intake mailbox variable, because both
 * jobs share one Entra registration and one environment file. The knowledge
 * graph bundle, the folder-id map, the known-documents index, and the Box
 * call ledger have no default: a missing one fails the read.
 *
 * **Example** (Read the settings from a provider)
 *
 * ```ts
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import { practiceMailTaggingConfig } from "@/PracticeMailTagging.config"
 *
 * const program = practiceMailTaggingConfig.parse(
 *   ConfigProvider.fromUnknown({
 *     HOME: "/home/operator",
 *     PRACTICE_MAIL_TAGGING_MAILBOX_USER_ID: "attorney@example.test",
 *     PRACTICE_MAIL_TAGGING_KG_BUNDLE_DIRECTORY: "state/practice-kg-bundle",
 *     PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH: "state/matter-folders.json",
 *     PRACTICE_MAIL_TAGGING_KNOWN_DOCUMENTS_PATH: "state/box-files.jsonl",
 *     PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH: "state/box-api-calls.jsonl"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const practiceMailTaggingConfig: Config.Config<PracticeMailTaggingConfig> = Config.all({
  stateDirectory: stateDirectoryConfig,
  mailboxUserId: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_MAILBOX_USER_ID").pipe(
    Config.orElse(() => Config.NonEmptyString("CLOUD_M365_DOCKET_MAILBOX"))
  ),
  kgBundleDirectory: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_KG_BUNDLE_DIRECTORY"),
  folderMapPath: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH"),
  knownDocumentsPath: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_KNOWN_DOCUMENTS_PATH"),
  boxCallLedgerPath: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH"),
  excludedFolderIds: Config.Array(S.NonEmptyString, "PRACTICE_MAIL_TAGGING_EXCLUDED_FOLDER_IDS").pipe(
    Config.withDefault([])
  ),
  runLabel: Config.NonEmptyString("PRACTICE_MAIL_TAGGING_RUN_LABEL").pipe(Config.withDefault(defaultRunLabel)),
  pageSize: Config.schema(PageSize, "PRACTICE_MAIL_TAGGING_PAGE_SIZE").pipe(Config.withDefault(defaultPageSize)),
  since: Config.schema(S.DateTimeUtcFromString, "PRACTICE_MAIL_TAGGING_SINCE").pipe(Config.withDefault(defaultSince)),
  pollInterval: Config.Duration("PRACTICE_MAIL_TAGGING_POLL_INTERVAL").pipe(
    Config.withDefault(defaultPollInterval),
    Config.map(Duration.max(minimumPollInterval))
  ),
  maxBackoff: Config.Duration("PRACTICE_MAIL_TAGGING_MAX_BACKOFF").pipe(Config.withDefault(defaultMaxBackoff)),
}).pipe(Config.map((settings) => PracticeMailTaggingConfig.make(settings)));

// An environment file carries a PEM key on one line with literal `\n` marks.
const restoreLineBreaks = (key: Redacted.Redacted<string>): Redacted.Redacted<string> =>
  key.pipe(Redacted.value, Str.replaceAll("\\n", "\n"), Redacted.make);

/**
 * Reads the Microsoft 365 app-only credential of the docket-intake Entra
 * registration, which this job shares.
 *
 * **Details**
 *
 * The private key stays `Redacted`. A key stored on one line with literal
 * `\n` marks, as an environment file needs, gets its line breaks back.
 *
 * **Example** (Read the app-only credential from a provider)
 *
 * ```ts
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import { m365AppOnlyConfig } from "@/PracticeMailTagging.config"
 *
 * const program = m365AppOnlyConfig.parse(
 *   ConfigProvider.fromUnknown({
 *     CLOUD_M365_DOCKET_TENANT_ID: "tenant-id",
 *     CLOUD_M365_DOCKET_CLIENT_ID: "client-id",
 *     CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256: "AB12",
 *     CLOUD_M365_DOCKET_CERT_PRIVATE_KEY: "placeholder-key"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const m365AppOnlyConfig: Config.Config<M365AppOnlyConfigInput> = Config.all({
  tenantId: Config.NonEmptyString("CLOUD_M365_DOCKET_TENANT_ID"),
  clientId: Config.NonEmptyString("CLOUD_M365_DOCKET_CLIENT_ID"),
  thumbprintSha256: Config.NonEmptyString("CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256"),
  privateKey: Config.schema(S.Redacted(S.NonEmptyString), "CLOUD_M365_DOCKET_CERT_PRIVATE_KEY"),
}).pipe(
  Config.map(({ tenantId, clientId, thumbprintSha256, privateKey }) =>
    M365AppOnlyConfigInput.make({
      tenantId,
      clientId,
      credential: M365CertificateCredential.make({ privateKey: restoreLineBreaks(privateKey), thumbprintSha256 }),
    })
  )
);

/**
 * Box credential the job runs with: the self-refreshing client credentials
 * grant, or a developer token.
 *
 * @category configuration
 * @since 0.0.0
 */
export type BoxCredential = BoxCcgConfig | BoxDeveloperTokenConfig;

const boxClientCredentials = (subjectVariable: string, subjectOf: (id: string) => Partial<BoxCcgConfig>) =>
  Config.all({
    clientId: Config.NonEmptyString("DMS_BOX_CLIENT_ID"),
    clientSecret: Config.Redacted("DMS_BOX_CLIENT_SECRET"),
    subject: Config.NonEmptyString(subjectVariable),
  }).pipe(
    Config.map(
      ({ clientId, clientSecret, subject }): BoxCredential =>
        BoxCcgConfig.make({ clientId, clientSecret, ...subjectOf(subject) })
    )
  );

/**
 * Reads the Box credential under the variable names the repository already
 * uses.
 *
 * **Details**
 *
 * The client credentials grant wins when its client pair and one subject are
 * set, the enterprise subject before the user subject. Otherwise the
 * developer token is read. That token lasts about an hour, so a `watch`
 * process needs the grant.
 *
 * **Example** (Read a developer token from a provider)
 *
 * ```ts
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 * import { boxCredentialConfig } from "@/PracticeMailTagging.config"
 *
 * const program = boxCredentialConfig.parse(ConfigProvider.fromUnknown({ CLOUD_BOX_TOKEN: "placeholder-token" }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const boxCredentialConfig: Config.Config<BoxCredential> = boxClientCredentials(
  "DMS_BOX_ENTERPRISE_ID",
  (enterpriseId) => ({ enterpriseId: O.some(enterpriseId) })
).pipe(
  Config.orElse(() => boxClientCredentials("DMS_BOX_USER_ID", (userId) => ({ userId: O.some(userId) }))),
  Config.orElse(() =>
    Config.map(Config.Redacted("CLOUD_BOX_TOKEN"), (token): BoxCredential => BoxDeveloperTokenConfig.make({ token }))
  )
);
