// Readers over a parsed `pnpm-workspace.yaml` document that BOTH the live
// assembler (`WorkspaceCatalogs`) and the at-ref reader (`WorkspaceSnapshots`)
// need to feed the config-dependency hook replay: the `configDependencies`
// map and the inline `peerDependencyRules` seed. One implementation, so the
// two sides of a diff cannot disagree about what a ref declared.

import * as P from "effect/Predicate";
import type { PeerDependencyRules } from "../ConfigDependencyHooks.ts";
import { NoPeerDependencyRules } from "../ConfigDependencyHooks.ts";
import { stringsOf } from "./patterns.ts";
import * as R from "effect/Record";

/** The `configDependencies` map (name → version+integrity) of a parsed pnpm-workspace document. */
export const configDependenciesOf = (document: unknown): Record<string, string> => {
	if (!P.isObject(document) || !P.isObject(document.configDependencies)) return {};
	const out: Record<string, string> = {};
	for (const [name, spec] of R.toEntries(document.configDependencies)) {
		if (P.isString(spec)) out[name] = spec;
	}
	return out;
};

/**
 * The `peerDependencyRules` a `pnpm-workspace.yaml` declares inline — the half
 * `pnpm:export` materializes into the file, as opposed to the half a config
 * dependency injects at replay time.
 *
 * @remarks
 * **Tolerant, unlike the catalog blocks**, and the asymmetry is deliberate: a
 * malformed catalog block must hard-fail because a silently-empty catalog makes
 * every dependency look newly added, whereas a malformed rules block costs only
 * suppression — the failure mode is reporting a peer pnpm would have hidden,
 * which is visible and safe. Failing the whole assembly over it would take the
 * catalogs down with it.
 *
 * Every axis is read independently, so a malformed `ignoreMissing` does not
 * discard a well-formed `allowedVersions`.
 */
export const inlinePeerDependencyRules = (document: unknown): PeerDependencyRules => {
	if (!P.isObject(document) || !P.isObject(document.peerDependencyRules)) return NoPeerDependencyRules;
	const block = document.peerDependencyRules;
	const allowedVersions: Record<string, string> = {};
	if (P.isObject(block.allowedVersions)) {
		for (const [key, value] of R.toEntries(block.allowedVersions)) {
			if (P.isString(value)) allowedVersions[key] = value;
		}
	}
	return {
		allowedVersions,
		ignoreMissing: stringsOf(block.ignoreMissing) ?? [],
		allowAny: stringsOf(block.allowAny) ?? [],
	};
};
