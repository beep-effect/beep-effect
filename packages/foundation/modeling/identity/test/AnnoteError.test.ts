import { make } from "@beep/identity";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const $I = make("probe").$ProbeId.create("Widget");

class WidgetError extends S.TaggedError<WidgetError>($I`WidgetError`)(
  "WidgetError",
  { reason: S.String, attempts: S.Number },
  $I.annoteError<WidgetError>("WidgetError", { description: "Widget failed." })
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
});
