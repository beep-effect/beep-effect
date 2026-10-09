// Reading the workspace `packages:` pattern list.
//
// pnpm records it in `pnpm-workspace.yaml`; npm, yarn and bun record it in the
// root package.json `workspaces` field (array form, or the legacy
// `{ packages: [...] }` object form). The YAML is parsed with `@effected/yaml`.

import { Yaml } from "../../yaml/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";

const JsonValue = S.fromJsonString(S.Unknown);

/** The reason a pattern read failed, with the file it failed on. */
export interface PatternReadFailure {
	readonly path: string;
	readonly kind: "read" | "invalidYaml" | "invalidJson";
	readonly cause: unknown;
}

/** The string entries of `value` when it is an array, else `undefined`. */
export const stringsOf = (value: unknown): ReadonlyArray<string> | undefined =>
	Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : undefined;

/** The `packages:` list of a `pnpm-workspace.yaml` document. Total on a parsed document. */
export const pnpmPatternsOf = (document: unknown): ReadonlyArray<string> => {
	if (!P.isObjectOrArray(document)) return [];
	return stringsOf("packages" in document ? document.packages : undefined) ?? [];
};

/** The `workspaces` field of a root package.json, in either supported shape. */
export const manifestPatternsOf = (manifest: unknown): ReadonlyArray<string> => {
	if (!P.isObjectOrArray(manifest)) return [];
	const workspaces = "workspaces" in manifest ? manifest.workspaces : undefined;
	const direct = stringsOf(workspaces);
	if (direct !== undefined) return direct;
	if (workspaces !== null && typeof workspaces === "object" && "packages" in workspaces) {
		return stringsOf(workspaces.packages) ?? [];
	}
	return [];
};

/**
 * The workspace `packages:` patterns for `root`: `pnpm-workspace.yaml` first,
 * then the root package.json `workspaces` field. An absent config is a
 * standalone package, not an error — it yields an empty list.
 */
export const readPatterns = (
	root: string,
): Effect.Effect<ReadonlyArray<string>, PatternReadFailure, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
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
