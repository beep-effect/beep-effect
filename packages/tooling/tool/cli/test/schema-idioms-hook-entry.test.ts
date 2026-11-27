import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vitest";

const runtime = vi.hoisted(() => ({ runMain: vi.fn() }));
vi.mock("@effect/platform-bun/BunRuntime", () => ({ runMain: runtime.runMain }));

it.effect("hands the hook program to BunRuntime.runMain with error reporting off", () =>
  Effect.gen(function* () {
    yield* Effect.promise(() => import("@beep/repo-cli/commands/SchemaIdioms/SchemaIdioms.hook.entry"));
    expect(runtime.runMain).toHaveBeenCalledOnce();
    const [main, options] = runtime.runMain.mock.calls[0] ?? [];
    expect(Effect.isEffect(main)).toBe(true);
    expect(options).toEqual({ disableErrorReporting: true });
  })
);
