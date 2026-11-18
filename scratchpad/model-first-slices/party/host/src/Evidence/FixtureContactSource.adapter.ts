import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { ContactSource } from "@proto/party-model/Evidence/ContactSource.external";
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
            signals: [EvidenceSignal.make({ source: mailbox, quote: "From: Dana Smith <dana@acme.test>" })],
          },
        ],
      }),
  }),
);
