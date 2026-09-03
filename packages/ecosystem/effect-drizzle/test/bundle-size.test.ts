import { describe, expect, it } from "@effect/vitest";
import { fnUntraced, tryPromise } from "effect/Effect";
import { buildBundleConsumer } from "./bundle-build.ts";
import { compareBundleSize, formatBundleSizeLine } from "./bundle-size.ts";

describe("bundle size comparison", () => {
  it("passes when the current size equals the baseline", () => {
    expect(compareBundleSize(100, { baselineRawBytes: 100 }).isRegression).toBe(false);
  });

  it("passes when the current size decreases", () => {
    expect(compareBundleSize(99, { baselineRawBytes: 100 }).isRegression).toBe(false);
  });

  it("fails when the current size increases by one byte", () => {
    expect(compareBundleSize(101, { baselineRawBytes: 100 }).isRegression).toBe(true);
  });

  it("flags a collapse below the stub floor even when it is a decrease", () => {
    const comparison = compareBundleSize(30, { baselineRawBytes: 7864, minimumRawBytes: 4096 });
    expect(comparison.isRegression).toBe(false);
    expect(comparison.isCollapse).toBe(true);
  });

  it("does not flag healthy sizes above the floor", () => {
    expect(compareBundleSize(7000, { baselineRawBytes: 7864, minimumRawBytes: 4096 }).isCollapse).toBe(false);
  });
});

describe("bundle size probe", () => {
  it.effect(
    "measures the sole artifact as raw UTF-8 bytes",
    fnUntraced(function* () {
      const artifact = yield* tryPromise(buildBundleConsumer);
      expect(artifact.rawBytes).toBe(new TextEncoder().encode(artifact.text).byteLength);
      expect(artifact.rawBytes).toBeGreaterThan(1000);
    })
  );
});

// bunx's node shim injects a partial Bun global (spawn without which), so
// gate on every capability the probe-process spawn actually needs.
const hasBunSpawn = typeof Bun !== "undefined" && typeof Bun.spawn === "function" && typeof Bun.which === "function";

describe.runIf(hasBunSpawn)("bundle size probe process", () => {
  it.effect(
    "exits nonzero for an injected one-byte regression without mutating the baseline",
    fnUntraced(function* () {
      const artifact = yield* tryPromise(buildBundleConsumer);
      const baselineRawBytes = artifact.rawBytes - 1;
      const probe = Bun.spawn(
        [
          Bun.which("bun") ?? "bun",
          new URL("./bundle-size.probe.ts", import.meta.url).pathname,
          `--test-baseline-raw-bytes=${baselineRawBytes}`,
        ],
        {
          cwd: new URL("../", import.meta.url).pathname,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      const [exitCode, stdout, stderr] = yield* tryPromise(() =>
        Promise.all([probe.exited, new Response(probe.stdout).text(), new Response(probe.stderr).text()])
      );
      expect(exitCode).not.toBe(0);
      const lines = stdout.split("\n");
      expect(lines[0]).toBe(formatBundleSizeLine(artifact.rawBytes, baselineRawBytes));
      expect(`${stdout}${stderr}`).toContain("Bundle raw byte size exceeds the committed baseline");
    })
  );
});
