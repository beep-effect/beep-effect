import {
  makeCitationNativeJsonDecoder,
  preflightCitationNativeJson,
} from "@beep/law-practice-server/internal/Citation/NativeJson";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { citationUnaccountedText } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexSessionJob,
  decodeCitationRegexSessionJob,
  encodeCitationRegexSessionJob,
  makeCitationRegexSessionPreparation,
} from "@beep/law-practice-server/internal/Citation/RegexSessionProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeStructuralProof = makeCitationNativeJsonDecoder({
  codec: S.fromJsonString(S.Struct({ a: S.Unknown })),
  propertyCeiling: 64,
  maximumDepth: 4,
  invalid: () => "depth-exceeded",
});
const decodeDescriptor = S.decodeUnknownEffect(CitationRegexPatternDescriptor);
const descriptor = decodeDescriptor({
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });

it.effect("accepts the depth-four names object and preflights its exact descriptor and sequence bytes", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const bound = yield* descriptor;
    const preparation = yield* makeCitationRegexSessionPreparation(limits, citationUnaccountedText);
    let measured = 0;
    const job = yield* preparation.prepare(
      "python-re",
      bound,
      123,
      native("(?P<maybe>a)?(b)"),
      native("ab"),
      0,
      1,
      (bytes) =>
        Effect.sync(() => {
          measured = bytes;
        })
    );
    expect(measured).toBe(job.frame.byteLength);
    const decoded = yield* decodeCitationRegexSessionJob(job.frame.subarray(0, -1));
    expect(decoded).toEqual(job.job);
    expect(decoded.descriptor.profile.names).toEqual({ maybe: 1 });
  })
);

it.effect("refuses depth five in structural preflight before base64 payload allocation", () =>
  Effect.gen(function* () {
    const bytes = new TextEncoder().encode('{"a":{"b":{"c":{"d":{"payload":"YQ=="}}}}}');
    const structural = yield* preflightCitationNativeJson(bytes, 64, () => "depth-exceeded", 4).pipe(Effect.flip);
    expect(structural).toBe("depth-exceeded");
    const parse = vi.spyOn(JSON, "parse");
    yield* Effect.gen(function* () {
      yield* decodeStructuralProof(new TextEncoder().encode('{"a":{"b":{"c":{"payload":"YQ=="}}}}'));
      expect(parse).toHaveBeenCalled();
      parse.mockClear();
      const refused = yield* decodeStructuralProof(bytes).pipe(Effect.flip);
      expect(refused).toBe("depth-exceeded");
      expect(parse).not.toHaveBeenCalled();
      const failure = yield* decodeCitationRegexSessionJob(bytes).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-frame" });
      expect(parse).not.toHaveBeenCalled();
    }).pipe(Effect.ensuring(Effect.sync(() => parse.mockRestore())));
  })
);

it.effect("checks capture-name length against the effective frame ceiling before allocating source payload", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const bound = yield* descriptor;
    const large = yield* decodeDescriptor({
      ...bound,
      profile: { ...bound.profile, names: { [Str.repeat(2048)("x")]: 1 } },
    });
    let reserved = false;
    const preparation = yield* makeCitationRegexSessionPreparation(
      { ...limits, processMessageBytes: 1024 },
      citationUnaccountedText
    );
    const failure = yield* preparation
      .prepare("python-re", large, 0, native("a"), native("a"), 0, 1, () =>
        Effect.sync(() => {
          reserved = true;
        })
      )
      .pipe(Effect.flip);
    expect(failure).toMatchObject({ limit: "processMessageBytes" });
    expect(reserved).toBe(false);
  })
);

it.effect("rejects unknown properties after structural preflight and preserves the encoded frame ceiling", () =>
  Effect.gen(function* () {
    const bound = yield* descriptor;
    const job = CitationRegexSessionJob.make({
      engine: "python-re",
      descriptor: bound,
      sequence: 0,
      patternWidth: 1,
      patternBytes: new Uint8Array([97]),
      sourceWidth: 1,
      sourceBytes: new Uint8Array([97]),
      flags: 0,
      maxMatches: 1,
      mode: "finditer",
    });
    const frame = yield* encodeCitationRegexSessionJob(job, 8192);
    const exact = yield* encodeCitationRegexSessionJob(job, frame.byteLength);
    expect(exact).toEqual(frame);
    const refused = yield* encodeCitationRegexSessionJob(job, frame.byteLength - 1).pipe(Effect.flip);
    expect(refused).toMatchObject({ limit: "processMessageBytes" });
    const text = new TextDecoder().decode(frame.subarray(0, -1));
    const unknown = `${Str.slice(0, -1)(text)},"unexpected":true}`;
    const failure = yield* decodeCitationRegexSessionJob(new TextEncoder().encode(unknown)).pipe(Effect.flip);
    expect(failure).toMatchObject({ reason: "invalid-frame" });
  })
);
