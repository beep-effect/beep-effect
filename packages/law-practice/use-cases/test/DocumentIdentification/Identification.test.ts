import * as I from "@beep/law-practice-use-cases/DocumentIdentification";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const client = I.ClientNumber.make("90001");
const other = I.ClientNumber.make("90002");
const docket = I.DocketId.make("10001US01");
const hash = I.ContentHash.make("a".repeat(64));
const card = (name: string, emails: ReadonlyArray<string>, source: I.ContactSource = "outlook-csv") =>
  I.RawContactCard.make({
    displayName: name,
    organization: O.some("Acme Widgets LLC"),
    titles: [],
    emails,
    phones: ["(212) 555-0100"],
    addresses: [],
    source,
  });
const context = (overrides: Partial<I.ResolverContext> = {}) =>
  I.ResolverContext.make({
    clients: [],
    pairs: [],
    contacts: [],
    aliases: [],
    pseudoClients: [],
    excludedDomains: [],
    ...overrides,
  });
const document = (text = "", overrides: Partial<I.IdentificationDocument> = {}) =>
  I.IdentificationDocument.make({
    documentId: "doc-1",
    contentHash: hash,
    text,
    sourcePath: "",
    extraction: O.none(),
    uspto: [],
    copies: [],
    ...overrides,
  });
const truth = (doc: I.IdentificationDocument, clientNumber = client) =>
  I.TrainingDocument.make({ document: doc, clientNumber, docket: O.none() });
const row = (clientNumber: I.ClientNumber, references: ReadonlyArray<string>) =>
  I.IndexEvidence.make({
    clientNumber: O.some(clientNumber),
    names: ["Acme Widgets LLC"],
    references,
    folders: [],
    emails: [],
    contactIds: [],
    source: "attorney-docket-sheet",
  });
const linked = (name = "Alex Example") =>
  I.Contact.make({
    ...normalised(name),
    links: [
      I.ContactLink.make({
        clientNumber: client,
        familyKey: O.none(),
        source: "attorney-filed-email",
        evidence: "one filed message",
      }),
    ],
  });
const normalised = (name: string) => I.normaliseContacts([card(name, ["alex@acme.example"])])[0]!;
const clientEntry = I.ClientIndexEntry.make({
  clientNumber: client,
  names: [I.ClientName.make({ name: "Acme Widgets LLC", source: "attorney-answer" })],
  folders: [],
});
const resolve = (doc: I.IdentificationDocument, c = context(), training: ReadonlyArray<I.TrainingDocument> = []) =>
  I.resolve(doc, c, I.fitTokenFilter(training, c));
const extracted = (name: string, text: string, kept = true) =>
  I.ConfirmedExtraction.make({
    extraction: I.DocumentExtraction.make({
      docType: "agreement",
      title: O.none(),
      parties: [I.ExtractedParty.make({ name, kind: "organization", role: "client", quote: text })],
      dockets: [],
      applicationNumbers: [],
      patentNumbers: [],
      emails: [],
      dates: [],
    }),
    verdict: I.CriticVerdict.make({
      keepParties: kept ? [0] : [],
      keepDockets: [],
      docType: "agreement",
      problems: [],
    }),
  });

describe("contacts and indexes", () => {
  it("deduplicates transitively across sources and normalised names, never by a role address", () => {
    const cards = [
      card("Alex Example", [" ALEX@acme.example "]),
      card("Alex Example", ["alex@acme.example", "second@acme.example"], "vcard"),
      card("Different Display", ["second@acme.example"]),
      card("One Person", ["info@acme.example"]),
      card("Other Person", ["info@acme.example"]),
      // Nameless role-only cards: unrelated mailboxes must not collapse onto one id.
      card("", ["docketing@firma.example"]),
      card("", ["info@clientb.example"]),
    ];
    const contacts = I.normaliseContacts(cards);
    // The count guards against role-address unions; the distinct-ids check alone would pass if cards wrongly merged.
    expect(contacts).toHaveLength(5);
    expect(A.dedupe(A.map(contacts, (c) => c.contactId))).toHaveLength(contacts.length);
    const idOf = (address: string) =>
      A.findFirst(contacts, (c) => A.some(c.emails, (e) => e.address === address)).pipe(O.map((c) => c.contactId));
    expect(idOf("docketing@firma.example")).not.toEqual(idOf("info@clientb.example"));
    assertSome(A.findFirst(contacts, (c) => c.emails.length === 2).pipe(O.map((c) => c.sources)), [
      "outlook-csv",
      "vcard",
    ]);
    expect(contacts[0]?.phones[0]?.e164).toBe("+12125550100");
    expect(I.normaliseContacts([...cards].reverse())).toEqual(contacts);
    expect(I.projectContacts(contacts)[0]).not.toHaveProperty("phones");
    expect(
      I.normaliseContacts([card("Same Name", ["one@acme.example"]), card(" same name ", ["two@acme.example"], "vcard")])
    ).toHaveLength(1);
  });
  it("gives nameless cards an identity from their own phones or addresses and drops empty cards", () => {
    const bare = (phones: ReadonlyArray<string>, addresses: ReadonlyArray<string> = []) =>
      I.RawContactCard.make({
        displayName: "",
        organization: O.none(),
        titles: [],
        emails: [],
        phones,
        addresses,
        source: "outlook-csv",
      });
    const contacts = I.normaliseContacts([
      bare(["312-555-0101"]),
      bare(["415-555-0199"]),
      bare([], ["1 Test Street, Example City, NY 10001"]),
      bare([]),
    ]);
    expect(contacts).toHaveLength(3);
    expect(A.dedupe(A.map(contacts, (c) => c.contactId))).toHaveLength(3);
  });
  it("builds the client index from asserted and attributed clients, merging names by source", () => {
    const index = I.buildClientIndex([
      row(client, ["90001.10001US01"]),
      I.IndexEvidence.make({
        ...row(client, []),
        names: ["Acme Widgets LLC", "Acme"],
        source: "attorney-answer",
        folders: ["b", "a"],
      }),
      I.IndexEvidence.make({ ...row(other, []), clientNumber: O.none(), references: ["90002.10001US01"], names: [] }),
    ]);
    expect(A.map(index, (c) => c.clientNumber)).toEqual([client, other]);
    expect(index[0]?.names).toHaveLength(3);
    expect(index[0]?.folders).toEqual(["a", "b"]);
    expect(index[1]?.names).toHaveLength(0);
  });
  it("links by contact id without a family, skips register rows, and matches organisations by name", () => {
    const [contact] = I.normaliseContacts([card("Alex Example", ["alex@acme.example"])]);
    const byId = I.IndexEvidence.make({
      ...row(client, []),
      contactIds: [contact!.contactId],
      source: "attorney-answer",
    });
    const register = I.IndexEvidence.make({
      ...row(other, ["90002.10001US01"]),
      contactIds: [contact!.contactId],
      source: "kg-register",
    });
    const clients = I.buildClientIndex([I.IndexEvidence.make({ ...row(other, []), names: ["acme widgets llc"] })]);
    const [linked] = I.linkContacts([contact!], [byId, register], clients);
    expect(A.map(linked!.links, (l) => `${l.clientNumber}:${l.source}:${O.getOrElse(l.familyKey, () => "-")}`)).toEqual(
      [`${client}:attorney-answer:-`, `${other}:org-name-match:-`]
    );
  });
  it("aggregates exact pair source counts and keeps repeating dockets under both clients", () => {
    const pairs = I.buildClientDocketPairs([
      row(client, ["90001.10001US01"]),
      row(client, ["10001US01"]),
      row(other, ["90002.10001US01"]),
    ]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.sources[0]?.count).toBe(2);
    expect(
      I.buildClientDocketPairs([
        I.IndexEvidence.make({
          ...row(client, []),
          clientNumber: O.none(),
          folders: ["Clients/Acme Widgets LLC 90001/10001US01"],
        }),
      ])[0]?.clientNumber
    ).toBe(client);
  });
  it("links non-role email evidence and retains strength-ladder provenance", () => {
    const contacts = I.normaliseContacts([
      card("Alex Example", ["alex@acme.example"]),
      card("Shared Office", ["info@acme.example"]),
    ]);
    const rows = [
      I.IndexEvidence.make({
        ...row(client, ["90001.10001US01"]),
        emails: ["alex@acme.example", "info@acme.example"],
        source: "attorney-filed-email",
      }),
    ];
    const linked = I.linkContacts(contacts, rows, []);
    assertSome(
      A.findFirst(linked, (c) => c.displayName === "Alex Example").pipe(O.map((c) => c.links[0]?.familyKey)),
      O.some("90001.10001")
    );
    assertSome(A.findFirst(linked, (c) => c.displayName === "Shared Office").pipe(O.map((c) => c.links.length)), 0);
  });
});

describe("resolver", () => {
  it("uses full references and rejects conflicting strong clients", () => {
    assertSome(resolve(document("Docket 90001.10001US01")).clientNumber, client);
    expect(resolve(document("90001.10001US01 and 90002.10001US01")).tier).toBe("ambiguous");
    const r = resolve(document("90001.10001US01 and 90001.10002US01"));
    expect(r.tier).toBe("identified");
    assertNone(r.docket);
  });
  it("uses identical copies only when their content hash matches", () => {
    const copies = [I.IdenticalCopy.make({ contentHash: hash, clientNumber: client, docket: O.some(docket) })];
    expect(resolve(document("", { copies })).tier).toBe("identified");
    expect(resolve(document("", { copies, contentHash: I.ContentHash.make("b".repeat(64)) })).tier).toBe("unknown");
  });
  it("uses cited USPTO docket facts, and ignores unrelated records", () => {
    const uspto = [
      I.UsptoEvidence.make({
        query: I.UsptoQuery.make({ kind: "application", number: "18900001" }),
        facts: I.UsptoRecordFacts.make({ docketNumber: O.some("90001.10001US01"), firstApplicant: O.none() }),
      }),
    ];
    expect(resolve(document("Application 18/900,001", { uspto })).tier).toBe("identified");
    // Cover-sheet layout: the number is followed by whitespace and a date, so whitespace must stay a boundary.
    expect(resolve(document("APPLICATION NO. FILING DATE\n18/900,001 10/06/2025", { uspto })).tier).toBe("identified");
    expect(resolve(document("Application No. 18/900,001 12 pages", { uspto })).tier).toBe("identified");
    expect(resolve(document("Application 18/900,002", { uspto })).tier).toBe("unknown");
    expect(resolve(document("Application 118/900,001", { uspto })).tier).toBe("unknown");
  });
  it("requires critic-confirmed content for identified-content; text alone stays a candidate", () => {
    const c = context({ clients: [clientEntry], contacts: [linked("Acme Widgets LLC")] });
    const text = "Client Acme Widgets LLC, alex@acme.example";
    expect(resolve(document(text, { extraction: O.some(extracted("Acme Widgets LLC", text)) }), c).tier).toBe(
      "identified-content"
    );
    expect(resolve(document(text, { extraction: O.some(extracted("Acme Widgets LLC", text, false)) }), c).tier).toBe(
      "candidate"
    );
    // Text signals are capped at three, below the content threshold of five.
    expect(resolve(document("alex@acme.example +12125550100"), context({ contacts: [linked()] })).tier).toBe(
      "candidate"
    );
    expect(resolve(document("nothing here"), context({ contacts: [linked()] })).tier).toBe("unknown");
  });
  it("learns party names only from train files with independent hashes", () => {
    const name = "Acme Widgets LLC";
    const train = [truth(document(name)), truth(document(name, { contentHash: I.ContentHash.make("b".repeat(64)) }))];
    // No client index: the learned name is the only signal, worth the party's role weight.
    const c = context();
    expect(resolve(document(name, { extraction: O.some(extracted(name, name)) }), c, train).tier).toBe("candidate");
    expect(resolve(document(name, { extraction: O.some(extracted(name, name)) }), c, [train[0]!, train[0]!]).tier).toBe(
      "unknown"
    );
  });
  it("drops a training token appearing under two different clients", () => {
    const c = context({ contacts: [linked()] });
    const train = [
      truth(document("alex@acme.example"), client),
      truth(document("alex@acme.example", { contentHash: I.ContentHash.make("b".repeat(64)) }), other),
    ];
    const filter = I.fitTokenFilter(train, c);
    expect(filter.ownership.find((t) => t.token === "contact-address:alex@acme.example")?.clients).toEqual([
      client,
      other,
    ]);
    expect(I.resolve(document("alex@acme.example"), c, filter).evidence).toEqual([]);
  });
  it("keeps a bare docket ambiguous when two clients own it", () => {
    const c = context({ pairs: I.buildClientDocketPairs([row(client, ["10001US01"]), row(other, ["10001US01"])]) });
    const r = resolve(document("10001US01"), c);
    expect(r.tier).toBe("ambiguous");
    assertNone(r.clientNumber);
  });
  it("validates critic quotes and supports input aliases and pseudo-clients", () => {
    const c = context({ aliases: [I.ClientAlias.make({ from: other, to: client })] });
    expect(resolve(document("90001.10001US01 90002.10001US01"), c).tier).toBe("identified");
    const text = "90001.10001US01";
    const bad = I.ConfirmedExtraction.make({
      ...extracted("Acme Widgets LLC", "invented"),
      extraction: I.DocumentExtraction.make({
        ...extracted("Acme Widgets LLC", "invented").extraction,
        parties: [],
        dockets: [I.ExtractedDocket.make({ text, quote: "invented" })],
      }),
      verdict: I.CriticVerdict.make({ keepParties: [], keepDockets: [0], docType: "other", problems: [] }),
    });
    expect(resolve(document("nothing", { extraction: O.some(bad) })).tier).toBe("unknown");
    const pseudoContext = context({
      pseudoClients: [I.PseudoClient.make({ key: "new:acme", names: ["Acme Widgets LLC"] })],
      aliases: [I.ClientAlias.make({ from: client, to: "new:acme" })],
      contacts: [linked("Acme Widgets LLC")],
    });
    const partyText = "Client Acme Widgets LLC";
    const result = resolve(
      document(partyText, { extraction: O.some(extracted("Acme Widgets LLC", partyText)) }),
      pseudoContext
    );
    expect(result.tier).toBe("identified-content");
    assertSome(result.clientNumber, "new:acme");
  });
  it("requires a threefold content margin and a twofold candidate margin", () => {
    const contact = (suffix: string, owner: I.ClientNumber) =>
      I.Contact.make({
        ...normalised("Acme Widgets LLC"),
        contactId: I.ContentHash.make(suffix.repeat(64)),
        links: [
          I.ContactLink.make({
            clientNumber: owner,
            familyKey: O.none(),
            source: "attorney-answer",
            evidence: "input answer",
          }),
        ],
      });
    const text = "Client Acme Widgets LLC";
    const doc = document(text, { extraction: O.some(extracted("Acme Widgets LLC", text)) });
    // Client name and contact each add the client role weight (6), text adds its cap (3): 9 against nothing.
    const single = context({ clients: [clientEntry], contacts: [contact("a", client)] });
    expect(resolve(doc, single).tier).toBe("identified-content");
    // A contact of the same name under another client scores 4: 9 clears twice that but not three times.
    const shared = context({ clients: [clientEntry], contacts: [contact("a", client), contact("c", other)] });
    expect(resolve(doc, shared).tier).toBe("candidate");
    const tie = context({ clients: [], contacts: [contact("a", client), contact("c", other)] });
    expect(resolve(doc, tie).tier).toBe("ambiguous");
  });
  it("recognises public applicant organisation names despite legal suffix differences", () => {
    const uspto = [
      I.UsptoEvidence.make({
        query: I.UsptoQuery.make({ kind: "application", number: "18900001" }),
        facts: I.UsptoRecordFacts.make({ docketNumber: O.none(), firstApplicant: O.some("Acme Widgets, Inc.") }),
      }),
    ];
    const r = resolve(
      document("Application 18/900,001 Acme Widgets LLC", { uspto }),
      context({ clients: [clientEntry] })
    );
    expect(r.tier).toBe("candidate");
    assertSome(r.clientNumber, client);
  });
  it("organises blank forms and explicit firm folders without attributing clients", () => {
    const rules = I.OrganisationRules.make({ firmFolders: ["Firm"], formFolders: ["Forms"] });
    expect(I.organiseDocument("Forms/a", "[NAME]", "agreement", false, rules).kind).toBe("form");
    expect(I.organiseDocument("Forms/a", "[NAME]", "agreement", true, rules).kind).toBe("unresolved");
    expect(I.organiseDocument("Firm/a", "", "other", false, rules).kind).toBe("firm");
  });
});

describe("evaluation and codecs", () => {
  it("partitions by hash deterministically without duplicate leakage", () => {
    const docs = A.makeBy(100, (i) =>
      truth(document("", { contentHash: I.ContentHash.make(i.toString(16).padStart(8, "0") + "a".repeat(56)) }))
    );
    const split = I.holdOutSplit(docs, "fixture");
    expect(split.train.length + split.test.length).toBe(100);
    expect(split.test.length).toBeGreaterThan(5);
    expect(split.test.length).toBeLessThan(40);
    expect(
      I.holdOutSplit([...docs].reverse(), "fixture")
        .test.map((d) => d.document.contentHash)
        .sort()
    ).toEqual(split.test.map((d) => d.document.contentHash).sort());
    expect(I.holdOutSplit(docs, "other").test.map((d) => d.document.contentHash)).not.toEqual(
      split.test.map((d) => d.document.contentHash)
    );
    const held = split.test[0]!;
    const duplicates = I.holdOutSplit([held, held], "fixture");
    expect(duplicates.test).toHaveLength(2);
    expect(duplicates.train).toHaveLength(0);
  });
  it("computes arithmetic including absent precision and docket mistakes", () => {
    const right = I.Resolution.make({
      clientNumber: O.some(client),
      docket: O.none(),
      tier: "candidate",
      evidence: [],
    });
    const wrong = I.Resolution.make({ ...right, clientNumber: O.some(other) });
    const cases = [
      I.EvaluationCase.make({ truth: truth(document()), resolution: right }),
      I.EvaluationCase.make({ truth: truth(document()), resolution: wrong }),
    ];
    const report = I.evaluate(cases, 8);
    const tier = report.tiers.find((t) => t.tier === "candidate")!;
    expect({ resolved: tier.resolved, right: tier.right, wrong: tier.wrong, coverage: tier.coverage }).toEqual({
      resolved: 2,
      right: 1,
      wrong: 1,
      coverage: 1,
    });
    assertSome(tier.precision, 0.5);
    assertNone(A.findFirst(report.tiers, (t) => t.tier === "identified").pipe(O.flatMap((t) => t.precision)));
    expect(I.evaluate([], 0).tiers[0]?.coverage).toBe(0);
  });
  it("turns identical-copy ground truth off during evaluation", () => {
    const doc = document("", {
      contentHash: I.ContentHash.make("0".repeat(64)),
      copies: [
        I.IdenticalCopy.make({
          contentHash: I.ContentHash.make("0".repeat(64)),
          clientNumber: client,
          docket: O.none(),
        }),
      ],
    });
    // "fixture-6" holds the all-zero fixture hash out, so the copy would have scored without the switch.
    const report = I.evaluateHoldOut([truth(doc)], context(), "fixture-6");
    expect(report.testSize).toBe(1);
    expect(report.tiers.find((t) => t.tier === "identified")?.resolved).toBe(0);
  });
  it.effect("roundtrips the private document and resolution codecs", () =>
    Effect.gen(function* () {
      const codec = S.fromJsonString(I.IdentificationDocument);
      const encoded = yield* S.encodeEffect(codec)(document());
      expect(yield* S.decodeEffect(codec)(encoded)).toEqual(document());
      expect(S.is(I.ClientNumber)("short")).toBe(false);
      expect(S.is(I.DocketId)("10001XX01")).toBe(false);
    })
  );
});

describe("private codecs", () => {
  const roundTrip = <T extends S.Top & S.ConstraintCodec<unknown, unknown, never, never>>(name: string, schema: T) =>
    it.prop(
      `round-trips ${name} through its JSON codec from schema-derived arbitraries`,
      [Arbitrary.schema(schema)],
      ([value]) => {
        const codec = S.fromJsonString(schema);
        const encoded = Result.getOrThrow(S.encodeResult(codec)(value));
        const decoded = Result.getOrThrow(S.decodeResult(codec)(encoded));
        pipe(Eq.equals(decoded, value), assertTrue);
      },
      { arbitrary: fcRuns(25) }
    );
  roundTrip("IdentificationIndex", I.IdentificationIndex);
  roundTrip("EvaluationReport", I.EvaluationReport);
  roundTrip("Resolution", I.Resolution);
});
