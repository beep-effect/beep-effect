import * as NodeModule from "node:module";
import { it } from "@beep/test-runner";
import * as HostProcess from "@beep/utils/HostProcess";
import { describe, expect, vi } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import {
  executableDirectory,
  isNativeAddonRequest,
  resolveNativeAddon,
  setDllDirectory,
  toWideString,
} from "../src/NativeAddon.ts";

const addon = "@duckdb/node-bindings-win32-x64/duckdb.node";

// A fake disk records every exact path checked.
const fakeResolver = (present: ReadonlyArray<string>, seen: Array<string>) => (candidate: string) => {
  seen.push(candidate);
  return A.contains(present, candidate);
};

describe("NativeAddon", () => {
  it("recognises only DuckDB native addon requests", () => {
    expect(isNativeAddonRequest(addon)).toBe(true);
    expect(isNativeAddonRequest("@duckdb/node-api")).toBe(false);
    expect(isNativeAddonRequest("effect/Effect")).toBe(false);
  });

  it("takes the executable folder from Windows and POSIX paths", () => {
    expect(executableDirectory("C:\\Users\\tom\\Ext\\practice-kg-mcp.exe")).toBe("C:\\Users\\tom\\Ext\\");
    expect(executableDirectory("/opt/ext/practice-kg-mcp")).toBe("/opt/ext/");
    expect(executableDirectory("practice-kg-mcp")).toBe(".");
  });

  it("resolves from the executable folder, never the working directory", () => {
    const cwd = process.cwd();
    const seen: Array<string> = [];
    const resolved = resolveNativeAddon(
      addon,
      "/opt/ext/practice-kg-mcp",
      // The addon also exists under the working directory; the resolver must not look there.
      fakeResolver([`/opt/ext/node_modules/${addon}`, `${cwd}/node_modules/${addon}`], seen)
    );
    expect(O.getOrNull(resolved)).toBe(`/opt/ext/node_modules/${addon}`);
    expect(seen).toEqual([`/opt/ext/node_modules/${addon}`]);
  });

  it("falls back (None) when the addon is not beside the executable, even if the cwd holds it", () => {
    const cwd = process.cwd();
    const seen: Array<string> = [];
    assertNone(
      resolveNativeAddon(addon, "/opt/ext/practice-kg-mcp", fakeResolver([`${cwd}/node_modules/${addon}`], seen))
    );
    expect(seen).toEqual([`/opt/ext/node_modules/${addon}`]);
  });

  it("ignores an addon present only in an ancestor node_modules", () => {
    const seen: Array<string> = [];
    assertNone(
      resolveNativeAddon(addon, "/opt/ext/practice-kg-mcp", fakeResolver([`/opt/node_modules/${addon}`], seen))
    );
    expect(seen).toEqual([`/opt/ext/node_modules/${addon}`]);
  });

  it("supports pipeable resolution and executable paths without separators", () => {
    expect(O.getOrNull(resolveNativeAddon("practice-kg-mcp", () => true)(addon))).toBe(`./node_modules/${addon}`);
  });

  it("encodes UTF-16 code units with a terminator, surrogate pairs intact", () => {
    expect(Array.from(toWideString("C:\\"))).toEqual([67, 58, 92, 0]);
    expect(Array.from(toWideString("a\u{1F600}"))).toEqual([97, 0xd83d, 0xde00, 0]);
    expect(Array.from(toWideString(""))).toEqual([0]);
  });

  it.effect("reports a failed DLL directory registration through Console instead of failing", () =>
    Effect.gen(function* () {
      const errors: Array<ReadonlyArray<unknown>> = [];
      const recording: Console.Console = { ...console, error: (...args) => errors.push(args) };
      // Off Windows `bun:ffi` or `kernel32.dll` is unavailable, so registration fails.
      const registered = yield* setDllDirectory("/opt/ext/node_modules/@duckdb/node-bindings-linux-x64/").pipe(
        Effect.provideService(Console.Console, recording)
      );
      expect(registered).toBe(false);
      expect(errors).toEqual([
        ["practice-kg-mcp: could not add the DuckDB addon folder to the DLL search path; duckdb.dll may fail to load."],
      ]);
    })
  );

  it("leaves other requests to the default resolution", () => {
    const seen: Array<string> = [];
    assertNone(resolveNativeAddon("effect/Effect", "/opt/ext/practice-kg-mcp", fakeResolver([], seen)));
    expect(seen).toEqual([]);
  });

  it.effect("installs once, resolves the bundled addon, and delegates missing or unrelated requests", () =>
    Effect.gen(function* () {
      const root = "/opt/native-addon-test";
      const executablePath = process.execPath;
      const resolver = NodeModule.Module as unknown as {
        _resolveFilename: (request: string, ...rest: ReadonlyArray<unknown>) => string;
      };
      const original = resolver._resolveFilename;
      const registered: Array<string> = [];
      const calls: Array<string> = [];
      resolver._resolveFilename = (request, ...rest) => {
        if (request === `${root}/node_modules/${addon}`) {
          return request;
        }
        if (request === `${root}/node_modules/@duckdb/node-bindings-missing/duckdb.node`) {
          throw new Error("Missing fixture addon");
        }
        if (!isNativeAddonRequest(request) && request !== "effect/Effect") {
          return original.call(NodeModule.Module, request, ...rest);
        }
        calls.push(request);
        return `fallback:${request}`;
      };
      try {
        vi.resetModules();
        vi.doMock("@beep/utils/HostProcess", () => ({ ...HostProcess, currentHostPlatform: "win32" }));
        const { installNativeAddonResolver } = yield* Effect.promise(() => import("../src/NativeAddon.ts"));
        const addonDirectory = `${root}/node_modules/@duckdb/node-bindings-win32-x64`;
        Object.defineProperty(process, "execPath", { value: `${root}/practice-kg-mcp`, configurable: true });
        installNativeAddonResolver((directory) => Effect.sync(() => registered.push(directory)));
        const installed = resolver._resolveFilename;
        yield* Effect.promise(() => import("../src/NativeAddon.install.ts"));
        installNativeAddonResolver();
        expect(resolver._resolveFilename).toBe(installed);
        expect(resolver._resolveFilename(addon)).toBe(`${addonDirectory}/duckdb.node`);
        expect(resolver._resolveFilename(addon)).toBe(`${addonDirectory}/duckdb.node`);
        expect(registered).toEqual([`${addonDirectory}/`]);
        expect(resolver._resolveFilename("@duckdb/node-bindings-missing/duckdb.node")).toBe(
          "fallback:@duckdb/node-bindings-missing/duckdb.node"
        );
        expect(resolver._resolveFilename("effect/Effect")).toBe("fallback:effect/Effect");
        expect(calls).toEqual(["@duckdb/node-bindings-missing/duckdb.node", "effect/Effect"]);
      } finally {
        vi.doUnmock("@beep/utils/HostProcess");
        resolver._resolveFilename = original;
        Object.defineProperty(process, "execPath", { value: executablePath, configurable: true });
      }
    })
  );
});
