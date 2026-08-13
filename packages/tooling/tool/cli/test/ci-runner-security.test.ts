import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Order, Path } from "effect";
import { describe, expect, it } from "vitest";

describe("CI runner security", () => {
  it("keeps the legacy non-ephemeral burst launcher retired", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const burstRoot = path.join(repoRoot, "goals/speed-loop/ops/runner-burst");
        const entries = A.sort(yield* fs.readDirectory(burstRoot), Order.String);
        const readme = yield* fs.readFileString(path.join(burstRoot, "README.md"));

        expect(entries).toEqual(["README.md", "teardown-burst-runners.sh"]);
        expect(readme).toContain("The manual launch path was retired");
        expect(readme).toContain("there is no break-glass launch exception");
      }).pipe(provideScopedLayer(NodeServices.layer))
    ));
});
