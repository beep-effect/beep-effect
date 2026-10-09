import { assert, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { detectMusl, strongestSri } from "../../../effected/github-actions/internal/pnpmExe.ts";

it.effect("libc detection handles every report shape and probe failure", () => Effect.sync(() => {
  const probe = (platform: string, report: unknown, expected: boolean) => {
    vi.stubGlobal("process", { ...process, platform, report: { getReport: () => report } });
    assert.strictEqual(detectMusl(), expected);
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
    vi.stubGlobal("process", { ...process, platform: "linux", report: undefined });
    assert.strictEqual(detectMusl(), false);
    vi.stubGlobal("process", { ...process, platform: "linux", report: { getReport: () => { throw new Error("probe"); } } });
    assert.strictEqual(detectMusl(), false);
  } finally {
    vi.unstubAllGlobals();
  }
  assertNone(strongestSri("-YQ=="));
  assertSome(strongestSri("SHA256-YQ==?option\nignored"), { algorithm: "sha256", hex: "61" });
}));
