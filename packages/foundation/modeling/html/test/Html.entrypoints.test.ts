import { Html } from "@beep/html/Html";
import { Input } from "@beep/html/Html.model";
import { VERSION } from "@beep/html/Version";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";

describe("@beep/html per-module entry points", () => {
  it("exports the package version from its explicit subpath", () => {
    expect(VERSION).toBe("0.0.0");
  });

  it("validates detailed autocomplete through the staged facade", () => {
    const root = Input.make({
      autocomplete: O.some("section-checkout shipping email"),
      type: O.some("email"),
    });

    expect(Html.Conformant.issues(root)).toStrictEqual([]);
    const conformant = Effect.runSync(Html.Conformant.decode(root));
    expect(Html.Safe.issues(conformant)[0]?.rule).toBe("deniedElement");
    expect(Exit.isFailure(Effect.runSyncExit(Html.Safe.decode(conformant)))).toBe(true);
  });
});
