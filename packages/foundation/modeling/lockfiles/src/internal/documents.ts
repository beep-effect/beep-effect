import { $LockfilesId } from "@beep/identity/packages";
import { Yaml } from "@beep/yaml";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { framingFailure, syntaxFailure } from "./shared.ts";
import type { ParseFailure } from "./shared.ts";

const $I = $LockfilesId.create("internal/documents");

/**
 * A document selected out of a YAML stream, with the stream's document count
 * carried alongside so a framing failure can report it.
 *
 * **Example** (Describe a selected document)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { SelectedDocument } from "@beep/lockfiles/internal/documents";
 *
 * console.log(S.is(SelectedDocument)({ document: { lockfileVersion: "9.0" }, documents: 1 })); // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class SelectedDocument extends S.Opaque<SelectedDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    document: S.Unknown.pipe(
      $I.annoteKey("SelectedDocument.document", {
        description: "Selected YAML value, preserved for the format-specific validator",
      })
    ),
    documents: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      $I.annoteKey("SelectedDocument.documents", { description: "Number of documents composed from the YAML stream" })
    ),
  }).pipe(
    $I.annoteSchema("SelectedDocument", {
      description: "A selected YAML document together with its stream's document count",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SelectedDocument {
  /**
   * The plain, unbranded encoded shape of a {@link SelectedDocument}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SelectedDocument.Encoded;
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
 * **Example** (Describe a stream without a preamble)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PnpmStream } from "@beep/lockfiles/internal/documents";
 *
 * console.log(S.is(PnpmStream)({ preamble: undefined, main: { lockfileVersion: "9.0" }, documents: 1 })); // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class PnpmStream extends S.Opaque<PnpmStream, { readonly brand: unique symbol }>()(
  S.Struct({
    preamble: S.Unknown.pipe(
      $I.annoteKey("PnpmStream.preamble", {
        description: "Env preamble value, or undefined when its stream position is empty or absent",
      })
    ),
    main: S.Unknown.pipe(
      $I.annoteKey("PnpmStream.main", {
        description: "Main lockfile value, or undefined when its stream position is empty or absent",
      })
    ),
    documents: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
      $I.annoteKey("PnpmStream.documents", { description: "Number of documents composed from the YAML stream" })
    ),
  }).pipe(
    $I.annoteSchema("PnpmStream", {
      description: "Positional pnpm YAML stream payload preserving the preamble, main document and document count",
    })
  )
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PnpmStream {
  /**
   * The plain, unbranded encoded shape of a {@link PnpmStream}.
   *
   * @internal
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PnpmStream.Encoded;
}

/**
 * Split a `pnpm-lock.yaml` YAML stream into its env preamble and its main
 * lockfile document. This is the one place pnpm's document framing is
 * decided: `Lockfile.parse` projects the main document out of it and
 * `PnpmEnvLockfile` the preamble, so the two readers cannot disagree about
 * which document is which or how many a stream may carry.
 *
 * **Details**
 *
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
 * **Example** (Split a lockfile without an env preamble)
 *
 * ```ts
 * import { splitPnpmStream } from "@beep/lockfiles/internal/documents";
 * import * as Effect from "effect/Effect";
 *
 * const stream = Effect.runSync(splitPnpmStream("lockfileVersion: '9.0'"));
 * console.log(stream.preamble === undefined); // true
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const splitPnpmStream = Effect.fn("LockfileDocuments.splitPnpmStream")(function* (
  content: string
): Effect.fn.Return<PnpmStream, ParseFailure> {
  const documents = yield* Yaml.parseAll(content).pipe(Effect.mapError(syntaxFailure));
  if (documents.length > MAX_PNPM_DOCUMENTS) {
    return yield* Effect.fail(framingFailure("unexpectedDocuments", documents.length));
  }
  const present = (document: unknown): unknown => (isEmptyDocument(document) ? undefined : document);
  return PnpmStream.make(
    documents.length === MAX_PNPM_DOCUMENTS
      ? { preamble: present(documents[0]), main: present(documents[1]), documents: documents.length }
      : { preamble: undefined, main: present(documents[0]), documents: documents.length }
  );
});

/**
 * Select the sole document of a YAML lockfile format that defines **no**
 * document framing — yarn Berry's `yarn.lock`.
 *
 * **Details**
 *
 * yarn never writes a multi-document `yarn.lock`, so there is no writer
 * contract to read a "main" document out of one. Rather than silently taking
 * the first document (which is what a single-document parse does, and how the
 * pnpm bug stayed invisible), a stream carrying more than one document fails
 * through the typed framing channel: we refuse to guess where the format
 * defines no rule.
 *
 * **Example** (Select a single yarn document)
 *
 * ```ts
 * import { selectSoleDocument } from "@beep/lockfiles/internal/documents";
 * import * as Effect from "effect/Effect";
 *
 * const selected = Effect.runSync(selectSoleDocument("__metadata:\n  version: 8"));
 * console.log(selected.documents); // 1
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const selectSoleDocument = Effect.fn("LockfileDocuments.selectSoleDocument")(function* (
  content: string
): Effect.fn.Return<SelectedDocument, ParseFailure> {
  const documents = yield* Yaml.parseAll(content).pipe(Effect.mapError(syntaxFailure));
  if (documents.length > 1) {
    return yield* Effect.fail(framingFailure("unexpectedDocuments", documents.length));
  }
  const document = documents.at(0);
  if (documents.length === 0 || isEmptyDocument(document)) {
    return yield* Effect.fail(framingFailure("noLockfileDocument", documents.length));
  }
  return SelectedDocument.make({ document, documents: documents.length });
});
