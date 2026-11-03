/** Source-bound native regex descriptors. Binding does not approve family safety.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Bytes from "effect/Bytes";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationRegexInput } from "./RegexInput.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationRegexProgram, makeCitationRegexProgram } from "./RegexProgram.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexDescriptors");
const Reason = LiteralKit(["invalid-bindings", "unknown-pattern", "profile-mismatch", "fingerprint-unavailable"]).pipe(
  $I.annoteSchema("Reason", { description: "Source-free descriptor registry boundary failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexDescriptorFailure extends S.TaggedError<
  CitationRegexDescriptorFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexDescriptorFailure`)(
  "CitationRegexDescriptorFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexDescriptorFailure>("CitationRegexDescriptorFailure", {
    description: "Descriptor binding failed without retaining pattern text, bytes, metadata or native causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexPatternProfile extends S.Opaque<
  CitationRegexPatternProfile,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    groups: CitationRegexProgram.fields.groups,
    names: CitationRegexProgram.fields.names,
    minimumWidthFloor: CitationRegexProgram.fields.minimumWidthFloor,
    repeatedCaptures: S.Boolean,
    nullableMultiRepeat: S.Boolean,
  })
    .check(
      S.makeFilter(
        (profile) => {
          const values = R.values(profile.names);
          return (
            A.every(R.keys(profile.names), Str.isNonEmpty) &&
            A.every(values, (group) => group > 0 && group <= profile.groups) &&
            A.dedupe(values).length === values.length
          );
        },
        $I.annote("ProfileNames", {
          description: "Require distinct named capture identities within the declared group count.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexPatternProfile", {
        description: "Independently observed capture/name/minimum-width/repetition facts, without execution authority.",
      })
    )
) {}
/** The fingerprint hashes a width byte followed by canonical native words.
 * Distinct Python strings with the same display projection cannot share a key.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexPatternDescriptor extends S.Opaque<
  CitationRegexPatternDescriptor,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patternSha256: Sha256Hex,
    flags: CitationRegexProgram.fields.sourceFlags,
    profile: CitationRegexPatternProfile,
  }).pipe(
    $I.annoteSchema("CitationRegexPatternDescriptor", {
      description: "One source-bound pattern/flags/profile record; decoding this data does not grant execution.",
    })
  )
) {}
const Bindings = S.Array(CitationRegexPatternDescriptor)
  .check(S.isMaxLength(CitationEngineAbsoluteMaxima.patterns))
  .pipe(
    $I.annoteSchema("Bindings", {
      description: "Bounded trusted server descriptor configuration, never raw-text input.",
    })
  );
const ProfileType = S.toType(CitationRegexPatternProfile);
const sameProfile = S.toEquivalence(CitationRegexPatternProfile);
const fail = (reason: CitationRegexDescriptorFailure["reason"]) => CitationRegexDescriptorFailure.make({ reason });
const key = (digest: string, flags: number) => `${flags}:${digest}`;
const copyDescriptor = (descriptor: CitationRegexPatternDescriptor) =>
  CitationRegexPatternDescriptor.make({
    ...descriptor,
    profile: CitationRegexPatternProfile.make({ ...descriptor.profile, names: { ...descriptor.profile.names } }),
  });

/**
 * Install trusted server bindings and capture policy, Clock and Digest. Source
 * identity and fresh compiler facts must agree before returning a bound program.
 * This registry supplies no execution method, family approval or request-supplied
 * grant. Runtime execution additionally requires reviewed routing, work limits,
 * family proof and an owned native process. Methods have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexDescriptorRegistry = Effect.fn("Citation.makeRegexDescriptorRegistry")(function* (
  policy: unknown,
  bindingsInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-bindings"));
  if (!A.isArray(bindingsInput)) return yield* fail("invalid-bindings");
  if (bindingsInput.length > limits.patterns)
    return yield* CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patterns" });
  const bindings = yield* S.decodeUnknownEffect(Bindings, { onExcessProperty: "error" })(bindingsInput).pipe(
    Effect.mapError(() => fail("invalid-bindings"))
  );
  const crypto = yield* Digest.Digest;
  const input = yield* makeCitationRegexInput(limits, "pattern");
  const compiler = yield* makeCitationRegexProgram(limits);
  const { timed } = yield* makeCitationRegexTiming(limits, false);
  const installed = MutableHashMap.empty<string, CitationRegexPatternDescriptor>();
  for (const descriptor of bindings) {
    const identity = key(descriptor.patternSha256, descriptor.flags);
    if (MutableHashMap.has(installed, identity)) return yield* fail("invalid-bindings");
    MutableHashMap.set(installed, identity, copyDescriptor(descriptor));
  }
  const bind = Effect.fn("Citation.bindRegexDescriptor")(function* (nativePattern: unknown, flagsInput: unknown) {
    const flags = yield* S.decodeUnknownEffect(CitationRegexProgram.fields.sourceFlags)(flagsInput).pipe(
      Effect.mapError(() => fail("unknown-pattern"))
    );
    const prepared = yield* input
      .prepareUnicode(nativePattern, () => Effect.void)
      .pipe(Effect.catchTag("CitationRegexInputFailure", () => Effect.fail(fail("unknown-pattern"))));
    const storage = prepared.value.storage;
    const words = Bytes.concat([new Uint8Array([storage.width]), storage.bytes]);
    const digest = yield* crypto
      .digestHex(Digest.sha256, words)
      .pipe(Effect.catchDefect(() => Effect.fail(fail("fingerprint-unavailable"))));
    const descriptor = yield* Effect.fromOption(MutableHashMap.get(installed, key(digest, flags))).pipe(
      Effect.mapError(() => fail("unknown-pattern"))
    );
    const program = yield* compiler.compile(storage, flags);
    const profile = yield* S.decodeUnknownEffect(ProfileType)(program).pipe(
      Effect.mapError(() => fail("profile-mismatch"))
    );
    if (!sameProfile(profile, descriptor.profile)) return yield* fail("profile-mismatch");
    return { descriptor: copyDescriptor(descriptor), program, prepared };
  }, timed);
  return { bind };
});
