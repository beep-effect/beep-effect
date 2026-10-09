// @effect-diagnostics nodeBuiltinImport:skip-file
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";
import * as Effect from "effect/Effect";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "env");

describe("env purity", () => {
	layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
		it.effect("the scanner still flags and spares what its shipped fixtures say (positive control)", () =>
			Effect.sync(() => assert.deepStrictEqual(SourceBoundary.verifyFixtures(), [])),
		);

		it.effect(
			"no source file reads process, imports a node:, platform or kit module, or writes to stdout or the console",
			() =>
				Effect.gen(function* () {
					const scan = yield* SourceBoundary.scan({
						root: SRC,
						rules: [
							"process",
							"node:process",
							"stdout-write",
							"console",
							{ forbidImports: ["node:*", "@effect/platform*", "@effected/*"] },
						],
					});
					assert.include(scan.files, "RuntimeEnv.ts", "the scan read the real tree");
					assert.include(scan.files, "internal/colorDepth.ts", "the scan recurses into internal/");
					assert.isAbove(scan.files.length, 8);
					assert.deepStrictEqual(scan.allowed, []);
					assert.deepStrictEqual(scan.violations, []);
				}),
		);
	});
});
