import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

const SHARED = new URL("../../../../../vitest.shared.ts", import.meta.url);

describe("the shared configuration's environment reads skip the default ConfigProvider, built once per worker at first use", () => {
  it("leave a variable set after the import visible to the default provider of a fresh process", {
    timeout: 60_000,
  }, () => {
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

  it.effect.each(["vitest.shared.ts", "vitest.setup.ts"])("go through one read with its own provider in %s", (name) =>
    Effect.gen(function* () {
      const source = yield* Effect.promise(() => Bun.file(new URL(`../../../../../${name}`, import.meta.url)).text());
      const count = (pattern: RegExp) => Str.split(source, pattern).length - 1;
      expect(
        [
          count(/\bConfig\.(?:String|Int|Number|Boolean|NonEmptyString|schema)\(/),
          count(/\bEffect\.runSync\b/),
          count(/Effect\.provideService\(ConfigProvider\.ConfigProvider, /),
        ],
        "one Config call, one runSync and one provider: a new read outside the helper adds a call"
      ).toEqual([1, 1, 1]);
    })
  );
});
