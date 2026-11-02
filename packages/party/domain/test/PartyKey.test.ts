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
      expect(yield* canonicalJson(basis)).toBe(PINNED_EMAIL_BYTES);
      const bytes = yield* canonicalBytes(basis);
      expect(bytes.length).toBe(81);
      expect(bytes[0]).toBe(0x7b);
      expect(bytes[bytes.length - 1]).toBe(0x7d);
      expect(yield* keyOf(emailAddress("dana@example.test"))).toBe(`pk:v1:${PINNED_EMAIL_DIGEST}`);
    })
  );

  it.effect("ignores input field order", () =>
    Effect.gen(function* () {
      const reordered = { value: "dana@example.test", scheme: "email", authority: "", kind: "identifier" } as const;
      expect(yield* canonicalJson(reordered)).toBe(PINNED_EMAIL_BYTES);
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
      expect(yield* issueReason(canonicalJson({ kind: "source-record", authority: "src", value: "a\uD800b" }))).toBe(
        "invalid-basis"
      );
      expect(yield* issueReason(normalizeEmail("a\uDC00@example.test"))).toBe("unpaired-surrogate");
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
      expect(yield* identifierBasis(header)).toEqual(yield* identifierBasis(card));
      expect(yield* canonicalBytes(yield* identifierBasis(header))).toEqual(
        yield* canonicalBytes(yield* identifierBasis(card))
      );
      expect(yield* partyKeyOf(header)).toBe(yield* partyKeyOf(card));
      expect(yield* partyKeyOf(header)).toBe(`pk:v1:${PINNED_EMAIL_DIGEST}`);
    })
  );

  it.effect("pins the explicit case fixture", () =>
    Effect.gen(function* () {
      const header = yield* emailAddress("Dana@example.test");
      const card = yield* emailAddress("dana@example.test");
      expect(header.normalized).toBe("dana@example.test");
      expect(header.normalized).toBe(card.normalized);
      expect(yield* canonicalJson(yield* identifierBasis(header))).toBe(
        yield* canonicalJson(yield* identifierBasis(card))
      );
      expect(yield* partyKeyOf(header)).toBe(yield* partyKeyOf(card));
    })
  );

  it.effect("treats composed and decomposed local parts as equal", () =>
    Effect.gen(function* () {
      expect(yield* normalizeEmail("josé@example.test")).toBe("josé@example.test");
      expect(yield* keyOf(emailAddress("josé@example.test"))).toBe(yield* keyOf(emailAddress("JosÉ@example.test")));
    })
  );

  it.effect("converts Unicode domains to A-labels and equates them with the A-label spelling", () =>
    Effect.gen(function* () {
      expect(yield* normalizeEmail("ana@Bücher.example")).toBe("ana@xn--bcher-kva.example");
      expect(yield* keyOf(emailAddress("ana@bücher.example"))).toBe(
        yield* keyOf(emailAddress("ana@XN--BCHER-KVA.example"))
      );
    })
  );

  it.effect("keeps dots and plus tags, so distinct tags stay distinct", () =>
    Effect.gen(function* () {
      expect(yield* normalizeEmail("D.Ana+Work@example.test")).toBe("d.ana+work@example.test");
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
      expect(yield* partyKeyOf(a)).toBe(yield* partyKeyOf(b));
    })
  );

  it.effect("rejects invalid mailboxes and domains as data-quality issues", () =>
    Effect.gen(function* () {
      expect(yield* issueReason(normalizeEmail("not-an-address"))).toBe("unparseable-mailbox");
      expect(yield* issueReason(normalizeEmail("da na@example.test"))).toBe("unparseable-mailbox");
      expect(yield* issueReason(normalizeEmail("Dana <>"))).toBe("unparseable-mailbox");
      expect(yield* issueReason(normalizeEmail("   "))).toBe("empty-value");
      expect(yield* issueReason(normalizeEmail("dana@-bad-.test"))).toBe("invalid-domain");
      expect(yield* issueReason(normalizeEmail("dana@exa_mple.test"))).toBe("invalid-domain");
      // U+2488 maps to "1." without STD3 rules; STD3 processing must reject it.
      expect(yield* issueReason(normalizeEmail("dana@a⒈test"))).toBe("invalid-domain");
    })
  );
});

describe("other identifier schemes", () => {
  it.effect("equates uppercase and lowercase Exchange DN inputs", () =>
    Effect.gen(function* () {
      const dn = "/o=ExampleOrg/ou=Exchange Administrative Group/cn=Recipients/cn=dana";
      const upper = yield* exchangeDn(Str.toUpperCase(dn));
      expect(upper.normalized).toBe(Str.toUpperCase(dn));
      expect(yield* partyKeyOf(upper)).toBe(yield* keyOf(exchangeDn(` ${dn} `)));
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
      expect(
        yield* keyOf(
          nativeAccountId(NativeAccountIdInput.make({ service: " urn:example:directory ", value: "AbC-1 " }))
        )
      ).toBe(native);
      expect(
        yield* keyOf(nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:directory", value: "abc-1" })))
      ).not.toBe(native);
      expect(
        yield* keyOf(nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:other", value: "AbC-1" })))
      ).not.toBe(native);
      const external = yield* keyOf(
        externalId(ExternalIdInput.make({ scheme: "urn:example:bar-number", value: "AbC-1" }))
      );
      expect(external).not.toBe(native);
      expect(
        yield* keyOf(externalId(ExternalIdInput.make({ scheme: "urn:example:other-number", value: "AbC-1" })))
      ).not.toBe(external);
    })
  );

  it.effect("equates equivalent phone spellings through one E.164 value", () =>
    Effect.gen(function* () {
      const national = yield* phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("US") }));
      const international = yield* phoneNumber(PhoneNumberInput.make({ raw: "+1 201-555-0123", country: O.none() }));
      expect(national.e164).toBe("+12015550123");
      expect(yield* partyKeyOf(national)).toBe(yield* partyKeyOf(international));
    })
  );

  it.effect("rejects missing authority, ambiguous and invalid phones", () =>
    Effect.gen(function* () {
      expect(yield* issueReason(username(UsernameInput.make({ service: "  ", handle: "dana" })))).toBe(
        "missing-authority"
      );
      expect(yield* issueReason(nativeAccountId(NativeAccountIdInput.make({ service: "", value: "AbC-1" })))).toBe(
        "missing-authority"
      );
      expect(
        yield* issueReason(externalId(ExternalIdInput.make({ scheme: "urn:example:bar-number", value: " " })))
      ).toBe("empty-value");
      expect(yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.none() })))).toBe(
        "ambiguous-phone"
      );
      expect(yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: "12", country: O.some("US") })))).toBe(
        "invalid-phone"
      );
    })
  );
});

describe("source-record fallback and replay", () => {
  it.effect("keys an identifier-free record by stable namespace and record id, case preserved", () =>
    Effect.gen(function* () {
      const key = yield* sourceRecordPartyKey(
        SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "Card-17" })
      );
      expect(
        yield* sourceRecordPartyKey(
          SourceRecordInput.make({ namespace: " urn:example:contacts", recordId: "Card-17 " })
        )
      ).toBe(key);
      expect(
        yield* sourceRecordPartyKey(SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "card-17" }))
      ).not.toBe(key);
      expect(
        yield* sourceRecordPartyKey(SourceRecordInput.make({ namespace: "urn:example:other", recordId: "Card-17" }))
      ).not.toBe(key);
      const asIdentifier = yield* keyOf(
        nativeAccountId(NativeAccountIdInput.make({ service: "urn:example:contacts", value: "Card-17" }))
      );
      expect(asIdentifier).not.toBe(key);
    })
  );

  it.effect("rejects a missing namespace or record id instead of falling back to a display name", () =>
    Effect.gen(function* () {
      expect(
        yield* issueReason(sourceRecordPartyKey(SourceRecordInput.make({ namespace: "", recordId: "Card-17" })))
      ).toBe("missing-source-record-identity");
      expect(
        yield* issueReason(
          sourceRecordPartyKey(SourceRecordInput.make({ namespace: "urn:example:contacts", recordId: "  " }))
        )
      ).toBe("missing-source-record-identity");
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
      expect(yield* Effect.all(A.map(inputs, keyOf))).toEqual(forward);
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
        expect(yield* issueReason(normalizeEmail(raw)), raw).toBe("unparseable-mailbox");
      }
    })
  );

  it.effect("rejects forged identifiers whose values skipped the shared normalizers", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(Identifier, { onExcessProperty: "error" });
      const rejects = (input: unknown) => Effect.as(Effect.flip(decode(input)), true);
      expect(yield* rejects({ _tag: "EmailAddress", normalized: "Dana@EXAMPLE.test", raw: "x" })).toBe(true);
      expect(yield* rejects({ _tag: "EmailAddress", normalized: "dana@b\u00fccher.example", raw: "x" })).toBe(true);
      expect(yield* rejects({ _tag: "EmailAddress", normalized: "a@@example.test", raw: "x" })).toBe(true);
      expect(yield* rejects({ _tag: "PhoneNumber", e164: "2015550123", raw: "x" })).toBe(true);
      expect(yield* rejects({ _tag: "ExchangeDn", normalized: "/o=lower", raw: "x" })).toBe(true);
      expect(yield* rejects({ _tag: "Username", service: " svc ", handle: "dana" })).toBe(true);
      expect(yield* rejects({ _tag: "Username", service: "", handle: "dana" })).toBe(true);
      expect(yield* rejects({ _tag: "Username", service: "svc", handle: "Dana" })).toBe(true);
      expect(yield* rejects({ _tag: "NativeAccountId", service: "svc", value: " AbC-1" })).toBe(true);
      const valid = yield* decode({ _tag: "EmailAddress", normalized: "dana@example.test", raw: "x" });
      expect(S.is(EmailAddress)(valid)).toBe(true);
    })
  );

  it.effect("rejects basis objects with missing, extra, non-string or mismatched fields", () =>
    Effect.gen(function* () {
      const base = { kind: "identifier", scheme: "email", authority: "", value: "dana@example.test" };
      expect(
        yield* issueReason(canonicalJson({ kind: "identifier", scheme: "email", value: "dana@example.test" }))
      ).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, extra: "x" }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, value: 7 }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, scheme: "fax" }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, authority: "urn:example:x" }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, scheme: "user" }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ ...base, value: " dana@example.test" }))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson({ kind: "source-record", authority: "", value: "Card-17" }))).toBe(
        "invalid-basis"
      );
      expect(S.is(IdentifierBasis)(yield* identifierBasis(yield* emailAddress("dana@example.test")))).toBe(true);
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
      expect(yield* issueReason(canonicalJson(basis("email", "", "Dana@EXAMPLE.test")))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson(basis("email", "", "dana@b\u00fccher.example")))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson(basis("tel", "", "(201) 555-0123")))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson(basis("tel", "", "12015550123")))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson(basis("x500", "", "/o=ExampleOrg/cn=dana")))).toBe("invalid-basis");
      expect(yield* issueReason(canonicalJson(basis("user", "https://chat.example.test", "Dana")))).toBe(
        "invalid-basis"
      );
      expect(yield* issueReason(canonicalBytes(basis("email", "", "Dana@EXAMPLE.test")))).toBe("invalid-basis");
      // The graduated spellings of the same identifiers are accepted, and the pinned bytes are unchanged.
      expect(yield* canonicalJson(basis("email", "", "dana@example.test"))).toBe(PINNED_EMAIL_BYTES);
      expect(yield* canonicalJson(basis("tel", "", "+12015550123"))).toBe(
        '{"authority":"","kind":"identifier","scheme":"tel","value":"+12015550123"}'
      );
      expect(yield* canonicalJson(basis("x500", "", "/O=EXAMPLEORG/CN=DANA"))).toContain(
        '"value":"/O=EXAMPLEORG/CN=DANA"'
      );
      expect(yield* canonicalJson(basis("user", "https://chat.example.test", "dana"))).toContain('"value":"dana"');
    })
  );

  it.effect("decodes stored E.164 values structurally; validity is checked only at graduation", () =>
    Effect.gen(function* () {
      // Shape-valid but not an assigned number under the pinned metadata.
      const stored = "+10000000000";
      expect(S.is(E164Phone)(stored)).toBe(true);
      const decoded = yield* S.decodeEffect(PhoneNumber)({ _tag: "PhoneNumber", e164: stored, raw: stored });
      expect(decoded.e164).toBe(stored);
      expect(yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: stored, country: O.none() })))).toBe(
        "invalid-phone"
      );
      expect(S.is(E164Phone)("+1 201 555 0123")).toBe(false);
      expect(S.is(E164Phone)("2015550123")).toBe(false);
    })
  );

  it.effect("reports unsupported country context separately from missing context", () =>
    Effect.gen(function* () {
      expect(
        yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.some("AQ") })))
      ).toBe("unsupported-country");
      expect(yield* issueReason(phoneNumber(PhoneNumberInput.make({ raw: "(201) 555-0123", country: O.none() })))).toBe(
        "ambiguous-phone"
      );
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
