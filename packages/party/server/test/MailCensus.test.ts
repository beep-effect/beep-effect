import {
  CensusSummary,
  emptyCensus,
  identifiersByName,
  observe,
  pairingSupport,
  recordDecodeFailure,
  summarize,
} from "@beep/party-server/MailCensus";
import { adaptMailRecord, MailIndexInput } from "@beep/party-server/MailIndex";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeCensusSummary = S.encodeEffect(S.fromJsonString(CensusSummary));

const dn = (name: string) => `/O=ACME/OU=EXCHANGE/CN=RECIPIENTS/CN=${name}`;
const ingest = (path: string, outlook: unknown, internet: unknown = undefined) =>
  S.decodeUnknownEffect(MailIndexInput)({
    record: {
      tree: "synthetic",
      sourceArtifactId: "synthetic-parent",
      messagePath: path,
      outlook,
      ...(internet === undefined ? {} : { internet }),
      recipients: [],
    },
    content: `party-sha256:${encodeURIComponent(path)}`,
    side: "third-party-production",
    producedBy: "party-act:test",
    observedAt: 1,
  }).pipe(Effect.flatMap(adaptMailRecord));

describe("mail census", () => {
  it("summarizes empty state and counts decode failures without source payload", () => {
    const empty = emptyCensus();
    const failed = recordDecodeFailure(empty);
    expect(summarize(failed)).toMatchObject({
      rows: 1,
      decodeFailures: 1,
      events: 0,
      displayNames: 0,
      nameEqualityCollisionRisk: 0,
      identifiers: { total: 0, email: 0, exchangeDn: 0 },
      displayNamesPerIdentifier: { "1": 0, "2": 0, "3-5": 0, "6+": 0, max: 0 },
    });
    expect(empty.decodeFailures).toBe(0);
  });
  it.effect("counts delegated messages, paired directory ids and distinct voices", () =>
    Effect.gen(function* () {
      const mail = yield* ingest(
        "delegated",
        {
          senderName: "Avery",
          senderEmailAddress: dn("AVERY"),
          sentRepresentingName: "Dana",
          sentRepresentingEmailAddress: dn("DANA"),
          clientSubmitTime: "1970-01-01T00:00:00.009Z",
        },
        { from: "Dana <dana@acme.example>", to: [], cc: [] }
      );
      const empty = emptyCensus();
      const census = observe(empty, mail);
      const summary = summarize(census);
      expect(summary).toMatchObject({
        rows: 1,
        events: 1,
        displayNames: 2,
        nameEqualityCollisionRisk: 0,
        identifiers: { total: 3, email: 1, exchangeDn: 2 },
        exchangeUnification: {
          dnsWithSmtpPairing: 1,
          dnsWithoutPairing: 1,
          dnsPairedToMultipleSmtp: 0,
          smtpPairedToMultipleDns: 0,
        },
        delegation: { delegatedEvents: 1, distinctDelegatedVoices: 1 },
      });
      expect(summarize(empty).rows).toBe(0);
      const repeated = pipe(census, observe(mail));
      expect(summarize(repeated).delegation).toMatchObject({ delegatedEvents: 2, distinctDelegatedVoices: 1 });
      expect(A.map(pairingSupport(repeated), (support) => support.messages)).toEqual([1]);
      const encoded = yield* encodeCensusSummary(summary);
      expect(encoded).not.toContain("Dana");
      expect(encoded).not.toContain("dana@acme.example");
      expect(encoded).not.toContain("party-ident:");
    })
  );
  it.effect("detects names spanning unpaired mailboxes but treats paired aliases as one", () =>
    Effect.gen(function* () {
      const first = yield* ingest("first", { senderName: "Alex Smith", senderEmailAddress: "first@acme.example" });
      const second = yield* ingest("second", {
        senderName: "  ALEX   SMITH  ",
        senderEmailAddress: "second@acme.example",
      });
      const census = observe(observe(emptyCensus(), first), second);
      expect(summarize(census).nameEqualityCollisionRisk).toBe(1);
      expect(summarize(census).identifiersPerDisplayName).toMatchObject({ "2": 1, max: 2 });
      expect(A.map(identifiersByName(census), (value) => value.name)).toEqual(["alex smith"]);
    })
  );
  it.effect("tracks numeric identifier spans and preserves previous snapshots", () =>
    Effect.gen(function* () {
      const late = yield* ingest("late", {
        senderName: "Dana",
        senderEmailAddress: "dana@acme.example",
        clientSubmitTime: "1970-01-01T00:00:00.010Z",
      });
      const early = yield* ingest("early", {
        senderName: "Dana",
        senderEmailAddress: "dana@acme.example",
        clientSubmitTime: "1970-01-01T00:00:00.002Z",
      });
      const before = observe(emptyCensus(), late);
      const after = observe(before, early);
      const id = O.getOrThrow(A.head(late.identifiers)).id;
      const span = O.getOrThrow(HashMap.get(after.identifierSpans, id));
      expect(DateTime.toEpochMillis(span.first)).toBe(2);
      expect(DateTime.toEpochMillis(span.last)).toBe(10);
      expect(DateTime.toEpochMillis(O.getOrThrow(HashMap.get(before.identifierSpans, id)).first)).toBe(10);
    })
  );
  it.effect("counts parser issues without turning a missing sender into an event", () =>
    Effect.gen(function* () {
      const missing = yield* ingest("missing", {});
      const summary = summarize(observe(emptyCensus(), missing));
      expect(summary.rows).toBe(1);
      expect(summary.events).toBe(0);
      expect(summary.issues).toEqual({ NoFromParticipant: 1 });
    })
  );
});

it.effect("reports larger alias-spread histogram buckets", () =>
  Effect.gen(function* () {
    const sharedName = yield* Effect.forEach(A.range(1, 6), (index) =>
      ingest(`alias-${index}`, {
        senderName: "Alex",
        senderEmailAddress: `alex-${index}@acme.example`,
      })
    );
    const sharedIdentifier = yield* Effect.forEach(["Dana", "D Brooks", "Dana Brooks"], (name) =>
      ingest(name, {
        senderName: name,
        senderEmailAddress: "dana@acme.example",
      })
    );
    const census = A.reduce(A.appendAll(sharedName, sharedIdentifier), emptyCensus(), (state, mail) =>
      observe(state, mail)
    );
    const summary = summarize(census);
    expect(summary.identifiersPerDisplayName).toMatchObject({ "1": 3, "6+": 1, max: 6 });
    expect(summary.displayNamesPerIdentifier).toMatchObject({ "1": 6, "3-5": 1, max: 3 });
    expect(summary.nameEqualityCollisionRisk).toBe(1);
  })
);

it.effect("counts both directions of many-to-many DN and SMTP pairings", () =>
  Effect.gen(function* () {
    const first = yield* ingest(
      "pair1",
      { senderName: "Alex", senderEmailAddress: dn("A") },
      { from: "Alex <one@acme.example>", to: [], cc: [] }
    );
    const second = yield* ingest(
      "pair2",
      { senderName: "Alex", senderEmailAddress: dn("A") },
      { from: "Alex <two@acme.example>", to: [], cc: [] }
    );
    const third = yield* ingest(
      "pair3",
      { senderName: "Alex", senderEmailAddress: dn("B") },
      { from: "Alex <two@acme.example>", to: [], cc: [] }
    );
    const census = A.reduce([first, second, third], emptyCensus(), (state, mail) => observe(state, mail));
    expect(summarize(census).exchangeUnification).toEqual({
      dnsWithSmtpPairing: 2,
      dnsWithoutPairing: 0,
      dnsPairedToMultipleSmtp: 1,
      smtpPairedToMultipleDns: 1,
    });
    expect(summarize(census).nameEqualityCollisionRisk).toBe(0);
    expect(pairingSupport(census)).toHaveLength(3);
  })
);
