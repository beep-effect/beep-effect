import { Yaml } from "../../yaml/index.ts";
import { Effect } from "effect";
import type { ParseFailure } from "./shared.ts";
import { framingFailure, syntaxFailure } from "./shared.ts";

/**
 * A document selected out of a YAML stream, with the stream's document count
 * carried alongside so a framing failure can report it.
 *
 * @internal
 */
export interface SelectedDocument {
	readonly document: unknown;
	readonly documents: number;
}

/**
 * An empty YAML document composes to `null` (`Yaml.parseAll("")` is `[null]`,
 * and the trailing document of an env-only `pnpm-lock.yaml` is `null` too).
 * A *present* scalar — `42` — is not empty; it is a shape error, and must
 * reach validation rather than be reported as a framing failure.
 *
 * @internal
 */
const isEmptyDocument = (document: unknown): boolean => document === null || document === undefined;

/**
 * The number of documents pnpm's env-lockfile writer can compose: the env
 * preamble and the main lockfile. See {@link splitPnpmStream}.
 *
 * @internal
 */
const MAX_PNPM_DOCUMENTS = 2;

/**
 * A `pnpm-lock.yaml` YAML stream split into its two positions. `preamble` is
 * the env document, `main` the lockfile proper; each is `undefined` when that
 * position is absent or holds an empty document.
 *
 * @internal
 */
export interface PnpmStream {
	readonly preamble: unknown;
	readonly main: unknown;
	readonly documents: number;
}

/**
 * Split a `pnpm-lock.yaml` YAML stream into its env preamble and its main
 * lockfile document. This is the one place pnpm's document framing is
 * decided: `Lockfile.parse` projects the main document out of it and
 * `PnpmEnvLockfile` the preamble, so the two readers cannot disagree about
 * which document is which or how many a stream may carry.
 *
 * @remarks
 * pnpm 11 and 12 write `pnpm-lock.yaml` as **up to two YAML documents** when
 * the workspace declares `configDependencies` or `devEngines.packageManager`:
 * an env preamble, then the lockfile proper. The rule for telling them apart
 * is **deterministic, not a heuristic**. It is pnpm's own writer contract:
 * `writeEnvLockfile` emits `${env}---${main}`, composing the preamble as a
 * *prefix*, so the preamble is the **first** of two documents and the
 * lockfile is always the **last**. Both documents declare `lockfileVersion`,
 * `importers` and `packages`, so position is the only discriminator. Content
 * cannot tell them apart, which is how a single-document parse once read the
 * preamble as the lockfile and reported an empty workspace.
 *
 * - One document: no preamble; that document is the lockfile.
 * - Two documents: the first is the preamble, the second the lockfile.
 * - More than two: outside the writer contract, so no position identifies
 *   either document. Rather than guess (the preamble feeds integrity
 *   verification, where a guess is a trust decision), it fails through the
 *   typed framing channel with `unexpectedDocuments`.
 *
 * An empty document composes to `null` and occupies its position as
 * `undefined`. pnpm writes an empty *main* document after a preamble both for
 * a workspace with no root `package.json` and only `configDependencies`, and
 * for a workspace whose first install failed after its config dependencies
 * were installed (measured against pnpm 11.28.0 and 12.7.0; the bytes are
 * identical). Whether that is a lockfile is the caller's decision, not the
 * splitter's.
 *
 * @internal
 */
export const splitPnpmStream = (content: string): Effect.Effect<PnpmStream, ParseFailure> =>
	Effect.gen(function* () {
		const documents = yield* Yaml.parseAll(content).pipe(Effect.mapError(syntaxFailure));
		if (documents.length > MAX_PNPM_DOCUMENTS) {
			return yield* Effect.fail(framingFailure("unexpectedDocuments", documents.length));
		}
		const present = (document: unknown): unknown => (isEmptyDocument(document) ? undefined : document);
		return documents.length === MAX_PNPM_DOCUMENTS
			? { preamble: present(documents[0]), main: present(documents[1]), documents: documents.length }
			: { preamble: undefined, main: present(documents[0]), documents: documents.length };
	});

/**
 * Select the sole document of a YAML lockfile format that defines **no**
 * document framing — yarn Berry's `yarn.lock`.
 *
 * @remarks
 * yarn never writes a multi-document `yarn.lock`, so there is no writer
 * contract to read a "main" document out of one. Rather than silently taking
 * the first document (which is what a single-document parse does, and how the
 * pnpm bug stayed invisible), a stream carrying more than one document fails
 * through the typed framing channel: we refuse to guess where the format
 * defines no rule.
 *
 * @internal
 */
export const selectSoleDocument = (content: string): Effect.Effect<SelectedDocument, ParseFailure> =>
	Effect.gen(function* () {
		const documents = yield* Yaml.parseAll(content).pipe(Effect.mapError(syntaxFailure));
		if (documents.length > 1) {
			return yield* Effect.fail(framingFailure("unexpectedDocuments", documents.length));
		}
		const document = documents.at(0);
		if (documents.length === 0 || isEmptyDocument(document)) {
			return yield* Effect.fail(framingFailure("noLockfileDocument", documents.length));
		}
		return { document, documents: documents.length };
	});
