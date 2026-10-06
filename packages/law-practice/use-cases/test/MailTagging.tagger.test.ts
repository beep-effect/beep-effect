import {
  decisionCategories,
  defaultMailTaxonomy,
  MailConversationId,
  MailTaxonomy,
  MatterClientKey,
  MatterDocketNumber,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
  MatterMatched,
  MatterUnmatched,
  SenderAddressRule,
  UnattributedMatter,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  decideMatterTagging,
  MatterTaggerContext,
  matterCandidates,
  senderRuleCategories,
} from "@beep/law-practice-use-cases/MailTagging";
import { EmailString } from "@beep/schema/Email";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as P from "effect/Predicate";
import { acme, envelope, globex, index, since, taxonomy } from "./MailTagging.fixture.ts";
import type { MailEnvelope } from "@beep/law-practice-domain/values/MailTagging";

const context = MatterTaggerContext.make({ index, taxonomy });
const isMatched = P.isTagged("MatterMatched");
const decide = (message: MailEnvelope) => decideMatterTagging(context, message);
const expectMatched = (message: MailEnvelope, kind: string) => {
  const decision = decide(message);

  expect(decision).toBeInstanceOf(MatterMatched);
  expect(isMatched(decision) && decision.matterKey === acme).toBe(true);
  expect(isMatched(decision) && A.map(decision.evidence, (item) => item.kind)).toStrictEqual([kind]);
};
const expectUnmatched = (message: MailEnvelope, reason: string) => {
  const decision = decide(message);

  expect(decision).toBeInstanceOf(MatterUnmatched);
  expect(!isMatched(decision) && decision.reason).toBe(reason);
};

// The attorney's docket grammar: `<client>.<family><country><sequence>`. Family 10001 is reused by two clients.
const keyed = MatterKey.make("1234.10001");
const reused = MatterKey.make("5678.10001");
const docketed = MatterTaggerContext.make({
  index: MatterIndex.make({
    builtAt: since,
    entries: [
      MatterIndexEntry.make({
        matterKey: keyed,
        clientKey: MatterClientKey.make("1234"),
        docketNumbers: [MatterDocketNumber.make("10001US01"), MatterDocketNumber.make("1234.10001US01")],
      }),
      MatterIndexEntry.make({
        matterKey: reused,
        clientKey: MatterClientKey.make("5678"),
        docketNumbers: [MatterDocketNumber.make("10001US01"), MatterDocketNumber.make("5678.10001US01")],
      }),
    ],
    unattributed: [
      UnattributedMatter.make({ familyKeys: [MatterDocketNumber.make("30003")] }),
      UnattributedMatter.make({ familyKeys: [MatterDocketNumber.make("9999.40004")] }),
    ],
  }),
  taxonomy: defaultMailTaxonomy([keyed, reused]),
});
const docketDecision = (subject: string) => decideMatterTagging(docketed, envelope({ at: 1, subject }));
const matchedKey = (subject: string) => {
  const decision = docketDecision(subject);
  return isMatched(decision) ? decision.matterKey : decision.reason;
};

describe("MailTagging matter tagger", () => {
  it("matches the attorney's client-keyed docket reference wherever it sits in the text", () => {
    expect(matchedKey("Re: 1234.10001US01 office action")).toBe(keyed);
    expect(matchedKey("docket#1234.10001us01")).toBe(keyed);
    expect(matchedKey("Your ref FA-2026-0042 / 1234.10001US01")).toBe(keyed);
    expect(matchedKey("Our ref 5678.10001US01")).toBe(reused);
  });

  it("matches a country stage the index does not list through its client-keyed family", () => {
    const decision = docketDecision("Annuity due for 1234.10001EP02");

    expect(matchedKey("Annuity due for 1234.10001EP02")).toBe(keyed);
    expect(isMatched(decision) && A.map(decision.evidence, (item) => [item.kind, item.matched])).toStrictEqual([
      ["docket-number", "1234.10001"],
    ]);
    expect(matchedKey("Entering the national phase: 1234.10001WO02-US1")).toBe(keyed);
  });

  it("never picks a client from a bare family", () => {
    expect(matchedKey("Annuity due for 10001EP02")).toBe("no-signal");
    expect(matchedKey("Status of 10001US01")).toBe("ambiguous");
  });

  it("leaves a docket reference into an unattributed family for the attorney", () => {
    expect(matchedKey("Filing receipt for 30003EP01")).toBe("needs-attorney");
    expect(matchedKey("Filing receipt for 9999.40004US01")).toBe("needs-attorney");
    expect(matchedKey("Invoice 30003 and 9999.40004 enclosed")).toBe("no-signal");
  });

  it("reads the reference grammar's application and patent forms", () => {
    expectMatched(envelope({ at: 1, subject: "App. No. 16/123,456 allowed" }), "application-number");
    expectMatched(envelope({ at: 2, subject: "now US 10,123,456" }), "patent-number");
  });

  it("never tags from a contact address alone, or from an address and its domain", () => {
    const fromContact = envelope({ at: 1, sender: "counsel@acme.example.test" });
    const candidates = matterCandidates(context, fromContact);

    expect(A.flatMap(candidates, (candidate) => A.map(candidate.evidence, (item) => item.kind))).toStrictEqual([
      "contact-address",
      "contact-domain",
    ]);
    expectUnmatched(fromContact, "below-threshold");
    expectUnmatched(
      envelope({ at: 2, sender: "attorney@example.test", recipients: ["counsel@acme.example.test"] }),
      "below-threshold"
    );
  });

  it("matches every written form of an application number", () => {
    expectMatched(envelope({ at: 1, subject: "Re: U.S. Appl. No. 16/123,456 - response due" }), "application-number");
    expectMatched(envelope({ at: 2, subject: "Filing receipt 16/123456" }), "application-number");
    expectMatched(envelope({ at: 3, bodyPreview: "Regarding serial number 16123456." }), "application-number");
  });

  it("matches a patent number with or without office and kind codes", () => {
    expectMatched(envelope({ at: 1, subject: "Maintenance fee for US 10,123,456 B2" }), "patent-number");
    expectMatched(envelope({ at: 2, subject: "US10123456B2 assignment" }), "patent-number");
  });

  it("matches a docket number as a case-insensitive token", () => {
    expectMatched(envelope({ at: 1, subject: "[acme-10001-us] draft claims." }), "docket-number");
    expectUnmatched(envelope({ at: 2, subject: "ACME-10001-USA draft claims" }), "no-signal");
  });

  it("does not read the serial half of an application number as a patent number", () => {
    const candidates = matterCandidates(context, envelope({ at: 1, subject: "Appl. 17/654,321" }));

    expect(A.map(candidates, (candidate) => candidate.matterKey)).toStrictEqual([globex]);
  });

  it("leaves a lone contact domain below the threshold", () => {
    const decision = decide(envelope({ at: 1, sender: "paralegal@acme.example.test" }));

    expectUnmatched(envelope({ at: 1, sender: "paralegal@acme.example.test" }), "below-threshold");
    expect(decisionCategories(decision)).toStrictEqual(["P: Unmatched - review"]);
  });

  it("calls equal evidence for two matters ambiguous instead of picking one", () => {
    const decision = decide(envelope({ at: 1, subject: "Status of 16/123,456 and 17/654,321" }));

    expectUnmatched(envelope({ at: 1, subject: "Status of 16/123,456 and 17/654,321" }), "ambiguous");
    expect(!isMatched(decision) && A.map(decision.candidates, (candidate) => candidate.matterKey)).toStrictEqual([
      acme,
      globex,
    ]);
  });

  it("reports no signal for unrelated mail and adds no category", () => {
    expectUnmatched(envelope({ at: 1, sender: "news@vendor.example.test" }), "no-signal");
    expect(decisionCategories(decide(envelope({ at: 1, sender: "news@vendor.example.test" })))).toStrictEqual([]);
  });

  it("takes no evidence from a free-mail sender domain", () => {
    expectUnmatched(envelope({ at: 1, sender: "fixture@gmail.com" }), "no-signal");
  });

  it("adds the client category for a known contact address", () => {
    const decision = decide(envelope({ at: 1, sender: "counsel@acme.example.test", subject: "Re: 16/123,456" }));

    expect(decisionCategories(decision)).toStrictEqual(["M: acme.10001", "P: Client"]);
  });

  it("adds the USPTO category for a uspto.gov sender", () => {
    const decision = decide(envelope({ at: 1, sender: "notices@uspto.gov", subject: "Notice for 16/123,456" }));

    expect(decisionCategories(decision)).toStrictEqual(["M: acme.10001", "P: USPTO"]);
    expect(decisionCategories(decide(envelope({ at: 2, sender: "notices@uspto.gov" })))).toStrictEqual(["P: USPTO"]);
  });

  it("takes contact-address evidence from the recipient of a sent message", () => {
    const sent = envelope({
      at: 1,
      subject: "Draft for your review",
      sender: "attorney@example.test",
      recipients: ["counsel@acme.example.test"],
    });
    const candidates = matterCandidates(context, sent);

    expect(A.map(candidates, (candidate) => candidate.matterKey)).toStrictEqual([acme]);
    expect(A.flatMap(candidates, (candidate) => A.map(candidate.evidence, (item) => item.kind))).toStrictEqual([
      "contact-address",
    ]);
    expectUnmatched(sent, "below-threshold");
    expect(decisionCategories(decide(sent))).toStrictEqual(["P: Unmatched - review"]);
  });

  it("leaves a reference to an unattributed matter for the attorney", () => {
    const decision = decide(envelope({ at: 1, subject: "Filing receipt 15/000,001" }));

    expectUnmatched(envelope({ at: 1, subject: "Filing receipt 15/000,001" }), "needs-attorney");
    expectUnmatched(envelope({ at: 2, subject: "Re: 30003-us status" }), "needs-attorney");
    expect(decisionCategories(decision)).toStrictEqual(["P: Unmatched - review"]);
  });

  it("does not match a taggable matter when an unattributed matter is named as strongly", () => {
    const message = envelope({ at: 1, subject: "Status of 16/123,456 and 15/000,001" });
    const decision = decide(message);

    expectUnmatched(message, "needs-attorney");
    expect(!isMatched(decision) && A.map(decision.candidates, (candidate) => candidate.matterKey)).toStrictEqual([
      acme,
    ]);
  });

  it("applies a sender-address rule intent only to that exact sender", () => {
    const withBillingRule = MatterTaggerContext.make({
      index,
      taxonomy: MailTaxonomy.make({
        ruleIntents: [
          SenderAddressRule.make({ address: EmailString.make("invoices@vendor.example.test"), category: "P: Billing" }),
        ],
      }),
    });
    const invoice = envelope({ at: 1, sender: "invoices@vendor.example.test" });
    const colleague = envelope({ at: 2, sender: "sales@vendor.example.test" });

    expect(senderRuleCategories(withBillingRule.taxonomy, invoice)).toStrictEqual(["P: Billing"]);
    expect(senderRuleCategories(colleague)(withBillingRule.taxonomy)).toStrictEqual([]);
    expect(decisionCategories(decideMatterTagging(withBillingRule, invoice))).toStrictEqual(["P: Billing"]);
    expect(decisionCategories(decideMatterTagging(colleague)(withBillingRule))).toStrictEqual([]);
  });

  it("carries a tagged conversation's matter over to a reply", () => {
    const carried = MatterTaggerContext.make({
      index,
      taxonomy,
      conversationMatters: HashMap.make([MailConversationId.make("conv-1"), acme]),
    });
    const reply = envelope({ at: 1, subject: "Re: thanks", conversation: "conv-1" });
    const decision = decideMatterTagging(carried, reply);

    expect(isMatched(decision) && decision.matterKey === acme).toBe(true);
    expect(isMatched(decision) && A.map(decision.evidence, (item) => item.kind)).toStrictEqual([
      "conversation-carryover",
    ]);
    expectUnmatched(reply, "no-signal");
  });
});
