import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  CombineSegmentsResult,
  ImprovedTranscript,
  ImprovedTranscriptSegment,
  SENTENCE_ENDERS,
  SpeakerIdentityStatus,
  TranscriptSegment,
  Translation,
  canDisplaySeconds,
  combineSegments,
  getTimestampString,
  iterateCombineSegmentsResult,
  legacyConversationSegmentId,
  prepareTranscriptSegment,
  segmentsAsString,
} from "../../beep/TranscriptSegment.ts";

const decode = <A extends S.Top>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const segment = (patch: {
  readonly id: string;
  readonly text: string;
  readonly isUser?: boolean;
  readonly speakerId?: number;
  readonly start: number;
  readonly end: number;
  readonly speaker?: O.Option<string>;
  readonly personId?: O.Option<string>;
  readonly sttProvider?: O.Option<string>;
}) =>
  TranscriptSegment.make({
    id: patch.id,
    text: patch.text,
    isUser: patch.isUser ?? false,
    speakerId: patch.speakerId ?? 0,
    start: patch.start,
    end: patch.end,
    speaker: patch.speaker,
    personId: patch.personId,
    sttProvider: patch.sttProvider,
  });

describe("TranscriptSegment", () => {
  it("decodes present values and missing or null options", () => {
    const present = decode(toWire(TranscriptSegment), {
      id: "seg-1",
      text: "Hello",
      speaker: "SPEAKER_01",
      speaker_id: 1,
      is_user: false,
      person_id: "p1",
      start: 0,
      end: 1.5,
      translations: [{ lang: "es", text: "Hola" }],
      speech_profile_processed: false,
      stt_provider: "deepgram",
      speaker_match_source: "profile",
      speaker_id_scope: "account",
      speaker_identity_status: "not_user",
    });
    assert.strictEqual(present.speakerId, 1);
    assert.strictEqual(O.getOrElse(present.personId, () => ""), "p1");
    assert.strictEqual(O.getOrElse(present.translations, () => []).length, 1);
    const missing = decode(toWire(TranscriptSegment), {
      id: "seg-2",
      text: "Hi",
      speaker_id: 0,
      is_user: true,
      start: 0,
      end: 1,
      speech_profile_processed: true,
      speaker_identity_status: "user",
    });
    assert.strictEqual(O.getOrElse(missing.speaker, () => ""), "SPEAKER_00");
    assert.strictEqual(O.isNone(missing.personId), true);
    assert.strictEqual(O.isNone(missing.sttProvider), true);
    const nulled = decode(toWire(TranscriptSegment), {
      id: "seg-3",
      text: "Hi",
      speaker: null,
      speaker_id: 0,
      is_user: false,
      person_id: null,
      start: 0,
      end: 1,
      translations: null,
      stt_provider: null,
      speaker_match_source: null,
      speaker_id_scope: null,
      speech_profile_processed: true,
      speaker_identity_status: "unknown",
    });
    assert.strictEqual(O.isNone(nulled.speaker), true);
    assert.strictEqual(O.isNone(nulled.translations), true);
  });

  it("prepares ids, speaker numbers, and the synthesized flag", () => {
    const parsed = Effect.runSync(
      prepareTranscriptSegment({ text: "Hello", speaker: "SPEAKER_03", isUser: false, start: 0, end: 1 }),
    );
    assert.strictEqual(parsed.segment.speakerId, 3);
    assert.strictEqual(parsed.speakerIdSynthesized, false);
    const synthesized = Effect.runSync(prepareTranscriptSegment({ text: "Hello", isUser: true, start: 0, end: 1 }));
    assert.strictEqual(synthesized.speakerIdSynthesized, true);
    assert.strictEqual(synthesized.segment.speakerId, 0);
    assert.strictEqual(synthesized.segment.speakerIdentityStatus, "user");
    assert.strictEqual(/^[0-9a-f-]{36}$/.test(synthesized.segment.id), true);
    const explicit = Effect.runSync(
      prepareTranscriptSegment({
        text: "Hello",
        speaker: null,
        speakerId: null,
        isUser: true,
        speakerIdentityStatus: "not_user",
        start: 0,
        end: 1,
      }),
    );
    assert.strictEqual(explicit.segment.speakerIdentityStatus, "not_user");
    assert.strictEqual(O.isNone(explicit.segment.speaker), true);
    assert.strictEqual(explicit.speakerIdSynthesized, true);
    const kept = Effect.runSync(
      prepareTranscriptSegment({ text: "Hello", speakerId: 4, isUser: false, start: 0, end: 1 }),
    );
    assert.strictEqual(kept.segment.speakerId, 4);
    assert.strictEqual(kept.speakerIdSynthesized, false);
    assert.strictEqual(legacyConversationSegmentId("conv-1", 0), "da57cb65-5efc-5c8a-9e87-2959d45b8279");
  });

  it("formats timestamps and speaker names", () => {
    const timed = segment({ id: "t", text: "Hi", isUser: true, start: 3661, end: 59 });
    assert.strictEqual(getTimestampString(timed), "1:01:01 - 0:00:59");
    const ordered = [
      segment({ id: "a", text: " Hi ", isUser: true, start: 0, end: 1 }),
      segment({ id: "b", text: "There", isUser: false, speakerId: 2, personId: O.some("p1"), start: 2, end: 3 }),
      segment({ id: "c", text: "Else", isUser: false, speakerId: 3, start: 4, end: 5 }),
    ];
    assert.strictEqual(canDisplaySeconds(ordered), true);
    assert.strictEqual(
      segmentsAsString(ordered, true, "", [{ id: "p1", name: "Ada" }]),
      "[0:00:00 - 0:00:01] User: Hi\n\n[0:00:02 - 0:00:03] Ada: There\n\n[0:00:04 - 0:00:05] Speaker 3: Else",
    );
    const overlap = [
      segment({ id: "a", text: "A", start: 0, end: 5 }),
      segment({ id: "b", text: "B", start: 1, end: 2 }),
    ];
    assert.strictEqual(canDisplaySeconds(overlap), false);
    assert.strictEqual(segmentsAsString(overlap, true), "Speaker 0: A\n\nSpeaker 0: B");
    assert.strictEqual(SENTENCE_ENDERS.includes("。"), true);
    assert.strictEqual(decode(SpeakerIdentityStatus, "no_match"), "no_match");
  });

  it("merges, protects, and iterates without the absorbed map", () => {
    const left = segment({ id: "a", text: "Hello", isUser: true, start: 0, end: 1 });
    const right = segment({ id: "b", text: "there", isUser: true, start: 1.2, end: 2 });
    const merged = combineSegments([left], [right]);
    assert.strictEqual(merged.segments.length, 1);
    assert.strictEqual(merged.segments[0]?.text, "Hello there");
    assert.strictEqual(merged.removedIds[0], "b");
    assert.strictEqual(merged.absorbedInto.b, "a");
    assert.strictEqual(iterateCombineSegmentsResult(merged).length, 3);
    const untouched = combineSegments([left], []);
    assert.strictEqual(untouched.segments.length, 1);
    assert.strictEqual(untouched.joined.length, 0);
    const protectedMerge = combineSegments([left], [right], 0, HashSet.make("b"));
    assert.strictEqual(protectedMerge.segments.length, 2);
    const shifted = combineSegments([], [segment({ id: "n", text: "Later", start: 1, end: 2 })], 5);
    assert.strictEqual(shifted.segments[0]?.start, 6);
    const different = combineSegments(
      [segment({ id: "a", text: "Hello", isUser: false, speaker: O.some("SPEAKER_00"), start: 0, end: 1 })],
      [
        segment({
          id: "b",
          text: "there. Next",
          isUser: false,
          speaker: O.some("SPEAKER_01"),
          speakerId: 1,
          start: 1,
          end: 2,
        }),
      ],
    );
    assert.strictEqual(different.segments.length >= 1, true);
    const provider = combineSegments(
      [left],
      [segment({ id: "c", text: "there", isUser: true, start: 1.2, end: 2, sttProvider: O.some("other") })],
    );
    assert.strictEqual(provider.segments.length, 2);
    const decoded = decode(toWire(ImprovedTranscript), { result: [{ speakerId: 2, text: "Hello" }] });
    assert.strictEqual(decoded.result[0]?.speakerId, 2);
    void Translation;
    void ImprovedTranscriptSegment;
    void CombineSegmentsResult;
  });

  it("derives an arbitrary for every exported model", () => {
    for (const schema of [
      SpeakerIdentityStatus,
      Translation,
      TranscriptSegment,
      CombineSegmentsResult,
      ImprovedTranscriptSegment,
      ImprovedTranscript,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
