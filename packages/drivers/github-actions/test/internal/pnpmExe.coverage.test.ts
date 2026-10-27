import { detectMusl, strongestSri } from "@beep/github-actions/internal/pnpmExe";
import { assert, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";

it.effect("libc detection handles every report shape and probe failure", () =>
  Effect.sync(() => {
    const probe = (platform: string, report: unknown, expected: boolean) => {
      vi.stubGlobal("process", { ...process, report: { getReport: () => report } });
      assert.strictEqual(detectMusl(platform), expected);
      vi.unstubAllGlobals();
    };
    try {
      probe("darwin", undefined, false);
      probe("linux", undefined, false);
      probe("linux", { header: null }, false);
      probe("linux", { header: {} }, true);
      probe("linux", { header: { glibcVersionRuntime: undefined } }, true);
      probe("linux", { header: { glibcVersionRuntime: "" } }, true);
      probe("linux", { header: { glibcVersionRuntime: "2.40" } }, false);
      vi.stubGlobal("process", { ...process, report: undefined });
      assert.strictEqual(detectMusl("linux"), false);
      vi.stubGlobal("process", {
        ...process,
        report: {
          getReport: () => {
            throw new Error("probe");
          },
        },
      });
      assert.strictEqual(detectMusl("linux"), false);
    } finally {
      vi.unstubAllGlobals();
    }
    assertNone(strongestSri("-YQ=="));
    assertSome(strongestSri("SHA256-YQ==?option\nignored"), { algorithm: "sha256", hex: "61" });
  })
);
