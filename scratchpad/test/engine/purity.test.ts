// @effect-diagnostics nodeBuiltinImport:skip-file
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { SourceBoundary } from "../../effected/workspaces/testing.ts";
import { Effect } from "effect";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "effected", "engine");

describe("engine purity", () => {
	layer(NodeServices.layer)((it) => {
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
					assert.include(scan.files, "LaunchContext.ts", "the scan read the real tree");
					assert.isAbove(scan.files.length, 2);
					assert.deepStrictEqual(scan.allowed, []);
					assert.deepStrictEqual(scan.violations, []);
				}),
		);
	});
});
