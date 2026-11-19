import { OrgId } from "@proto/kernel/Ids";
import { ContactSource } from "@proto/party-model/Evidence/ContactSource.external";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import { MailboxPoller } from "./MailboxPoller.singleton.ts";
import { thunkEffectVoid } from "@beep/utils/thunk"

/**
 * The poller: every minute, read the mailbox through the port the model
 * declared and assert what it found through `IntakeApi`, the same door every
 * other caller uses, presenting the credential it was given. The boundary
 * admits it as a process acting for a human, so its assertions are rooted
 * at that human. The upstream id is the command id, so a redelivered
 * finding applies once.
 *
 * **Example** (The poller's Layer, before a pool is provided)
 * ```ts
 * import { mailboxPollerLive } from "@proto/party-host/Evidence/MailboxPoller.handler";
 *
 * const poller = mailboxPollerLive({
 *   main: "file:///app/PartyMailboxPoller.ts",
 *   mailbox: "intake",
 *   org: "org_acme",
 *   credential: { authorization: "Fixture process:MailboxPoller@p_intake" },
 * });
 * ```
 *
 * @category cluster
 * @since 0.0.0
 */
export const mailboxPollerLive = (options: {
  readonly main: string;
  readonly mailbox: string;
  readonly org: string;
  readonly credential: Headers.Input;
}) =>
  MailboxPoller.make(
    { main: options.main },
    // The ports and the cursor, then the poll they drive.
    Effect.map(
      Effect.all({ source: Effect.service(ContactSource), intake: Effect.service(IntakeApi.Client), lastSeen: Ref.make(0) }, { concurrency: 1 }),
      ({ source, intake, lastSeen }) => {
      const org = OrgId.make(options.org);
      return Effect.gen(function* () {
        const since = yield* Ref.get(lastSeen);
        const now = yield* Clock.currentTimeMillis;
        const { assertions } = yield* source.observe({ mailbox: options.mailbox, since });
        yield* Effect.forEach(
          assertions,
          (found) =>
            intake
              .AssertClaim(
                found.claimId,
                { org, proposition: found.proposition, signals: found.signals },
                { commandId: found.sourceId, headers: options.credential },
              )
              .pipe(Effect.catchTag("ClaimAlreadyAsserted", thunkEffectVoid)),
          { concurrency: 1, discard: true },
        );
        yield* Ref.set(lastSeen, now);
      }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.orDie);
      },
    ),
  );
