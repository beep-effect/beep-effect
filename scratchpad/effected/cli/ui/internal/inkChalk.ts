import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Option } from "effect";

/**
 * A chalk colour level: 0 none, 1 basic, 2 256 colours, 3 truecolor.
 *
 * @internal
 */
export type ChalkLevel = 0 | 1 | 2 | 3;

/**
 * The one member of Ink's chalk instance the kit touches. Every style getter reads it at call time, so setting it
 * is live.
 *
 * @internal
 */
export interface InkChalk {
	level: ChalkLevel;
}

const isInkChalk = (value: unknown): value is InkChalk =>
	(typeof value === "function" || (typeof value === "object" && value !== null)) &&
	typeof (value as { readonly level?: unknown }).level === "number";

/** The runtime's `import.meta.resolve`, when it has one. */
const esmResolve: ((specifier: string) => string) | undefined =
	typeof import.meta.resolve === "function" ? (specifier) => import.meta.resolve(specifier) : undefined;

/**
 * The path of Ink's entry: through `resolve` (the runtime's `import.meta.resolve` by default), or, where that is
 * missing or throws, through Node's CommonJS resolution from this module.
 *
 * @remarks
 * Vite's module runner, which evaluates a Vitest reporter loaded by path, has an `import.meta.resolve` that throws
 * ("not supported"); the CommonJS resolution finds the same file, since Ink's `exports` has a `default` condition.
 *
 * @param resolve - an ESM resolver, to stand in for the runtime's in a test
 *
 * @internal
 */
export const resolveInkEntry = (resolve: ((specifier: string) => string) | undefined = esmResolve): string => {
	if (resolve !== undefined) {
		try {
			return fileURLToPath(resolve("ink"));
		} catch {
			// Fall through to CommonJS resolution.
		}
	}
	return createRequire(import.meta.url).resolve("ink");
};

/**
 * The chalk instance Ink itself imports, resolved from Ink's own location; `None` when it cannot be resolved.
 *
 * @remarks
 * One of the three files licensed to touch Node. Ink's `exports` has
 * only `"."` and chalk is its own dependency, so the kit cannot import Ink's chalk by name: a `chalk` of the kit's
 * own could be a different copy, and setting its level would silently change nothing. Resolving `chalk` from Ink's
 * entry ({@link resolveInkEntry}) and importing its realpath yields the very module Ink imports, because Node keys ES
 * modules by realpath. A consumer that bundles Ink leaves nothing
 * to resolve, and the answer is `None`; it never rejects.
 *
 * @param inkEntryOf - how Ink's entry is found; {@link resolveInkEntry} by default
 *
 * @internal
 */
export const inkChalk = async (
	inkEntryOf: () => string = () => resolveInkEntry(),
): Promise<Option.Option<InkChalk>> => {
	try {
		const inkEntry = inkEntryOf();
		const chalkPath = realpathSync(createRequire(inkEntry).resolve("chalk"));
		const chalk: { readonly default?: unknown } = await import(/* @vite-ignore */ pathToFileURL(chalkPath).href);
		return isInkChalk(chalk.default) ? Option.some(chalk.default) : Option.none();
	} catch {
		return Option.none();
	}
};
