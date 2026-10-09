import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { PublishError } from "../../effected/npm/PublishError.ts";

describe("PublishError diagnostic coverage", () => {
  it.effect("renders each failure with and without optional diagnostic context", () => Effect.sync(() => {
    const cases = [
      ["auth", "Could not write npm auth for the registry", "Could not write npm auth for https://registry.test:\nfailed"],
      ["pack", "npm pack failed", "npm pack failed for pkg (exit 7):\nfailed"],
      ["publish", "npm publish failed", "npm publish failed for pkg (exit 7):\nfailed"],
      ["output", "npm produced unreadable output", "npm produced unreadable output for pkg:\nfailed"],
      ["digest", "Packed tarball could not be read for hashing", "Packed tarball could not be read for hashing for pkg:\nfailed"],
      ["executor", "A pinned npm was requested, but this project has no launcher to fetch it", "A pinned npm was requested, but this project has no launcher to fetch it"],
    ] as const;
    for (const [kind, bare, detailed] of cases) {
      assert.strictEqual(PublishError.make({ kind }).message, bare);
      assert.strictEqual(PublishError.make({ kind, output: " \n\t " }).message, bare);
      assert.strictEqual(PublishError.make({ kind, subject: "pkg", registry: "https://registry.test", exitCode: 7, output: "  failed\n" }).message, detailed);
    }
  }));
});
