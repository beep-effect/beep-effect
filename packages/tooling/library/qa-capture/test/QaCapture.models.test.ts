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
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const assertRoundTrip = Effect.fn("assertRoundTrip")(function* <Schema extends S.Codec<unknown, unknown>>(
  schema: Schema
) {
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.all([Arbitrary.schema(schema)]),
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
        expect(Equal.equals(decoded, value)).toBe(true);

        return true;
      }),
    fcRuns(25)
  );
  expect(result._tag).toBe("Passed");
});

describe("@beep/qa-capture models", () => {
  it.effect("round-trips literal domains", () =>
    Effect.gen(function* () {
      yield* assertRoundTrip(ActionEventKind);
      yield* assertRoundTrip(TransitionPhase);
      yield* assertRoundTrip(CaptureLane);
      yield* assertRoundTrip(ClockSyncMethod);
      yield* assertRoundTrip(ClockConfidence);
      yield* assertRoundTrip(ExtractionPriority);
      yield* assertRoundTrip(ExtractionRuleKind);
      yield* assertRoundTrip(DropReason);
    })
  );

  it.effect("round-trips every action-event variant and the union", () =>
    Effect.gen(function* () {
      yield* assertRoundTrip(DomRect);
      yield* assertRoundTrip(PointerDownEvent);
      yield* assertRoundTrip(PointerUpEvent);
      yield* assertRoundTrip(PointerMoveEvent);
      yield* assertRoundTrip(PointerEnterEvent);
      yield* assertRoundTrip(PointerLeaveEvent);
      yield* assertRoundTrip(FocusInEvent);
      yield* assertRoundTrip(FocusOutEvent);
      yield* assertRoundTrip(KeyDownEvent);
      yield* assertRoundTrip(CssTransitionEvent);
      yield* assertRoundTrip(CssAnimationEvent);
      yield* assertRoundTrip(ScrollEvent);
      yield* assertRoundTrip(MarkerEvent);
      yield* assertRoundTrip(BeaconEvent);
      yield* assertRoundTrip(ActionEvent);
    })
  );

  it.effect("round-trips session, provenance, and plan models", () =>
    Effect.gen(function* () {
      yield* assertRoundTrip(Viewport);
      yield* assertRoundTrip(CaptureSession);
      yield* assertRoundTrip(ClockSync);
      yield* assertRoundTrip(CaptureProvenance);
      yield* assertRoundTrip(CaptureArtifact);
      yield* assertRoundTrip(SessionManifest);
      yield* assertRoundTrip(CollectorHandle);
      yield* assertRoundTrip(ArtifactBudget);
      yield* assertRoundTrip(ExtractionRule);
      yield* assertRoundTrip(GifSpec);
      yield* assertRoundTrip(ExtractionWindow);
      yield* assertRoundTrip(DroppedWindow);
      yield* assertRoundTrip(ExtractionPlan);
    })
  );

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
