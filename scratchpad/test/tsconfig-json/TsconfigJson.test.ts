import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
	Reference,
	TsconfigJson,
	TsconfigJsonFromString,
	TsconfigParseError,
	TypeAcquisition,
	WatchOptions,
} from "../../effected/tsconfig-json/TsconfigJson.ts";

// A realistic multi-field JSONC document — comments and a trailing comma —
// exercising every top-level field plus nested compilerOptions/watchOptions/
// typeAcquisition/references, per the task brief (inline, no FileSystem: this
// module is pure).
const REALISTIC_TSCONFIG = `{
	// project-wide compiler settings
	"$schema": "https://json.schemastore.org/tsconfig.json",
	"compilerOptions": {
		"target": "ES2023",
		"module": "NodeNext",
		"strict": true,
		"lib": ["esnext", "dom"],
	},
	"extends": "./base.json",
	"files": ["src/index.ts"],
	"include": ["src/**/*.ts"],
	"exclude": ["dist", "node_modules"],
	"references": [
		{ "path": "../core" },
	],
	"watchOptions": {
		"watchFile": "UseFsEvents",
		"watchDirectory": "FixedPollingInterval",
		"fallbackPolling": "DynamicPriority",
		"synchronousWatchDirectory": true,
		"excludeDirectories": ["**/node_modules"],
	},
	"typeAcquisition": {
		"enable": false,
		"include": ["jquery"],
	},
	"compileOnSave": false,
	// tooling extras tsc itself ignores
	"ts-node": { "esm": true },
	"buildOptions": { "verbose": true },
}`;

// The repo's own root tsconfig.json content, inlined — the "real JSONC
// document" fixture per the brief.
const ROOT_TSCONFIG = `{
	"$schema": "https://json.schemastore.org/tsconfig.json",
	"extends": "@savvy-web/silk/tsconfig/node/root.json"
}`;

describe("TsconfigJsonFromString", () => {
	it.effect("decodes a realistic JSONC document with comments and trailing commas", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TsconfigJsonFromString)(REALISTIC_TSCONFIG);
			assert.strictEqual(decoded.$schema, "https://json.schemastore.org/tsconfig.json");
			assert.strictEqual(decoded.compilerOptions?.target, "es2023");
			assert.strictEqual(decoded.compilerOptions?.module, "nodenext");
			assert.strictEqual(decoded.extends, "./base.json");
			assert.deepStrictEqual(decoded.files, ["src/index.ts"]);
			assert.deepStrictEqual(decoded.include, ["src/**/*.ts"]);
			assert.deepStrictEqual(decoded.exclude, ["dist", "node_modules"]);
			assert.strictEqual(decoded.references?.[0]?.path, "../core");
			assert.strictEqual(decoded.watchOptions?.watchFile, "usefsevents");
			assert.strictEqual(decoded.watchOptions?.watchDirectory, "fixedpollinginterval");
			assert.strictEqual(decoded.watchOptions?.fallbackPolling, "dynamicpriority");
			assert.strictEqual(decoded.watchOptions?.synchronousWatchDirectory, true);
			assert.strictEqual(decoded.typeAcquisition?.enable, false);
			assert.strictEqual(decoded.compileOnSave, false);
			assert.deepStrictEqual(decoded["ts-node"], { esm: true });
			assert.deepStrictEqual(decoded.buildOptions, { verbose: true });
		}),
	);

	it.effect("decodes this repo's own root tsconfig.json content", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TsconfigJsonFromString)(ROOT_TSCONFIG);
			assert.strictEqual(decoded.extends, "@savvy-web/silk/tsconfig/node/root.json");
			assert.strictEqual(decoded.$schema, "https://json.schemastore.org/tsconfig.json");
		}),
	);

	it.effect("extends accepts a bare string", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TsconfigJsonFromString)(`{ "extends": "./base.json" }`);
			assert.strictEqual(decoded.extends, "./base.json");
		}),
	);

	it.effect("extends accepts an array of strings", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TsconfigJsonFromString)(`{ "extends": ["./a.json", "pkg/b"] }`);
			assert.deepStrictEqual(decoded.extends, ["./a.json", "pkg/b"]);
		}),
	);

	it.effect("malformed JSONC fails decode with a schema issue, never throws", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(S.decodeEffect(TsconfigJsonFromString)("{ not json "));
			assert.strictEqual(result._tag, "Failure");
		}),
	);

	it.effect("top-level unknown keys survive decode and encode", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TsconfigJsonFromString)(
				`{ "ts-node": { "esm": true }, "buildOptions": { "verbose": true }, "$schema": "x" }`,
			);
			assert.deepStrictEqual(decoded["ts-node"], { esm: true });
			assert.deepStrictEqual(decoded.buildOptions, { verbose: true });

			const encoded = yield* S.encodeUnknownEffect(TsconfigJson)(decoded);
			assert.deepStrictEqual(encoded["ts-node"], { esm: true });
			assert.deepStrictEqual(encoded.buildOptions, { verbose: true });
		}),
	);
});

describe("Reference", () => {
	it.effect("rejects an empty path", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(S.decodeEffect(Reference)({ path: "" }));
			assert.strictEqual(result._tag, "Failure");
		}),
	);

	it.effect("keeps extra keys on a reference entry", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(Reference)({ path: "../a", circular: true });
			assert.strictEqual(decoded.path, "../a");
			assert.strictEqual(decoded.circular, true);
		}),
	);
});

describe("WatchOptions", () => {
	it.effect("decodes watchFile/watchDirectory/fallbackPolling case-insensitively", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(WatchOptions)({
				watchFile: "FixedPollingInterval",
				watchDirectory: "UseFsEvents",
				fallbackPolling: "FixedInterval",
			});
			assert.strictEqual(decoded.watchFile, "fixedpollinginterval");
			assert.strictEqual(decoded.watchDirectory, "usefsevents");
			assert.strictEqual(decoded.fallbackPolling, "fixedinterval");
		}),
	);

	it.effect("passes phantom keys through", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(WatchOptions)({ force: true });
			assert.strictEqual(decoded.force, true);
		}),
	);
});

describe("TypeAcquisition", () => {
	it.effect("decodes the typed fields and preserves passthrough", () =>
		Effect.gen(function* () {
			const decoded = yield* S.decodeEffect(TypeAcquisition)({
				enable: true,
				include: ["jquery"],
				exclude: ["lodash"],
				disableFilenameBasedTypeAcquisition: true,
				futureField: 1,
			});
			assert.strictEqual(decoded.enable, true);
			assert.deepStrictEqual(decoded.include, ["jquery"]);
			assert.deepStrictEqual(decoded.exclude, ["lodash"]);
			assert.strictEqual(decoded.disableFilenameBasedTypeAcquisition, true);
			assert.strictEqual(decoded.futureField, 1);
		}),
	);
});

describe("TsconfigParseError", () => {
	it("carries a path and a Defect-wrapped cause", () => {
		const error = TsconfigParseError.make({ path: "/repo/tsconfig.json", cause: new Error("boom") });
		assert.strictEqual(error.path, "/repo/tsconfig.json");
		assert.strictEqual(error._tag, "TsconfigParseError");
	});

	it.effect("preserves the diagnostic cause stack when encoded", () =>
		Effect.gen(function* () {
			const cause = new Error("inner");
			const stack = cause.stack ?? assert.fail("The diagnostic cause must carry a stack.");
			const error = TsconfigParseError.make({ path: "/repo/tsconfig.json", cause });
			const encoded = yield* S.encodeEffect(TsconfigParseError)(error);
			assert.deepStrictEqual(encoded.cause, {
				name: cause.name,
				message: cause.message,
				stack,
			});
		}),
	);

	it("allows an empty path when not file-bound", () => {
		const error = TsconfigParseError.make({ path: "", cause: new Error("boom") });
		assert.strictEqual(error.path, "");
	});
});
