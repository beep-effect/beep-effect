/**
 * Synthetic-testable vault section administration; apply remains operator-only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import { ChildProcess } from "effect/process";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { OutputBound, runCapturedStreams } from "../../internal/process/StepExec.ts";
import { AccountsError } from "./Accounts.errors.ts";
import { AccountsSecretField, AccountsSecretsItem } from "./AccountsSecretsLayout.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";

const $I = $RepoCliId.create("commands/Accounts/AccountsSecretsLayout.service");
const Prefix = LiteralKit([
  "AI",
  "CLOUD",
  "CRM",
  "CRYPTO",
  "DEV",
  "DMS",
  "DNS",
  "LEGAL",
  "PAYMENTS",
  "RESEARCH",
  "SOCIAL",
]);
const unprefixed: Readonly<Record<string, typeof Prefix.Type>> = {
  CODERABBIT_API_KEY: "AI",
  COGNEE_CLOUD_API_KEY: "AI",
  FISH_AUDIO_API_KEY: "AI",
  MCP_GATEWAY_AUTH_TOKEN: "AI",
  NOTION_PAT: "AI",
  OMI_API_KEY: "AI",
  OMI_MCP_KEY: "AI",
  SUPPIXEL_API_KEY: "AI",
  TYPESAFE_AI_API_KEY: "AI",
  PULUMI_ENCRYPTION_PASSPHRASE: "CLOUD",
  TAILSCALE_API_ACCESS_TOKEN: "CLOUD",
  TAILSCALE_AUTH_KEY: "CLOUD",
  BEEP_CI_RUNNER_APP_ID: "DEV",
  BEEP_CI_RUNNER_CLIENT_ID: "DEV",
  BEEP_TEST_DATABASE_URL: "DEV",
  BETTER_AUTH_API_KEY: "DEV",
  BUZZ_IDENTITY_KEY: "DEV",
  GITHUB_TOKEN: "DEV",
  OBS_SERVER_IP: "DEV",
  OBS_SERVER_PASSWORD: "DEV",
  OMOIDE_CURATION_CREDENTIAL_TOKEN: "DEV",
  OP_SERVICE_ACCOUNT_TOKEN: "DEV",
  SOURCEGRAPH_ACCESS_TOKEN: "DEV",
  EPO_CONSUMER_KEY: "LEGAL",
  EPO_CONSUMER_SECRET_KEY: "LEGAL",
  PATENT_DEV_ACCESS_CODE: "LEGAL",
  USPTO_API_KEY: "LEGAL",
  DATA_GOV_API_KEY: "RESEARCH",
  BEEP_IP_BOT_TOKEN: "SOCIAL",
  SPOTIFY_CLIENT_ID: "SOCIAL",
  SPOTIFY_CLIENT_SECRET: "SOCIAL",
  X_API_BEARER_TOKEN: "SOCIAL",
};
const isNote = (field: AccountsSecretField) => field.id === "notesPlain" || O.contains("NOTES")(field.purpose);
const error = (message: string) => AccountsError.make({ reason: "decode", message });
const fieldOrder = Order.mapInput(
  Order.String,
  (field: AccountsSecretField) =>
    `${O.getOrElse(
      O.map(field.section, (section) => section.label),
      () => ""
    )}\0${field.label}`
);

/**
 * Hashes every field attribute except section, in stable field-id order.
 *
 * **Example** (Prepare an identity digest)
 * ```ts
 * import { secretsLayoutIdentity } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 * Effect.isEffect(secretsLayoutIdentity([])) // => true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const secretsLayoutIdentity = Effect.fn("Accounts.secretsLayoutIdentity")(function* (
  fields: ReadonlyArray<AccountsSecretField>
) {
  const stable = A.map(
    A.sort(
      fields,
      Order.mapInput(Order.String, (field: AccountsSecretField) => field.id)
    ),
    (field) => ({ ...field, section: O.none() })
  );
  const text = yield* S.encodeEffect(AccountsSecretField.pipe(S.Array, S.fromJsonString))(stable);
  return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
});

/**
 * Groups non-note fields by their reviewed section without changing identity.
 *
 * **Example** (Prepare a lossless transform)
 * ```ts
 * import { layoutSecretsItem } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * Effect.isEffect(layoutSecretsItem({ fields: [], sections: [], version: O.none() })) // => true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const layoutSecretsItem = Effect.fn("Accounts.layoutSecretsItem")(
  function* (item: AccountsSecretsItem) {
    const rest = yield* Effect.forEach(
      A.filter(item.fields, (field) => !isNote(field)),
      (field) => {
        const prefix = O.orElse(R.get(unprefixed, field.label), () =>
          A.findFirst(Prefix.literals, (candidate) => Str.startsWith(`${candidate}_`)(field.label))
        );
        return O.match(prefix, {
          onNone: () => Effect.fail(error("Unmapped field label; add a reviewed prefix or mapping before applying.")),
          onSome: (label) => Effect.succeed({ ...field, section: O.some({ id: Str.toLowerCase(label), label }) }),
        });
      }
    );
    const fields = [...A.filter(item.fields, isNote), ...A.sort(rest, fieldOrder)];
    const sections = A.map(
      A.filter(Prefix.literals, (label) =>
        A.some(rest, (field) => O.exists(field.section, (section) => section.label === label))
      ),
      (label) => ({ id: Str.toLowerCase(label), label })
    );
    const laid: AccountsSecretsItem = { ...item, fields, sections };
    if ((yield* secretsLayoutIdentity(item.fields)) !== (yield* secretsLayoutIdentity(laid.fields)))
      return yield* error("Refusing: layout changed field identity.");
    return laid;
  },
  Effect.mapError((cause) =>
    S.is(AccountsError)(cause) ? cause : error("Cannot transform secret layout without changing field identity.")
  )
);

/**
 * Administrative command contract; successful output contains layout metadata only.
 *
 * @category services
 * @since 0.0.0
 */
export interface AccountsSecretsLayoutShape {
  readonly run: (apply: boolean) => Effect.Effect<ReadonlyArray<string>, AccountsError>;
}

/**
 * Explicit dry-run and operator-only apply boundary for vault layout.
 *
 * **Example** (Prepare a dry run)
 * ```ts
 * import { AccountsSecretsLayout } from "@beep/repo-cli/test/Accounts"
 * import * as Effect from "effect/Effect"
 * Effect.isEffect(AccountsSecretsLayout.use((service) => service.run(false))) // => true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AccountsSecretsLayout extends Context.Service<AccountsSecretsLayout, AccountsSecretsLayoutShape>()(
  $I`AccountsSecretsLayout`
) {}

const make = Effect.fn("AccountsSecretsLayout.make")(function* () {
  const runtime = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
  return AccountsSecretsLayout.of({
    run: Effect.fn("AccountsSecretsLayout.run")(
      function* (apply) {
        const config = yield* Config.all({
          vault: Config.String("BEEP_SECRETS_VAULT").pipe(Config.withDefault("BEEP_SECRETS")),
          item: Config.String("BEEP_SECRETS_ITEM").pipe(Config.withDefault("BEEP_SECRETS")),
          op: Config.String("OP_BIN").pipe(Config.withDefault("op")),
        });
        if (apply && config.op !== "op-human")
          return yield* AccountsError.make({
            reason: "denied",
            message: "Apply is operator-only: use OP_BIN=op-human with --apply.",
          });
        const read = yield* runCapturedStreams({
          command: config.op,
          args: ["item", "get", config.item, "--vault", config.vault, "--format", "json"],
          stdoutBound: OutputBound.make({ maxChars: 8 * 1024 * 1024, truncatedNotice: "" }),
          stderrBound: OutputBound.make({ maxChars: 0, truncatedNotice: "" }),
          trim: false,
        }).pipe(Effect.option);
        if (O.isNone(read) || read.value.exitCode !== 0 || read.value.truncated) {
          yield* runCapturedStreams({
            command: "op-doctor",
            args: [],
            bound: OutputBound.make({ maxChars: 4096, truncatedNotice: "" }),
          }).pipe(Effect.ignore);
          return yield* AccountsError.make({
            reason: "io",
            message: "op item get failed; op-doctor ran once. Secret operation stopped.",
          });
        }
        const item = yield* S.decodeEffect(S.fromJsonString(AccountsSecretsItem))(read.value.stdout).pipe(
          Effect.mapError(() => error("Cannot decode item metadata; no values were rendered."))
        );
        const laid = yield* layoutSecretsItem(item);
        const summary = `${laid.fields.length} fields, sections: ${A.join(
          A.map(laid.sections, (section) => section.label),
          " "
        )}`;
        if (!apply)
          return [
            ...A.map(
              laid.fields,
              (field) =>
                `${O.getOrElse(
                  O.map(field.section, (section) => section.label),
                  () => "(top)"
                )}\t${field.label}`
            ),
            summary,
          ];
        const text = yield* S.encodeEffect(S.fromJsonString(AccountsSecretsItem))(laid);
        const edited = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* ChildProcess.make(
              config.op,
              ["item", "edit", config.item, "--vault", config.vault, "--format", "json"],
              { stdin: Stream.make(new TextEncoder().encode(text)), stdout: "pipe", stderr: "ignore" }
            );
            const [code, output] = yield* Effect.all(
              [handle.exitCode, handle.stdout.pipe(Stream.decodeText, Stream.mkString)],
              { concurrency: "unbounded" }
            );
            return { code, output };
          })
        ).pipe(Effect.option);
        if (O.isNone(edited) || edited.value.code !== 0) {
          yield* runCapturedStreams({
            command: "op-doctor",
            args: [],
            bound: OutputBound.make({ maxChars: 4096, truncatedNotice: "" }),
          }).pipe(Effect.ignore);
          return yield* AccountsError.make({
            reason: "io",
            message: "op item edit failed; op-doctor ran once. Secret operation stopped.",
          });
        }
        const confirmed = yield* S.decodeEffect(S.fromJsonString(AccountsSecretsItem))(edited.value.output).pipe(
          Effect.mapError(() => error("Cannot decode item-edit confirmation; no values were rendered."))
        );
        return [`written version ${O.getOrElse(confirmed.version, () => 0)}: ${summary}`];
      },
      Effect.mapError((cause) =>
        S.is(AccountsError)(cause)
          ? cause
          : AccountsError.make({ reason: "io", message: "Secret layout operation failed; no values were rendered." })
      ),
      Effect.provide(runtime)
    ),
  });
});

/**
 * Live layout administration without a startup secret read.
 *
 * **Example** (Inspect the administrative layer)
 * ```ts
 * import { AccountsSecretsLayoutLive } from "@beep/repo-cli/test/Accounts"
 * import * as Layer from "effect/Layer"
 * Layer.isLayer(AccountsSecretsLayoutLive) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AccountsSecretsLayoutLive = Layer.effect(AccountsSecretsLayout, make());
