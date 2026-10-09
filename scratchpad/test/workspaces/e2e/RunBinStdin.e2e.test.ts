// @effect-diagnostics nodeBuiltinImport:skip-file
// runBin / runCarrierBin stdin against a REAL spawned bin that echoes what it
// reads. A hand-made consumer over a temp directory: no package manager runs.

import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, layer } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import { InstalledConsumer } from "../../../effected/workspaces/testing.ts";

const DIR = realpathSync(mkdtempSync(join(tmpdir(), "run-bin-stdin-")));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

// Writes "got:<stdin>" and the byte count; reads to end of input, so an open pipe would hang.
const ECHO = `#!/usr/bin/env node
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const input = Buffer.concat(chunks);
  process.stdout.write("got:" + input.toString("utf8") + "|" + input.length);
});
`;
mkdirSync(join(DIR, "node_modules", ".bin"), { recursive: true });
mkdirSync(join(DIR, "node_modules", "carrier", "bin"), { recursive: true });
writeFileSync(join(DIR, "node_modules", "carrier", "bin", "echo.js"), ECHO);
writeFileSync(
	join(DIR, "node_modules", "carrier", "package.json"),
	JSON.stringify({ name: "carrier", version: "1.0.0", bin: { echo: "bin/echo.js" } }),
);
writeFileSync(join(DIR, "node_modules", ".bin", "echo"), ECHO);
chmodSync(join(DIR, "node_modules", ".bin", "echo"), 0o755);

/** The consumer over the real PATH, read through `Config` so the ambient provider decides. */
const consumer = Config.String("PATH").pipe(
	Config.withDefault(""),
	Effect.map((path) =>
		InstalledConsumer.make({
			manager: "npm",
			managerVersion: "0.0.0",
			directory: DIR,
			carrier: "carrier",
			env: Redacted.make({ PATH: path }),
		}),
	),
);

layer(NodeServices.layer)("runBin and runCarrierBin stdin, real spawn", (it) => {
	it.effect("a string is written to the bin's stdin and closed", () =>
		Effect.gen(function* () {
			const output = yield* (yield* consumer).runBin("echo", [], { stdin: "héllo" });
			assert.strictEqual(output.stdout, "got:héllo|6");
		}),
	);

	it.effect("bytes and a chunked stream arrive whole", () =>
		Effect.gen(function* () {
			const bytes = yield* (yield* consumer).runBin("echo", [], { stdin: new Uint8Array([104, 105]) });
			assert.strictEqual(bytes.stdout, "got:hi|2");
			const encoder = new TextEncoder();
			const streamed = yield* (yield* consumer).runBin("echo", [], {
				stdin: Stream.make(encoder.encode("ab"), encoder.encode("cd")),
			});
			assert.strictEqual(streamed.stdout, "got:abcd|4");
		}),
	);

	it.effect("omitted stdin is end of input at once: the bin exits instead of hanging", () =>
		Effect.gen(function* () {
			const output = yield* (yield* consumer).runBin("echo", [], { timeout: "10 seconds" });
			assert.strictEqual(output.stdout, "got:|0");
			assert.isTrue(output.succeeded);
		}),
	);

	it.effect("runCarrierBin takes stdin the same way", () =>
		Effect.gen(function* () {
			const output = yield* (yield* consumer).runCarrierBin("echo", [], { stdin: "framed" });
			assert.strictEqual(output.stdout, "got:framed|6");
			const bare = yield* (yield* consumer).runCarrierBin("echo", [], { timeout: "10 seconds" });
			assert.strictEqual(bare.stdout, "got:|0");
		}),
	);
});
