import { make } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const $I = make("probe").$ProbeId.create("Widget");
const $Bound = make("probe", { authority: "https://ns.beep.sh/", prefix: "beep" }).$ProbeId.create("Widget");

class WidgetError extends S.TaggedError<WidgetError>($I`WidgetError`)(
  "WidgetError",
  { reason: S.String, attempts: S.Finite },
  $I.annoteError<WidgetError>("WidgetError", { description: "Widget failed." })
) {}

class BoundWidgetError extends S.TaggedError<BoundWidgetError>($Bound`BoundWidgetError`)(
  "BoundWidgetError",
  { reason: S.String },
  $Bound.annoteError<BoundWidgetError>("BoundWidgetError", { description: "Bound widget failed." })
) {}

describe("IdentityComposer.annoteError", () => {
  it("adopts the declared field struct as the error's equivalence", () => {
    const same = S.toEquivalence(WidgetError);
    const a = WidgetError.make({ reason: "x", attempts: 1 });
    const b = WidgetError.make({ reason: "x", attempts: 1 });
    const c = WidgetError.make({ reason: "x", attempts: 2 });

    expect(same(a, b)).toBe(true);
    expect(same(a, c)).toBe(false);
  });

  it("carries identity metadata and the caller extras", () => {
    const record = $I.annoteError<WidgetError>("WidgetError", { description: "Widget failed." });

    expect(record.identifier).toBe("@beep/probe/Widget/WidgetError");
    expect(record.title).toBe("WidgetError");
    expect(record.description).toBe("Widget failed.");
    expect(typeof record.schemaId).toBe("symbol");
  });

  it("omits iri and curie on an unbound composer", () => {
    const record = $I.annoteError<WidgetError>("WidgetError", { description: "Widget failed." });

    expect("iri" in record).toBe(false);
    expect("curie" in record).toBe(false);
  });

  it("forwards the bound composer's iri and curie, matching annote", () => {
    const identity = $Bound.annote("BoundWidgetError");
    const record = $Bound.annoteError<BoundWidgetError>("BoundWidgetError", {
      description: "Bound widget failed.",
    });

    expect(typeof identity.iri).toBe("string");
    expect(typeof identity.curie).toBe("string");
    expect(record.iri).toBe(identity.iri);
    expect(record.curie).toBe(identity.curie);
  });

  it("resolves iri and curie on the annotated error class", () => {
    const identity = $Bound.annote("BoundWidgetError");
    const resolved = S.resolveAnnotations(BoundWidgetError);

    expect(resolved?.iri).toBe(identity.iri);
    expect(resolved?.curie).toBe(identity.curie);
  });

  it("lets a caller-supplied title win over the derived default", () => {
    const record = $I.annoteError<WidgetError>("WidgetError", { title: "Custom Widget Failure" });

    expect(record.title).toBe("Custom Widget Failure");
  });
});
