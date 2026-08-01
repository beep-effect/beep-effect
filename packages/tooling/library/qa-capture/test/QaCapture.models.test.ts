import {
  ActionEvent,
  ActionEventKind,
  ArtifactBudget,
  BeaconEvent,
  CaptureArtifact,
  CaptureLane,
  CaptureProvenance,
  CaptureSession,
  ClockConfidence,
  ClockSync,
  ClockSyncMethod,
  CollectorHandle,
  CssAnimationEvent,
  CssTransitionEvent,
  DomRect,
  DroppedWindow,
  DropReason,
  decodeActionEventJson,
  ExtractionPlan,
  ExtractionPriority,
  ExtractionRule,
  ExtractionRuleKind,
  ExtractionWindow,
  encodeActionEventJson,
  FocusInEvent,
  FocusOutEvent,
  GifSpec,
  KeyDownEvent,
  MarkerEvent,
  PointerDownEvent,
  PointerEnterEvent,
  PointerLeaveEvent,
  PointerMoveEvent,
  PointerUpEvent,
  ScrollEvent,
  SessionManifest,
  TransitionPhase,
  Viewport,
} from "@beep/qa-capture";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertRoundTrip = <Schema extends S.Codec<unknown, unknown>>(schema: Schema): void => {
  const encode = S.encodeSync(schema);
  const decode = S.decodeUnknownSync(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      expect(Equal.equals(decode(encode(value)), value)).toBe(true);
    }),
    fcRuns(25)
  );
};

describe("@beep/qa-capture models", () => {
  it("round-trips literal domains", () => {
    assertRoundTrip(ActionEventKind);
    assertRoundTrip(TransitionPhase);
    assertRoundTrip(CaptureLane);
    assertRoundTrip(ClockSyncMethod);
    assertRoundTrip(ClockConfidence);
    assertRoundTrip(ExtractionPriority);
    assertRoundTrip(ExtractionRuleKind);
    assertRoundTrip(DropReason);
  });

  it("round-trips every action-event variant and the union", () => {
    assertRoundTrip(DomRect);
    assertRoundTrip(PointerDownEvent);
    assertRoundTrip(PointerUpEvent);
    assertRoundTrip(PointerMoveEvent);
    assertRoundTrip(PointerEnterEvent);
    assertRoundTrip(PointerLeaveEvent);
    assertRoundTrip(FocusInEvent);
    assertRoundTrip(FocusOutEvent);
    assertRoundTrip(KeyDownEvent);
    assertRoundTrip(CssTransitionEvent);
    assertRoundTrip(CssAnimationEvent);
    assertRoundTrip(ScrollEvent);
    assertRoundTrip(MarkerEvent);
    assertRoundTrip(BeaconEvent);
    assertRoundTrip(ActionEvent);
  });

  it("round-trips session, provenance, and plan models", () => {
    assertRoundTrip(Viewport);
    assertRoundTrip(CaptureSession);
    assertRoundTrip(ClockSync);
    assertRoundTrip(CaptureProvenance);
    assertRoundTrip(CaptureArtifact);
    assertRoundTrip(SessionManifest);
    assertRoundTrip(CollectorHandle);
    assertRoundTrip(ArtifactBudget);
    assertRoundTrip(ExtractionRule);
    assertRoundTrip(GifSpec);
    assertRoundTrip(ExtractionWindow);
    assertRoundTrip(DroppedWindow);
    assertRoundTrip(ExtractionPlan);
  });

  it.effect("decodes an NDJSON line into the tagged union", () =>
    Effect.gen(function* () {
      const marker = MarkerEvent.make({
        kind: "marker",
        label: "scenario:sash-drag/start",
        seq: 1,
        tEpochMs: 1753838000000,
      });
      const line = yield* encodeActionEventJson(marker);
      const decoded = yield* decodeActionEventJson(line);
      expect(decoded.kind).toBe("marker");
      expect(Equal.equals(decoded, marker)).toBe(true);
    })
  );

  it.effect("rejects printable key identities by construction", () =>
    Effect.gen(function* () {
      const outcome = yield* Effect.exit(
        decodeActionEventJson('{"key":"a","kind":"key-down","modifiers":[],"seq":1,"tEpochMs":1753838000000}')
      );
      expect(outcome._tag).toBe("Failure");
    })
  );
});
