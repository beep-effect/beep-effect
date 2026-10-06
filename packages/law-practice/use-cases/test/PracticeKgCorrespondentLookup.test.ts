import {
  PracticeKgAttorneyLinkSource,
  PracticeKgContactLinkSource,
  PracticeKgCorrespondentCandidate,
  PracticeKgCorrespondentContact,
  PracticeKgCorrespondentEvidence,
  PracticeKgCorrespondentLink,
  PracticeKgInferredLinkSource,
  resolvePracticeKgCorrespondent,
} from "@beep/law-practice-use-cases/server";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const contact = (contactId: string, roleAddress = false) =>
  PracticeKgCorrespondentContact.make({ contactId, displayName: "Pat Example", organization: null, roleAddress });

const link = (source: PracticeKgContactLinkSource, familyKey: string | null, clientNumber = "11111") =>
  PracticeKgCorrespondentLink.make({
    clientNumber,
    contactId: "c_aaaaaaaaaaaa",
    evidence: "fixture",
    familyKey,
    source,
  });

const candidate = PracticeKgCorrespondentCandidate.make({
  ccCount: 0,
  client: "11111",
  clientName: null,
  familyKey: "11111.20001",
  firstAt: null,
  fromCount: 1,
  lastAt: null,
  messageCount: 1,
  toCount: 0,
});

const decide = (fields: Partial<PracticeKgCorrespondentEvidence>) => {
  const decision = resolvePracticeKgCorrespondent(
    PracticeKgCorrespondentEvidence.make({
      candidates: [],
      contacts: [contact("c_aaaaaaaaaaaa")],
      links: [],
      practiceAddress: false,
      ...fields,
    })
  );
  return [decision.resolution, decision.familyKey];
};

describe("practice KG correspondent lookup contract", () => {
  it("splits the link sources into the attorney's own and the inferred, covering every source once", () => {
    expect(A.length(PracticeKgAttorneyLinkSource.literals) + A.length(PracticeKgInferredLinkSource.literals)).toBe(
      A.length(PracticeKgContactLinkSource.literals)
    );
    expect(PracticeKgInferredLinkSource.literals).toStrictEqual(["org-name-match", "email-subject-ref"]);
  });

  it("resolves uniquely only from the attorney's own links naming one matter", () => {
    expect(
      decide({ links: [link("attorney-answer", "11111.20001"), link("attorney-filed-email", "11111.20001")] })
    ).toStrictEqual(["unique", "11111.20001"]);
  });

  it("never resolves uniquely from counts, inferred links, or a split", () => {
    expect([
      decide({ candidates: [candidate] }),
      decide({ links: [link("org-name-match", "11111.20001")] }),
      decide({ links: [link("email-subject-ref", "11111.20001")] }),
      decide({ links: [link("attorney-answer", "11111.20001"), link("attorney-pc-folder", "22222.30002", "22222")] }),
      decide({ links: [link("attorney-answer", "11111.20001"), link("attorney-pc-folder", null)] }),
      decide({ links: [link("attorney-answer", null)] }),
    ]).toStrictEqual(A.replicate(["ambiguous", null], 6));
  });

  it("refuses role mailboxes, practice addresses, shared and unknown addresses", () => {
    const named = [link("attorney-answer", "11111.20001")];
    expect([
      decide({ contacts: [contact("c_aaaaaaaaaaaa", true)], links: named }),
      decide({ links: named, practiceAddress: true }),
      decide({ contacts: [contact("c_aaaaaaaaaaaa"), contact("c_bbbbbbbbbbbb")], links: named }),
      decide({ contacts: [], links: named }),
    ]).toStrictEqual(A.replicate(["ambiguous", null], 4));
    expect(decide({ contacts: [] })).toStrictEqual(["none", null]);
  });
});
