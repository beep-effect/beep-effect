import { ClaimId } from "@proto/party/Claim/Claim.id";
import { ContactSource } from "@proto/party/Evidence/ContactSource.external";
import { PartyId } from "@proto/party/Party/Party.id";
import { Proposition } from "@proto/party/Proposition";
import * as Effect from "effect/Effect";

/**
 * A mailbox that always holds the same one finding. Stands where a vendor
 * adapter (Graph, IMAP) would; the same contract tests run against both.
 *
 * **Example** (Provide the fixture mailbox)
 * ```ts
 * import { FixtureContactSource } from "@proto/party-host/Evidence/FixtureContactSource.adapter";
 *
 * const layer = FixtureContactSource;
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export const FixtureContactSource = ContactSource.toLayer(
  Effect.succeed({
    observe: ({ mailbox }) =>
      Effect.succeed({
        assertions: [
          {
            sourceId: `${mailbox}/msg-1`,
            claimId: ClaimId.make(`${mailbox}/msg-1`),
            proposition: Proposition.cases.HasIdentifier.make({
              party: PartyId.make("party_dana"),
              scheme: "email",
              value: "dana@acme.test",
            }),
            signals: [{ source: mailbox, excerpt: "From: Dana Smith <dana@acme.test>" }],
          },
        ],
      }),
  }),
);
