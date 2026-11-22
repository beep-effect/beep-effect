// The shared Vitest configuration runs inside a worker whenever a test imports it, and it must read
// the environment without building Effect's default ConfigProvider, which is built once, from the
// environment at its first use: a test that stubs a variable afterwards would read the old value.
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const SHARED = new URL("../../../../../vitest.shared.ts", import.meta.url);

describe("the shared configuration's environment reads", () => {
  // In a process of its own: a coverage run shares one worker between test files, and any of them may
  // already have built the default provider.
  it("leave a variable set after the import visible to the default provider", { timeout: 60_000 }, () => {
    const probe = [
      `await import("${SHARED.href}");`,
      'process.env.BEEP_SHARED_CONFIG_PROBE = "set after the import";',
      'const Config = await import("effect/Config");',
      'const Effect = await import("effect/Effect");',
      'process.stdout.write(Effect.runSync(Config.String("BEEP_SHARED_CONFIG_PROBE")));',
    ];
    const { BEEP_SHARED_CONFIG_PROBE: _unset, ...inherited } = Bun.env;
    const result = Bun.spawnSync({
      cmd: ["bun", "-e", A.join(probe, "\n")],
      cwd: import.meta.dirname,
      env: inherited,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect([result.success, result.stdout.toString()], Str.slice(0, 2000)(result.stderr.toString())).toEqual([
      true,
      "set after the import",
    ]);
  });

  // A new read would add a Config call or a runSync outside the one helper, and fail here.
  it.effect.each(["vitest.shared.ts", "vitest.setup.ts"])("go through one read with its own provider in %s", (name) =>
    Effect.gen(function* () {
      const source = yield* Effect.promise(() => Bun.file(new URL(`../../../../../${name}`, import.meta.url)).text());
      const count = (pattern: RegExp) => Str.split(source, pattern).length - 1;
      expect([
        count(/\bConfig\.(?:String|Int|Number|Boolean|NonEmptyString|schema)\(/),
        count(/\bEffect\.runSync\b/),
        count(/Effect\.provideService\(ConfigProvider\.ConfigProvider, /),
      ]).toEqual([1, 1, 1]);
    })
  );
});
