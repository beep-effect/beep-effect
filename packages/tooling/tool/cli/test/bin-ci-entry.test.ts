import { ciBinaryRunMainOptions } from "@beep/repo-cli/commands/Ci";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { vi } from "vitest";

// The slim entry's top level, imported with the runner replaced: no CLI runs and nothing exits.
// The teardown is then driven directly, with `process.exit` stubbed.
const runtime = vi.hoisted(() => ({ runMain: vi.fn() }));
vi.mock("@effect/platform-bun/BunRuntime", () => ({ runMain: runtime.runMain }));

it.effect("hands the CI main effect and its run options to BunRuntime.runMain", () =>
  Effect.gen(function* () {
    yield* Effect.promise(() => import("@beep/repo-cli/test/BinCi"));
    expect(runtime.runMain).toHaveBeenCalledOnce();
    const [main, options] = runtime.runMain.mock.calls[0] ?? [];
    expect(Effect.isEffect(main)).toBe(true);
    expect(options).toBe(ciBinaryRunMainOptions);
    expect(options.disableErrorReporting).toBe(true);
  })
);

it.effect("drains the stream console, then reports and exits with the teardown's code", () =>
  Effect.gen(function* () {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const code = yield* Effect.callback<number>((resume) => {
      ciBinaryRunMainOptions.teardown(Exit.fail("lane failed"), (reported) => resume(Effect.succeed(reported)));
    });
    expect(code).toBe(1);
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
  })
);
