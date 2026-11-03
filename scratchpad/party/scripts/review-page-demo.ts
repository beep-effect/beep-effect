/**
 * Render the unchanged local review page from graduated, fully synthetic evidence.
 * Usage: bun scratchpad/party/scripts/review-page-demo.ts <out.html>
 * @packageDocumentation
 * @since 0.0.0
 */
import { IngestIdentifier } from "@beep/party-server/ContactEvidence";
import { PartyLedgerMemory } from "@beep/party-server/Ledger";
import { identifierOfAddress } from "@beep/party-server/MailIndex";
import { ObservedSpan, OrgLead } from "@beep/party-server/OrgEvidence";
import { CaseEvidence, CaseMailbox, MailboxAnchorInput, mailboxParty, sealCase } from "@beep/party-server/ReviewLoop";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { renderReviewPage } from "./ReviewPage.ts";
import { encodeReviewPageCases, ReviewPageInput } from "./ReviewPageAdapter.ts";

const demo = Effect.fn("review-page-demo")(function* (out: string) {
  const identifiers: Array<IngestIdentifier> = [];
  const mailbox = Effect.fn("review-page-demo.mailbox")(function* (
    email: string,
    domain: string,
    from: number,
    to: number
  ) {
    const identifier = yield* Effect.fromOption(yield* identifierOfAddress(email));
    identifiers.push(identifier);
    const ids = MailboxAnchorInput.make({ identifiers: [identifier.id] });
    return CaseMailbox.make({
      party: yield* mailboxParty(ids),
      identifiers: ids.identifiers,
      domains: [domain],
      span: O.some(
        ObservedSpan.make({
          first: DateTime.makeUnsafe(`${from}-01-01T00:00:00Z`),
          last: DateTime.makeUnsafe(`${to}-01-01T00:00:00Z`),
        })
      ),
    });
  });
  const cases = yield* Effect.forEach(
    [
      {
        name: "chris morgan",
        orgLead: OrgLead.Enum["different-orgs-concurrent"],
        mailboxes: [
          yield* mailbox("chris.morgan@acme.example", "acme.example", 2019, 2023),
          yield* mailbox("chris@acme.example", "acme.example", 2020, 2022),
          yield* mailbox("cmorgan@other.example", "other.example", 2019, 2024),
        ],
      },
      {
        name: "dana brooks",
        orgLead: OrgLead.Enum["same-org-alias"],
        mailboxes: [
          yield* mailbox("dana@acme.example", "acme.example", 2018, 2024),
          yield* mailbox("dbrooks@acme.example", "acme.example", 2021, 2024),
        ],
      },
      {
        name: "sam rivera",
        orgLead: OrgLead.Enum["different-orgs-sequential"],
        mailboxes: [
          yield* mailbox("sam@oldco.example", "oldco.example", 2015, 2018),
          yield* mailbox("sam.rivera@acme.example", "acme.example", 2019, 2025),
        ],
      },
    ],
    Effect.fn("review-page-demo.case")(function* (row) {
      const evidence = yield* S.decodeUnknownEffect(S.toType(CaseEvidence))({
        ...row,
        shape: "full-name",
        outcome: "unresolved",
      });
      return yield* sealCase(evidence);
    })
  );
  const fs = yield* FileSystem.FileSystem;
  const json = yield* encodeReviewPageCases(ReviewPageInput.make({ cases, identifiers }));
  yield* fs.writeFileString(out, renderReviewPage(json));
  yield* Effect.log(`demo page with ${A.length(cases)} synthetic cases: ${out}`);
});

const command = Command.make("review-page-demo", { out: Argument.String("out.html") }, ({ out }) => demo(out));
Command.run(command, { version: "0.0.0" }).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off -- platform and memory-ledger layers are provided once at the script entry point. Owner: @beep/scratchpad. Exit: never while this is a Bun entry script.
  Effect.provide(Layer.mergeAll(BunServices.layer, PartyLedgerMemory)),
  BunRuntime.runMain
);
