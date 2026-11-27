import { ChildEnv } from "@beep/github-actions";
import { PathPrependEnv, PathPrependOptions } from "@beep/github-actions/ChildEnv";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

describe("ChildEnv", () => {
  describe("trap (a): env without extendEnv: true silently strips the child's environment", () => {
    it("answers env AND extendEnv: true as one value", () => {
      const answer = ChildEnv.prependPath(["/tools/bin"], { base: { PATH: "/usr/bin" }, platform: "linux" });
      assert.deepStrictEqual(
        answer,
        PathPrependEnv.make({ env: { PATH: "/tools/bin:/usr/bin" }, extendEnv: true }),
        "the pair is the point: spreading the whole answer cannot forget the flag, and an env-only mutant fails"
      );
    });

    it("carries exactly one env entry — the additions, nothing restated", () => {
      const answer = ChildEnv.prependPath(["/tools/bin"], {
        base: { PATH: "/usr/bin", HOME: "/home/ci" },
        platform: "linux",
      });
      assert.deepStrictEqual(
        R.keys(answer.env),
        ["PATH"],
        "DetachedProcess merges `.env` over the parent; restated variables would clobber it with stale copies"
      );
    });
  });

  describe("trap (b): the Windows casing write-through", () => {
    it("writes through an inherited `Path`, never emitting `PATH` beside it", () => {
      const answer = ChildEnv.prependPath(["D:\\tools"], {
        base: { Path: "C:\\Windows\\system32", SystemRoot: "C:\\Windows" },
        platform: "win32",
      });
      assert.deepStrictEqual(
        answer.env,
        { Path: "D:\\tools;C:\\Windows\\system32" },
        "the key is the inherited spelling; a PATH beside Path leaves the winner to Node's undocumented dedupe"
      );
    });

    it("finds the key case-insensitively, whatever the casing", () => {
      assert.strictEqual(ChildEnv.pathKeyOf({ path: "/usr/bin" }), "path");
      assert.strictEqual(ChildEnv.pathKeyOf({ Path: "x" }), "Path");
      assert.strictEqual(ChildEnv.pathKeyOf({ PATH: "x" }), "PATH");
      assert.strictEqual(ChildEnv.pathKeyOf({ HOME: "/home/ci" }), "PATH");
    });

    it("uses the platform's delimiter: `;` on win32, `:` elsewhere", () => {
      const win = ChildEnv.prependPath(["a", "b"], { base: { Path: "c" }, platform: "win32" });
      assert.deepStrictEqual(win.env, { Path: "a;b;c" });
      const posix = ChildEnv.prependPath(["a", "b"], { base: { PATH: "c" }, platform: "darwin" });
      assert.deepStrictEqual(posix.env, { PATH: "a:b:c" });
    });
  });

  describe("trap (c): the win32 shell decision", () => {
    it("asks for a shell on win32 only", () => {
      assert.isTrue(ChildEnv.needsShell("win32"), ".cmd shims cannot be spawned directly since CVE-2024-27980");
      assert.isFalse(ChildEnv.needsShell("linux"), "POSIX gets no shell, which would only add a quoting hazard");
      assert.isFalse(ChildEnv.needsShell("darwin"));
    });
  });

  describe("the prepend itself", () => {
    it("keeps the caller's order — the first directory wins name collisions", () => {
      const answer = ChildEnv.prependPath(["/pm/shims", "/runtime/bin"], {
        base: { PATH: "/usr/bin" },
        platform: "linux",
      });
      assert.deepStrictEqual(answer.env, { PATH: "/pm/shims:/runtime/bin:/usr/bin" });
    });

    it("appends nothing for an absent or empty inherited PATH — no empty trailing entry", () => {
      assert.deepStrictEqual(
        ChildEnv.prependPath(["/tools"], { base: {}, platform: "linux" }).env,
        { PATH: "/tools" },
        "a trailing delimiter is an empty PATH entry, which both platforms read as the current directory: an injection"
      );
      assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base: { PATH: "" }, platform: "linux" }).env, {
        PATH: "/tools",
      });
    });
  });
});

describe("ChildEnv regression contracts", () => {
  it("prepends the exact POSIX PATH when Path is also present", () => {
    assert.deepStrictEqual(
      ChildEnv.prependPath(["/tools"], {
        base: { Path: "/ignored", PATH: "/usr/bin" },
        platform: "linux",
      }).env,
      { PATH: "/tools:/usr/bin" }
    );
  });

  it("creates POSIX PATH rather than prepending an unrelated lowercase path", () => {
    assert.deepStrictEqual(
      ChildEnv.prependPath(["/tools"], {
        base: { path: "/ignored" },
        platform: "darwin",
      }).env,
      { PATH: "/tools" }
    );
  });

  it("ignores a prototype PATH on POSIX and Windows", () => {
    const base: Record<string, string | undefined> = {};
    Object.setPrototypeOf(base, { PATH: "/prototype" });
    for (const platform of ["linux", "win32"]) {
      assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base, platform }).env, { PATH: "/tools" });
    }
  });

  it("ignores a prototype Path while retaining Windows own-key casing", () => {
    const base: Record<string, string | undefined> = {};
    Object.setPrototypeOf(base, { Path: "/prototype" });
    assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base, platform: "win32" }).env, { PATH: "/tools" });
    const own: Record<string, string | undefined> = { Path: "/own" };
    Object.setPrototypeOf(own, { PATH: "/prototype" });
    assert.deepStrictEqual(ChildEnv.prependPath(["/tools"], { base: own, platform: "win32" }).env, {
      Path: "/tools;/own",
    });
  });

  it.effect("validates plain additions and requires the true merge flag", () =>
    Effect.gen(function* () {
      const additions: PathPrependEnv.Encoded = { env: { PATH: "/tools" }, extendEnv: true };
      const value1 = yield* S.decodeEffect(PathPrependEnv)(additions);
      assert.deepStrictEqual(value1, additions);
      assert.isFalse(S.is(PathPrependEnv)({ env: {}, extendEnv: false }));
      assert.isFalse(S.is(PathPrependEnv)({ env: {} }));
      assert.isFalse(S.is(PathPrependEnv)({ env: { PATH: undefined }, extendEnv: true }));
    })
  );

  it.effect("keeps undefined base entries and requires explicit base and platform", () =>
    Effect.gen(function* () {
      const options: PathPrependOptions.Encoded = {
        base: { PATH: undefined, HOME: "/home/ci" },
        platform: "other-platform",
      };
      const value2 = yield* S.decodeEffect(PathPrependOptions)(options);
      assert.deepStrictEqual(value2, options);
      assert.isFalse(S.is(PathPrependOptions)({ platform: "linux" }));
      assert.isFalse(S.is(PathPrependOptions)({ base: {} }));
      assert.isFalse(S.is(PathPrependOptions)({ base: { PATH: 42 }, platform: "linux" }));
    })
  );
});
