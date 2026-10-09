// Reading the workspace `packages:` pattern list.
//
// pnpm records it in `pnpm-workspace.yaml`; npm, yarn and bun record it in the
// root package.json `workspaces` field (array form, or the legacy
// `{ packages: [...] }` object form). The YAML is parsed with `@effected/yaml`.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Yaml } from "../../yaml/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as A from "effect/Array";

const $I = $ScratchpadId.create("effected/workspaces/internal/patterns");

/**
 * The caller-visible reasons reading workspace patterns can fail.
 *
 * **Example** (Recognize a workspace configuration failure kind)
 *
 * ```ts
 * import { PatternReadFailureKind } from "@beep/scratchpad/effected/workspaces/internal/patterns";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PatternReadFailureKind)("invalidYaml")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PatternReadFailureKind = LiteralKit(["read", "invalidYaml", "invalidJson"]).annotate(
	$I.annote("PatternReadFailureKind", { description: "The caller-visible reasons reading workspace patterns can fail." }),
);
/**
 * The failure-kind literals accepted by the workspace pattern reader.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatternReadFailureKind = typeof PatternReadFailureKind.Type;

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * The reason a pattern read failed, with the file it failed on.
 *
 * @category models
 * @since 0.0.0
 */
export interface PatternReadFailure {
	readonly path: string;
	readonly kind: PatternReadFailureKind;
	readonly cause: unknown;
}

/**
 * The string entries of `value` when it is an array, else `undefined`.
 *
 * **Example** (Filter a mixed pattern array)
 *
 * ```ts
 * import { stringsOf } from "@beep/scratchpad/effected/workspaces/internal/patterns";
 *
 * console.log(stringsOf(["packages/*", 42])?.join(",")); // packages/*
 * console.log(stringsOf({ packages: [] })); // undefined
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const stringsOf = (value: unknown): ReadonlyArray<string> | undefined =>
	A.isArray(value) ? value.filter((entry): entry is string => P.isString(entry)) : undefined;

/**
 * Extracts the `packages:` list of a `pnpm-workspace.yaml` document.
 *
 * **Details**
 *
 * Total on a parsed document.
 *
 * **Example** (Read patterns from a parsed pnpm document)
 *
 * ```ts
 * import { pnpmPatternsOf } from "@beep/scratchpad/effected/workspaces/internal/patterns";
 *
 * console.log(pnpmPatternsOf({ packages: ["packages/*", 42] }).join(",")); // packages/*
 * console.log(pnpmPatternsOf(null).length); // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const pnpmPatternsOf = (document: unknown): ReadonlyArray<string> => {
	if (!P.isObjectOrArray(document)) return [];
	return stringsOf("packages" in document ? document.packages : undefined) ?? [];
};

/**
 * Extracts the `workspaces` field of a root package.json, in either supported shape.
 *
 * **Example** (Read both manifest workspace shapes)
 *
 * ```ts
 * import { manifestPatternsOf } from "@beep/scratchpad/effected/workspaces/internal/patterns";
 *
 * console.log(manifestPatternsOf({ workspaces: ["packages/*"] }).join(",")); // packages/*
 * console.log(manifestPatternsOf({ workspaces: { packages: ["apps/*"] } }).join(",")); // apps/*
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const manifestPatternsOf = (manifest: unknown): ReadonlyArray<string> => {
	if (!P.isObjectOrArray(manifest)) return [];
	const workspaces = "workspaces" in manifest ? manifest.workspaces : undefined;
	const direct = stringsOf(workspaces);
	if (direct !== undefined) return direct;
	if (P.isObjectKeyword(workspaces) && !P.isFunction(workspaces) && "packages" in workspaces) {
		return stringsOf(workspaces.packages) ?? [];
	}
	return [];
};

/**
 * Reads the workspace `packages:` patterns for `root`, preferring `pnpm-workspace.yaml` over the root package.json `workspaces` field.
 *
 * **Details**
 *
 * An absent config is a standalone package, not an error — it yields an empty list.
 * When the pnpm document yields no patterns, the reader falls back to package.json.
 *
 * **Gotchas**
 *
 * An existing configuration that cannot be read or parsed fails with its path and
 * failure kind rather than silently yielding an empty list. FileSystem and Path
 * services are required to execute the reader.
 *
 * **Example** (Construct a workspace pattern read)
 *
 * ```ts
 * import { readPatterns } from "@beep/scratchpad/effected/workspaces/internal/patterns";
 * import * as Effect from "effect/Effect";
 *
 * const program = readPatterns("/repo");
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readPatterns = Effect.fn("readPatterns")(function* (
	root: string,
): Effect.fn.Return<ReadonlyArray<string>, PatternReadFailure, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;

	// A config file that EXISTS but cannot be read is not a config file that
	// declares no patterns. Substituting "" / "{}" made those two outcomes
	// literally identical, so the failure was invisible by construction — the
	// same silent-degradation family as absorbing a `readDirectory` error into
	// an empty directory listing. An ABSENT file is still fine: that is a real,
	// distinguishable condition meaning "no config here".
	const pnpmWorkspacePath = path.join(root, "pnpm-workspace.yaml");
	const hasPnpmWorkspace = yield* fs.exists(pnpmWorkspacePath).pipe(Effect.orElseSucceed(() => false));
	if (hasPnpmWorkspace) {
		const content = yield* fs
			.readFileString(pnpmWorkspacePath)
			.pipe(Effect.mapError((cause): PatternReadFailure => ({ path: pnpmWorkspacePath, kind: "read", cause })));
		const document = yield* Yaml.parse(content).pipe(
			Effect.mapError((cause): PatternReadFailure => ({ path: pnpmWorkspacePath, kind: "invalidYaml", cause })),
		);
		const patterns = pnpmPatternsOf(document);
		if (patterns.length > 0) return patterns;
	}

	const manifestPath = path.join(root, "package.json");
	const hasManifest = yield* fs.exists(manifestPath).pipe(Effect.orElseSucceed(() => false));
	if (!hasManifest) return [];

	const content = yield* fs
		.readFileString(manifestPath)
		.pipe(Effect.mapError((cause): PatternReadFailure => ({ path: manifestPath, kind: "read", cause })));
	const manifest = yield* S.decodeEffect(JsonValue)(content).pipe(Effect.mapError((cause): PatternReadFailure => ({ path: manifestPath, kind: "invalidJson", cause })));
	return manifestPatternsOf(manifest);
});
