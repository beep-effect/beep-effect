import { XdgBase, XdgBaseKind } from "@beep/xdg/XdgBase";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixtureText } from "./support/rawModules.ts";

const provider = (vars: Record<string, string>) => ConfigProvider.fromUnknown(vars);

describe("XdgBase", () => {
  it.effect("names the variable of every kind", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(A.map(XdgBaseKind.literals, XdgBase.variable), [
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "XDG_CACHE_HOME",
        "XDG_STATE_HOME",
        "XDG_RUNTIME_DIR",
      ]);
    })
  );

  describe("resolve", () => {
    // README Deviations "absolute HOME, two meanings": Xdg.layer accepts a Windows HOME, XdgBase does not.
    it.effect("treats a Windows HOME or value as absent, unlike Xdg.layer", () =>
      Effect.sync(() => {
        for (const windows of ["C:/x", "C:\\Users\\ada", "\\\\server\\share"]) {
          assertNone(XdgBase.resolve("state", { home: windows }));
          assertSome(XdgBase.resolve("state", { value: windows, home: "/home/ada" }), "/home/ada/.local/state");
        }
      })
    );

    it.effect("uses an absolute value verbatim", () =>
      Effect.sync(() => {
        assertSome(XdgBase.resolve("config", { value: "/x//y/", home: "/home/ada" }), "/x//y/");
        assertSome(XdgBase.resolve("runtime", { value: "/run/user/1000" }), "/run/user/1000");
        assertSome(XdgBase.resolve("state", { value: "/trailing " }), "/trailing ");
      })
    );

    it.effect("falls back to the spec default under HOME", () =>
      Effect.sync(() => {
        const home = { home: "/home/ada" };
        assertSome(XdgBase.resolve("config", home), "/home/ada/.config");
        assertSome(XdgBase.resolve("data", home), "/home/ada/.local/share");
        assertSome(XdgBase.resolve("cache", home), "/home/ada/.cache");
        assertSome(XdgBase.resolve("state", home), "/home/ada/.local/state");
        assertNone(XdgBase.resolve("runtime", home));
      })
    );

    it.effect("normalizes HOME the way systemd-path does before appending the default", () =>
      Effect.sync(() => {
        assertSome(XdgBase.resolve("config", { home: "/home/ada//" }), "/home/ada/.config");
        assertSome(XdgBase.resolve("config", { home: "/a/./b" }), "/a/b/.config");
        assertSome(XdgBase.resolve("config", { home: "/" }), "/.config");
        assertSome(XdgBase.resolve("config", { home: "/.." }), "/.config");
        // Inner `..` and trailing spaces are kept verbatim.
        assertSome(XdgBase.resolve("config", { home: "/a/../b" }), "/a/../b/.config");
        assertSome(XdgBase.resolve("config", { home: "/home/ada " }), "/home/ada /.config");
      })
    );

    // Inverted: the lab and both adopters took any non-empty value; an invalid
    // value is now ignored, as the spec and systemd-path require.
    it.effect("ignores empty, whitespace and relative values", () =>
      Effect.sync(() => {
        for (const value of ["", " ", "relative", "~/state", " /leading-space"]) {
          assertSome(XdgBase.resolve("state", { value, home: "/home/ada" }), "/home/ada/.local/state");
          assertNone(XdgBase.resolve("runtime", { value, home: "/home/ada" }));
        }
      })
    );

    it.effect("is absent without a valid value and without an absolute HOME", () =>
      Effect.sync(() => {
        assertNone(XdgBase.resolve("config", {}));
        assertNone(XdgBase.resolve("config", { home: "" }));
        assertNone(XdgBase.resolve("config", { home: "home/ada" }));
        assertNone(XdgBase.resolve("config", { value: "relative", home: "relative" }));
      })
    );
  });

  describe("dir", () => {
    it.effect("reads the variable and HOME from the provider", () =>
      Effect.gen(function* () {
        assertSome(yield* XdgBase.dir("data").parse(provider({ XDG_DATA_HOME: "/data" })), "/data");
        assertSome(yield* XdgBase.dir("data").parse(provider({ HOME: "/home/ada" })), "/home/ada/.local/share");
        assertSome(
          yield* XdgBase.dir("data").parse(provider({ HOME: "/home/ada", XDG_DATA_HOME: "data" })),
          "/home/ada/.local/share"
        );
      })
    );

    it.effect("answers none instead of failing when nothing resolves", () =>
      Effect.gen(function* () {
        assertNone(yield* XdgBase.dir("state").parse(provider({})));
        assertNone(yield* XdgBase.dir("runtime").parse(provider({ HOME: "/home/ada" })));
      })
    );
  });

  describe("require", () => {
    it.effect("succeeds with the same answer as dir", () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* XdgBase.require("state").parse(provider({ HOME: "/h" })), "/h/.local/state");
        assert.strictEqual(yield* XdgBase.require("runtime").parse(provider({ XDG_RUNTIME_DIR: "/run/x" })), "/run/x");
      })
    );

    it.effect("fails with a ConfigError naming HOME when no default can be built", () =>
      Effect.gen(function* () {
        const missing = yield* Effect.flip(XdgBase.require("state").parse(provider({})));
        assert.strictEqual(missing._tag, "ConfigError");
        assert.include(missing.message, "HOME");
        const relative = yield* Effect.flip(XdgBase.require("cache").parse(provider({ HOME: "home/ada" })));
        assert.include(relative.message, "Expected an absolute path");
      })
    );

    it.effect("fails with a ConfigError naming XDG_RUNTIME_DIR for the runtime directory", () =>
      Effect.gen(function* () {
        const missing = yield* Effect.flip(XdgBase.require("runtime").parse(provider({ HOME: "/home/ada" })));
        assert.include(missing.message, "XDG_RUNTIME_DIR");
        const relative = yield* Effect.flip(XdgBase.require("runtime").parse(provider({ XDG_RUNTIME_DIR: "run" })));
        assert.include(relative.message, "Expected an absolute path");
      })
    );
  });
});

const Nullable = S.NullOr(S.String);
const Golden = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag(1),
    systemd: S.String,
    cases: S.Array(S.Tuple([XdgBaseKind, Nullable, Nullable, Nullable])),
  })
);

describe("XdgBase against frozen systemd-path answers", () => {
  // Regenerate with goals/effected-promotion/ops/xdg-systemd-differential.ts --golden.
  // `systemd` is null where systemd-path had no answer, or answered from the user
  // database because neither the variable nor HOME was valid (passwd-fallback):
  // XdgBase is HOME-optional and answers none there.
  it.effect("matches every recorded case", () =>
    Effect.gen(function* () {
      const golden = yield* S.decodeEffect(Golden)(fixtureText("systemd-path.golden.json"));
      assert.isTrue(Str.startsWith("systemd ")(golden.systemd));
      assert.strictEqual(A.length(golden.cases), 900);
      const mismatches = A.filter(golden.cases, ([kind, value, home, systemd]) => {
        const resolved = XdgBase.resolve(kind, {
          ...(value !== null && { value }),
          ...(home !== null && { home }),
        });
        return O.getOrNull(resolved) !== systemd;
      });
      assert.deepStrictEqual(mismatches, []);
    })
  );
});
