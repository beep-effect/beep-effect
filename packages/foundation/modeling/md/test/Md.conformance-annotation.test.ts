import {
  BeepMarkdownDocument,
  BeepMarkdownSpecificationProfile,
  CommonMarkDocument,
  CommonMarkSpecificationProfile,
  GfmDocument,
  GfmSpecificationProfile,
} from "@beep/md/Md.conformance";
import * as Conformance from "@beep/schema/Conformance";
import { validateConformanceAnnotationAgainstLedgerArtifacts } from "@beep/test-utils/ConformanceLedger";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("@beep/md conformance annotations", () => {
  it("collects the CommonMark profile from its strict document schema", () => {
    const annotation = CommonMarkDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual(["commonmark-0.31.2"]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual(CommonMarkSpecificationProfile.sourceIds);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual(CommonMarkSpecificationProfile.invariantIds);
  });

  it("collects the GFM profile from its strict document schema", () => {
    const annotation = GfmDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual(["gfm-0.29.0.gfm.13"]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual(GfmSpecificationProfile.sourceIds);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual(GfmSpecificationProfile.invariantIds);
  });

  it("collects the Beep extension profile from the strict Markdown document schema", () => {
    const annotation = BeepMarkdownDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    expect(S.is(Conformance.Annotation)(annotation)).toBe(true);
    expect(A.map(annotation.profiles, ({ id }) => id)).toEqual(["beep-md-extensions-v1"]);
    expect(A.map(annotation.sources, ({ id }) => id)).toEqual(BeepMarkdownSpecificationProfile.sourceIds);
    expect(A.map(annotation.invariants, ({ id }) => id)).toEqual(BeepMarkdownSpecificationProfile.invariantIds);
  });

  it.effect("matches every strict Markdown annotation to exact ledger records and enforcement evidence", () => {
    const commonMark = CommonMarkDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);
    const gfm = GfmDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);
    const beep = BeepMarkdownDocument.pipe(Conformance.collectConformanceAnnotations, A.head, O.getOrThrow);

    return Effect.all(
      [
        validateConformanceAnnotationAgainstLedgerArtifacts(new URL("../", import.meta.url), "@beep/md", commonMark),
        validateConformanceAnnotationAgainstLedgerArtifacts(new URL("../", import.meta.url), "@beep/md", gfm),
        validateConformanceAnnotationAgainstLedgerArtifacts(new URL("../", import.meta.url), "@beep/md", beep),
      ],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.map(A.flatten),
      Effect.map((issues) => expect(issues).toEqual([]))
    );
  });
});
