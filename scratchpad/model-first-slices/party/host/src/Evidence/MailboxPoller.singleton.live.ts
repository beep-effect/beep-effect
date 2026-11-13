import { system } from "@proto/kernel/Actor";
import { ContactSource } from "@proto/party/Evidence/ContactSource.external";
import { IntakeApi } from "@proto/party/IntakeApi.api";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import { sessionAs } from "../Session.middleware.live.ts";
import { MailboxPoller } from "./MailboxPoller.singleton.ts";

/**
 * The poller: every minute, read the mailbox through the port the model
 * declared and assert what it found through `IntakeApi`, the same door every
 * other caller uses. The upstream id is the command id, so a redelivered
 * finding applies once.
 *
 * **Example** (The poller's Layer, before a pool is provided)
 * ```ts
 * import { mailboxPollerLive } from "@proto/party-host/Evidence/MailboxPoller.singleton.live";
 *
 * const poller = mailboxPollerLive({ main: "file:///app/PartyMailboxPoller.ts", mailbox: "intake", org: "org_acme" });
 * ```
 *
 * @category cluster
 * @since 0.0.0
 */
export const mailboxPollerLive = (options: {
  readonly main: string;
  readonly mailbox: string;
  readonly org: string;
}) =>
  MailboxPoller.make(
    { main: options.main },
    Effect.gen(function* () {
      const source = yield* ContactSource;
      const intake = yield* IntakeApi.Client;
      const lastSeen = yield* Ref.make(0);
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
                { proposition: found.proposition, signals: found.signals },
                { commandId: found.sourceId },
              )
              .pipe(Effect.catchTag("ClaimAlreadyAsserted", () => Effect.void)),
          { concurrency: 1, discard: true },
        );
        yield* Ref.set(lastSeen, now);
      }).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.orDie);
    }),
  );

/**
 * `IntakeApi.Client` in process, acting as the poller (a `System` actor in
 * one org), over a hosted Party model. Provide the hosted model's Layer to it.
 *
 * **Example** (The poller's client over an in-memory model)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { intakeAsPoller } from "@proto/party-host/Evidence/MailboxPoller.singleton.live";
 * import { hostParty } from "@proto/party-host/Host";
 * import * as Layer from "effect/Layer";
 *
 * const client = intakeAsPoller("org_acme").pipe(Layer.provide(hostParty(Domain.InMemory)));
 * ```
 *
 * @category cluster
 * @since 0.0.0
 */
export const intakeAsPoller = (org: string) =>
  IntakeApi.layerClientInProcess.pipe(Layer.provide(sessionAs(system("MailboxPoller", org))));
