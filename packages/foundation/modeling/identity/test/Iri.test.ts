import { fcRuns } from "@beep/fc-runs";
import { AbsoluteIRI, IRI, IRIReference, RelativeIRIReference } from "@beep/identity/Iri";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure, assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

const IRIDecodeEffect = S.decodeEffect(IRI);
const IRIIs = S.is(IRI);
const IRIToEquivalence = S.toEquivalence(IRI);
const AbsoluteIRIDecodeEffect = S.decodeEffect(AbsoluteIRI);
const AbsoluteIRIIs = S.is(AbsoluteIRI);
const AbsoluteIRIToEquivalence = S.toEquivalence(AbsoluteIRI);
const IRIReferenceDecodeEffect = S.decodeEffect(IRIReference);
const IRIReferenceIs = S.is(IRIReference);
const IRIReferenceToEquivalence = S.toEquivalence(IRIReference);
const RelativeIRIReferenceDecodeEffect = S.decodeEffect(RelativeIRIReference);
const RelativeIRIReferenceIs = S.is(RelativeIRIReference);
const RelativeIRIReferenceToEquivalence = S.toEquivalence(RelativeIRIReference);
const decodeAbsoluteIRI = S.decodeUnknownEffect(AbsoluteIRI);
const decodeIRI = S.decodeUnknownEffect(IRI);
const decodeIRIReference = S.decodeUnknownEffect(IRIReference);
const decodeRelativeIRIReference = S.decodeUnknownEffect(RelativeIRIReference);

const isIRI = S.is(IRI);
const decodeIri = flow(S.decodeUnknownResult(IRI), Result.getOrThrow);
const decodeAbsoluteIri = flow(S.decodeUnknownResult(AbsoluteIRI), Result.getOrThrow);
const decodeIriReference = flow(S.decodeUnknownResult(IRIReference), Result.getOrThrow);
const decodeRelativeIriReference = flow(S.decodeUnknownResult(RelativeIRIReference), Result.getOrThrow);

const canParseWithNativeUrl = (value: string): boolean => {
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
};

const bidiFormattingCharacters = ["\u200E", "\u200F", "\u202A", "\u202B", "\u202C", "\u202D", "\u202E"] as const;

describe("IRI", () => {
  it.effect("accepts representative internationalized and relative forms through the facade", () =>
    Effect.gen(function* () {
      const decodedIRI = yield* decodeIRI("https://例え.テスト/δοκιμή?q=値#片段");
      expect(decodedIRI).toBe("https://例え.テスト/δοκιμή?q=値#片段");
      const decodedAbsoluteIRI = yield* decodeAbsoluteIRI("mailto:用户@example.org");
      expect(decodedAbsoluteIRI).toBe("mailto:用户@example.org");
      const decodedIRIReference = yield* decodeIRIReference("../résumé/δοκιμή?x=値#片段");
      expect(decodedIRIReference).toBe("../résumé/δοκιμή?x=値#片段");
      const decodedRelativeIRIReference = yield* decodeRelativeIRIReference("folder/child:leaf");
      expect(decodedRelativeIRIReference).toBe("folder/child:leaf");
    })
  );

  it.effect("rejects invalid facade inputs with the IRI schema diagnostics", () =>
    Effect.gen(function* () {
      const invalidIri = yield* Effect.exit(decodeIRI("https://example.com/%ZZ"));
      assertExitFailure(Exit.mapError(invalidIri, Struct.get("_tag")), Cause.fail("SchemaError"));
      if (Exit.isFailure(invalidIri)) {
        expect(Cause.pretty(invalidIri.cause)).toContain("Expected a valid RFC 3987 IRI");
      }

      const invalidAbsolute = yield* Effect.exit(decodeAbsoluteIRI("https://example.com/path#frag"));
      assertExitFailure(Exit.mapError(invalidAbsolute, Struct.get("_tag")), Cause.fail("SchemaError"));
      if (Exit.isFailure(invalidAbsolute)) {
        expect(Cause.pretty(invalidAbsolute.cause)).toContain("Expected a valid RFC 3987 absolute IRI");
      }

      const invalidRelative = yield* Effect.exit(decodeRelativeIRIReference("folder:child/leaf"));
      assertExitFailure(Exit.mapError(invalidRelative, Struct.get("_tag")), Cause.fail("SchemaError"));
      if (Exit.isFailure(invalidRelative)) {
        expect(Cause.pretty(invalidRelative.cause)).toContain("Expected a valid RFC 3987 relative IRI reference");
      }
    })
  );

  it.effect.prop(
    "only generates RFC 3987 IRI values that decode to themselves",
    [Arbitrary.schema(IRI)],
    ([value]) => Effect.map(IRIDecodeEffect(value), (decoded) => IRIIs(value) && IRIToEquivalence(decoded, value)),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 AbsoluteIRI values that decode to themselves",
    [Arbitrary.schema(AbsoluteIRI)],
    ([value]) =>
      Effect.map(
        AbsoluteIRIDecodeEffect(value),
        (decoded) => AbsoluteIRIIs(value) && AbsoluteIRIToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 IRIReference values that decode to themselves",
    [Arbitrary.schema(IRIReference)],
    ([value]) =>
      Effect.map(
        IRIReferenceDecodeEffect(value),
        (decoded) => IRIReferenceIs(value) && IRIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "only generates RFC 3987 RelativeIRIReference values that decode to themselves",
    [Arbitrary.schema(RelativeIRIReference)],
    ([value]) =>
      Effect.map(
        RelativeIRIReferenceDecodeEffect(value),
        (decoded) => RelativeIRIReferenceIs(value) && RelativeIRIReferenceToEquivalence(decoded, value)
      ),
    { arbitrary: fcRuns(50) }
  );
});

describe("schema.org IRIs through the generic IRI codec", () => {
  it("keeps canonical schema.org and unrelated legacy-http IRIs unchanged on decode", () => {
    expect(Result.getOrThrow(S.decodeResult(IRI)("https://schema.org/name"))).toBe("https://schema.org/name");
    expect(Result.getOrThrow(S.decodeResult(IRI)("http://purl.org/dc/terms/creator"))).toBe(
      "http://purl.org/dc/terms/creator"
    );
  });

  it("accepts valid legacy schema.org forms on the type side", () => {
    pipe(S.is(IRI)("http://schema.org/name"), assertTrue);
    pipe(S.is(IRI)("https://schema.org/name"), assertTrue);
    assertNone(S.decodeOption(IRI)("https://example.com/%ZZ"));
    pipe(IRI.makeOption("http://schema.org/name"), O.isSome, assertTrue);
    expect(() => IRI.make("http://schema.org/name")).not.toThrow();
  });
});

describe("@beep/identity IRI schemas", () => {
  it("accepts internationalized IRIs across scheme, authority, path, query, and fragment forms", () => {
    const cases = [
      "https://例え.テスト/δοκιμή/𐌀?κλειδί=値#片段",
      "https://example.com/%C3%A9",
      "mailto:用户@example.org",
      "foo:",
      "foo:/",
      "foo://",
      "foo:bar",
      "foo:?q=1",
      "foo:#frag",
    ] as const;

    for (const value of cases) {
      expect(decodeIri(value)).toBe(value);
    }
  });

  it("accepts representative authority permutations", () => {
    const cases = [
      "https://user:pass@例え.テスト:8080/a",
      "https://1.2.3.4/",
      "https://10.20.30.40/",
      "https://100.0.0.1/",
      "https://249.0.0.1/",
      "https://255.255.255.255/",
      "https://1234.0.0.1/",
      "https://[::1]/",
      "https://[2001:db8::1]/",
      "https://[::ffff:192.0.2.128]:443/",
      "https://[::ffff:192.0.2.128]/",
      "https://[vF.FF-._~!$&'()*+,;=:]/",
      "https://999.0.0.1/",
      "scheme://",
      "scheme://@/path",
    ] as const;

    for (const value of cases) {
      expect(decodeIri(value)).toBe(value);
    }
  });

  it("accepts representative ucschar ranges and rejects excluded noncharacters", () => {
    const validCases = [
      "https://example.com/\u00A1",
      "https://example.com/\uF900",
      "https://example.com/𐌀",
      "https://example.com/\u{E1000}",
    ] as const;
    const invalidCases = [
      "https://example.com/\uFDD0",
      "https://example.com/\u{EFFFE}",
      "https://example.com/\uD800",
    ] as const;

    for (const value of validCases) {
      expect(decodeIri(value)).toBe(value);
    }

    for (const value of invalidCases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("accepts iprivate characters in query components only", () => {
    const validCases = ["https://example.com/search?\uE000", "https://example.com/search?\u{F0000}"] as const;
    const invalidCases = [
      "https://\uE000.example.com/",
      "https://example.com/\uE000",
      "https://example.com/#\uE000",
    ] as const;

    for (const value of validCases) {
      expect(decodeIri(value)).toBe(value);
    }

    for (const value of invalidCases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects malformed percent encoding across components", () => {
    const cases = [
      "https://example.com/%",
      "https://example.com/%2",
      "https://example.com/%ZZ",
      "https://exa%mple.com/",
      "https://user%ZZ@example.com/",
      "https:/%ZZ",
      "https://example.com/ok/%ZZ",
      "foo:%ZZ",
      "foo:ok/%ZZ",
      "https://example.com/path?value=%GG",
      "https://example.com/path#frag%",
    ] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects malformed authorities and illegal delimiters", () => {
    const cases = [
      "https://user@@example.com/",
      "https://example.com:port/",
      "https://example:80:90/",
      "https://[2001:db8::1/",
      "https://[2001:db8::1]:port/",
      "https://[192.168.0.1::1]/",
      "https://[2001:db8:12345::1]/",
      "https://[1:2:3:4:5:6:7:]/",
      "https://[2001::db8::1]/",
      "https://[2001:db8:::1]/",
      "https://[2001:db8::zzzz]/",
      "https://[vFabc]/",
      "https://[v1.]/",
      "https://example.com/has space",
      "https://example.com/<bad>",
      "https://example.com/`bad`",
    ] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects forbidden bidi formatting characters", () => {
    const cases = pipe(
      bidiFormattingCharacters,
      A.map((character) => `https://example.com/${character}`)
    );

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("Expected a valid RFC 3987 IRI");
    }
  });

  it("rejects leading or trailing whitespace", () => {
    const cases = [" https://example.com", "https://example.com ", "\nhttps://example.com"] as const;

    for (const value of cases) {
      expect(() => decodeIri(value)).toThrow("IRI values must not contain leading or trailing whitespace");
    }
  });

  it.effect("separates absolute, full, and relative IRI references", () =>
    Effect.gen(function* () {
      const relativeCases = [
        "",
        "#片段",
        "?κλειδί=値",
        "../résumé/δοκιμή?x=値#片段",
        "//例え.テスト/path",
        "///path",
        "abc",
        "/absolute/path",
        "/segment/%C3%A9",
        "folder/child:leaf",
        "folder/%F0%90%8C%80",
        ".",
      ] as const;

      expect(decodeAbsoluteIri("https://example.com/δοκιμή?x=1")).toBe("https://example.com/δοκιμή?x=1");
      expect(decodeAbsoluteIri("mailto:用户@example.org")).toBe("mailto:用户@example.org");
      expect(() => decodeAbsoluteIri("https://example.com/δοκιμή#frag")).toThrow(
        "Expected a valid RFC 3987 absolute IRI"
      );
      expect(() => decodeAbsoluteIri("")).toThrow("Absolute IRI values must not be empty");

      for (const value of relativeCases) {
        expect(decodeIriReference(value)).toBe(value);
        expect(decodeRelativeIriReference(value)).toBe(value);
      }

      const sampleEffect1 = yield* Arbitrary.sampleEffect(Arbitrary.schema(RelativeIRIReference), { count: 1 });
      expect(sampleEffect1).toHaveLength(1);

      expect(decodeIriReference("folder:child/leaf")).toBe("folder:child/leaf");
      expect(decodeRelativeIriReference("folder/child:leaf")).toBe("folder/child:leaf");
      expect(() => decodeRelativeIriReference("folder:child/leaf")).toThrow(
        "Expected a valid RFC 3987 relative IRI reference"
      );
    })
  );

  it("rejects malformed relative references", () => {
    const cases = [
      "foo/%ZZ",
      "/%ZZ",
      "/ok/%ZZ",
      "?%ZZ",
      "#%ZZ",
      "folder?%ZZ",
      "folder#%ZZ",
      "//user@@example.com/path",
      "//[2001::db8::1]/",
      "//[vFabc]/path",
      "//example.com:port/path",
      "\u202Erelative/path",
    ] as const;

    for (const value of cases) {
      expect(() => decodeRelativeIriReference(value)).toThrow("Expected a valid RFC 3987 relative IRI reference");
    }
  });

  it("keeps native URL parsing separate from RFC 3987 validation", () => {
    const nativeUrlFriendlyButSpecInvalid = "https://example.com/\uE000";

    pipe(isIRI(nativeUrlFriendlyButSpecInvalid), assertFalse);
    pipe(canParseWithNativeUrl(nativeUrlFriendlyButSpecInvalid), assertTrue);
  });
});
