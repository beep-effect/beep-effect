import { HostProcessPlatform } from "@beep/utils/HostProcess";
import {
  CredentialBlobMaxBytes,
  SecretStoreUnsupported,
  SecretTarget,
  SecretTooLarge,
  WindowsSecretStore,
} from "@beep/windows-secrets";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const isSecretTarget = S.is(SecretTarget);

describe("SecretTarget", () => {
  it.each(["beep/m365/refresh-token", "beep/box/access-token", "beep/a1/b2-c3"])("accepts %s", (value) => {
    expect(isSecretTarget(value)).toBe(true);
  });

  it.each([
    "beep/M365/token",
    "beep/m365",
    "beep/m365/token/extra",
    "other/m365/token",
    "beep/m365/-token",
    "beep/m365/token-",
    "beep/m365/to--ken",
    "beep//token",
    "beep/m 365/token",
    "",
  ])("rejects %j", (value) => {
    expect(isSecretTarget(value)).toBe(false);
  });
});

// The memory layer is provided through the @effect/vitest harness (the test
// entry point), not via Effect.provide in the effect body; each test uses its
// own target because the layer is shared across the block.
it.layer(WindowsSecretStore.layerMemory, { timeout: "10 seconds" })("WindowsSecretStore.layerMemory", (it) => {
  it.effect("returns none for a missing credential", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const got = yield* store.get(SecretTarget.make("beep/test/missing"));
      assertNone(got);
    })
  );

  it.effect("round-trips a value per target", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const target = SecretTarget.make("beep/test/round-trip");
      const otherTarget = SecretTarget.make("beep/test/round-trip-other");
      yield* store.set(target, Redacted.make("first-secret"));
      yield* store.set(otherTarget, Redacted.make("other-secret"));
      yield* store.set(target, Redacted.make("second-secret"));
      const got1 = yield* store.get(target);
      assertSome(O.map(got1, Redacted.value), "second-secret");
      const got2 = yield* store.get(otherTarget);
      assertSome(O.map(got2, Redacted.value), "other-secret");
    })
  );

  it.effect("removes idempotently", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const target = SecretTarget.make("beep/test/remove");
      yield* store.set(target, Redacted.make("secret"));
      yield* store.remove(target);
      yield* store.remove(target);
      const got3 = yield* store.get(target);
      assertNone(got3);
    })
  );

  it.effect("accepts a value at the 2,560-byte cap", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const target = SecretTarget.make("beep/test/at-cap");
      const value = Str.repeat(CredentialBlobMaxBytes / 2)("x");
      yield* store.set(target, Redacted.make(value));
      const got4 = yield* store.get(target);
      assertSome(O.map(got4, Redacted.value), value);
    })
  );

  it.effect("fails with SecretTooLarge past the cap without storing or echoing the value", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const target = SecretTarget.make("beep/test/past-cap");
      const value = Str.repeat(CredentialBlobMaxBytes / 2 + 1)("y");
      const error = yield* Effect.flip(store.set(target, Redacted.make(value)));
      expect(error).toBeInstanceOf(SecretTooLarge);
      if (error._tag === "SecretTooLarge") {
        expect(error.bytes).toBe(2562);
        expect(error.limit).toBe(2560);
        expect(error.target).toBe(target);
      }
      expect(pipe(error.message, Str.includes("yyyy"))).toBe(false);
      const got5 = yield* store.get(target);
      assertNone(got5);
    })
  );

  it.effect("round-trips bytes through the identity protect double", () =>
    Effect.gen(function* () {
      const store = yield* WindowsSecretStore;
      const input = new Uint8Array([1, 2, 3, 250]);
      const protect6 = yield* store.protect(input);
      const restored = yield* store.unprotect(protect6);
      expect(restored).toEqual(input);
      expect(restored).not.toBe(input);
    })
  );
});

const buildStore = <E>(layer: Layer.Layer<WindowsSecretStore, E>) =>
  Effect.map(Layer.build(layer), (context) => Context.get(context, WindowsSecretStore));

describe("WindowsSecretStore layers", () => {
  it.effect("starts every memory layer build empty", () =>
    Effect.gen(function* () {
      const target = SecretTarget.make("beep/test/fresh-build");
      const first = yield* buildStore(WindowsSecretStore.layerMemory);
      yield* first.set(target, Redacted.make("secret"));
      const second = yield* buildStore(WindowsSecretStore.layerMemory);
      const got7 = yield* second.get(target);
      assertNone(got7);
    })
  );

  it.effect("fails layerWindows with SecretStoreUnsupported off Windows", () =>
    Effect.gen(function* () {
      const error = yield* WindowsSecretStore.layerWindows.pipe(buildStore, Effect.flip);
      expect(error).toBeInstanceOf(SecretStoreUnsupported);
      const expectation = expect(error.platform);
      const HostProcessPlatform1 = yield* HostProcessPlatform;
      expectation.toBe(HostProcessPlatform1);
    }).pipe(Effect.provideService(HostProcessPlatform, "linux"))
  );
});
