import { $SchemaId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { staticDescriptorInstaller } from "@beep/schema/SchemaUtils/internal/staticDescriptors";
import { alwaysEquivalent } from "@beep/schema/SchemaUtils/toEquivalence";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const BoolKeySettings = S.Struct({
  visible: SchemaUtils.BoolKeyDefaultFalse,
  enabled: SchemaUtils.BoolKeyDefaultTrue,
});
const decodeBoolKeySettingsEffect = S.decodeUnknownEffect(BoolKeySettings);
const encodeBoolKeySettingsEffect = S.encodeEffect(BoolKeySettings);

describe("BoolKeyDefaultFalse and BoolKeyDefaultTrue", () => {
  it("default omitted constructor input", () => {
    expect(BoolKeySettings.make({})).toEqual({ visible: false, enabled: true });
    expect(BoolKeySettings.make({ visible: true, enabled: false })).toEqual({ visible: true, enabled: false });
  });

  it.effect(
    "default missing keys on decode and encode the decoded booleans",
    Effect.fnUntraced(function* () {
      expect(yield* decodeBoolKeySettingsEffect({})).toEqual({ visible: false, enabled: true });
      expect(yield* decodeBoolKeySettingsEffect({ visible: true })).toEqual({ visible: true, enabled: true });
      expect(yield* encodeBoolKeySettingsEffect({ visible: false, enabled: true })).toEqual({
        visible: false,
        enabled: true,
      });
    })
  );
});

describe("alwaysEquivalent", () => {
  const Failure = S.Struct({
    url: S.String,
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
    payload: S.Unknown.pipe(S.overrideToEquivalence(alwaysEquivalent)),
  });
  const sameFailure = S.toEquivalence(Failure);

  it("is exported from the SchemaUtils barrel", () => {
    expect(SchemaUtils.alwaysEquivalent).toBe(alwaysEquivalent);
  });

  it("leaves opaque fields out of the owning schema's identity", () => {
    expect(
      sameFailure(
        { url: "https://example.com", cause: new Error("first"), payload: { id: 1 } },
        { url: "https://example.com", cause: new Error("second"), payload: "other" }
      )
    ).toBe(true);
  });

  it("keeps the declared fields in the owning schema's identity", () => {
    expect(
      sameFailure(
        { url: "https://example.com", cause: new Error("same"), payload: 1 },
        { url: "https://example.org", cause: new Error("same"), payload: 1 }
      )
    ).toBe(false);
  });
});

describe("withStatics", () => {
  it("preserves statics when identity annotations run later in the pipeline", () => {
    const TenantName = S.String.pipe(
      SchemaUtils.withStatics(() => ({
        empty: "" as const,
      })),
      $SchemaId.annoteSchema("TenantName", {
        description: "Tenant name with helper statics.",
      })
    );

    expect(TenantName.empty).toBe("");
    expect(S.is(TenantName)("tenant")).toBe(true);
  });

  it("keeps an identical existing static and replaces a configurable one", () => {
    const shared = (): string => "shared";
    const target = { keep: shared, replace: "old" };
    const attached = SchemaUtils.withStatics(target, () => ({ keep: shared, replace: "new" }));

    expect(attached.keep).toBe(shared);
    expect(attached.replace).toBe("new");
  });

  it("skips an identical existing static when no owner preserves it", () => {
    const target = { same: 1 };
    Reflect.defineProperty(target, "same", { value: 1, configurable: false, enumerable: true });

    expect(staticDescriptorInstaller.install(target, { same: 1 }).same).toBe(1);
  });

  it("copies accessor statics as accessors", () => {
    const attached = SchemaUtils.withStatics({}, () => ({
      get computed(): number {
        return 2;
      },
    }));

    expect(attached.computed).toBe(2);
    expect(Reflect.getOwnPropertyDescriptor(attached, "computed")?.get).toBeTypeOf("function");
  });

  it("rejects a conflicting non-configurable static", () => {
    const target = {};
    Reflect.defineProperty(target, "locked", { value: "old", configurable: false, enumerable: true });

    expect(() => SchemaUtils.withStatics(target, () => ({ locked: "new" }))).toThrow(
      expect.objectContaining({
        _tag: "StaticDescriptorRedefinitionError",
        key: "locked",
        message: "Cannot redefine non-configurable static 'locked'.",
      })
    );
  });

  it("rejects a static on a non-extensible target", () => {
    const target = Object.preventExtensions({});

    expect(() => SchemaUtils.withStatics(target, () => ({ added: 1 }))).toThrow(
      expect.objectContaining({
        _tag: "StaticDescriptorRedefinitionError",
        key: "added",
        message: "Cannot define static 'added'.",
      })
    );
  });
});
