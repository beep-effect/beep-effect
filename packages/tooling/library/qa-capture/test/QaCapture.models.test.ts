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

const assertRoundTrip = Effect.fn("QaCaptureTest.assertRoundTrip")(function* <Schema extends S.Codec<unknown, unknown>>(
  name: string,
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(Equal.equals(decoded, value), name).toBe(true);
});

describe("@beep/qa-capture models", () => {
  it.effect.prop(
    "round-trips literal domains",
    {
      ActionEventKind: Arbitrary.schema(ActionEventKind),
      TransitionPhase: Arbitrary.schema(TransitionPhase),
      CaptureLane: Arbitrary.schema(CaptureLane),
      ClockSyncMethod: Arbitrary.schema(ClockSyncMethod),
      ClockConfidence: Arbitrary.schema(ClockConfidence),
      ExtractionPriority: Arbitrary.schema(ExtractionPriority),
      ExtractionRuleKind: Arbitrary.schema(ExtractionRuleKind),
      DropReason: Arbitrary.schema(DropReason),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertRoundTrip("ActionEventKind", ActionEventKind, values.ActionEventKind);
        yield* assertRoundTrip("TransitionPhase", TransitionPhase, values.TransitionPhase);
        yield* assertRoundTrip("CaptureLane", CaptureLane, values.CaptureLane);
        yield* assertRoundTrip("ClockSyncMethod", ClockSyncMethod, values.ClockSyncMethod);
        yield* assertRoundTrip("ClockConfidence", ClockConfidence, values.ClockConfidence);
        yield* assertRoundTrip("ExtractionPriority", ExtractionPriority, values.ExtractionPriority);
        yield* assertRoundTrip("ExtractionRuleKind", ExtractionRuleKind, values.ExtractionRuleKind);
        yield* assertRoundTrip("DropReason", DropReason, values.DropReason);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips every action-event variant and the union",
    {
      DomRect: Arbitrary.schema(DomRect),
      PointerDownEvent: Arbitrary.schema(PointerDownEvent),
      PointerUpEvent: Arbitrary.schema(PointerUpEvent),
      PointerMoveEvent: Arbitrary.schema(PointerMoveEvent),
      PointerEnterEvent: Arbitrary.schema(PointerEnterEvent),
      PointerLeaveEvent: Arbitrary.schema(PointerLeaveEvent),
      FocusInEvent: Arbitrary.schema(FocusInEvent),
      FocusOutEvent: Arbitrary.schema(FocusOutEvent),
      KeyDownEvent: Arbitrary.schema(KeyDownEvent),
      CssTransitionEvent: Arbitrary.schema(CssTransitionEvent),
      CssAnimationEvent: Arbitrary.schema(CssAnimationEvent),
      ScrollEvent: Arbitrary.schema(ScrollEvent),
      MarkerEvent: Arbitrary.schema(MarkerEvent),
      BeaconEvent: Arbitrary.schema(BeaconEvent),
      ActionEvent: Arbitrary.schema(ActionEvent),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertRoundTrip("DomRect", DomRect, values.DomRect);
        yield* assertRoundTrip("PointerDownEvent", PointerDownEvent, values.PointerDownEvent);
        yield* assertRoundTrip("PointerUpEvent", PointerUpEvent, values.PointerUpEvent);
        yield* assertRoundTrip("PointerMoveEvent", PointerMoveEvent, values.PointerMoveEvent);
        yield* assertRoundTrip("PointerEnterEvent", PointerEnterEvent, values.PointerEnterEvent);
        yield* assertRoundTrip("PointerLeaveEvent", PointerLeaveEvent, values.PointerLeaveEvent);
        yield* assertRoundTrip("FocusInEvent", FocusInEvent, values.FocusInEvent);
        yield* assertRoundTrip("FocusOutEvent", FocusOutEvent, values.FocusOutEvent);
        yield* assertRoundTrip("KeyDownEvent", KeyDownEvent, values.KeyDownEvent);
        yield* assertRoundTrip("CssTransitionEvent", CssTransitionEvent, values.CssTransitionEvent);
        yield* assertRoundTrip("CssAnimationEvent", CssAnimationEvent, values.CssAnimationEvent);
        yield* assertRoundTrip("ScrollEvent", ScrollEvent, values.ScrollEvent);
        yield* assertRoundTrip("MarkerEvent", MarkerEvent, values.MarkerEvent);
        yield* assertRoundTrip("BeaconEvent", BeaconEvent, values.BeaconEvent);
        yield* assertRoundTrip("ActionEvent", ActionEvent, values.ActionEvent);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips session, provenance, and plan models",
    {
      Viewport: Arbitrary.schema(Viewport),
      CaptureSession: Arbitrary.schema(CaptureSession),
      ClockSync: Arbitrary.schema(ClockSync),
      CaptureProvenance: Arbitrary.schema(CaptureProvenance),
      CaptureArtifact: Arbitrary.schema(CaptureArtifact),
      SessionManifest: Arbitrary.schema(SessionManifest),
      CollectorHandle: Arbitrary.schema(CollectorHandle),
      ArtifactBudget: Arbitrary.schema(ArtifactBudget),
      ExtractionRule: Arbitrary.schema(ExtractionRule),
      GifSpec: Arbitrary.schema(GifSpec),
      ExtractionWindow: Arbitrary.schema(ExtractionWindow),
      DroppedWindow: Arbitrary.schema(DroppedWindow),
      ExtractionPlan: Arbitrary.schema(ExtractionPlan),
    },
    (values) =>
      Effect.gen(function* () {
        yield* assertRoundTrip("Viewport", Viewport, values.Viewport);
        yield* assertRoundTrip("CaptureSession", CaptureSession, values.CaptureSession);
        yield* assertRoundTrip("ClockSync", ClockSync, values.ClockSync);
        yield* assertRoundTrip("CaptureProvenance", CaptureProvenance, values.CaptureProvenance);
        yield* assertRoundTrip("CaptureArtifact", CaptureArtifact, values.CaptureArtifact);
        yield* assertRoundTrip("SessionManifest", SessionManifest, values.SessionManifest);
        yield* assertRoundTrip("CollectorHandle", CollectorHandle, values.CollectorHandle);
        yield* assertRoundTrip("ArtifactBudget", ArtifactBudget, values.ArtifactBudget);
        yield* assertRoundTrip("ExtractionRule", ExtractionRule, values.ExtractionRule);
        yield* assertRoundTrip("GifSpec", GifSpec, values.GifSpec);
        yield* assertRoundTrip("ExtractionWindow", ExtractionWindow, values.ExtractionWindow);
        yield* assertRoundTrip("DroppedWindow", DroppedWindow, values.DroppedWindow);
        yield* assertRoundTrip("ExtractionPlan", ExtractionPlan, values.ExtractionPlan);
      }),
    { arbitrary: fcRuns(25) }
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
