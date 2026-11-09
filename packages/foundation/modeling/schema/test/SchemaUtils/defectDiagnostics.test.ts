import { defectDiagnostics, optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics";
import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as S from "effect/Schema";

const Failure = S.Struct({
  operation: S.String,
  cause: optionalDefect("Underlying failure."),
  message: optionalDefectMessage("Message of the underlying failure."),
});

describe("defectDiagnostics", () => {
  it("keeps an Error as the cause and extracts its message", () => {
    const original = new Error("disk full");
    const diagnostics = defectDiagnostics(original);

    assertSome(diagnostics.cause, original);
    assertSome(diagnostics.message, "disk full");
  });

  it("keeps a non-Error cause without a message", () => {
    const diagnostics = defectDiagnostics("plain failure");

    assertSome(diagnostics.cause, "plain failure");
    assertNone(diagnostics.message);
  });

  it("drops an empty Error message", () => {
    assertNone(defectDiagnostics(new Error("")).message);
  });

  it("reports nothing when no cause was supplied", () => {
    const diagnostics = defectDiagnostics(undefined);

    assertNone(diagnostics.cause);
    assertNone(diagnostics.message);
  });

  it("fills an error struct built from the paired fields", () => {
    const failure = Failure.make({ operation: "write", ...defectDiagnostics(new Error("boom")) });
    assertSome(failure.message, "boom");

    const bare = Failure.make({ operation: "write" });
    assertNone(bare.cause);
    assertNone(bare.message);
    expect(bare.operation).toBe("write");
  });
});
