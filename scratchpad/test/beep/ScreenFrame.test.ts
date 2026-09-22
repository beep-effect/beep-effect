import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  ConversationScreenFrame,
  ConversationScreenFrameSet,
  NormalizedRect,
  ScreenFrameAdjudicationRequest,
  ScreenFrameAdjudicationResponse,
  ScreenFrameApprovalClaims,
  ScreenFrameCandidateIn,
  ScreenFrameGround,
  ScreenFrameJudgement,
  ScreenFrameSettings,
  ScreenFrameSettingsUpdateRequest,
  ScreenFrameSharingUpdateRequest,
  ScreenFrameSubjectIn,
  capLabels,
  truncateCaption,
} from "../../beep/ScreenFrame.ts";

const decode = <A, I>(schema: S.Codec<A, I>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const candidate = {
  clientFrameId: "frame-1",
  capturedAt: "2020-01-02T03:04:05.000Z",
  mimeType: "image/jpeg",
  declaredWidth: 640,
  declaredHeight: 480,
  sha256Base64: "a".repeat(44),
  bytesBase64: "aaaa",
};

describe("ScreenFrame", () => {
  it("truncates captions by code point and leaves non-strings alone", () => {
    expect(truncateCaption("hello")).toBe("hello");
    expect(truncateCaption("a".repeat(161))).toBe("a".repeat(160));
    expect(truncateCaption(`${"a".repeat(159)}\u0301extra`)).toBe("a".repeat(159));
    expect(truncateCaption(`${"a".repeat(159)}\u200dextra`)).toBe("a".repeat(159));
    expect(truncateCaption("😀".repeat(161))).toBe("😀".repeat(160));
    expect(truncateCaption(1)).toBe(1);
    const capped = capLabels(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    expect(Array.isArray(capped) && capped).toHaveLength(8);
    expect(capLabels("labels")).toBe("labels");
  });

  it("applies caption and label caps while decoding a judgement", () => {
    const approved = decode(ScreenFrameJudgement, {
      outcome: "approved_clean",
      caption: "a".repeat(161),
      labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
      bannerSuitability: 1,
      rejectReason: "other",
    });
    const rejected = decode(ScreenFrameJudgement, {
      outcome: "rejected",
      caption: "short",
      labels: [],
      bannerSuitability: 0,
    });
    expect(approved.caption).toHaveLength(160);
    expect(approved.labels).toHaveLength(8);
    expect(approved.rejectReason).toEqual(O.some("other"));
    expect(O.isNone(rejected.rejectReason)).toBe(true);
    expect(Effect.runSyncExit(S.decodeUnknownEffect(ScreenFrameJudgement)({
      outcome: "approved_clean",
      caption: "ok",
      labels: ["one"],
      bannerSuitability: 1.1,
    }))._tag).toBe("Failure");
  });

  it("decodes both mime types, both attempt outcomes, and an open claim purpose", () => {
    const png = decode(ScreenFrameCandidateIn, { ...candidate, mimeType: "image/png" });
    expect(png.mimeType).toBe("image/png");
    const request = decode(ScreenFrameAdjudicationRequest, {
      schemaVersion: 1,
      attemptId: "00000000-0000-4000-8000-000000000001",
      purpose: "meeting_note_v1",
      subject: { kind: "conversation", id: "conv-1" },
      candidates: [candidate],
    });
    expect(request.candidates).toHaveLength(1);
    const response = decode(ScreenFrameAdjudicationResponse, {
      attemptId: "00000000-0000-4000-8000-000000000001",
      outcome: "no_approved_frames",
      frameSet: { revision: 0, strip: [] },
    });
    expect(response.outcome).toBe("no_approved_frames");
    expect(O.isNone(response.frameSet.banner)).toBe(true);
    const claims = decode(ScreenFrameApprovalClaims, {
      iss: "omi-screen-frame-adjudicator",
      aud: "omi-screen-frame-writer",
      jti: "00000000-0000-4000-8000-000000000001",
      uid: "user-1",
      purpose: "custom-purpose",
      subjectKind: "conversation",
      subjectId: "conv-1",
      canonicalSha256: "abc",
      model: "judge",
      policyVersion: "p1",
      promptVersion: "prompt-1",
      retention: "custom-retention",
      decision: "approved_clean",
      labelsDigest: "digest",
      issuedAt: "2020-01-02T03:04:05.000Z",
      expiresAt: "2020-01-02T03:14:05.000Z",
    });
    expect(claims.purpose).toBe("custom-purpose");
    expect(claims.retention).toBe("custom-retention");
    const ground = decode(ScreenFrameGround, { stops: ["not-hex", "also"], isNeutral: true });
    expect(ground.stops).toEqual(["not-hex", "also"]);
    expect(Effect.runSyncExit(S.decodeUnknownEffect(ScreenFrameGround)({ stops: ["#000000"], isNeutral: false }))._tag)
      .toBe("Failure");
    const frame = decode(ConversationScreenFrame, {
      id: "frame-1",
      capturedAt: "2020-01-02T03:04:05.000Z",
      role: "strip",
      rank: 6,
      caption: "Notes",
      labels: [],
      sourceBadge: null,
      focalRegion: null,
      width: 1,
      height: 1,
      contentUrl: "https://example.test/frame",
      thumbnailUrl: "https://example.test/thumb",
      urlExpiresAt: "2020-01-02T04:04:05.000Z",
      ground: { stops: ["#000000", "#ffffff"], isNeutral: false },
    });
    expect(O.isNone(frame.sourceBadge)).toBe(true);
    expect(O.isNone(frame.focalRegion)).toBe(true);
    expect(decode(ScreenFrameSettings, { meetingNoteScreenshotsEnabled: false }).meetingNoteScreenshotsEnabled).toBe(
      false,
    );
    expect(decode(ScreenFrameSharingUpdateRequest, { enabled: true }).enabled).toBe(true);
    expect(decode(ScreenFrameSettingsUpdateRequest, { meetingNoteScreenshotsEnabled: true })
      .meetingNoteScreenshotsEnabled).toBe(true);
    expect(decode(NormalizedRect, { x: 0, y: 0, width: 1, height: 1 }).width).toBe(1);
    expect(decode(ScreenFrameSubjectIn, { kind: "conversation", id: "conv-1" }).id).toBe("conv-1");
    const set = ConversationScreenFrameSet.make({ revision: 0 });
    expect(set.strip).toHaveLength(0);
    expect(P.isString(truncateCaption("ok"))).toBe(true);
  });

  it("builds an arbitrary for each screen-frame model", () => {
    for (const model of [
      ScreenFrameSubjectIn,
      ScreenFrameCandidateIn,
      ScreenFrameAdjudicationRequest,
      ScreenFrameSharingUpdateRequest,
      ScreenFrameSettings,
      ScreenFrameSettingsUpdateRequest,
      NormalizedRect,
      ScreenFrameGround,
      ConversationScreenFrame,
      ConversationScreenFrameSet,
      ScreenFrameAdjudicationResponse,
      ScreenFrameJudgement,
      ScreenFrameApprovalClaims,
    ]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
