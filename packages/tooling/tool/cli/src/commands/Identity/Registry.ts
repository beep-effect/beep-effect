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
 * set changes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdentityAuthority } from "@beep/identity/Authority";
import { $RepoCliId } from "@beep/identity/packages";
import {
  RegistryShard,
  RegistryTable,
  registryConflictMessage,
  snapshotViolationMessage,
  snapshotViolations,
  TermSnapshot,
} from "@beep/identity/Term";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { formatJsonValue } from "@beep/repo-cli-kit/cli/Json";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
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
]).pipe(
  $I.annoteSchema("IdentityRegistryIssueKind", {
    description:
      "Identity registry finding kind: a shard that fails to decode, a conflict between shards, a regenerated snapshot that breaks the committed one, or a generated artifact that differs from regeneration.",
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
  }).pipe($I.annoteSchema("RegistryLayout", { description: "Paths of the identity registry files in a checkout." }))
) {
  /**
   * Lay out the registry under the identity package directory `identityDir`.
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
  static readonly of = (identityDir: string): RegistryLayout =>
    RegistryLayout.make({
      shards: `${identityDir}/${SHARD_DIRECTORY}`,
      snapshot: `${identityDir}/${SNAPSHOT_FILE}`,
      data: `${identityDir}/${DATA_FILE}`,
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

const quote: (value: string) => string = flow(S.encodeResult(S.fromJsonString(S.String)), Result.getOrThrow);

const SCALAR_MEMBER_LINE = /^ *(?:"(?:[^"\\]|\\.)*"|-?\d[\d.eE+-]*|true|false|null),?$/;
const ARRAY_CLOSE_LINE = /^ *\],?$/;

const inlineArray = (pending: A.NonEmptyReadonlyArray<string>, close: string): string =>
  `${A.headNonEmpty(pending)}${A.join(
    A.map(A.tailNonEmpty(pending), (member) => Str.replace(/,$/, "")(Str.trim(member))),
    ", "
  )}${Str.trim(close)}`;

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
 * output ends with a newline. The pending array state keeps its opening line
 * ending in [ and its scalar member lines until the closing line arrives.
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
 * Every table binding names a live term, so term lookups cannot miss. The
 * authority import is chosen after rendering rows because any rendered IRI
 * literal under the authority references it.
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

const decodeShard = S.decodeUnknownResult(S.fromJsonString(RegistryShard));
const decodeSnapshot = S.decodeUnknownResult(S.fromJsonString(TermSnapshot));

const shardIssue = (path: string, detail: string): IdentityRegistryIssue =>
  IdentityRegistryIssue.make({ kind: "registry-shard-invalid", subject: path, detail });

const decodeShardFile = (file: RegistrySourceFile): Result.Result<RegistryShard, IdentityRegistryIssue> =>
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
 * @returns The generated artifacts, or every finding that blocks them.
 * @category projections
 * @since 0.0.0
 */
export const planRegistryArtifacts = ({
  layout,
  shardFiles,
  previous,
}: RegistryPlanInput): Result.Result<
  ReadonlyArray<RegistrySourceFile>,
  A.NonEmptyReadonlyArray<IdentityRegistryIssue>
> => {
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
        : Result.succeed([
            RegistrySourceFile.make({ path: layout.data, content: renderRegistryData(table) }),
            RegistrySourceFile.make({ path: layout.snapshot, content: renderTermSnapshot(next) }),
          ]);
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
  return RegistryLayout.of(path.dirname(path.dirname(packagesFile)));
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

const readShardFiles = Effect.fn("IdentityRegistry.readShardFiles")(function* (
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
export const planRegistry = Effect.fn("IdentityRegistry.plan")(function* (repoRoot: string, layout: RegistryLayout) {
  const path = yield* Path.Path;
  const shardFiles = yield* readShardFiles(repoRoot, layout);
  const previous = yield* readOptional(path.join(repoRoot, layout.snapshot));
  return planRegistryArtifacts(RegistryPlanInput.make({ layout, shardFiles, previous }));
});

/**
 * Every registry finding of the checkout at `repoRoot`: invalid shards, conflicts, or drift.
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
  const current = yield* Effect.forEach(
    plan.success,
    (artifact) =>
      Effect.map(readOptional(path.join(repoRoot, artifact.path)), (content) => [artifact.path, content] as const),
    { concurrency: 1 }
  );
  const byPath = R.fromEntries(current);
  return driftIssues(plan.success, (artifactPath) => O.flatten(R.get(byPath, artifactPath)));
});

/**
 * Write the registry artifacts of the checkout at `repoRoot`, or return the findings that block it.
 *
 * **Details**
 *
 * Only the generated data module and the snapshot are written; a shard is
 * never rewritten. The result is the list of artifacts whose bytes changed.
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
export const writeRegistry = Effect.fn("IdentityRegistry.write")(function* (repoRoot: string, layout: RegistryLayout) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const plan = yield* planRegistry(repoRoot, layout);
  if (Result.isFailure(plan)) {
    return Result.fail(plan.failure);
  }
  let written = A.empty<string>();
  for (const artifact of plan.success) {
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
