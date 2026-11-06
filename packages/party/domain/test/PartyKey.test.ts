import {
  E164Phone,
  EmailAddress,
  ExternalIdInput,
  emailAddress,
  exchangeDn,
  externalId,
  Identifier,
  NativeAccountIdInput,
  nativeAccountId,
  normalizeEmail,
  normalizePhone,
  PhoneNumber,
  PhoneNumberInput,
  phoneNumber,
  UsernameInput,
  username,
} from "@beep/party-domain/Identifier";
import {
  canonicalBytes,
  canonicalJson,
  IdentifierBasis,
  identifierBasis,
  PartyKey,
  partyKeyOf,
  SourceRecordInput,
  sourceRecordPartyKey,
} from "@beep/party-domain/PartyKey";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { IdentifierIssue } from "@beep/party-domain/Identifier";

// Pinned by SPEC "PartyKey v1 bytes and adapter equality". The digest was
// calculated independently of this package:
//   printf '%s' '<bytes>' | sha256sum
const PINNED_EMAIL_BYTES = '{"authority":"","kind":"identifier","scheme":"email","value":"dana@example.test"}';
const PINNED_EMAIL_DIGEST = "a390765977ccb1ea6062e33c4508f6847be63377c0c0057d726c99eac3a04d29";

const keyOf = (identifier: Effect.Effect<Identifier, IdentifierIssue>) => Effect.flatMap(identifier, partyKeyOf);

const issueReason = <A>(effect: Effect.Effect<A, IdentifierIssue>) =>
  Effect.map(Effect.flip(effect), (issue) => issue.reason);

describe("PartyKey v1 canonical bytes", () => {
  it.effect("pins the email basis bytes and an independently calculated digest", () =>
    Effect.gen(function* () {
      const basis = { kind: "identifier", scheme: "email", authority: "", value: "dana@example.test" } as const;
      const canonicalJson1 = yield* canonicalJson(basis);
      expect(canonicalJson1).toBe(PINNED_EMAIL_BYTES);
      const bytes = yield* canonicalBytes(basis);
      expect(bytes.length).toBe(81);
      expect(bytes[0]).toBe(0x7b);
      expect(bytes[bytes.length - 1]).toBe(0x7d);
      const keyOf2 = yield* keyOf(emailAddress("dana@example.test"));
      expect(keyOf2).toBe(`pk:v1:${PINNED_EMAIL_DIGEST}`);
    })
  );

  it.effect("ignores input field order", () =>
    Effect.gen(function* () {
      const reordered = { value: "dana@example.test", scheme: "email", authority: "", kind: "identifier" } as const;
      const canonicalJson3 = yield* canonicalJson(reordered);
      expect(canonicalJson3).toBe(PINNED_EMAIL_BYTES);
    })
  );

  it.effect("escapes only quote, backslash and C0 controls and emits other characters directly", () =>
    Effect.gen(function* () {
      const text = yield* canonicalJson({
        kind: "source-record",
        authority: 'src\t"q"\\',
        value: "a\u0001b\u001fc\u2028\u00e9",
      });
      expect(text).toBe(
        '{"authority":"src\\t\\"q\\"\\\\","kind":"source-record","value":"a\\u0001b\\u001fc\u2028\u00e9"}'
      );
    })
  );

  it.effect("rejects unpaired surrogates", () =>
    Effect.gen(function* () {
      const issueReason4 = yield* issueReason(
        canonicalJson({ kind: "source-record", authority: "src", value: "a\uD800b" })
      );
      expect(issueReason4).toBe("invalid-basis");
      const issueReason5 = yield* issueReason(normalizeEmail("a\uDC00@example.test"));
      expect(issueReason5).toBe("unpaired-surrogate");
    })
  );

  it("decodes only the v1 key shape", () => {
    expect(S.is(PartyKey)(`pk:v1:${PINNED_EMAIL_DIGEST}`)).toBe(true);
    expect(S.is(PartyKey)(`pk:v1:${Str.toUpperCase(PINNED_EMAIL_DIGEST)}`)).toBe(false);
    expect(S.is(PartyKey)(`pk:v2:${PINNED_EMAIL_DIGEST}`)).toBe(false);
    expect(S.is(PartyKey)(`pk:v1:${PINNED_EMAIL_DIGEST}0`)).toBe(false);
  });
});

describe("email adapter equality", () => {
  it.effect("a mail header and a contact card yield the same normalized value, bytes and key", () =>
    Effect.gen(function* () {
      const header = yield* emailAddress("Dana Example <Dana@EXAMPLE.test>");
      const card = yield* emailAddress(" dana@example.test ");
      expect(header.raw).toBe("Dana Example <Dana@EXAMPLE.test>");
      expect(header.normalized).toBe(card.normalized);
      const identifierBasis6 = yield* identifierBasis(header);
      const expectation = expect(identifierBasis6);
      const identifierBasis1 = yield* identifierBasis(card);
      expectation.toEqual(identifierBasis1);
      const identifierBasis73 = yield* identifierBasis(header);
      const canonicalBytes7 = yield* canonicalBytes(identifierBasis73);
      const expectation1 = expect(canonicalBytes7);
      const identifierBasis14 = yield* identifierBasis(card);
      const canonicalBytes2 = yield* canonicalBytes(identifierBasis14);
      expectation1.toEqual(canonicalBytes2);
      const partyKeyOf8 = yield* partyKeyOf(header);
      const expectation2 = expect(partyKeyOf8);
      const partyKeyOf3 = yield* partyKeyOf(card);
      expectation2.toBe(partyKeyOf3);
      const partyKeyOf9 = yield* partyKeyOf(header);
      expect(partyKeyOf9).toBe(`pk:v1:${PINNED_EMAIL_DIGEST}`);
    })
  );

  it.effect("pins the explicit case fixture", () =>
    Effect.gen(function* () {
      const header = yield* emailAddress("Dana@example.test");
      const card = yield* emailAddress("dana@example.test");
      expect(header.normalized).toBe("dana@example.test");
      expect(header.normalized).toBe(card.normalized);
      const identifierBasis74 = yield* identifierBasis(header);
      const canonicalJson10 = yield* canonicalJson(identifierBasis74);
      const expectation3 = expect(canonicalJson10);
      const identifierBasis15 = yield* identifierBasis(card);
      const canonicalJson4 = yield* canonicalJson(identifierBasis15);
      expectation3.toBe(canonicalJson4);
      const partyKeyOf11 = yield* partyKeyOf(header);
      const expectation4 = expect(partyKeyOf11);
      const partyKeyOf5 = yield* partyKeyOf(card);
      expectation4.toBe(partyKeyOf5);
    })
  );

  it.effect("treats composed and decomposed local parts as equal", () =>
    Effect.gen(function* () {
      const normalizeEmail12 = yield* normalizeEmail("josé@example.test");
      expect(normalizeEmail12).toBe("josé@example.test");
      const keyOf13 = yield* keyOf(emailAddress("josé@example.test"));
      const expectation5 = expect(keyOf13);
      const keyOf6 = yield* keyOf(emailAddress("JosÉ@example.test"));
      expectation5.toBe(keyOf6);
    })
  );

  it.effect("converts Unicode domains to A-labels and equates them with the A-label spelling", () =>
    Effect.gen(function* () {
      const normalizeEmail14 = yield* normalizeEmail("ana@Bücher.example");
      expect(normalizeEmail14).toBe("ana@xn--bcher-kva.example");
      const keyOf15 = yield* keyOf(emailAddress("ana@bücher.example"));
      const expectation6 = expect(keyOf15);
      const keyOf7 = yield* keyOf(emailAddress("ana@XN--BCHER-KVA.example"));
      expectation6.toBe(keyOf7);
    })
  );

  it.effect("keeps dots and plus tags, so distinct tags stay distinct", () =>
    Effect.gen(function* () {
      const normalizeEmail16 = yield* normalizeEmail("D.Ana+Work@example.test");
      expect(normalizeEmail16).toBe("d.ana+work@example.test");
      const work = yield* keyOf(emailAddress("dana+work@example.test"));
      const home = yield* keyOf(emailAddress("dana+home@example.test"));
      const bare = yield* keyOf(emailAddress("dana@example.test"));
      expect(new Set([work, home, bare]).size).toBe(3);
    })
  );

  it.effect("ignores changed metadata because raw spellings are never hashed", () =>
    Effect.gen(function* () {
      const a = yield* emailAddress("Dana Example <dana@example.test>");
      const b = yield* emailAddress("Someone Else <DANA@example.test>");
      expect(a.raw).not.toBe(b.raw);
      const partyKeyOf17 = yield* partyKeyOf(a);
      const expectation7 = expect(partyKeyOf17);
      const partyKeyOf10 = yield* partyKeyOf(b);
      expectation7.toBe(partyKeyOf10);
    })
  );

  it.effect("rejects invalid mailboxes and domains as data-quality issues", () =>
    Effect.gen(function* () {
      const issueReason18 = yield* issueReason(normalizeEmail("not-an-address"));
      expect(issueReason18).toBe("unparseable-mailbox");
      const issueReason19 = yield* issueReason(normalizeEmail("da na@example.test"));
      expect(issueReason19).toBe("unparseable-mailbox");
      const issueReason20 = yield* issueReason(normalizeEmail("Dana <>"));
      expect(issueReason20).toBe("unparseable-mailbox");
      const issueReason21 = yield* issueReason(normalizeEmail("   "));
      expect(issueReason21).toBe("empty-value");
      const issueReason22 = yield* issueReason(normalizeEmail("dana@-bad-.test"));
      expect(issueReason22).toBe("invalid-domain");
      const issueReason23 = yield* issueReason(normalizeEmail("dana@exa_mple.test"));
      expect(issueReason23).toBe("invalid-domain");
      // U+2488 maps to "1." without STD3 rules; STD3 processing must reject it.
      const issueReason24 = yield* issueReason(normalizeEmail("dana@a⒈test"));
      expect(issueReason24).toBe("invalid-domain");
    })
  );
});

describe("other identifier schemes", () => {
  it.effect("equates uppercase and lowercase Exchange DN inputs", () =>
    Effect.gen(function* () {
      const dn = "/o=ExampleOrg/ou=Exchange Administrative Group/cn=Recipients/cn=dana";
      const upper = yield* exchangeDn(Str.toUpperCase(dn));
      expect(upper.normalized).toBe(Str.toUpperCase(dn));
      const partyKeyOf25 = yield* partyKeyOf(upper);
      const expectation8 = expect(partyKeyOf25);
      const keyOf11 = yield* keyOf(exchangeDn(` ${dn} `));
      expectation8.toBe(keyOf11);
    })
  );

  it.effect("equates case-varied handles within one service and separates services", () =>
    Effect.gen(function* () {
      const service = "https://chat.example.test";
      const a = yield* keyOf(username(UsernameInput.make({ service, handle: "Dana.Example" })));
      const b = yield* keyOf(username(UsernameInput.make({ service, handle: " dana.example " })));
      const other = yield* keyOf(
        username(UsernameInput.make({ service: "https://other.example.test", handle: "dana.example" }))
      );
      expect(a).toBe(b);
      expect(other).not.toBe(a);
    })
  );

  it.effect("keeps native and external values case-sensitive and keys them by namespace", () =>
    Effect.gen(function* () {
      const native = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:directory", value: "AbC-1" }))
      );
      const keyOf26 = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: " urn:example:directory ", value: "AbC-1 " }))
      );
      expect(keyOf26).toBe(native);
      const keyOf27 = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:directory", value: "abc-1" }))
      );
      expect(keyOf27).not.toBe(native);
      const keyOf28 = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:other", value: "AbC-1" }))
      );
      expect(keyOf28).not.toBe(native);
      const external = yield* keyOf(
        externalId(ExternalIdInput.make({ scheme: "urn:example:bar-number", value: "AbC-1" }))
      );
      expect(external).not.toBe(native);
      const keyOf29 = yield* keyOf(
        externalId(ExternalIdInput.make({ scheme: "urn:example:other-number", value: "AbC-1" }))
      );
      expect(keyOf29).not.toBe(external);
    })
  );

  it.effect("equates equivalent phone spellings through one E.164 value", () =>
    Effect.gen(function* () {
      const national = yield* phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("US") }));
      const international = yield* phoneNumber(PhoneNumberInput.make({ raw: "+1 201-555-0123", country: O.none() }));
      expect(national.e164).toBe("+12015550123");
      const partyKeyOf30 = yield* partyKeyOf(national);
      const expectation9 = expect(partyKeyOf30);
      const partyKeyOf12 = yield* partyKeyOf(international);
      expectation9.toBe(partyKeyOf12);
    })
  );

  it.effect("rejects missing authority, ambiguous and invalid phones", () =>
    Effect.gen(function* () {
      const issueReason31 = yield* issueReason(username(UsernameInput.make({ service: "  ", handle: "dana" })));
      expect(issueReason31).toBe("missing-authority");
      const issueReason32 = yield* issueReason(
        nativeAccountId(NativeAccountIdInput.make({ service: "", value: "AbC-1" }))
      );
      expect(issueReason32).toBe("missing-authority");
      const issueReason33 = yield* issueReason(
        externalId(ExternalIdInput.make({ scheme: "urn:example:bar-number", value: " " }))
      );
      expect(issueReason33).toBe("empty-value");
      const issueReason34 = yield* issueReason(
        phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.none() }))
      );
      expect(issueReason34).toBe("ambiguous-phone");
      const issueReason35 = yield* issueReason(
        phoneNumber(PhoneNumberInput.make({ raw: "12", country: O.some("US") }))
      );
      expect(issueReason35).toBe("invalid-phone");
    })
  );
});

describe("source-record fallback and replay", () => {
  it.effect("keys an identifier-free record by stable namespace and record id, case preserved", () =>
    Effect.gen(function* () {
      const key = yield* sourceRecordPartyKey(
        SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "Card-17" })
      );
      const sourceRecordPartyKey36 = yield* sourceRecordPartyKey(
        SourceRecordInput.make({ namespace: " urn:example:contacts", recordId: "Card-17 " })
      );
      expect(sourceRecordPartyKey36).toBe(key);
      const sourceRecordPartyKey37 = yield* sourceRecordPartyKey(
        SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "card-17" })
      );
      expect(sourceRecordPartyKey37).not.toBe(key);
      const sourceRecordPartyKey38 = yield* sourceRecordPartyKey(
        SourceRecordInput.make({ namespace: "urn:example:other", recordId: "Card-17" })
      );
      expect(sourceRecordPartyKey38).not.toBe(key);
      const asIdentifier = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:contacts", value: "Card-17" }))
      );
      expect(asIdentifier).not.toBe(key);
    })
  );

  it.effect("rejects a missing namespace or record id instead of falling back to a display name", () =>
    Effect.gen(function* () {
      const issueReason39 = yield* issueReason(
        sourceRecordPartyKey(SourceRecordInput.make({ namespace: "", recordId: "Card-17" }))
      );
      expect(issueReason39).toBe("missing-source-record-identity");
      const issueReason40 = yield* issueReason(
        sourceRecordPartyKey(SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "  " }))
      );
      expect(issueReason40).toBe("missing-source-record-identity");
    })
  );

  it.effect("produces the same keys regardless of adapter input order", () =>
    Effect.gen(function* () {
      const inputs = [
        emailAddress("Dana Example <Dana@EXAMPLE.test>"),
        exchangeDn("/o=ExampleOrg/cn=dana"),
        username(UsernameInput.make({ service: "https://chat.example.test", handle: "Dana" })),
      ] as const;
      const forward = yield* Effect.all(A.map(inputs, keyOf));
      const backward = yield* Effect.all(A.map(A.reverse(inputs), keyOf));
      expect(A.reverse(backward)).toEqual(forward);
      const all41 = yield* Effect.all(A.map(inputs, keyOf));
      expect(all41).toEqual(forward);
    })
  );
});

describe("normalization boundaries cannot be bypassed", () => {
  it.effect("rejects malformed mailboxes instead of repairing them", () =>
    Effect.gen(function* () {
      for (const raw of [
        "a@@example.test",
        "dana@example.test@other.test",
        "Dana <dana@example.test> trailing",
        "Dana <dana@example.test",
        "dana@example.test>",
        "<a@example.test> <b@example.test>",
        '"dana example"@example.test',
        "@example.test",
        "dana@",
      ]) {
        const issueReason42 = yield* issueReason(normalizeEmail(raw));
        expect(issueReason42, raw).toBe("unparseable-mailbox");
      }
    })
  );

  it.effect("rejects forged identifiers whose values skipped the shared normalizers", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(Identifier, { onExcessProperty: "error" });
      const rejects = (input: unknown) => Effect.as(Effect.flip(decode(input)), true);
      const rejects43 = yield* rejects({ _tag: "EmailAddress", normalized: "Dana@EXAMPLE.test", raw: "x" });
      expect(rejects43).toBe(true);
      const rejects44 = yield* rejects({ _tag: "EmailAddress", normalized: "dana@b\u00fccher.example", raw: "x" });
      expect(rejects44).toBe(true);
      const rejects45 = yield* rejects({ _tag: "EmailAddress", normalized: "a@@example.test", raw: "x" });
      expect(rejects45).toBe(true);
      const rejects46 = yield* rejects({ _tag: "PhoneNumber", e164: "2015550123", raw: "x" });
      expect(rejects46).toBe(true);
      const rejects47 = yield* rejects({ _tag: "ExchangeDn", normalized: "/o=lower", raw: "x" });
      expect(rejects47).toBe(true);
      const rejects48 = yield* rejects({ _tag: "Username", service: " svc ", handle: "dana" });
      expect(rejects48).toBe(true);
      const rejects49 = yield* rejects({ _tag: "Username", service: "", handle: "dana" });
      expect(rejects49).toBe(true);
      const rejects50 = yield* rejects({ _tag: "Username", service: "svc", handle: "Dana" });
      expect(rejects50).toBe(true);
      const rejects51 = yield* rejects({ _tag: "NativeAccountId", service: "svc", value: " AbC-1" });
      expect(rejects51).toBe(true);
      const valid = yield* decode({ _tag: "EmailAddress", normalized: "dana@example.test", raw: "x" });
      expect(S.is(EmailAddress)(valid)).toBe(true);
    })
  );

  it.effect("rejects basis objects with missing, extra, non-string or mismatched fields", () =>
    Effect.gen(function* () {
      const base = { kind: "identifier", scheme: "email", authority: "", value: "dana@example.test" };
      const issueReason52 = yield* issueReason(
        canonicalJson({ kind: "identifier", scheme: "email", value: "dana@example.test" })
      );
      expect(issueReason52).toBe("invalid-basis");
      const issueReason53 = yield* issueReason(canonicalJson({ ...base, extra: "x" }));
      expect(issueReason53).toBe("invalid-basis");
      const issueReason54 = yield* issueReason(canonicalJson({ ...base, value: 7 }));
      expect(issueReason54).toBe("invalid-basis");
      const issueReason55 = yield* issueReason(canonicalJson({ ...base, scheme: "fax" }));
      expect(issueReason55).toBe("invalid-basis");
      const issueReason56 = yield* issueReason(canonicalJson({ ...base, authority: "urn:example:x" }));
      expect(issueReason56).toBe("invalid-basis");
      const issueReason57 = yield* issueReason(canonicalJson({ ...base, scheme: "user" }));
      expect(issueReason57).toBe("invalid-basis");
      const issueReason58 = yield* issueReason(canonicalJson({ ...base, value: " dana@example.test" }));
      expect(issueReason58).toBe("invalid-basis");
      const issueReason59 = yield* issueReason(
        canonicalJson({ kind: "source-record", authority: "", value: "Card-17" })
      );
      expect(issueReason59).toBe("invalid-basis");
      const argument = S.is(IdentifierBasis);
      const emailAddress16 = yield* emailAddress("dana@example.test");
      const identifierBasis13 = yield* identifierBasis(emailAddress16);
      expect(argument(identifierBasis13)).toBe(true);
    })
  );
});

describe("review findings (PR 2588)", () => {
  it.effect("rejects basis values that are not the scheme's graduated canonical value", () =>
    Effect.gen(function* () {
      const basis = (scheme: string, authority: string, value: string) => ({
        kind: "identifier",
        scheme,
        authority,
        value,
      });
      const issueReason60 = yield* issueReason(canonicalJson(basis("email", "", "Dana@EXAMPLE.test")));
      expect(issueReason60).toBe("invalid-basis");
      const issueReason61 = yield* issueReason(canonicalJson(basis("email", "", "dana@b\u00fccher.example")));
      expect(issueReason61).toBe("invalid-basis");
      const issueReason62 = yield* issueReason(canonicalJson(basis("tel", "", "(201) 555-0123")));
      expect(issueReason62).toBe("invalid-basis");
      const issueReason63 = yield* issueReason(canonicalJson(basis("tel", "", "12015550123")));
      expect(issueReason63).toBe("invalid-basis");
      const issueReason64 = yield* issueReason(canonicalJson(basis("x500", "", "/o=ExampleOrg/cn=dana")));
      expect(issueReason64).toBe("invalid-basis");
      const issueReason65 = yield* issueReason(canonicalJson(basis("user", "https://chat.example.test", "Dana")));
      expect(issueReason65).toBe("invalid-basis");
      const issueReason66 = yield* issueReason(canonicalBytes(basis("email", "", "Dana@EXAMPLE.test")));
      expect(issueReason66).toBe("invalid-basis");
      // The graduated spellings of the same identifiers are accepted, and the pinned bytes are unchanged.
      const canonicalJson67 = yield* canonicalJson(basis("email", "", "dana@example.test"));
      expect(canonicalJson67).toBe(PINNED_EMAIL_BYTES);
      const canonicalJson68 = yield* canonicalJson(basis("tel", "", "+12015550123"));
      expect(canonicalJson68).toBe('{"authority":"","kind":"identifier","scheme":"tel","value":"+12015550123"}');
      const canonicalJson69 = yield* canonicalJson(basis("x500", "", "/O=EXAMPLEORG/CN=DANA"));
      expect(canonicalJson69).toContain('"value":"/O=EXAMPLEORG/CN=DANA"');
      const canonicalJson70 = yield* canonicalJson(basis("user", "https://chat.example.test", "dana"));
      expect(canonicalJson70).toContain('"value":"dana"');
    })
  );

  it.effect("decodes stored E.164 values structurally; validity is checked only at graduation", () =>
    Effect.gen(function* () {
      // Shape-valid but not an assigned number under the pinned metadata.
      const stored = "+10000000000";
      expect(S.is(E164Phone)(stored)).toBe(true);
      const decoded = yield* S.decodeEffect(PhoneNumber)({ _tag: "PhoneNumber", e164: stored, raw: stored });
      expect(decoded.e164).toBe(stored);
      const issueReason71 = yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: stored, country: O.none() })));
      expect(issueReason71).toBe("invalid-phone");
      expect(S.is(E164Phone)("+1 201 555 0123")).toBe(false);
      expect(S.is(E164Phone)("2015550123")).toBe(false);
    })
  );

  it.effect("reports unsupported country context separately from missing context", () =>
    Effect.gen(function* () {
      const issueReason72 = yield* issueReason(
        phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("AQ") }))
      );
      expect(issueReason72).toBe("unsupported-country");
      const unsupported = yield* Effect.flip(
        normalizePhone(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("AQ") }))
      );
      expect(unsupported.field).toBe("country");
      expect(unsupported.input).toBe("AQ");
      const ambiguous = yield* Effect.flip(
        normalizePhone(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.none() }))
      );
      expect(ambiguous.reason).toBe("ambiguous-phone");
      expect(ambiguous.field).toBe("value");
    })
  );

  it.effect("keeps issue fields precise and never echoes a basis", () =>
    Effect.gen(function* () {
      const namespace = yield* Effect.flip(
        sourceRecordPartyKey(SourceRecordInput.make({ namespace: " ", recordId: "Card-17" }))
      );
      expect(namespace.reason).toBe("missing-source-record-identity");
      expect(namespace.field).toBe("namespace");
      const record = yield* Effect.flip(
        sourceRecordPartyKey(SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: " " }))
      );
      expect(record.field).toBe("record-id");
      const basis = yield* Effect.flip(
        canonicalJson({ kind: "identifier", scheme: "email", authority: "", value: "Dana@EXAMPLE.test" })
      );
      expect(basis.field).toBe("basis");
      expect(basis.input).toBe("");
      const email = yield* Effect.flip(normalizeEmail("a@@example.test"));
      expect(email.field).toBe("value");
    })
  );
});
