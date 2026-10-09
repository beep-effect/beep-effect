/** Counts-only CLI with explicit source paths and separate write confirmation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { M365, M365AppOnlyConfigInput, M365CertificateCredential } from "@beep/m365";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import { Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { contactsMailboxLayer } from "./Contacts.mailbox.ts";
import { ContactInputs, ContactsError } from "./Contacts.schemas.ts";
import { ContactSeeding, contactSeedingLayer } from "./Contacts.service.ts";
import { ContactsStateLive } from "./Contacts.state.ts";

const inputFlags = { csv: Flag.String("csv").pipe(Flag.atLeast(0)), vcf: Flag.String("vcf").pipe(Flag.atLeast(0)) };
const yes = Flag.Boolean("yes").pipe(Flag.withDefault(false));
const privateConfigFailure = () => ContactsError.make({ reason: "input" });
const liveMailbox = Layer.unwrap(
  Effect.gen(function* () {
    const mailbox = yield* Config.String("M365_APP_ONLY_MAILBOX");
    const config = M365AppOnlyConfigInput.make({
      tenantId: yield* Config.String("M365_APP_ONLY_TENANT_ID"),
      clientId: yield* Config.String("M365_APP_ONLY_CLIENT_ID"),
      credential: M365CertificateCredential.make({
        thumbprintSha256: yield* Config.String("M365_APP_ONLY_CERT_THUMBPRINT_SHA256"),
        privateKey: yield* Config.Redacted("M365_APP_ONLY_CERT_PRIVATE_KEY"),
      }),
    });
    return contactsMailboxLayer(mailbox).pipe(Layer.provide(M365.makeAppOnlyLiveLayer(config)));
  }).pipe(Effect.mapError(privateConfigFailure))
);

const print = (value: unknown) => S.encodeEffect(S.fromJsonString(S.Unknown))(value).pipe(Effect.flatMap(Console.log));

/** Build the contact CLI; mailbox selection comes exclusively from the env file.
 * **Example** (Build a CLI)
 * ```ts
 * import { makeContactsCommand } from "@/Contacts.command"
 * console.log(makeContactsCommand("fixture-checkout"))
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const makeContactsCommand = (checkoutRoot: string) => {
  const baseLayer = contactSeedingLayer(checkoutRoot).pipe(Layer.provide(ContactsStateLive));
  const run = <A, E>(offline: boolean, program: Effect.Effect<A, E, ContactSeeding>) =>
    Effect.scoped(
      (offline ? baseLayer : baseLayer.pipe(Layer.provide(liveMailbox))).pipe(
        Layer.build,
        Effect.flatMap((context) => program.pipe(Effect.provideContext(context)))
      )
    ).pipe(Effect.mapError((error) => (S.is(ContactsError)(error) ? error : privateConfigFailure())));
  return Command.make("practice-m365-contacts").pipe(
    Command.withSubcommands([
      Command.make(
        "dry-run",
        {
          ...inputFlags,
          offline: Flag.Boolean("offline").pipe(Flag.withDefault(false)),
          census: Flag.Boolean("census").pipe(Flag.withDefault(false)),
        },
        (flags) =>
          run(
            flags.offline,
            ContactSeeding.use((service) => service.dryRun(ContactInputs.make(flags), flags.offline, flags.census))
          ).pipe(Effect.flatMap(print))
      ),
      Command.make("apply", { ...inputFlags, yes }, (flags) =>
        run(
          false,
          ContactSeeding.use((service) => service.apply(ContactInputs.make(flags), flags.yes))
        ).pipe(Effect.flatMap(print))
      ),
      Command.make("export", { out: Flag.String("out") }, (flags) =>
        run(
          false,
          ContactSeeding.use((service) => service.export(flags.out))
        ).pipe(Effect.flatMap(print))
      ),
      Command.make(
        "undo",
        {
          run: Flag.String("run").pipe(Flag.optional),
          byCategory: Flag.Boolean("by-category").pipe(Flag.withDefault(false)),
          dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)),
          yes,
        },
        (flags) =>
          run(
            false,
            ContactSeeding.use((service) => service.undo(flags.run, flags.byCategory, flags.dryRun, flags.yes))
          ).pipe(Effect.flatMap(print))
      ),
    ])
  );
};
