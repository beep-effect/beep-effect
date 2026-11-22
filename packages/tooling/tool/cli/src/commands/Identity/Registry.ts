/**
 * The identity registry generator behind `beep identity registry`: generate the
 * artifacts from the source shards, or check that the committed ones match them.
 *
 * **Details**
 *
 * The source shards are `registry/namespaces/<prefix>.json` in the identity
 * package, one {@link RegistryShard} per file. The generator builds the one
 * {@link RegistryTable} from them and writes two artifacts: the literal data
 * module `src/internal/generated/Registry.data.ts` and the term-stability
 * snapshot `registry/term-snapshot.json`. The snapshot's `release` is a property
 * of the change against a base ref ({@link BaseSnapshot}): a writer computes it
 * from the snapshot the base publishes, so a change made in many steps is released
 * once. Where the base commit publishes none, the registry is still unreleased
 * and a writer keeps the release the committed snapshot has ({@link ReleasePolicy}).
 * `--check`, which reads no git state, and a writer with no base commit succeed
 * the committed snapshot. A shard that names a `projection` package also has its
 * bindings written into that package as plain literals, for a package that
 * cannot import `@beep/identity`. A projection module no shard targets any more
 * is drift, and `--write` removes it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdentityAuthority } from "@beep/identity/Authority";
import { $RepoCliId } from "@beep/identity/packages";
import {
  CodeId,
  RegistryProjection,
  RegistryShard,
  RegistryTable,
  registryConflictMessage,
  SnapshotViolation,
  snapshotViolationMessage,
  snapshotViolations,
  TermSnapshot,
  termSetViolations,
} from "@beep/identity/Term";
import { formatJsonValue } from "@beep/repo-cli-kit/cli/Json";
import { workspaceDirectories } from "@beep/repo-cli-kit/RepoWorkspaces";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import type { Term } from "@beep/identity/Term";

const $I = $RepoCliId.create("commands/Identity/Registry");

const SHARD_DIRECTORY = "registry/namespaces";
const SNAPSHOT_FILE = "registry/term-snapshot.json";
const DATA_FILE = "src/internal/generated/Registry.data.ts";
const PROJECTION_FILE = "src/internal/generated/RegistryTerms.ts";
const JSON_LINE_WIDTH = 80;
/**
 * The ref whose merge base with `HEAD` is the base of a run that names none with `--base`.
 *
 * **Example** (Read the default base ref)
 *
 * ```ts
 * import { DEFAULT_BASE_REF } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(DEFAULT_BASE_REF) // "origin/main"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_BASE_REF = "origin/main";

// The command that regenerates the artifacts against the base `--base` named, or against the default base.
const writeCommand = (ref: O.Option<string>): string =>
  `\`bun run beep identity registry --write${O.match(ref, { onNone: () => "", onSome: (named) => ` --base ${named}` })}\``;
// A package move rewrites binding codes only: the names a shard may project into are a closed set in source.
const PROJECTION_REMEDY =
  "After renaming the package, put its new name in the RegistryProjection literal (`@beep/identity/Term`) and in the shard's `projection`, then move its bindings with `bun run beep identity rebind @beep/<old package> @beep/<new package>`; otherwise drop the shard's `projection`.";
const WRITE_HINT = `Run ${writeCommand(O.none())} to regenerate.`;

/**
 * Closed kind of an identity registry finding.
 *
 * **Example** (Check a finding kind)
 *
 * ```ts
 * import { IdentityRegistryIssueKind } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(IdentityRegistryIssueKind.is["registry-conflict"]("registry-conflict")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IdentityRegistryIssueKind = LiteralKit([
  "registry-shard-invalid",
  "registry-conflict",
  "registry-snapshot-break",
  "registry-generated-drift",
  "term-removed-without-deprecation",
  "namespace-prefix-changed",
  "deprecation-changed",
  "term-revived",
  "binding-changed",
  "release-regressed",
  "release-overstated",
  "since-misstated",
  "binding-dangling",
]).pipe(
  $I.annoteSchema("IdentityRegistryIssueKind", {
    description:
      "Identity registry finding kind: a shard that fails to decode, a conflict between shards, a regenerated snapshot that breaks the committed one, a generated artifact that differs from regeneration, or a break of the base ref's published term set (a term or namespace removed without a deprecation, a namespace prefix changed, a deprecation removed or changed, a deprecated term revived, a binding reassigned), a snapshot release below its base or below the release its changes call for, a snapshot release above the one its changes call for, an added binding or deprecation that records another release, or a binding whose code names no module of the checkout.",
  })
);

/**
 * Decoded type of {@link IdentityRegistryIssueKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type IdentityRegistryIssueKind = typeof IdentityRegistryIssueKind.Type;

/**
 * One identity registry finding: its kind, the file it is about and what is wrong.
 *
 * **Example** (Make a drift finding)
 *
 * ```ts
 * import { IdentityRegistryIssue } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const issue = IdentityRegistryIssue.make({
 *   kind: "registry-generated-drift",
 *   subject: "packages/foundation/modeling/identity/registry/term-snapshot.json",
 *   detail: "differs from regeneration"
 * })
 * console.log(issue.kind) // "registry-generated-drift"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdentityRegistryIssue extends S.Opaque<IdentityRegistryIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: IdentityRegistryIssueKind,
    subject: S.String.annotateKey({ description: "Repository-relative file the finding is about." }),
    detail: S.String.annotateKey({ description: "What is wrong and how to repair it." }),
  }).pipe(
    $I.annoteSchema("IdentityRegistryIssue", {
      description: "Identity registry finding: kind, subject file and remediation detail.",
    })
  )
) {}

/**
 * One source file read for the generator: its repository-relative path and its text.
 *
 * **Example** (Describe a shard source)
 *
 * ```ts
 * import { RegistrySourceFile } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const file = RegistrySourceFile.make({ path: "registry/namespaces/fabio.json", content: "{}" })
 * console.log(file.path) // "registry/namespaces/fabio.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistrySourceFile extends S.Opaque<RegistrySourceFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.annotateKey({ description: "Repository-relative path of the file." }),
    content: S.String.annotateKey({ description: "UTF-8 text of the file." }),
  }).pipe($I.annoteSchema("RegistrySourceFile", { description: "A file the registry generator reads or writes." }))
) {}

/**
 * Where the generator writes the projection of the shards that name one package.
 *
 * **Example** (Describe a projection target)
 *
 * ```ts
 * import { RegistryProjectionTarget } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const target = RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner")
 * console.log(target.path) // "packages/test-runner/src/internal/generated/RegistryTerms.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryProjectionTarget extends S.Opaque<RegistryProjectionTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    projection: RegistryProjection,
    path: S.String.annotateKey({ description: "Repository-relative path of the generated projection module." }),
  }).pipe(
    $I.annoteSchema("RegistryProjectionTarget", {
      description: "A package the registry projects bindings into and the module it writes there.",
    })
  )
) {
  /**
   * Target the projection module of `projection` under its package directory `packageDir`.
   *
   * **Example** (Target the test runner)
   *
   * ```ts
   * import { RegistryProjectionTarget } from "@beep/repo-cli/commands/Identity/Registry"
   *
   * console.log(RegistryProjectionTarget.of("@beep/test-runner", "packages/test-runner").projection) // "@beep/test-runner"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (projection: RegistryProjection, packageDir: string): RegistryProjectionTarget =>
    RegistryProjectionTarget.make({ projection, path: `${packageDir}/${PROJECTION_FILE}` });
}

/**
 * The registry layout of one checkout: where the shards, the snapshot and the data module live.
 *
 * **Example** (Lay out a fixture identity package)
 *
 * ```ts
 * import { RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * console.log(layout.snapshot) // "packages/identity/registry/term-snapshot.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryLayout extends S.Opaque<RegistryLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    shards: S.String.annotateKey({ description: "Repository-relative directory of the source shards." }),
    snapshot: S.String.annotateKey({ description: "Repository-relative path of the term snapshot." }),
    data: S.String.annotateKey({ description: "Repository-relative path of the generated data module." }),
    projections: S.Array(RegistryProjectionTarget).annotateKey({
      description: "Projection modules the checkout carries, one per package present in it.",
    }),
  }).pipe($I.annoteSchema("RegistryLayout", { description: "Paths of the identity registry files in a checkout." }))
) {
  /**
   * Lay out the registry under the identity package directory `identityDir`, with its projection targets.
   *
   * **Example** (Lay out the registry)
   *
   * ```ts
   * import { RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
   *
   * console.log(RegistryLayout.of("packages/identity").data) // "packages/identity/src/internal/generated/Registry.data.ts"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (
    identityDir: string,
    projections: ReadonlyArray<RegistryProjectionTarget> = []
  ): RegistryLayout =>
    RegistryLayout.make({
      shards: `${identityDir}/${SHARD_DIRECTORY}`,
      snapshot: `${identityDir}/${SNAPSHOT_FILE}`,
      data: `${identityDir}/${DATA_FILE}`,
      projections,
    });
}

/**
 * The identity registry generator could not read or write its files.
 *
 * **Example** (Make a generator error)
 *
 * ```ts
 * import { IdentityRegistryGeneratorError } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(IdentityRegistryGeneratorError.make({ message: "Cannot read the shards." }).message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IdentityRegistryGeneratorError extends S.TaggedError<
  IdentityRegistryGeneratorError,
  { readonly brand: unique symbol }
>($I`IdentityRegistryGeneratorError`)(
  "IdentityRegistryGeneratorError",
  { message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<IdentityRegistryGeneratorError>("IdentityRegistryGeneratorError", {
    description: "The identity registry generator could not read or write its files.",
  })
) {}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const quote: (value: string) => string = flow(S.encodeResult(S.fromJsonString(S.String)), Result.getOrThrow);

// A member line of a pretty-printed array of JSON scalars, and the line that closes an array.
const SCALAR_MEMBER_LINE = /^ *(?:"(?:[^"\\]|\\.)*"|-?\d[\d.eE+-]*|true|false|null),?$/;
const ARRAY_CLOSE_LINE = /^ *\],?$/;

// `pending` is an opening line ending in `[` followed by its scalar member lines; `close` ends it.
const inlineArray = (pending: A.NonEmptyReadonlyArray<string>, close: string): string =>
  `${A.headNonEmpty(pending)}${A.join(
    A.map(A.tailNonEmpty(pending), (member) => Str.replace(/,$/, "")(Str.trim(member))),
    ", "
  )}${Str.trim(close)}`;

// The output so far plus the open array, if any: its opening line (ending in `[`) and scalar member lines.
type CollapseState = { readonly output: ReadonlyArray<string>; readonly pending: ReadonlyArray<string> };

const closeArray = (output: ReadonlyArray<string>, pending: A.NonEmptyReadonlyArray<string>, close: string) => {
  const inline = inlineArray(pending, close);
  return Str.length(inline) <= JSON_LINE_WIDTH
    ? A.append(output, inline)
    : A.appendAll(output, A.append(pending, close));
};

const openOrKeep = (output: ReadonlyArray<string>, line: string): CollapseState =>
  Str.endsWith("[")(line) ? { output, pending: [line] } : { output: A.append(output, line), pending: [] };

const collapseStep = ({ output, pending }: CollapseState, line: string): CollapseState => {
  if (!A.isReadonlyArrayNonEmpty(pending)) {
    return openOrKeep(output, line);
  }
  if (SCALAR_MEMBER_LINE.test(line)) {
    return { output, pending: A.append(pending, line) };
  }
  return ARRAY_CLOSE_LINE.test(line)
    ? { output: closeArray(output, pending, line), pending: [] }
    : openOrKeep(A.appendAll(output, pending), line);
};

const collapseScalarArrays = (text: string): string => {
  const { output, pending } = A.reduce(Str.split("\n")(text), { output: [], pending: [] }, collapseStep);
  return A.join(A.appendAll(output, pending), "\n");
};

/**
 * Render a JSON value the way the repository's Biome JSON formatter lays it out.
 *
 * **Details**
 *
 * The value is pretty-printed with one member per line, which Biome keeps for
 * objects. Biome puts an array of scalars on one line when it fits the
 * 80-column JSON line width, so such arrays are collapsed here too. The
 * output ends with a newline.
 *
 * **Example** (Render a shard)
 *
 * ```ts
 * import { renderRegistryJson } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(renderRegistryJson({ terms: ["Report"], bindings: [] }))
 * // {
 * //   "terms": ["Report"],
 * //   "bindings": []
 * // }
 * ```
 *
 * @param value - The JSON-compatible value to render.
 * @returns The value as Biome-formatted JSON text ending in a newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderRegistryJson = (value: unknown): string => collapseScalarArrays(formatJsonValue(value));

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const objectKey = (value: string): string => (isIdentifier(value) ? value : quote(value));

const authorityReference = "${IdentityAuthority}";

const iriLiteral = (iri: string): string =>
  Str.startsWith(IdentityAuthority)(iri)
    ? `\`${authorityReference}${Str.slice(Str.length(IdentityAuthority))(iri)}\``
    : quote(iri);

const sortedEntries = <Value>(entries: ReadonlyArray<readonly [string, Value]>) =>
  A.sort(
    entries,
    Order.mapInput(Order.String, ([key]: readonly [string, Value]) => key)
  );

/**
 * The `VocabShape` view of a table: each prefix with its namespace IRI and its live locals.
 *
 * **Example** (Read the vocabulary of a table)
 *
 * ```ts
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 * import { registryVocabOf } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const fabio = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
 *   terms: ["Report"],
 *   bindings: [],
 *   deprecations: []
 * })
 * console.log(registryVocabOf(Result.getOrThrow(RegistryTable.fromShards([fabio]))).fabio?.terms) // ["Report"]
 * ```
 *
 * @param table - The registry table to project.
 * @returns Each prefix with its namespace IRI and its live locals in ascending order.
 * @category projections
 * @since 0.0.0
 */
export const registryVocabOf = (
  table: RegistryTable
): Readonly<Record<string, { readonly iri: string; readonly terms: ReadonlyArray<string> }>> =>
  R.fromEntries(
    A.map(table.namespaces, (namespace) => [
      namespace.prefix,
      {
        iri: namespace.iri,
        terms: A.sort(
          A.filterMap(table.terms, (term: Term) =>
            term.namespace === namespace.prefix ? Result.succeed(term.local) : Result.failVoid
          ),
          Order.String
        ),
      },
    ])
  );

const renderVocabEntry = ([prefix, entry]: readonly [
  string,
  { readonly iri: string; readonly terms: ReadonlyArray<string> },
]): string =>
  `  ${objectKey(prefix)}: {
    iri: ${iriLiteral(entry.iri)},
    terms: [${A.join(
      A.map(entry.terms, (term) => `\n      ${quote(term)},`),
      ""
    )}${A.isReadonlyArrayEmpty(entry.terms) ? "" : "\n    "}],
  },`;

const renderBindings = (table: RegistryTable): ReadonlyArray<string> => {
  const termByIri = R.fromEntries(A.map(table.terms, (term) => [term.iri, term] as const));
  // A table binding always names a live term (RegistryTable invariant), so the lookup never misses.
  return A.flatMap(table.bindings, (binding) =>
    pipe(
      R.get(termByIri, binding.term),
      O.map(
        (term) =>
          `  ${quote(binding.code)}: { curie: ${quote(`${term.namespace}:${term.local}`)}, iri: ${iriLiteral(term.iri)} },`
      ),
      O.toArray
    )
  );
};

const renderDeprecations = (table: RegistryTable): ReadonlyArray<string> =>
  A.map(table.deprecations, (deprecation) =>
    O.match(deprecation.replacement, {
      onNone: () => `  ${quote(deprecation.term)}: { since: ${quote(deprecation.since)} },`,
      onSome: (replacement) =>
        `  ${quote(deprecation.term)}: { since: ${quote(deprecation.since)}, replacement: ${iriLiteral(replacement)} },`,
    })
  );

// A TypeScript object literal with one property per line.
const recordBody = (rows: ReadonlyArray<string>): string =>
  A.isReadonlyArrayEmpty(rows) ? "{}" : A.join(A.flatten([["{"], rows, ["}"]]), "\n");

/**
 * Render the generated `Registry.data.ts` module for a table.
 *
 * **Details**
 *
 * The module holds three literal constants and imports only
 * `IdentityAuthority`, and only when a rendered IRI literal (a namespace,
 * a bound term or a replacement) substitutes it:
 * `RegistryVocab` (the `VocabShape` view), `RegistryBindings` (code identity
 * to CURIE and IRI) and `RegistryDeprecations` (deprecated IRI to its release
 * and replacement).
 *
 * **Example** (Render the data module)
 *
 * ```ts
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 * import { renderRegistryData } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const fabio = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
 *   terms: ["Report"],
 *   bindings: [],
 *   deprecations: []
 * })
 * console.log(renderRegistryData(Result.getOrThrow(RegistryTable.fromShards([fabio]))).includes("export const RegistryVocab"))
 * ```
 *
 * @param table - The registry table to render.
 * @returns The text of the generated `Registry.data.ts` module.
 * @category formatting
 * @since 0.0.0
 */
export const renderRegistryData = (table: RegistryTable): string => {
  const vocab = A.map(sortedEntries(R.toEntries(registryVocabOf(table))), renderVocabEntry);
  const bindings = renderBindings(table);
  const deprecations = renderDeprecations(table);
  // The import follows the rendered rows: any IRI literal under the authority references it.
  const authority = A.some(A.flatten([vocab, bindings, deprecations]), Str.includes(authorityReference))
    ? `import { IdentityAuthority } from "../../Authority.ts";\n\n`
    : "";
  return `/**
 * Generated by \`bun run beep identity registry --write\` from the source shards in
 * \`registry/namespaces/\`. Do not edit by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
${authority}/**
 * Every registry namespace: its IRI and its live term locals, keyed by prefix.
 *
 * @category constants
 * @since 0.0.0
 */
export const RegistryVocab = ${recordBody(vocab)} as const satisfies Readonly<
  Record<string, { readonly iri: string; readonly terms: ReadonlyArray<string> }>
>;

/**
 * Every bound code identity: the CURIE and IRI of the term it is bound to.
 *
 * @category constants
 * @since 0.0.0
 */
export const RegistryBindings = ${recordBody(bindings)} as const satisfies Readonly<
  Record<string, { readonly curie: string; readonly iri: string }>
>;

/**
 * Every deprecated term IRI: the release that deprecated it and its replacement, when one exists.
 *
 * @category constants
 * @since 0.0.0
 */
export const RegistryDeprecations = ${recordBody(deprecations)} as const satisfies Readonly<
  Record<string, { readonly since: string; readonly replacement?: string }>
>;
`;
};

const encodeSnapshot = flow(S.encodeResult(TermSnapshot), Result.getOrThrow);

/**
 * Render a term snapshot as the committed `term-snapshot.json` text.
 *
 * **Example** (Render the empty snapshot)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { renderTermSnapshot } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(renderTermSnapshot(TermSnapshot.empty).startsWith("{\n  \"version\": \"term-snapshot/v1\""))
 * ```
 *
 * @param snapshot - The term snapshot to render.
 * @returns The committed `term-snapshot.json` text.
 * @category formatting
 * @since 0.0.0
 */
export const renderTermSnapshot = (snapshot: TermSnapshot): string => renderRegistryJson(encodeSnapshot(snapshot));

const renderProjectionRow = (term: Term, code: string): string => `  ${quote(code)}: {
    identifier: ${quote(code)},
    iri: ${quote(term.iri)},
    curie: ${quote(`${term.namespace}:${term.local}`)},
  },`;

// Every generated projection module starts with these lines, and no other file does.
const PROJECTION_HEADER = `/**
 * Generated by \`bun run beep identity registry --write\` from the identity registry shards that
 * project into this package. Do not edit by hand.
`;

// Only a generated projection is ever reported as stale or removed.
const isGeneratedProjection: (content: string) => boolean = Str.startsWith(PROJECTION_HEADER);

/**
 * Render the projection module of one package: every binding of the given namespaces as plain literals.
 *
 * **Details**
 *
 * The module imports nothing, because a projection package cannot import
 * `@beep/identity`. Each row is keyed by its code identity and carries that
 * identity, the bound term IRI and its CURIE.
 *
 * **Example** (Render a projection)
 *
 * ```ts
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 * import { renderRegistryProjection } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const vitest = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "vitest", iri: "https://example.test/vitest/" },
 *   terms: ["TestHang"],
 *   bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
 *   deprecations: []
 * })
 * const table = Result.getOrThrow(RegistryTable.fromShards([vitest]))
 * console.log(renderRegistryProjection(table, ["vitest"]).includes("vitest:TestHang"))
 * ```
 *
 * @param table - The registry table whose bindings are projected.
 * @param prefixes - The namespaces whose bindings the package receives.
 * @returns The text of the generated `RegistryTerms.ts` module.
 * @category formatting
 * @since 0.0.0
 */
export const renderRegistryProjection: {
  (prefixes: ReadonlyArray<string>): (table: RegistryTable) => string;
  (table: RegistryTable, prefixes: ReadonlyArray<string>): string;
} = dual(2, (table: RegistryTable, prefixes: ReadonlyArray<string>): string => {
  const termByIri = R.fromEntries(A.map(table.terms, (term) => [term.iri, term] as const));
  const rows = A.flatMap(table.bindings, (binding) =>
    pipe(
      R.get(termByIri, binding.term),
      O.filter((term) => A.contains(prefixes, term.namespace)),
      O.map((term) => renderProjectionRow(term, binding.code)),
      O.toArray
    )
  );
  return `${PROJECTION_HEADER} *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Every code identity this package binds in the identity registry: the identity, its term IRI and its CURIE.
 *
 * @category constants
 * @since 0.0.0
 */
export const RegistryTerms = ${recordBody(rows)} as const satisfies Readonly<
  Record<string, { readonly identifier: string; readonly iri: string; readonly curie: string }>
>;
`;
});

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

const decodeShard = S.decodeUnknownResult(S.fromJsonString(RegistryShard));
const decodeSnapshot = S.decodeUnknownResult(S.fromJsonString(TermSnapshot));

const shardIssue = (path: string, detail: string): IdentityRegistryIssue =>
  IdentityRegistryIssue.make({ kind: "registry-shard-invalid", subject: path, detail });

/**
 * Decode one shard file, refusing a file that is not named after its prefix.
 *
 * **Example** (Decode a shard file)
 *
 * ```ts
 * import { decodeShardFile, RegistrySourceFile } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 *
 * const file = RegistrySourceFile.make({
 *   path: "registry/namespaces/fabio.json",
 *   content: '{"namespace":{"prefix":"fabio","iri":"http://purl.org/spar/fabio/"},"terms":[],"bindings":[],"deprecations":[]}'
 * })
 * console.log(Result.isSuccess(decodeShardFile(file))) // true
 * ```
 *
 * @param file - The shard file to decode.
 * @returns The decoded shard, or the `registry-shard-invalid` finding.
 * @category validation
 * @since 0.0.0
 */
export const decodeShardFile = (file: RegistrySourceFile): Result.Result<RegistryShard, IdentityRegistryIssue> =>
  pipe(
    decodeShard(file.content),
    Result.mapError((error) => shardIssue(file.path, error.message)),
    Result.flatMap((shard) =>
      Str.endsWith(`/${shard.namespace.prefix}.json`)(file.path)
        ? Result.succeed(shard)
        : Result.fail(shardIssue(file.path, `A shard file is named after its prefix: ${shard.namespace.prefix}.json.`))
    )
  );

/**
 * The term snapshot of a base ref and the ref a run named for it.
 *
 * **Details**
 *
 * A base that publishes no term set has the empty snapshot. `ref` is the
 * `--base` of the run, so a remedy names the command that repairs against the
 * same base. `resolved` is false when the checkout has no base commit at all
 * (not a git work tree, no `origin/main`, disjoint history): the empty
 * snapshot then says nothing about what is published.
 *
 * **Example** (Describe a base that published nothing)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const base = BaseSnapshot.make({ snapshot: TermSnapshot.empty })
 * console.log(base.snapshot.release) // "0.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaseSnapshot extends S.Opaque<BaseSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    snapshot: TermSnapshot,
    ref: S.Option(S.String)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "The ref `--base` named; none for the default base." }),
    resolved: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Whether a base commit was found; false when the checkout has no default base.",
    }),
  }).pipe(
    $I.annoteSchema("BaseSnapshot", {
      description: "The term snapshot of a base ref and the ref that was named.",
    })
  )
) {}

/**
 * Decode the snapshot text of a base ref; an absent snapshot is the empty snapshot.
 *
 * **Example** (Read a base with no snapshot)
 *
 * ```ts
 * import { decodeBaseSnapshot } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.getOrThrow(decodeBaseSnapshot("term-snapshot.json", O.none())).release) // "0.0.0"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const decodeBaseSnapshot: {
  (text: O.Option<string>): (subject: string) => Result.Result<TermSnapshot, IdentityRegistryIssue>;
  (subject: string, text: O.Option<string>): Result.Result<TermSnapshot, IdentityRegistryIssue>;
} = dual(
  2,
  (subject: string, text: O.Option<string>): Result.Result<TermSnapshot, IdentityRegistryIssue> =>
    O.match(text, {
      onNone: () => Result.succeed(TermSnapshot.empty),
      onSome: flow(
        decodeSnapshot,
        Result.mapError((error) =>
          IdentityRegistryIssue.make({
            kind: "registry-generated-drift",
            subject,
            detail: `The base ref's snapshot does not decode: ${error.message}`,
          })
        )
      ),
    })
);

/**
 * The inputs of one registry plan: the layout, the shard files, the committed snapshot text and the base.
 *
 * **Example** (Describe a plan with no committed snapshot)
 *
 * ```ts
 * import { RegistryLayout, RegistryPlanInput } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * const input = RegistryPlanInput.make({ layout: RegistryLayout.of("packages/identity"), shardFiles: [], committed: O.none() })
 * console.log(input.shardFiles.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryPlanInput extends S.Opaque<RegistryPlanInput, { readonly brand: unique symbol }>()(
  S.Struct({
    layout: RegistryLayout,
    shardFiles: S.Array(RegistrySourceFile).annotateKey({ description: "The shard files, in path order." }),
    committed: S.Option(S.String).annotateKey({ description: "The committed snapshot text, when one exists." }),
    base: S.Option(BaseSnapshot)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "The base a writer releases the change against; none for a check." }),
  }).pipe($I.annoteSchema("RegistryPlanInput", { description: "The inputs of one identity registry plan." }))
) {}

// The base a plan succeeds: one that publishes a term set. Any other base leaves the committed snapshot.
const publishedBase = (input: RegistryPlanInput): O.Option<BaseSnapshot> =>
  O.filter(input.base, (base) => TermSnapshot.isPublished(base.snapshot));

/**
 * How a regeneration releases its change: `succeed` the previous snapshot, or `keep` its release.
 *
 * **Details**
 *
 * A writer over a base commit that publishes no term set keeps: until the
 * base publishes, every edit of the checkout is part of one unreleased change,
 * and succeeding the committed snapshot would bump the release once per
 * command. Every other regeneration succeeds its previous snapshot, including
 * a writer in a checkout with no base commit, where nothing says the registry
 * is unreleased.
 *
 * **Example** (Check a policy)
 *
 * ```ts
 * import { ReleasePolicy } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(ReleasePolicy.is.keep("keep")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReleasePolicy = LiteralKit(["succeed", "keep"]).pipe(
  $I.annoteSchema("ReleasePolicy", {
    description:
      "How a regeneration releases its change: succeed the previous snapshot, or keep the release of a registry no base has published.",
  })
);

/**
 * Type of {@link ReleasePolicy}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReleasePolicy = typeof ReleasePolicy.Type;

/**
 * The release policy of a run over `base`: `keep` for a writer whose base commit publishes no term set.
 *
 * **Example** (Keep the release over an unpublished base)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, releasePolicy } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * console.log(releasePolicy(BaseSnapshot.makeOption({ snapshot: TermSnapshot.empty }))) // "keep"
 * console.log(releasePolicy(O.none())) // "succeed"
 * ```
 *
 * @param base - The base of the run; none for a check.
 * @returns The policy the regeneration follows.
 * @category projections
 * @since 0.0.0
 */
export const releasePolicy = (base: O.Option<BaseSnapshot>): ReleasePolicy =>
  O.exists(base, ({ resolved, snapshot }) => resolved && !TermSnapshot.isPublished(snapshot)) ? "keep" : "succeed";

/**
 * Regenerate the snapshot of `table` after `previous`, under a {@link ReleasePolicy}.
 *
 * **Example** (Keep the release of an unreleased registry)
 *
 * ```ts
 * import { ReleaseVersion, RegistryTable, TermSnapshot } from "@beep/identity/Term"
 * import { regeneratedSnapshot } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 *
 * const table = Result.getOrThrow(RegistryTable.fromShards([]))
 * const committed = TermSnapshot.make({ ...TermSnapshot.empty, release: ReleaseVersion.make("2.0.0") })
 * console.log(regeneratedSnapshot(table, "keep", committed).release) // "2.0.0"
 * ```
 *
 * @param table - The registry table to project.
 * @param policy - Whether the change succeeds `previous` or keeps its release.
 * @param previous - The snapshot the plan reads as the previous one.
 * @returns The snapshot the plan writes, at the release the policy gives.
 * @category projections
 * @since 0.0.0
 */
export const regeneratedSnapshot: {
  (policy: ReleasePolicy, previous: TermSnapshot): (table: RegistryTable) => TermSnapshot;
  (table: RegistryTable, policy: ReleasePolicy, previous: TermSnapshot): TermSnapshot;
} = dual(
  3,
  (table: RegistryTable, policy: ReleasePolicy, previous: TermSnapshot): TermSnapshot =>
    ReleasePolicy.is.keep(policy)
      ? RegistryTable.snapshotKeeping(table, previous)
      : RegistryTable.snapshot(table, previous)
);

/**
 * The previous snapshot of a regeneration: the base's when the base publishes a term set, else the committed one.
 *
 * **Details**
 *
 * A committed snapshot that does not decode is a `registry-generated-drift`
 * finding, because the release history it carries cannot be recovered by
 * regeneration. It is not read at all when the base publishes a term set, whose
 * release history is the one that counts.
 *
 * **Example** (Succeed the base)
 *
 * ```ts
 * import { ReleaseVersion, TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, previousSnapshot, RegistryLayout, RegistryPlanInput } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * const snapshot = TermSnapshot.make({ ...TermSnapshot.empty, release: ReleaseVersion.make("1.0.0") })
 * const base = BaseSnapshot.makeOption({ snapshot })
 * const input = RegistryPlanInput.make({ layout, shardFiles: [], committed: O.none(), base })
 * console.log(Result.getOrThrow(previousSnapshot(input)).release) // "1.0.0"
 * ```
 *
 * @param input - The inputs of the plan.
 * @returns The snapshot the plan succeeds, or the finding that the committed one does not decode.
 * @category projections
 * @since 0.0.0
 */
export const previousSnapshot = (input: RegistryPlanInput): Result.Result<TermSnapshot, IdentityRegistryIssue> =>
  O.match(publishedBase(input), {
    onSome: ({ snapshot }) => Result.succeed(snapshot),
    onNone: () =>
      O.match(input.committed, {
        onNone: () => Result.succeed(TermSnapshot.empty),
        onSome: flow(
          decodeSnapshot,
          Result.mapError((error) =>
            IdentityRegistryIssue.make({
              kind: "registry-generated-drift",
              subject: input.layout.snapshot,
              detail: `The committed snapshot does not decode, so its release history is unknown: ${error.message}`,
            })
          )
        ),
      }),
  });

/**
 * One registry plan: the regenerated snapshot, every artifact generated from the same table, and the
 * projection modules no shard targets.
 *
 * **Details**
 *
 * `snapshot` is the value the snapshot artifact renders, so a reader of the
 * plan compares it without looking the file up and decoding it again.
 * `retired` names the projection module of every package in the checkout that
 * no shard projects into. Such a file is stale only when it is a generated
 * projection; any other file at that path is left alone.
 *
 * **Example** (Describe a plan over no term)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { RegistryPlan } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const plan = RegistryPlan.make({ snapshot: TermSnapshot.empty, artifacts: [], retired: [] })
 * console.log(plan.snapshot.release) // "0.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryPlan extends S.Opaque<RegistryPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    snapshot: TermSnapshot,
    artifacts: S.Array(RegistrySourceFile).annotateKey({
      description: "The generated files: the data module, the snapshot and every projection module.",
    }),
    retired: S.Array(S.String).annotateKey({
      description: "Repository-relative paths of the projection modules no shard targets.",
    }),
  }).pipe(
    $I.annoteSchema("RegistryPlan", {
      description: "The regenerated snapshot, the artifacts and the retired projection modules of one plan.",
    })
  )
) {}

// Where a violation was found and what repairs it there.
type RemedyContext = {
  readonly where: string;
  readonly layout: RegistryLayout;
  readonly ref: O.Option<string>;
};

// How to repair each kind of break; only a term's removal is repaired with `identity deprecate`, which retires
// a live term and never a namespace.
const REMOVAL_REMEDY =
  "Restore the IRI, or retire it with `bun run beep identity deprecate`, the only writer of a term's deprecation.";
const NAMESPACE_REMOVAL_REMEDY =
  "Restore the namespace's shard, or retire it by hand: `identity deprecate` retires terms only. In a remaining shard, add a deprecation of the namespace IRI and of each live term of the removed shard, at the release of the change (`replacement: \"\"` names that shard's namespace as the namespace IRI's successor), then regenerate.";
const PREFIX_REMEDY = "Restore the namespace's prefix from the base ref.";
const DEPRECATION_REMEDY = "Restore the deprecation row from the base ref; deprecations are append-only.";
const REVIVED_REMEDY = "Remove the term again; a deprecated IRI is never published again.";
const BINDING_REMEDY =
  "Restore the binding's term and `since` from the base ref; move a renamed module with `bun run beep identity rebind`.";

// The writer computes the release from the base, so regenerating repairs it. A base that is not an ancestor
// yet still publishes rows the checkout lacks, and a wrong `since` is a shard edit of its own.
const mergeStep = ({ ref }: RemedyContext): string =>
  `Merge ${O.getOrElse(ref, () => DEFAULT_BASE_REF)} if it is not merged yet`;
const releaseRemedy = (context: RemedyContext): string =>
  `${mergeStep(context)}, set every \`since\` reported as since-misstated, then run ${writeCommand(context.ref)}.`;
const sinceRemedy = (context: RemedyContext): string =>
  `${mergeStep(context)}, set that \`since\` in its shard under ${context.layout.shards} to the release of the change, then run ${writeCommand(context.ref)}.`;

// The lint kind of each way a head snapshot breaks the base ref's published term set, and its remedy.
const baseBreaks: {
  readonly [Tag in SnapshotViolation["_tag"]]: readonly [
    kind: IdentityRegistryIssueKind,
    remedy: (context: RemedyContext) => string,
  ];
} = {
  TermRemoved: ["term-removed-without-deprecation", constant(REMOVAL_REMEDY)],
  NamespaceDropped: ["term-removed-without-deprecation", constant(NAMESPACE_REMOVAL_REMEDY)],
  NamespacePrefixChanged: ["namespace-prefix-changed", constant(PREFIX_REMEDY)],
  DeprecationRemoved: ["deprecation-changed", constant(DEPRECATION_REMEDY)],
  DeprecationChanged: ["deprecation-changed", constant(DEPRECATION_REMEDY)],
  TermRevived: ["term-revived", constant(REVIVED_REMEDY)],
  SinceRewritten: ["binding-changed", constant(BINDING_REMEDY)],
  BindingReassigned: ["binding-changed", constant(BINDING_REMEDY)],
  BindingAmbiguous: ["binding-changed", constant(BINDING_REMEDY)],
  ReleaseRegressed: ["release-regressed", releaseRemedy],
  ReleaseUnderstated: ["release-regressed", releaseRemedy],
  ReleaseOverstated: ["release-overstated", releaseRemedy],
  BindingSinceMisstated: ["since-misstated", sinceRemedy],
  DeprecationSinceMisstated: ["since-misstated", sinceRemedy],
};

// What a violation says and what repairs it, as the text of a finding.
const violationDetail = (context: RemedyContext, violation: SnapshotViolation): string =>
  `${context.where}: ${snapshotViolationMessage(violation)} ${baseBreaks[violation._tag][1](context)}`;

const AGAINST_BASE = "Against the base ref";
const AGAINST_COMMITTED = "Against the committed snapshot";

// Why a regeneration is refused. A writer judges the rows against a base that publishes a term set. Against
// the committed snapshot alone a row may never have been published, so the text says what tells them apart:
// the writer, for a check, and the snapshot's removal where no base publishes one.
const breakIssue =
  (input: RegistryPlanInput) =>
  (violation: SnapshotViolation): IdentityRegistryIssue => {
    const { base, layout } = input;
    const ref = O.flatMap(base, (found) => found.ref);
    const detail = O.match(base, {
      onNone: () =>
        `${AGAINST_COMMITTED}: ${snapshotViolationMessage(violation)} Run ${writeCommand(ref)}, which judges the change against its base ref.`,
      onSome: ({ snapshot }) =>
        TermSnapshot.isPublished(snapshot)
          ? violationDetail({ where: AGAINST_BASE, layout, ref }, violation)
          : `${violationDetail({ where: AGAINST_COMMITTED, layout, ref }, violation)} If no branch published it either, remove ${layout.snapshot} and run ${writeCommand(ref)}.`,
    });
    return IdentityRegistryIssue.make({ kind: "registry-snapshot-break", subject: layout.snapshot, detail });
  };

const isSinceViolation = SnapshotViolation.isAnyOf(["BindingSinceMisstated", "DeprecationSinceMisstated"]);

// A row the change adds whose `since` is not the release of the change. Only a shard edit repairs it, so the
// writer refuses the change instead of writing what the lint then reports.
const sinceIssues = (input: RegistryPlanInput, previous: TermSnapshot, next: TermSnapshot) =>
  O.match(publishedBase(input), {
    onNone: A.empty<IdentityRegistryIssue>,
    onSome: () =>
      A.map(A.filter(snapshotViolations(previous, next), isSinceViolation), (violation) =>
        IdentityRegistryIssue.make({
          kind: "since-misstated",
          subject: input.layout.snapshot,
          detail: `${AGAINST_BASE}: ${snapshotViolationMessage(violation)} Set that \`since\` in its shard under ${input.layout.shards} to the release of the change, then run the same command again.`,
        })
      ),
  });

/**
 * Build the table from shard files and render every generated artifact, or return every finding.
 *
 * **Details**
 *
 * The regenerated snapshot succeeds {@link previousSnapshot}. One whose rows
 * break that snapshot, such as a term removed with no deprecation, is a
 * `registry-snapshot-break` finding for each break, so `--write` refuses it. A
 * row the base never published is free to go again. Against a base that
 * publishes a term set, a binding or deprecation the change adds must record
 * the release of the change: another `since` is a `since-misstated` finding,
 * because only a shard edit repairs it. The release itself is computed, so
 * regenerating repairs it, and {@link baseSnapshotIssues} judges the committed one.
 *
 * **Example** (Plan from no shards)
 *
 * ```ts
 * import { planRegistryArtifacts, RegistryLayout, RegistryPlanInput } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * console.log(Result.isFailure(planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [], committed: O.none() }))))
 * ```
 *
 * @param input - The layout, source shards, committed snapshot and optional release base.
 * @returns The regenerated snapshot, the generated artifacts and the retired projection modules, or every finding that blocks them.
 * @category projections
 * @since 0.0.0
 */
export const planRegistryArtifacts = (
  input: RegistryPlanInput
): Result.Result<RegistryPlan, A.NonEmptyReadonlyArray<IdentityRegistryIssue>> => {
  const { layout, shardFiles } = input;
  if (A.isReadonlyArrayEmpty(shardFiles)) {
    return Result.fail([shardIssue(layout.shards, "The registry has no source shard.")]);
  }
  const decoded = A.map(shardFiles, decodeShardFile);
  const invalid = A.getFailures(decoded);
  if (A.isReadonlyArrayNonEmpty(invalid)) {
    return Result.fail(invalid);
  }
  const previous = previousSnapshot(input);
  if (Result.isFailure(previous)) {
    return Result.fail([previous.failure]);
  }
  return pipe(
    RegistryTable.fromShards(A.getSuccesses(decoded)),
    Result.mapError(
      A.map((conflict) =>
        IdentityRegistryIssue.make({
          kind: "registry-conflict",
          subject: layout.shards,
          detail: registryConflictMessage(conflict),
        })
      )
    ),
    Result.flatMap((table) => {
      const shards = A.getSuccesses(decoded);
      const projectionIssues = A.filterMap(shards, (shard) =>
        O.match(shard.projection, {
          onNone: () => Result.failVoid,
          onSome: (projection) =>
            A.some(layout.projections, (target) => target.projection === projection)
              ? Result.failVoid
              : Result.succeed(
                  shardIssue(
                    `${layout.shards}/${shard.namespace.prefix}.json`,
                    `The shard projects into ${projection}, which this checkout does not have. ${PROJECTION_REMEDY}`
                  )
                ),
        })
      );
      if (A.isReadonlyArrayNonEmpty(projectionIssues)) {
        return Result.fail(projectionIssues);
      }
      // A target no shard names any more has a module to retire; the others have one to generate.
      const [projections, retired] = A.partition(layout.projections, (target) => {
        const prefixes = A.filterMap(shards, (shard) =>
          O.contains(shard.projection, target.projection) ? Result.succeed(shard.namespace.prefix) : Result.failVoid
        );
        return A.isReadonlyArrayNonEmpty(prefixes)
          ? Result.succeed(
              RegistrySourceFile.make({ path: target.path, content: renderRegistryProjection(table, prefixes) })
            )
          : Result.fail(target.path);
      });
      const next = regeneratedSnapshot(table, releasePolicy(input.base), previous.success);
      const breaks = A.appendAll(
        A.map(termSetViolations(previous.success, next), breakIssue(input)),
        sinceIssues(input, previous.success, next)
      );
      return A.isReadonlyArrayNonEmpty(breaks)
        ? Result.fail(breaks)
        : Result.succeed(
            RegistryPlan.make({
              snapshot: next,
              artifacts: [
                RegistrySourceFile.make({ path: layout.data, content: renderRegistryData(table) }),
                RegistrySourceFile.make({ path: layout.snapshot, content: renderTermSnapshot(next) }),
                ...projections,
              ],
              retired,
            })
          );
    })
  );
};

const driftIssue = (subject: string, detail: string): IdentityRegistryIssue =>
  IdentityRegistryIssue.make({ kind: "registry-generated-drift", subject, detail: `${detail} ${WRITE_HINT}` });

/**
 * The drift findings of a plan against the files on disk.
 *
 * **Details**
 *
 * A planned artifact drifts when it is missing or differs. A retired
 * projection module drifts while a generated projection is still on disk at
 * its path.
 *
 * **Example** (Report a missing artifact)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { driftIssues, RegistryPlan, RegistrySourceFile } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * const plan = RegistryPlan.make({
 *   snapshot: TermSnapshot.empty,
 *   artifacts: [RegistrySourceFile.make({ path: "a.json", content: "{}\n" })],
 *   retired: []
 * })
 * console.log(driftIssues(plan, () => O.none()).length) // 1
 * console.log(driftIssues(() => O.some("{}\n"))(plan).length) // 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const driftIssues: {
  (current: (path: string) => O.Option<string>): (plan: RegistryPlan) => ReadonlyArray<IdentityRegistryIssue>;
  (plan: RegistryPlan, current: (path: string) => O.Option<string>): ReadonlyArray<IdentityRegistryIssue>;
} = dual(
  2,
  (plan: RegistryPlan, current: (path: string) => O.Option<string>): ReadonlyArray<IdentityRegistryIssue> =>
    A.appendAll(
      A.filterMap(plan.artifacts, (artifact) =>
        O.match(current(artifact.path), {
          onNone: () => Result.succeed(driftIssue(artifact.path, "The generated artifact is missing.")),
          onSome: (content) =>
            content === artifact.content
              ? Result.failVoid
              : Result.succeed(driftIssue(artifact.path, "The generated artifact differs from regeneration.")),
        })
      ),
      A.filterMap(plan.retired, (retired) =>
        O.exists(current(retired), isGeneratedProjection)
          ? Result.succeed(driftIssue(retired, "No shard projects into this package any more."))
          : Result.failVoid
      )
    )
);

/**
 * The findings of a head snapshot against the snapshot of a base ref (law L0-3).
 *
 * **Details**
 *
 * The committed snapshot is regenerated against itself, so a change that
 * rewrites the shards and the snapshot together passes `--check`. This
 * comparison reads the base ref's snapshot instead: every term and namespace
 * IRI the base published stays published or gains a deprecation, deprecations
 * stay as they were, a deprecated IRI is not revived, a namespace keeps its
 * prefix and a binding keeps its term and `since`. Additions are free. The head
 * is released as exactly the release the change calls for, and every binding
 * or deprecation it adds records that release.
 *
 * **Example** (Report a term removed against the base)
 *
 * ```ts
 * import { ReleaseVersion, TermIri, TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, baseSnapshotIssues, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 *
 * const snapshot = Result.getOrThrow(
 *   TermSnapshot.fromRows({
 *     release: ReleaseVersion.make("1.0.0"),
 *     namespaces: [],
 *     terms: [TermIri.make("http://www.w3.org/ns/prov#Activity")],
 *     bindings: [],
 *     deprecations: []
 *   })
 * )
 * const layout = RegistryLayout.of("packages/identity")
 * const base = BaseSnapshot.make({ snapshot })
 * console.log(baseSnapshotIssues(base, TermSnapshot.empty, layout)[0]?.kind)
 * // "term-removed-without-deprecation"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const baseSnapshotIssues: {
  (head: TermSnapshot, layout: RegistryLayout): (base: BaseSnapshot) => ReadonlyArray<IdentityRegistryIssue>;
  (base: BaseSnapshot, head: TermSnapshot, layout: RegistryLayout): ReadonlyArray<IdentityRegistryIssue>;
} = dual(
  3,
  (base: BaseSnapshot, head: TermSnapshot, layout: RegistryLayout): ReadonlyArray<IdentityRegistryIssue> =>
    A.map(snapshotViolations(base.snapshot, head), (violation) =>
      IdentityRegistryIssue.make({
        kind: baseBreaks[violation._tag][0],
        subject: layout.snapshot,
        detail: violationDetail({ where: AGAINST_BASE, layout, ref: base.ref }, violation),
      })
    )
);

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const ioError = (message: string) => (cause: unknown) => IdentityRegistryGeneratorError.make({ message, cause });

const readOptional = Effect.fn("IdentityRegistry.readOptional")(function* (repoRoot: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, file);
  const exists = yield* fs.exists(absolute).pipe(Effect.mapError(ioError(`Cannot stat ${file}.`)));
  if (!exists) {
    return O.none<string>();
  }
  const content = yield* fs.readFileString(absolute).pipe(Effect.mapError(ioError(`Cannot read ${file}.`)));
  return O.some(content);
});

const isCodeId = S.is(CodeId);

// The workspace package a binding code names (`@beep/<package>`) and its module path: every segment
// but the last, which is the member (a class or `Class.field`). Only a code identity has them: it has no
// segment of dots alone, so its module path never leaves the package's `src`.
const codeParts = (code: string): O.Option<readonly [packageName: string, modulePath: string]> => {
  const [scope, name = "", ...segments] = Str.split("/")(code);
  const modulePath = A.join(A.dropRight(segments, 1), "/");
  return isCodeId(code) && modulePath !== "" ? O.some([`${scope}/${name}`, modulePath] as const) : O.none();
};

// The files a module path may name under its package.
const moduleCandidates = (modulePath: string): ReadonlyArray<string> => [
  `src/${modulePath}.ts`,
  `src/${modulePath}.tsx`,
  `src/${modulePath}/index.ts`,
];

// Whether a path is a regular file. A missing path, or one below a file, names no module.
const isRegularFile = Effect.fn("IdentityRegistry.isRegularFile")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.stat(absolutePath).pipe(
    Effect.map((info) => info.type === "File"),
    Effect.catchTag("PlatformError", (error) =>
      A.contains(["NotFound", "BadResource"], error.reason._tag) ? Effect.succeed(false) : Effect.fail(error)
    ),
    Effect.mapError(ioError(`Cannot stat ${absolutePath}.`))
  );
});

/**
 * The code identities among `codes` that name no module of the checkout at `repoRoot`.
 *
 * **Details**
 *
 * A binding code is `@beep/<package>/<module path>/<member>`, whose last
 * segment is the member (a class, or `Class.field`). It resolves when
 * `<package>` is a workspace of the checkout and the module path names a
 * regular file of that package: `src/<module path>.ts`, `.tsx` or
 * `src/<module path>/index.ts`. A directory with such a name is no module, and
 * a code that is not a {@link CodeId}, such as one with a `..` segment, names
 * none. A
 * binding that resolves nowhere would leave its class unbound at runtime, so `rebind`
 * refuses to create one and `identity registry --check` reports one.
 *
 * **Example** (List the dangling codes of a checkout)
 *
 * ```ts
 * import { danglingBindingCodes } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(danglingBindingCodes("/repo", ["@beep/test-runner/Vitest/TestHang"]))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const danglingBindingCodes = Effect.fn("IdentityRegistry.danglingBindingCodes")(function* (
  repoRoot: string,
  codes: ReadonlyArray<string>
) {
  const path = yield* Path.Path;
  const workspaces = yield* workspaceDirectories(repoRoot).pipe(
    Effect.mapError(ioError("Cannot list the workspaces of the checkout."))
  );
  const resolves = (code: string) =>
    O.match(
      O.flatMap(codeParts(code), ([packageName, modulePath]) =>
        O.map(HashMap.get(workspaces, packageName), (directory) => [directory, modulePath] as const)
      ),
      {
        onNone: () => Effect.succeed(false),
        onSome: ([directory, modulePath]) =>
          Effect.findFirst(moduleCandidates(modulePath), (candidate) =>
            isRegularFile(path.join(directory, candidate))
          ).pipe(Effect.map(O.isSome)),
      }
    );
  return yield* Effect.filter(codes, (code) => Effect.map(resolves(code), (found) => !found), { concurrency: 1 });
});

/**
 * Resolve the registry layout of the checkout at `repoRoot` from the identity workspace.
 *
 * **Example** (Resolve the layout)
 *
 * ```ts
 * import { resolveRegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(resolveRegistryLayout("/repo"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveRegistryLayout = Effect.fn("IdentityRegistry.resolveLayout")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const packagesFile = yield* CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(repoRoot).pipe(
    Effect.mapError(ioError("Cannot resolve the @beep/identity workspace."))
  );
  const workspaces = yield* workspaceDirectories(repoRoot).pipe(
    Effect.mapError(ioError("Cannot list the workspaces of the checkout."))
  );
  const projections = A.filterMap(RegistryProjection.literals, (projection) =>
    O.match(HashMap.get(workspaces, projection), {
      onNone: () => Result.failVoid,
      onSome: (directory) =>
        Result.succeed(RegistryProjectionTarget.of(projection, path.relative(repoRoot, directory))),
    })
  );
  return RegistryLayout.of(path.dirname(path.dirname(packagesFile)), projections);
});

/**
 * Whether the checkout carries an identity registry at all: shards or a generated data module.
 *
 * **Example** (Probe for a registry)
 *
 * ```ts
 * import { RegistryLayout, registryPresent } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(registryPresent("/repo", RegistryLayout.of("packages/identity")))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const registryPresent = Effect.fn("IdentityRegistry.present")(function* (
  repoRoot: string,
  layout: RegistryLayout
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const probe = (relative: string) =>
    fs.exists(path.join(repoRoot, relative)).pipe(Effect.mapError(ioError(`Cannot stat ${relative}.`)));
  return (yield* probe(layout.shards)) || (yield* probe(layout.data));
});

/**
 * Read the shard files of the checkout at `repoRoot`, in path order.
 *
 * **Example** (Read the shards)
 *
 * ```ts
 * import { readShardFiles, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(readShardFiles("/repo", RegistryLayout.of("packages/identity")))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readShardFiles = Effect.fn("IdentityRegistry.readShardFiles")(function* (
  repoRoot: string,
  layout: RegistryLayout
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(repoRoot, layout.shards);
  const exists = yield* fs.exists(directory).pipe(Effect.mapError(ioError(`Cannot stat ${layout.shards}.`)));
  if (!exists) {
    return A.empty<RegistrySourceFile>();
  }
  const names = yield* fs.readDirectory(directory).pipe(Effect.mapError(ioError(`Cannot list ${layout.shards}.`)));
  return yield* Effect.forEach(
    A.sort(A.filter(names, Str.endsWith(".json")), Order.String),
    (name) =>
      fs.readFileString(path.join(directory, name)).pipe(
        Effect.mapBoth({
          onFailure: ioError(`Cannot read ${layout.shards}/${name}.`),
          onSuccess: (content) => RegistrySourceFile.make({ path: `${layout.shards}/${name}`, content }),
        })
      ),
    { concurrency: 1 }
  );
});

/**
 * Read the plan inputs of the checkout at `repoRoot`: its shards, its committed snapshot and the given base.
 *
 * **Example** (Read the inputs of a check)
 *
 * ```ts
 * import { readRegistryPlanInput, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * console.log(readRegistryPlanInput("/repo", RegistryLayout.of("packages/identity"), O.none()))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readRegistryPlanInput = Effect.fn("IdentityRegistry.readPlanInput")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: O.Option<BaseSnapshot>
) {
  const shardFiles = yield* readShardFiles(repoRoot, layout);
  const committed = yield* readOptional(repoRoot, layout.snapshot);
  return RegistryPlanInput.make({ layout, shardFiles, committed, base });
});

/**
 * Plan the registry artifacts of the checkout at `repoRoot` from its shards, its committed snapshot and the given base.
 *
 * **Details**
 *
 * An edited shard stands in for the committed shard at its path, so an edit is
 * planned in full before any of it is written. An edit at a path that has no
 * shard, or two edits at one path, is a `registry-shard-invalid` finding: the
 * plan would not describe what a write of the edits writes. A check names no
 * base and reads no git state.
 *
 * **Example** (Plan the registry)
 *
 * ```ts
 * import { planRegistry, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * console.log(planRegistry("/repo", RegistryLayout.of("packages/identity"), O.none()))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const planRegistry = Effect.fn("IdentityRegistry.plan")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: O.Option<BaseSnapshot>,
  edits: ReadonlyArray<RegistrySourceFile> = A.empty()
) {
  const input = yield* readRegistryPlanInput(repoRoot, layout, base);
  const editIssues = A.filterMap(A.dedupe(A.map(edits, (edited) => edited.path)), (path) => {
    const count = A.length(A.filter(edits, (edited) => edited.path === path));
    if (count > 1) {
      return Result.succeed(shardIssue(path, `${count} edits name this shard; an edit names each shard once.`));
    }
    return A.some(input.shardFiles, (file) => file.path === path)
      ? Result.failVoid
      : Result.succeed(shardIssue(path, "The edit names no shard of the registry; an edit replaces a shard."));
  });
  if (A.isReadonlyArrayNonEmpty(editIssues)) {
    return Result.fail(editIssues);
  }
  const shardFiles = A.map(input.shardFiles, (file) =>
    pipe(
      A.findFirst(edits, (edited) => edited.path === file.path),
      O.getOrElse(() => file)
    )
  );
  return planRegistryArtifacts(RegistryPlanInput.make({ ...input, shardFiles }));
});

/**
 * Every registry finding of the checkout at `repoRoot`: invalid shards, conflicts, drift, and the breaks of
 * `against`'s published term set.
 *
 * **Details**
 *
 * Every binding code of the regenerated snapshot names a module of the checkout
 * ({@link danglingBindingCodes}). The plan reads no base and no git state: a
 * committed release below a `since` its rows record is drift, because a
 * regeneration raises it. Given a base snapshot, the same regenerated snapshot is
 * also compared with it ({@link baseSnapshotIssues}), so both comparisons read
 * one set of shards. A checkout whose plan fails has no head snapshot, so it
 * reports why the plan failed and nothing against the base.
 *
 * **Example** (Check the registry)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, checkRegistry, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * console.log(checkRegistry("/repo", layout))
 * console.log(checkRegistry("/repo", layout, O.some(BaseSnapshot.make({ snapshot: TermSnapshot.empty }))))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkRegistry = Effect.fn("IdentityRegistry.check")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  against: O.Option<BaseSnapshot> = O.none()
) {
  const plan = yield* planRegistry(repoRoot, layout, O.none());
  if (Result.isFailure(plan)) {
    return plan.failure;
  }
  const { artifacts, retired, snapshot } = plan.success;
  const current = yield* Effect.forEach(
    A.appendAll(
      A.map(artifacts, (artifact) => artifact.path),
      retired
    ),
    (file) => Effect.map(readOptional(repoRoot, file), (content) => [file, content] as const),
    { concurrency: 1 }
  );
  const byPath = R.fromEntries(current);
  const drift = driftIssues(plan.success, (file) => O.flatten(R.get(byPath, file)));
  const dangling = yield* danglingBindingCodes(
    repoRoot,
    A.map(snapshot.bindings, (binding) => binding.code)
  );
  const danglingIssues = A.map(dangling, (code) =>
    IdentityRegistryIssue.make({
      kind: "binding-dangling",
      subject: layout.shards,
      detail: `The binding code ${code} names no module of the checkout. Restore the module, or move the binding with \`bun run beep identity rebind\`.`,
    })
  );
  const baseIssues = O.match(against, {
    onNone: A.empty<IdentityRegistryIssue>,
    onSome: (base) => baseSnapshotIssues(base, snapshot, layout),
  });
  return A.appendAll(A.appendAll(drift, danglingIssues), baseIssues);
});

/**
 * What one registry write changed: the files it wrote and the projection modules it removed.
 *
 * **Example** (Describe a write that changed nothing)
 *
 * ```ts
 * import { RegistryWrite } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(RegistryWrite.make({ written: [], removed: [] }).written.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryWrite extends S.Opaque<RegistryWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    written: S.Array(S.String).annotateKey({ description: "Repository-relative paths whose bytes changed." }),
    removed: S.Array(S.String).annotateKey({ description: "Repository-relative paths of removed projection modules." }),
  }).pipe($I.annoteSchema("RegistryWrite", { description: "The files one registry write changed and removed." }))
) {}

// Replace a file whole: a failed write leaves the old bytes, so a rerun never reads a truncated file. Each
// write stages in a directory of its own beside the file, which `mkdtemp` creates new, so no other write
// shares the staged file and no entry already at a staging path (a link left there) is followed.
const replaceFile = Effect.fn("IdentityRegistry.replaceFile")(function* (repoRoot: string, file: RegistrySourceFile) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, file.path);
  const current = yield* readOptional(repoRoot, file.path);
  if (O.contains(current, file.content)) {
    return false;
  }
  const directory = path.dirname(absolute);
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(ioError(`Cannot create the directory of ${file.path}.`)));
  const staging = yield* fs
    .makeTempDirectory({ directory, prefix: `.${path.basename(absolute)}.staging-` })
    .pipe(Effect.mapError(ioError(`Cannot stage ${file.path}.`)));
  const staged = path.join(staging, path.basename(absolute));
  yield* fs
    .writeFileString(staged, file.content, { flag: "wx" })
    .pipe(
      Effect.andThen(fs.rename(staged, absolute)),
      Effect.ensuring(Effect.ignore(fs.remove(staging, { recursive: true, force: true }))),
      Effect.mapError(ioError(`Cannot write ${file.path}.`))
    );
  return true;
});

// Remove a retired projection module; a file at its path that the generator did not write stays.
const removeRetired = Effect.fn("IdentityRegistry.removeRetired")(function* (repoRoot: string, retired: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, retired);
  const current = yield* readOptional(repoRoot, retired);
  if (!O.exists(current, isGeneratedProjection)) {
    return false;
  }
  yield* fs.remove(absolute).pipe(Effect.mapError(ioError(`Cannot remove ${retired}.`)));
  return true;
});

// The same failure with how to finish what it interrupted.
const withRecovery =
  (recovery: string) =>
  (error: IdentityRegistryGeneratorError): IdentityRegistryGeneratorError =>
    IdentityRegistryGeneratorError.make({ message: `${error.message} ${recovery}`, cause: error.cause });

/**
 * Write the registry artifacts of the checkout at `repoRoot`, or return the findings that block it.
 *
 * **Details**
 *
 * The release is computed from the base, so writing the same change in many steps
 * gives the release of the whole change. A base commit that publishes no term set
 * leaves the committed snapshot as the previous one and keeps its release.
 *
 * The edited shards are written with the generated artifacts, and only after the
 * whole plan succeeds: a finding leaves every file as it was. No other shard is
 * rewritten, and the projection module of a package no shard targets any more is
 * removed.
 *
 * The shards are written before anything generated from them, and each file is
 * replaced whole. A failure while the shards are written leaves the shards that
 * are left as they were, so the same edit can be run again. A failure after that
 * says that the edit was applied and that `identity registry --write` finishes
 * it, because the edit itself no longer applies.
 *
 * **Example** (Write the registry)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, RegistryLayout, writeRegistry } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * const base = BaseSnapshot.make({ snapshot: TermSnapshot.empty })
 * console.log(writeRegistry("/repo", layout, base))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const writeRegistry = Effect.fn("IdentityRegistry.write")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: BaseSnapshot,
  edits: ReadonlyArray<RegistrySourceFile> = A.empty()
) {
  const plan = yield* planRegistry(repoRoot, layout, O.some(base), edits);
  if (Result.isFailure(plan)) {
    return Result.fail(plan.failure);
  }
  const { artifacts, retired } = plan.success;
  const replaceAll = (files: ReadonlyArray<RegistrySourceFile>) =>
    Effect.filter(files, (file) => replaceFile(repoRoot, file), { concurrency: 1 });
  const shards = yield* replaceAll(edits).pipe(
    Effect.mapError(withRecovery("Fix the error, then run the same command again to edit the shards that are left."))
  );
  const generated = Effect.all(
    [replaceAll(artifacts), Effect.filter(retired, (file) => removeRetired(repoRoot, file), { concurrency: 1 })],
    { concurrency: 1 }
  );
  const [regenerated, removed] = yield* A.isReadonlyArrayNonEmpty(edits)
    ? Effect.mapError(
        generated,
        withRecovery(
          `The shard edit was applied (${A.join(
            A.map(edits, (file) => file.path),
            ", "
          )}), so do not run it again: fix the error, then run ${writeCommand(base.ref)}.`
        )
      )
    : generated;
  return Result.succeed(
    RegistryWrite.make({
      written: A.map(A.appendAll(shards, regenerated), (file) => file.path),
      removed,
    })
  );
});

/**
 * One line per registry finding, in report order.
 *
 * **Example** (Format a finding)
 *
 * ```ts
 * import { IdentityRegistryIssue, issueLine } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(issueLine(IdentityRegistryIssue.make({ kind: "registry-conflict", subject: "a", detail: "b" })))
 * // a [registry-conflict] b
 * ```
 *
 * @param issue - The finding to format.
 * @returns The finding as `<subject> [<kind>] <detail>`.
 * @category formatting
 * @since 0.0.0
 */
export const issueLine = (issue: IdentityRegistryIssue): string => `${issue.subject} [${issue.kind}] ${issue.detail}`;
