import { makeCitationNativeArgumentEncoder } from "@beep/law-practice-server/internal/Citation/NativeJson";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import {
  CitationRegexSessionComplete,
  CitationRegexSessionFailure,
  CitationRegexSessionReady,
  CitationRegexSessionStarted,
  CitationRegexSessionStartup,
  citationRegexSessionResult,
  decodeCitationRegexSessionReply,
  decodeCitationRegexSessionStartup,
  encodeCitationRegexSessionReply,
  encodeCitationRegexSessionStartup,
  preflightCitationRegexSessionControls,
} from "@beep/law-practice-server/internal/Citation/RegexSessionRpc";
import {
  CitationRegexWorkerStartup,
  encodeCitationRegexStartup,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

it.effect("round trips sequenced controls, startup limits and the unsequenced result", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const startup = CitationRegexSessionStartup.make({ limits });
    const argument = yield* encodeCitationRegexSessionStartup(startup);
    const decoded = yield* decodeCitationRegexSessionStartup([argument]);
    expect(decoded).toEqual(startup);
    const complete = CitationRegexSessionComplete.make({ sequence: 0, groups: 0, matches: 0, spans: "" });
    for (const reply of [
      CitationRegexSessionReady.make({}),
      CitationRegexSessionStarted.make({ sequence: 0 }),
      CitationRegexSessionFailure.make({
        sequence: 0,
        failure: CitationSafetyLimitExceeded.make({ operation: "extract", limit: "processMessageBytes" }),
      }),
      complete,
    ]) {
      const frame = yield* encodeCitationRegexSessionReply(reply, limits.processMessageBytes);
      const value = yield* decodeCitationRegexSessionReply(frame.subarray(0, -1));
      expect(value).toEqual(reply);
      const failure = yield* encodeCitationRegexSessionReply(reply, frame.byteLength - 1).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "processMessageBytes" });
    }
    yield* preflightCitationRegexSessionControls(limits.processMessageBytes);
    const result = yield* citationRegexSessionResult(complete);
    expect(new TextDecoder().decode(result)).toBe(
      '{"_tag":"Complete","version":"citation-regex-result/v1","groups":0,"matches":0,"spans":""}'
    );
  })
);

it.effect("refuses malformed startup, structurally invalid replies and non-ASCII capture carriers", () =>
  Effect.gen(function* () {
    const missing = yield* decodeCitationRegexSessionStartup([]).pipe(Effect.flip);
    expect(missing).toMatchObject({ reason: "invalid-runtime" });
    const malformed = yield* decodeCitationRegexSessionReply(new TextEncoder().encode('{"_tag":"Other"}')).pipe(
      Effect.flip
    );
    expect(malformed).toMatchObject({ reason: "invalid-frame" });
    const failure = yield* encodeCitationRegexSessionReply(
      CitationRegexSessionComplete.make({ sequence: 0, groups: 0, matches: 0, spans: "é" }),
      8192
    ).pipe(Effect.flip);
    expect(failure).toMatchObject({ reason: "invalid-frame" });
  })
);

const encodeArgument = makeCitationNativeArgumentEncoder({
  codec: S.fromJsonString(S.String),
  maximum: 8192,
  invalid: () => "argument-exceeded",
});
it.effect("bounds variable startup arguments after schema encoding", () =>
  Effect.gen(function* () {
    const small = yield* encodeArgument("ok");
    expect(small).toBe('"ok"');
    const failure = yield* encodeArgument(Str.repeat(8192)("x")).pipe(Effect.flip);
    expect(failure).toBe("argument-exceeded");
  })
);

it.effect("preserves the v2 startup capture-name bound while sharing the argument encoder", () =>
  Effect.gen(function* () {
    const { limits } = yield* defaultCitationEnginePolicy;
    const descriptor = CitationRegexPatternDescriptor.make({
      patternSha256: Sha256Hex.make(Str.repeat(64)("a")),
      flags: 0,
      profile: {
        groups: 1,
        names: { [Str.repeat(8)("x")]: 1 },
        minimumWidthFloor: 1,
        repeatedCaptures: false,
        nullableMultiRepeat: false,
      },
    });
    const failure = yield* encodeCitationRegexStartup(
      CitationRegexWorkerStartup.make({ limits: { ...limits, patternUtf16: 1 }, engine: "python-re", descriptor })
    ).pipe(Effect.flip);
    expect(failure).toMatchObject({ reason: "invalid-runtime" });
  })
);
