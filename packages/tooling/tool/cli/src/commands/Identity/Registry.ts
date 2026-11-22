/**
 * `beep identity registry`: generate the identity registry artifacts from the
 * source shards, or check that the committed artifacts match them.
 *
 * **Details**
 *
 * The source shards are `registry/namespaces/<prefix>.json` in the identity
 * package, one {@link RegistryShard} per file. The generator builds the one
 * {@link RegistryTable} from them and writes two artifacts: the literal data
 * module `src/internal/generated/Registry.data.ts` and the term-stability
 * snapshot `registry/term-snapshot.json`. The committed snapshot is the
 * previous snapshot, so regeneration keeps its `release` until the published
 * set changes. A shard that names a `projection` package also has its
 * bindings written into that package as plain literals, for a package that
 * cannot import `@beep/identity`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdentityAuthority } from "@beep/identity/Authority";
import { $RepoCliId } from "@beep/identity/packages";
import {
  RegistryProjection,
  RegistryShard,
  RegistryTable,
  registryConflictMessage,
  snapshotReleaseViolations,
  snapshotViolationMessage,
  snapshotViolations,
  TermSnapshot,
} from "@beep/identity/Term";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { formatJsonValue } from "@beep/repo-cli-kit/cli/Json";
import { workspaceDirectories } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CreatePackageIdentityRegistration } from "../CreatePackage/internal/IdentityRegistration.ts";
import type { SnapshotViolation, Term } from "@beep/identity/Term";

const $I = $RepoCliId.create("commands/Identity/Registry");

const SHARD_DIRECTORY = "registry/namespaces";
const SNAPSHOT_FILE = "registry/term-snapshot.json";
const DATA_FILE = "src/internal/generated/Registry.data.ts";
const PROJECTION_FILE = "src/internal/generated/RegistryTerms.ts";
const JSON_LINE_WIDTH = 80;
const WRITE_HINT = "Run `bun run beep identity registry --write` to regenerate.";

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
  "binding-dangling",
]).pipe(
  $I.annoteSchema("IdentityRegistryIssueKind", {
    description:
      "Identity registry finding kind: a shard that fails to decode, a conflict between shards, a regenerated snapshot that breaks the committed one, a generated artifact that differs from regeneration, or a break of the base ref's published term set (a term or namespace removed without a deprecation, a namespace prefix changed, a deprecation removed or changed, a deprecated term revived, a binding reassigned), a snapshot release wound back below its base or its own rows or below the release its changes call for, or a binding whose code names no module of the checkout.",
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
  return `/**
 * Generated by \`bun run beep identity registry --write\` from the identity registry shards that
 * project into this package. Do not edit by hand.
 *
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
 * The inputs of one registry plan: the layout, the shard files and the committed snapshot text.
 *
 * **Example** (Describe a plan with no committed snapshot)
 *
 * ```ts
 * import { RegistryLayout, RegistryPlanInput } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * const input = RegistryPlanInput.make({ layout: RegistryLayout.of("packages/identity"), shardFiles: [], previous: O.none() })
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
    previous: S.Option(S.String).annotateKey({ description: "The committed snapshot text, when one exists." }),
  }).pipe($I.annoteSchema("RegistryPlanInput", { description: "The inputs of one identity registry plan." }))
) {}

/**
 * One registry plan: the regenerated snapshot and every artifact generated from the same table.
 *
 * **Details**
 *
 * `snapshot` is the value the snapshot artifact renders, so a reader of the
 * plan compares it without looking the file up and decoding it again.
 *
 * **Example** (Describe a plan over no term)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { RegistryPlan } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * const plan = RegistryPlan.make({ snapshot: TermSnapshot.empty, artifacts: [] })
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
  }).pipe($I.annoteSchema("RegistryPlan", { description: "The regenerated snapshot and the artifacts of one plan." }))
) {}

/**
 * Build the table from shard files and render every generated artifact, or return every finding.
 *
 * **Details**
 *
 * `previous` is the committed snapshot text, if any. A snapshot that does not
 * decode is a `registry-generated-drift` finding, because the release history
 * it carries cannot be recovered by regeneration. A regenerated snapshot that
 * breaks the committed one, such as a term removed with no deprecation, is a
 * `registry-snapshot-break` finding for each violation, so `--write` refuses it.
 *
 * **Example** (Plan from no shards)
 *
 * ```ts
 * import { planRegistryArtifacts, RegistryLayout, RegistryPlanInput } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * console.log(Result.isFailure(planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles: [], previous: O.none() }))))
 * ```
 *
 * @returns The regenerated snapshot and the generated artifacts, or every finding that blocks them.
 * @category projections
 * @since 0.0.0
 */
export const planRegistryArtifacts = ({
  layout,
  shardFiles,
  previous,
}: RegistryPlanInput): Result.Result<RegistryPlan, A.NonEmptyReadonlyArray<IdentityRegistryIssue>> => {
  if (A.isReadonlyArrayEmpty(shardFiles)) {
    return Result.fail([shardIssue(layout.shards, "The registry has no source shard.")]);
  }
  const decoded = A.map(shardFiles, decodeShardFile);
  const invalid = A.getFailures(decoded);
  if (A.isReadonlyArrayNonEmpty(invalid)) {
    return Result.fail(invalid);
  }
  const previousSnapshot = O.match(previous, {
    onNone: () => Result.succeed(TermSnapshot.empty),
    onSome: (text) =>
      pipe(
        decodeSnapshot(text),
        Result.mapError((error) =>
          IdentityRegistryIssue.make({
            kind: "registry-generated-drift",
            subject: layout.snapshot,
            detail: `The committed snapshot does not decode, so its release history is unknown: ${error.message}`,
          })
        )
      ),
  });
  if (Result.isFailure(previousSnapshot)) {
    return Result.fail([previousSnapshot.failure]);
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
                    `The shard projects into ${projection}, which this checkout does not have.`
                  )
                ),
        })
      );
      if (A.isReadonlyArrayNonEmpty(projectionIssues)) {
        return Result.fail(projectionIssues);
      }
      const projections = A.filterMap(layout.projections, (target) => {
        const prefixes = A.filterMap(shards, (shard) =>
          O.contains(shard.projection, target.projection) ? Result.succeed(shard.namespace.prefix) : Result.failVoid
        );
        return A.isReadonlyArrayNonEmpty(prefixes)
          ? Result.succeed(
              RegistrySourceFile.make({ path: target.path, content: renderRegistryProjection(table, prefixes) })
            )
          : Result.failVoid;
      });
      const next = RegistryTable.snapshot(table, previousSnapshot.success);
      const breaks = A.map(snapshotViolations(previousSnapshot.success, next), (violation) =>
        IdentityRegistryIssue.make({
          kind: "registry-snapshot-break",
          subject: layout.snapshot,
          detail: `${snapshotViolationMessage(violation)} Deprecate the term in its shard instead.`,
        })
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
            })
          );
    })
  );
};

/**
 * The drift findings of planned artifacts against the files on disk.
 *
 * **Example** (Report a missing artifact)
 *
 * ```ts
 * import { driftIssues, RegistrySourceFile } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as O from "effect/Option"
 *
 * const planned = [RegistrySourceFile.make({ path: "a.json", content: "{}\n" })]
 * console.log(driftIssues(planned, () => O.none()).length) // 1
 * console.log(driftIssues(() => O.some("{}\n"))(planned).length) // 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const driftIssues: {
  (
    current: (path: string) => O.Option<string>
  ): (planned: ReadonlyArray<RegistrySourceFile>) => ReadonlyArray<IdentityRegistryIssue>;
  (
    planned: ReadonlyArray<RegistrySourceFile>,
    current: (path: string) => O.Option<string>
  ): ReadonlyArray<IdentityRegistryIssue>;
} = dual(
  2,
  (
    planned: ReadonlyArray<RegistrySourceFile>,
    current: (path: string) => O.Option<string>
  ): ReadonlyArray<IdentityRegistryIssue> =>
    A.filterMap(planned, (artifact) =>
      O.match(current(artifact.path), {
        onNone: () =>
          Result.succeed(
            IdentityRegistryIssue.make({
              kind: "registry-generated-drift",
              subject: artifact.path,
              detail: `The generated artifact is missing. ${WRITE_HINT}`,
            })
          ),
        onSome: (content) =>
          content === artifact.content
            ? Result.failVoid
            : Result.succeed(
                IdentityRegistryIssue.make({
                  kind: "registry-generated-drift",
                  subject: artifact.path,
                  detail: `The generated artifact differs from regeneration. ${WRITE_HINT}`,
                })
              ),
      })
    )
);

// How to repair each kind of break; only a removal is repaired with `identity deprecate`.
const REMOVAL_REMEDY =
  "Restore the IRI, or retire it with `bun run beep identity deprecate`, the only writer of a deprecation.";
const PREFIX_REMEDY = "Restore the namespace's prefix from the base ref.";
const DEPRECATION_REMEDY = "Restore the deprecation row from the base ref; deprecations are append-only.";
const REVIVED_REMEDY = "Remove the term again; a deprecated IRI is never published again.";
const BINDING_REMEDY =
  "Restore the binding's term and `since` from the base ref; move a renamed module with `bun run beep identity rebind`.";
const RELEASE_REMEDY =
  "Restore the release in term-snapshot.json to at least the base ref's release and every `since` its rows record.";

const UNDERSTATED_REMEDY =
  "Merge the base ref, then regenerate against its snapshot with `bun run beep identity registry --write` so the release is the one the change calls for.";

// The lint kind of each way a head snapshot breaks the base ref's published term set, and its remedy.
const baseBreaks: {
  readonly [Tag in SnapshotViolation["_tag"]]: readonly [kind: IdentityRegistryIssueKind, remedy: string];
} = {
  TermRemoved: ["term-removed-without-deprecation", REMOVAL_REMEDY],
  NamespaceDropped: ["term-removed-without-deprecation", REMOVAL_REMEDY],
  NamespacePrefixChanged: ["namespace-prefix-changed", PREFIX_REMEDY],
  DeprecationRemoved: ["deprecation-changed", DEPRECATION_REMEDY],
  DeprecationChanged: ["deprecation-changed", DEPRECATION_REMEDY],
  TermRevived: ["term-revived", REVIVED_REMEDY],
  SinceRewritten: ["binding-changed", BINDING_REMEDY],
  BindingReassigned: ["binding-changed", BINDING_REMEDY],
  BindingAmbiguous: ["binding-changed", BINDING_REMEDY],
  ReleaseRegressed: ["release-regressed", RELEASE_REMEDY],
  ReleaseUnderstated: ["release-regressed", UNDERSTATED_REMEDY],
  ReleaseBelowSince: ["release-regressed", RELEASE_REMEDY],
};

// One registry finding for a snapshot violation, prefixed with where it was found.
const violationIssue =
  (subject: string, where: string) =>
  (violation: SnapshotViolation): IdentityRegistryIssue => {
    const [kind, remedy] = baseBreaks[violation._tag];
    return IdentityRegistryIssue.make({
      kind,
      subject,
      detail: `${where}: ${snapshotViolationMessage(violation)} ${remedy}`,
    });
  };

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
 * prefix and a binding keeps its term and `since`. Additions are free.
 *
 * **Example** (Report a term removed against the base)
 *
 * ```ts
 * import { ReleaseVersion, TermIri, TermSnapshot } from "@beep/identity/Term"
 * import { baseSnapshotIssues } from "@beep/repo-cli/commands/Identity/Registry"
 * import * as Result from "effect/Result"
 *
 * const base = Result.getOrThrow(
 *   TermSnapshot.fromRows({
 *     release: ReleaseVersion.make("1.0.0"),
 *     namespaces: [],
 *     terms: [TermIri.make("http://www.w3.org/ns/prov#Activity")],
 *     bindings: [],
 *     deprecations: []
 *   })
 * )
 * console.log(baseSnapshotIssues(base, TermSnapshot.empty, "term-snapshot.json")[0]?.kind)
 * // "term-removed-without-deprecation"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const baseSnapshotIssues: {
  (head: TermSnapshot, subject: string): (base: TermSnapshot) => ReadonlyArray<IdentityRegistryIssue>;
  (base: TermSnapshot, head: TermSnapshot, subject: string): ReadonlyArray<IdentityRegistryIssue>;
} = dual(
  3,
  (base: TermSnapshot, head: TermSnapshot, subject: string): ReadonlyArray<IdentityRegistryIssue> =>
    A.map(snapshotViolations(base, head), violationIssue(subject, "Against the base ref"))
);

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

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const ioError = (message: string) => (cause: unknown) => IdentityRegistryGeneratorError.make({ message, cause });

const readOptional = Effect.fn("IdentityRegistry.readOptional")(function* (absolutePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(absolutePath).pipe(Effect.mapError(ioError(`Cannot stat ${absolutePath}.`)));
  if (!exists) {
    return O.none<string>();
  }
  const content = yield* fs.readFileString(absolutePath).pipe(Effect.mapError(ioError(`Cannot read ${absolutePath}.`)));
  return O.some(content);
});

// The workspace package a binding code names (`@beep/<package>`) and its module path: every segment
// but the last, which is the member (a class or `Class.field`).
const codeParts = (code: string): O.Option<readonly [packageName: string, modulePath: string]> => {
  const [scope = "", name = "", ...segments] = Str.split("/")(code);
  const modulePath = A.join(A.dropRight(segments, 1), "/");
  return scope === "@beep" && name !== "" && modulePath !== ""
    ? O.some([`${scope}/${name}`, modulePath] as const)
    : O.none();
};

// The files a module path may name under its package.
const moduleCandidates = (modulePath: string): ReadonlyArray<string> => [
  `src/${modulePath}.ts`,
  `src/${modulePath}.tsx`,
  `src/${modulePath}/index.ts`,
];

/**
 * The code identities among `codes` that name no module of the checkout at `repoRoot`.
 *
 * **Details**
 *
 * A binding code is `@beep/<package>/<module path>/<member>`, whose last
 * segment is the member (a class, or `Class.field`). It resolves when
 * `<package>` is a workspace of the checkout and the module path names a
 * module file of that package: `src/<module path>.ts`, `.tsx` or
 * `src/<module path>/index.ts`. A binding that
 * resolves nowhere would leave its class unbound at runtime, so `rebind`
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
  const fs = yield* FileSystem.FileSystem;
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
            fs.exists(path.join(directory, candidate)).pipe(Effect.mapError(ioError(`Cannot stat ${candidate}.`)))
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
 * Plan the registry artifacts of the checkout at `repoRoot` from its shards and committed snapshot.
 *
 * **Details**
 *
 * An edited shard stands in for the committed shard at its path, so an edit is
 * planned in full before any of it is written.
 *
 * **Example** (Plan the registry)
 *
 * ```ts
 * import { planRegistry, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(planRegistry("/repo", RegistryLayout.of("packages/identity")))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const planRegistry = Effect.fn("IdentityRegistry.plan")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  edits: ReadonlyArray<RegistrySourceFile> = A.empty()
) {
  const path = yield* Path.Path;
  const committed = yield* readShardFiles(repoRoot, layout);
  const shardFiles = A.map(committed, (file) =>
    pipe(
      A.findFirst(edits, (edited) => edited.path === file.path),
      O.getOrElse(() => file)
    )
  );
  const previous = yield* readOptional(path.join(repoRoot, layout.snapshot));
  return planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles, previous }));
});

/**
 * Every registry finding of the checkout at `repoRoot`: invalid shards, conflicts, or drift.
 *
 * **Details**
 *
 * The regenerated snapshot is also checked on its own: its release is never
 * lower than a `since` its rows record, and every binding code names a
 * module of the checkout ({@link danglingBindingCodes}).
 *
 * **Example** (Check the registry)
 *
 * ```ts
 * import { checkRegistry, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(checkRegistry("/repo", RegistryLayout.of("packages/identity")))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkRegistry = Effect.fn("IdentityRegistry.check")(function* (repoRoot: string, layout: RegistryLayout) {
  const path = yield* Path.Path;
  const plan = yield* planRegistry(repoRoot, layout);
  if (Result.isFailure(plan)) {
    return plan.failure;
  }
  const { artifacts, snapshot } = plan.success;
  const current = yield* Effect.forEach(
    artifacts,
    (artifact) =>
      Effect.map(readOptional(path.join(repoRoot, artifact.path)), (content) => [artifact.path, content] as const),
    { concurrency: 1 }
  );
  const byPath = R.fromEntries(current);
  const drift = driftIssues(artifacts, (artifactPath) => O.flatten(R.get(byPath, artifactPath)));
  const release = A.map(snapshotReleaseViolations(snapshot), violationIssue(layout.snapshot, "In the snapshot"));
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
  return A.appendAll(A.appendAll(drift, release), danglingIssues);
});

/**
 * The findings of the checkout's regenerated snapshot against a base ref's snapshot.
 *
 * **Details**
 *
 * A checkout whose plan fails has no head snapshot to compare, so it reports
 * nothing here; {@link checkRegistry} reports why the plan failed.
 *
 * **Example** (Check against the empty base)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { checkRegistryAgainstBase, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(checkRegistryAgainstBase("/repo", RegistryLayout.of("packages/identity"), TermSnapshot.empty))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkRegistryAgainstBase = Effect.fn("IdentityRegistry.checkAgainstBase")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: TermSnapshot
) {
  const plan = yield* planRegistry(repoRoot, layout);
  return Result.match(plan, {
    onFailure: A.empty<IdentityRegistryIssue>,
    onSuccess: ({ snapshot }) => baseSnapshotIssues(base, snapshot, layout.snapshot),
  });
});

/**
 * Write the registry artifacts of the checkout at `repoRoot`, or return the findings that block it.
 *
 * **Details**
 *
 * The edited shards are written with the generated artifacts, and only after the
 * whole plan succeeds: a finding leaves every file as it was. No other shard is
 * rewritten. The result is the list of files whose bytes changed.
 *
 * **Example** (Write the registry)
 *
 * ```ts
 * import { RegistryLayout, writeRegistry } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(writeRegistry("/repo", RegistryLayout.of("packages/identity")))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const writeRegistry = Effect.fn("IdentityRegistry.write")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  edits: ReadonlyArray<RegistrySourceFile> = A.empty()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const plan = yield* planRegistry(repoRoot, layout, edits);
  if (Result.isFailure(plan)) {
    return Result.fail(plan.failure);
  }
  let written = A.empty<string>();
  for (const artifact of A.appendAll(edits, plan.success.artifacts)) {
    const absolute = path.join(repoRoot, artifact.path);
    const current = yield* readOptional(absolute);
    if (O.isSome(current) && current.value === artifact.content) {
      continue;
    }
    yield* fs
      .makeDirectory(path.dirname(absolute), { recursive: true })
      .pipe(Effect.mapError(ioError(`Cannot create the directory of ${artifact.path}.`)));
    yield* fs
      .writeFileString(absolute, artifact.content)
      .pipe(Effect.mapError(ioError(`Cannot write ${artifact.path}.`)));
    written = A.append(written, artifact.path);
  }
  return Result.succeed(written);
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

const reportIssues = Effect.fn("IdentityRegistry.reportIssues")(function* (
  issues: A.NonEmptyReadonlyArray<IdentityRegistryIssue>
) {
  yield* Console.error(`[identity:registry] found ${A.length(issues)} finding(s).`);
  for (const issue of issues) {
    yield* Console.error(issueLine(issue));
  }
  return yield* failWithReportedExit("identity registry: findings.");
});

const runIdentityRegistry = Effect.fn("IdentityRegistry.run")(function* (options: {
  readonly write: boolean;
  readonly check: boolean;
}) {
  if (options.write && options.check) {
    return yield* failWithReportedExit("identity registry: pass --write or --check, not both.");
  }
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(ioError("Cannot find the repository root.")));
  const layout = yield* resolveRegistryLayout(repoRoot);
  if (options.write) {
    const written = yield* writeRegistry(repoRoot, layout);
    if (Result.isFailure(written)) {
      return yield* reportIssues(written.failure);
    }
    yield* Console.log(
      A.isReadonlyArrayEmpty(written.success)
        ? "[identity:registry] up to date."
        : `[identity:registry] wrote ${A.join(written.success, ", ")}.`
    );
    return;
  }
  const issues = yield* checkRegistry(repoRoot, layout);
  if (A.isReadonlyArrayNonEmpty(issues)) {
    return yield* reportIssues(issues);
  }
  yield* Console.log("[identity:registry] OK: the generated registry artifacts match the shards.");
});

/**
 * `beep identity registry`: regenerate (`--write`) or check (`--check`, the default) the registry artifacts.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { identityRegistryCommand } from "@beep/repo-cli/commands/Identity/Registry"
 *
 * console.log(identityRegistryCommand.name) // "registry"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const identityRegistryCommand = Command.make(
  "registry",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write Registry.data.ts and term-snapshot.json from the source shards")
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Write nothing; report shard, conflict and drift findings (the default)")
    ),
  },
  runIdentityRegistry
).pipe(Command.withDescription("Generate or check the identity registry artifacts from its source shards"));
