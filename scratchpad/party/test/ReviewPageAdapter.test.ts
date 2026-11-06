import { ActivityId, IdentifierId, OccurrenceId } from "@beep/party-domain/Ids";
import { RecordRow } from "@beep/party-domain/Provenance";
import { IngestIdentifier } from "@beep/party-server/ContactEvidence";
import { identifierOfAddress } from "@beep/party-server/MailIndex";
import { ObservedSpan } from "@beep/party-server/OrgEvidence";
import { CaseEvidence, CaseMailbox, sealCase } from "@beep/party-server/ReviewLoop";
import { PartyId } from "@beep/shared-domain/identity/Party";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  adaptPageDecision,
  encodeReviewPageCases,
  PageDecision,
  PageDecisionInput,
  ReviewPageInput,
} from "../scripts/ReviewPageAdapter.ts";

const fixture = Effect.gen(function* () {
  const identifier = yield* Effect.fromOption(yield* identifierOfAddress("Dana@EXAMPLE.test"));
  const current = yield* sealCase(
    CaseEvidence.make({
      name: "Dana Brooks",
      shape: "full-name",
      outcome: "unresolved",
      orgLead: "same-org-alias",
      mailboxes: [
        CaseMailbox.make({
          party: PartyId.make(2),
          identifiers: [identifier.id],
          domains: ["example.test"],
          span: O.some(ObservedSpan.make({ first: DateTime.makeUnsafe(0), last: DateTime.makeUnsafe(1000) })),
        }),
      ],
    })
  );
  return { identifier, current };
});

describe("review page compatibility", () => {
  it.effect("renders readable canonical addresses, integer parties and ISO dates without changing the basis", () =>
    Effect.gen(function* () {
      const { identifier, current } = yield* fixture;
      const encoded = yield* encodeReviewPageCases(
        ReviewPageInput.make({ cases: [current], identifiers: [identifier] })
      );
      const json = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(encoded);
      expect(json).toEqual([
        {
          name: "Dana Brooks",
          shape: "full-name",
          outcome: "unresolved",
          orgLead: "same-org-alias",
          basis: current.basis,
          mailboxes: [
            {
              party: 2,
              identifiers: ["ident:email:dana%40example.test"],
              domains: ["example.test"],
              firstSeen: "1970-01-01T00:00:00.000Z",
              lastSeen: "1970-01-01T00:00:01.000Z",
            },
          ],
        },
      ]);
    })
  );
  it.effect("rejects missing display evidence and mismatched identifier references", () =>
    Effect.gen(function* () {
      const { identifier, current } = yield* fixture;
      const missing = yield* encodeReviewPageCases(ReviewPageInput.make({ cases: [current], identifiers: [] })).pipe(
        Effect.flip
      );
      expect(missing).toMatchObject({ reason: "missing-identifier" });
      const mismatch = yield* encodeReviewPageCases(
        ReviewPageInput.make({
          cases: [current],
          identifiers: [IngestIdentifier.make({ ...identifier, id: IdentifierId.make("party-ident:wrong") })],
        })
      ).pipe(Effect.flip);
      expect(mismatch).toMatchObject({ reason: "mismatched-identifier" });
    })
  );
  it.effect("enriches a page export with explicit validity and provenance without accepting its verdict", () =>
    Effect.gen(function* () {
      const { current } = yield* fixture;
      const page = yield* S.decodeEffect(PageDecision)({
        name: "Dana Brooks",
        basis: current.basis,
        verdict: { _tag: "Grouped", groups: [[2]] },
        reviewer: "user:reviewer",
        reviewedAt: "2026-11-03T00:00:00Z",
        note: "Checked source",
      });
      const input = PageDecisionInput.make({
        decision: page,
        validity: { validFrom: DateTime.makeUnsafe(100), validTo: O.some(DateTime.makeUnsafe(200)) },
        producedBy: ActivityId.make("party-act:import-review"),
        anchor: RecordRow.make({ occurrence: OccurrenceId.make("party-occ:review-export"), rowKey: "1" }),
      });
      const adapted = adaptPageDecision(input);
      expect(adapted.verdict).toEqual(page.verdict);
      expect(adapted.basis).toBe(current.basis);
      expect(adapted.validity).toEqual(input.validity);
      expect(adapted.anchor).toEqual(input.anchor);
      expect(adapted.reviewer).toBe("party-user:user%3Areviewer");
      expect(DateTime.toEpochMillis(adapted.reviewedAt)).toBe(DateTime.toEpochMillis(page.reviewedAt));
    })
  );
});
