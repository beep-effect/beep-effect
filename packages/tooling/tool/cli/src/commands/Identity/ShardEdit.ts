/**
 * `beep identity rebind` and `beep identity deprecate`: the two edits of the
 * identity registry shards that keep the published term set stable.
 *
 * **Details**
 *
 * `rebind` moves the bindings of a code identity (and every code under it) to
 * a new code identity after a module rename, or every binding of a package to
 * its new name after a package rename. Each term keeps its IRI and its
 * `since`, so no published IRI changes. `deprecate` retires a live term:
 * it removes the local from its shard and appends the append-only
 * deprecation row, with the vocabulary release the whole change against the
 * base ref calls for and an optional replacement in the same namespace. Both
 * rewrite only the shards they change and then regenerate the registry
 * artifacts against that base (`--base`); neither edits the generated files by
 * hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  CodeId,
  CodeMove,
  CodePackage,
  moveCode,
  RegistryShard,
  RegistryTable,
  registryConflictMessage,
  ShardBinding,
  TermSnapshot,
} from "@beep/identity/Term";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  danglingBindingCodes,
  decodeShardFile,
  IdentityRegistryGeneratorError,
  issueLine,
  previousSnapshot,
  RegistryLayout,
  RegistrySourceFile,
  readRegistryPlanInput,
  renderRegistryJson,
  resolveRegistryLayout,
  writeRegistry,
} from "./Registry.ts";
import { baseFlag, readBaseSnapshot } from "./RegistryBase.ts";
import type { FileSystem } from "effect/FileSystem";
import type { Path } from "effect/Path";
import type { BaseSnapshot, IdentityRegistryIssue, RegistryWrite } from "./Registry.ts";

const $I = $RepoCliId.create("commands/Identity/ShardEdit");

/**
 * Closed reason a shard edit is refused.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { ShardEditRefusalReason } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * console.log(ShardEditRefusalReason.is["term-bound"]("term-bound")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShardEditRefusalReason = LiteralKit([
  "shard-invalid",
  "registry-conflict",
  "invalid-code",
  "mixed-move",
  "nothing-bound",
  "target-module-missing",
  "invalid-curie",
  "unknown-term",
  "term-bound",
  "replacement-outside-namespace",
  "replacement-unknown",
]).pipe(
  $I.annoteSchema("ShardEditRefusalReason", {
    description:
      "Why a registry shard edit is refused: an invalid shard, a resulting registry conflict, a malformed code identity or CURIE, a rebind between a package and a code identity, a rebind that moves nothing or onto a module the checkout does not have, a term that is not live or is still bound, or a replacement outside the namespace or not live.",
  })
);

/**
 * Decoded type of {@link ShardEditRefusalReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type ShardEditRefusalReason = typeof ShardEditRefusalReason.Type;

/**
 * A refused shard edit: why, what it is about and how to repair it.
 *
 * **Example** (Make a refusal)
 *
 * ```ts
 * import { ShardEditRefusal } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * const refusal = ShardEditRefusal.make({ reason: "unknown-term", subject: "skos:nope", detail: "not live" })
 * console.log(refusal.reason) // "unknown-term"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardEditRefusal extends S.Opaque<ShardEditRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: ShardEditRefusalReason,
    subject: S.String.annotateKey({ description: "The shard file, code identity or CURIE the refusal is about." }),
    detail: S.String.annotateKey({ description: "What is wrong and how to repair it." }),
  }).pipe(
    $I.annoteSchema("ShardEditRefusal", {
      description: "A refused registry shard edit: reason, subject and remediation detail.",
    })
  )
) {}

/**
 * A deprecation request: retire a live term, optionally naming its successor in the same namespace.
 *
 * **Details**
 *
 * `replacement` is a CURIE of a live term of the deprecated term's own
 * namespace. The namespace itself (`<prefix>:`) is refused: a retired term is
 * succeeded by a term, never by a namespace IRI.
 *
 * **Example** (Request a deprecation)
 *
 * ```ts
 * import { DeprecateRequest } from "@beep/repo-cli/commands/Identity/ShardEdit"
 * import * as O from "effect/Option"
 *
 * const request = DeprecateRequest.make({ curie: "skos:prefLabel", replacement: O.some("skos:altLabel") })
 * console.log(request.curie) // "skos:prefLabel"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeprecateRequest extends S.Opaque<DeprecateRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    curie: S.String.annotateKey({ description: "CURIE of the live term to deprecate." }),
    replacement: S.Option(S.String).annotateKey({
      description: "CURIE of the successor in the same namespace, when one exists.",
    }),
  }).pipe($I.annoteSchema("DeprecateRequest", { description: "Retire a live term of the identity registry." }))
) {}

/**
 * The inputs of a shard edit: the layout, the shard files and the snapshot the edited registry succeeds.
 *
 * **Example** (Describe an edit over no shards)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import { ShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * const input = ShardEditInput.make({ layout: RegistryLayout.of("packages/identity"), shardFiles: [], previous: TermSnapshot.empty })
 * console.log(input.shardFiles.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardEditInput extends S.Opaque<ShardEditInput, { readonly brand: unique symbol }>()(
  S.Struct({
    layout: RegistryLayout,
    shardFiles: S.Array(RegistrySourceFile).annotateKey({ description: "The shard files, in path order." }),
    previous: TermSnapshot,
  }).pipe($I.annoteSchema("ShardEditInput", { description: "The inputs of one registry shard edit." }))
) {}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

type ShardEditResult = Result.Result<ReadonlyArray<RegistrySourceFile>, A.NonEmptyReadonlyArray<ShardEditRefusal>>;

type ShardFile = readonly [file: RegistrySourceFile, shard: RegistryShard];

const refusal = (reason: ShardEditRefusalReason, subject: string, detail: string): ShardEditRefusal =>
  ShardEditRefusal.make({ reason, subject, detail });

const encodeShard = flow(S.encodeResult(RegistryShard), Result.getOrThrow);
const decodeEncodedShard = S.decodeResult(RegistryShard);

const decodeShardFiles = (
  files: ReadonlyArray<RegistrySourceFile>
): Result.Result<ReadonlyArray<ShardFile>, A.NonEmptyReadonlyArray<ShardEditRefusal>> => {
  const decoded = A.map(files, (file) =>
    pipe(
      decodeShardFile(file),
      Result.map((shard): ShardFile => [file, shard]),
      Result.mapError((issue) => refusal("shard-invalid", issue.subject, issue.detail))
    )
  );
  const invalid = A.getFailures(decoded);
  return A.isReadonlyArrayNonEmpty(invalid) ? Result.fail(invalid) : Result.succeed(A.getSuccesses(decoded));
};

const tableOf = (
  layout: RegistryLayout,
  shards: ReadonlyArray<RegistryShard>
): Result.Result<RegistryTable, A.NonEmptyReadonlyArray<ShardEditRefusal>> =>
  Result.mapError(
    RegistryTable.fromShards(shards),
    A.map((conflict) => refusal("registry-conflict", layout.shards, registryConflictMessage(conflict)))
  );

const shardFileOf = (file: RegistrySourceFile, encoded: RegistryShard.Encoded): RegistrySourceFile =>
  RegistrySourceFile.make({ path: file.path, content: renderRegistryJson(encoded) });

// The edited shard as its file, validated by decoding the edited rows.
const editedFile = (
  file: RegistrySourceFile,
  encoded: RegistryShard.Encoded
): Result.Result<readonly [RegistrySourceFile, RegistryShard], ShardEditRefusal> =>
  pipe(
    decodeEncodedShard(encoded),
    Result.mapError((error) => refusal("shard-invalid", file.path, error.message)),
    Result.map((shard) => [shardFileOf(file, encoded), shard] as const)
  );

const byCode = Order.mapInput(Order.String, (binding: { readonly code: string }) => binding.code);
const byTerm = Order.mapInput(Order.String, (deprecation: { readonly term: string }) => deprecation.term);

// The shard with its bindings moved. The moved table has no conflict, so the moved codes are distinct
// and the sorted bindings always form a shard.
const movedShard = (shard: RegistryShard, move: CodeMove): RegistryShard =>
  RegistryShard.make({
    ...shard,
    bindings: A.sort(
      A.map(shard.bindings, (binding) => ShardBinding.make({ ...binding, code: moveCode(binding.code, move) })),
      byCode
    ),
  });

/**
 * Plan a rebind: the shard files whose bindings move, or every refusal.
 *
 * **Details**
 *
 * The move renames a code identity and every code under it, or every code of
 * a package. It is checked on the whole table first, so a move onto a code
 * that is already bound is refused with the `DuplicateBinding` conflict. A
 * move of no binding is refused, because a rename that finds nothing to move
 * usually names the wrong code identity. The command
 * then refuses a move onto a code that names no module of the checkout
 * (`target-module-missing`), which would leave every moved class unbound. Terms,
 * namespaces and deprecations are untouched, so the regenerated snapshot
 * publishes exactly the IRIs it published before.
 *
 * **Example** (Rebind a test-runner module)
 *
 * ```ts
 * import { CodeId, CodeIdMove, TermSnapshot } from "@beep/identity/Term"
 * import { RegistryLayout, RegistrySourceFile, renderRegistryJson } from "@beep/repo-cli/commands/Identity/Registry"
 * import { planRebind, ShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
 * import * as Result from "effect/Result"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * const vitest = RegistrySourceFile.make({
 *   path: `${layout.shards}/vitest.json`,
 *   content: renderRegistryJson({
 *     namespace: { prefix: "vitest", iri: "https://beep-effect.com/ns/vitest/" },
 *     terms: ["TestHang"],
 *     bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "1.0.0" }],
 *     deprecations: []
 *   })
 * })
 * const planned = planRebind(
 *   ShardEditInput.make({ layout, shardFiles: [vitest], previous: TermSnapshot.empty }),
 *   CodeIdMove.make({ from: CodeId.make("@beep/test-runner/Vitest"), to: CodeId.make("@beep/test-runner/Runner") })
 * )
 * console.log(Result.getOrThrow(planned)[0]?.content.includes("@beep/test-runner/Runner/TestHang")) // true
 * ```
 *
 * @param input - The layout, shard files and previous snapshot.
 * @param move - The code identity or package to move and its destination.
 * @returns The rewritten shard files, or every refusal.
 * @category projections
 * @since 0.0.0
 */
export const planRebind: {
  (move: CodeMove): (input: ShardEditInput) => ShardEditResult;
  (input: ShardEditInput, move: CodeMove): ShardEditResult;
} = dual(
  2,
  (input: ShardEditInput, move: CodeMove): ShardEditResult =>
    Result.gen(function* () {
      const files = yield* decodeShardFiles(input.shardFiles);
      const table = yield* tableOf(
        input.layout,
        A.map(files, ([, shard]) => shard)
      );
      yield* Result.mapError(
        RegistryTable.rebind(table, move),
        A.map((conflict) => refusal("registry-conflict", input.layout.shards, registryConflictMessage(conflict)))
      );
      const touched = A.filter(files, ([, shard]) =>
        A.some(shard.bindings, (binding) => moveCode(binding.code, move) !== binding.code)
      );
      if (!A.isReadonlyArrayNonEmpty(touched)) {
        return yield* Result.fail(
          A.of(
            refusal(
              "nothing-bound",
              move.from,
              `No binding has the code ${move.from} or a code under ${move.from}/; nothing moves.`
            )
          )
        );
      }
      return A.map(touched, ([file, shard]) => shardFileOf(file, encodeShard(movedShard(shard, move))));
    })
);

// A CURIE split at its first colon into prefix and local.
const splitCurie = (curie: string): Result.Result<readonly [prefix: string, local: string], ShardEditRefusal> =>
  pipe(
    Str.indexOf(":")(curie),
    O.filter((index) => index > 0),
    O.map((index) => [Str.slice(0, index)(curie), Str.slice(index + 1)(curie)] as const),
    Result.fromOption(() => refusal("invalid-curie", curie, "Expected a CURIE of the form <prefix>:<local>."))
  );

// The shard-relative replacement: a live local of the term's own shard. A retired term is never succeeded by
// its namespace IRI (the table refuses that chain), so `<prefix>:` is refused here with the same reason.
const replacementLocal = (
  shard: RegistryShard,
  local: string,
  replacement: O.Option<string>
): Result.Result<O.Option<string>, ShardEditRefusal> =>
  O.match(replacement, {
    onNone: () => Result.succeed(O.none()),
    onSome: (curie) =>
      Result.flatMap(splitCurie(curie), ([prefix, successor]) => {
        if (prefix !== shard.namespace.prefix) {
          return Result.fail(
            refusal(
              "replacement-outside-namespace",
              curie,
              `A replacement is a term of the deprecated term's namespace "${shard.namespace.prefix}"; deprecate it there or name no replacement.`
            )
          );
        }
        return successor !== local && A.contains(shard.terms, successor)
          ? Result.succeed(O.some(successor))
          : Result.fail(
              refusal(
                "replacement-unknown",
                curie,
                successor === ""
                  ? `A term is succeeded by a term, never by its namespace IRI; name a live term of "${prefix}".`
                  : `The replacement is not a live term of "${prefix}".`
              )
            );
      }),
  });

const deprecatedRows = (
  shard: RegistryShard,
  local: string,
  replacement: O.Option<string>,
  since: string
): RegistryShard.Encoded => {
  const encoded = encodeShard(shard);
  return {
    ...encoded,
    terms: A.filter(encoded.terms, (term) => term !== local),
    deprecations: A.sort(
      A.append(
        encoded.deprecations,
        O.match(replacement, {
          onNone: () => ({ term: `${shard.namespace.iri}${local}`, since }),
          onSome: (successor) => ({ term: `${shard.namespace.iri}${local}`, since, replacement: successor }),
        })
      ),
      byTerm
    ),
  };
};

/**
 * Plan a deprecation: the shard file that retires the term, or every refusal.
 *
 * **Details**
 *
 * The term must be a live local of its shard and no code identity may still
 * be bound to it, since a binding names a live term. The binding is removed
 * from its shard first; a rebind would keep the term bound. The deprecation's
 * `since` is the release the whole change from the previous snapshot calls
 * for, so every deprecation of one change records one release. Against a
 * published term set this is the next major; the first release is `1.0.0`.
 * The edited shards must still form a table, which refuses a replacement chain
 * that the retirement breaks.
 *
 * **Example** (Deprecate a term in favour of another)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { RegistryLayout, RegistrySourceFile, renderRegistryJson } from "@beep/repo-cli/commands/Identity/Registry"
 * import { DeprecateRequest, planDeprecate, ShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const layout = RegistryLayout.of("packages/identity")
 * const fabio = RegistrySourceFile.make({
 *   path: `${layout.shards}/fabio.json`,
 *   content: renderRegistryJson({
 *     namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
 *     terms: ["Report", "TechnicalReport"],
 *     bindings: [],
 *     deprecations: []
 *   })
 * })
 * const planned = planDeprecate(
 *   ShardEditInput.make({ layout, shardFiles: [fabio], previous: TermSnapshot.empty }),
 *   DeprecateRequest.make({ curie: "fabio:TechnicalReport", replacement: O.some("fabio:Report") })
 * )
 * console.log(Result.getOrThrow(planned)[0]?.content.includes('"replacement": "Report"')) // true
 * ```
 *
 * @param input - The layout, shard files and previous snapshot.
 * @param request - The term to retire and its optional replacement.
 * @returns The rewritten shard file, or every refusal.
 * @category projections
 * @since 0.0.0
 */
export const planDeprecate: {
  (request: DeprecateRequest): (input: ShardEditInput) => ShardEditResult;
  (input: ShardEditInput, request: DeprecateRequest): ShardEditResult;
} = dual(
  2,
  (input: ShardEditInput, request: DeprecateRequest): ShardEditResult =>
    Result.gen(function* () {
      const files = yield* decodeShardFiles(input.shardFiles);
      const [prefix, local] = yield* Result.mapError(splitCurie(request.curie), A.of);
      const [file, shard] = yield* pipe(
        A.findFirst(files, ([, candidate]) => candidate.namespace.prefix === prefix),
        O.filter(([, candidate]) => A.contains(candidate.terms, local)),
        Result.fromOption(() =>
          A.of(refusal("unknown-term", request.curie, `${request.curie} is not a live term of the registry.`))
        )
      );
      const codes = A.filterMap(shard.bindings, (binding) =>
        binding.local === local ? Result.succeed(binding.code) : Result.failVoid
      );
      if (A.isReadonlyArrayNonEmpty(codes)) {
        return yield* Result.fail(
          A.of(
            refusal(
              "term-bound",
              request.curie,
              `${request.curie} is bound by ${A.join(codes, ", ")}; remove the binding from ${file.path} before deprecating the term. A rebind does not help: it keeps the term bound.`
            )
          )
        );
      }
      const replacement = yield* Result.mapError(replacementLocal(shard, local, request.replacement), A.of);
      const others = A.filterMap(files, ([other, otherShard]) =>
        other.path === file.path ? Result.failVoid : Result.succeed(otherShard)
      );
      // The release depends on which rows the change adds, never on their `since`, so a draft row finds it.
      const [, draft] = yield* Result.mapError(
        editedFile(file, deprecatedRows(shard, local, replacement, input.previous.release)),
        A.of
      );
      const since = RegistryTable.releaseAfter(yield* tableOf(input.layout, A.append(others, draft)), input.previous);
      const [edited, retired] = yield* Result.mapError(
        editedFile(file, deprecatedRows(shard, local, replacement, since)),
        A.of
      );
      yield* tableOf(input.layout, A.append(others, retired));
      return A.of(edited);
    })
);

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * Read the inputs of a shard edit from the checkout at `repoRoot`, over the given base.
 *
 * **Example** (Read the edit inputs)
 *
 * ```ts
 * import { TermSnapshot } from "@beep/identity/Term"
 * import { BaseSnapshot, RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import { readShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * const base = BaseSnapshot.make({ snapshot: TermSnapshot.empty })
 * console.log(readShardEditInput("/repo", RegistryLayout.of("packages/identity"), base))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readShardEditInput = Effect.fn("IdentityShardEdit.readInput")(function* (
  repoRoot: string,
  layout: RegistryLayout,
  base: BaseSnapshot
) {
  const input = yield* readRegistryPlanInput(repoRoot, layout, O.some(base));
  return Result.map(previousSnapshot(input), (previous) =>
    ShardEditInput.make({ layout, shardFiles: input.shardFiles, previous })
  );
});

const reportRefusals = Effect.fn("IdentityShardEdit.reportRefusals")(function* (
  label: string,
  refusals: A.NonEmptyReadonlyArray<ShardEditRefusal>
) {
  yield* Console.error(`[identity:${label}] refused: ${A.length(refusals)} reason(s).`);
  for (const refused of refusals) {
    yield* Console.error(`${refused.subject} [${refused.reason}] ${refused.detail}`);
  }
  return yield* failWithReportedExit(`identity ${label}: refused.`);
});

// Refusals an edit earns from the checkout itself, after its plan succeeded.
type CheckoutRefusals = (
  repoRoot: string,
  planned: ReadonlyArray<RegistrySourceFile>
) => Effect.Effect<ReadonlyArray<ShardEditRefusal>, IdentityRegistryGeneratorError, FileSystem | Path>;

const noCheckoutRefusals: CheckoutRefusals = () => Effect.succeed(A.empty());

// One line per file an applied edit rewrote, regenerated or removed.
const reportWrite = Effect.fn("IdentityShardEdit.reportWrite")(function* (
  label: string,
  planned: ReadonlyArray<RegistrySourceFile>,
  { removed, written }: RegistryWrite
) {
  for (const file of written) {
    const verb = A.some(planned, (shard) => shard.path === file) ? "rewrote" : "regenerated";
    yield* Console.log(`[identity:${label}] ${verb} ${file}`);
  }
  for (const file of removed) {
    yield* Console.log(`[identity:${label}] removed ${file}`);
  }
});

const reportIssues = Effect.fn("IdentityShardEdit.reportIssues")(function* (
  label: string,
  reason: string,
  issues: ReadonlyArray<IdentityRegistryIssue>
) {
  for (const issue of issues) {
    yield* Console.error(issueLine(issue));
  }
  return yield* failWithReportedExit(`identity ${label}: ${reason}`);
});

// Plan the edit over the base, check it against the checkout, then write the shards it changes with the
// regenerated registry artifacts. Nothing is written unless the edited shards regenerate.
const runShardEdit = Effect.fn("IdentityShardEdit.run")(function* (
  label: string,
  ref: O.Option<string>,
  plan: (input: ShardEditInput) => ShardEditResult,
  checkout: CheckoutRefusals = noCheckoutRefusals
) {
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError((cause) =>
      IdentityRegistryGeneratorError.make({ message: "Cannot find the repository root.", cause })
    )
  );
  const layout = yield* resolveRegistryLayout(repoRoot);
  const base = yield* readBaseSnapshot(`identity:${label}`, repoRoot, layout, ref);
  if (Result.isFailure(base)) {
    return yield* reportIssues(label, "the base ref's snapshot does not decode.", A.of(base.failure));
  }
  const input = yield* readShardEditInput(repoRoot, layout, base.success);
  if (Result.isFailure(input)) {
    return yield* reportIssues(label, "the committed snapshot does not decode.", A.of(input.failure));
  }
  const planned = plan(input.success);
  if (Result.isFailure(planned)) {
    return yield* reportRefusals(label, planned.failure);
  }
  const refused = yield* checkout(repoRoot, planned.success);
  if (A.isReadonlyArrayNonEmpty(refused)) {
    return yield* reportRefusals(label, refused);
  }
  const written = yield* writeRegistry(repoRoot, layout, base.success, planned.success);
  if (Result.isFailure(written)) {
    return yield* reportIssues(label, "the edited shards do not regenerate.", written.failure);
  }
  yield* reportWrite(label, planned.success, written.success);
});

const isMoveEnd = S.is(S.Union([CodeId, CodePackage]));
const decodeMove = S.decodeUnknownResult(CodeMove);

// The requested move, or a refusal for each end that is neither a code identity nor a package, or for
// a move between the two kinds.
const moveOf = (options: {
  readonly from: string;
  readonly to: string;
}): Result.Result<CodeMove, A.NonEmptyReadonlyArray<ShardEditRefusal>> => {
  const invalid = A.map(
    A.filter([options.from, options.to], (end) => !isMoveEnd(end)),
    (end) =>
      refusal(
        "invalid-code",
        end,
        "Expected a code identity of the form @beep/<package>/<path>, or a package of the form @beep/<package>."
      )
  );
  return A.isReadonlyArrayNonEmpty(invalid)
    ? Result.fail(invalid)
    : Result.mapError(decodeMove(options), () =>
        A.of(
          refusal(
            "mixed-move",
            `${options.from} -> ${options.to}`,
            "A package moves to a package and a code identity to a code identity; name both ends of the same kind."
          )
        )
      );
};

// A rebind onto a module the checkout does not have would leave every moved class unbound, so each
// moved code must name a module file of its package.
const rebindTargetRefusals = (move: CodeMove): CheckoutRefusals =>
  Effect.fnUntraced(function* (repoRoot: string, planned: ReadonlyArray<RegistrySourceFile>) {
    const moved = pipe(
      planned,
      A.flatMap((file) =>
        O.match(Result.getSuccess(decodeShardFile(file)), {
          onNone: A.empty<RegistryShard["bindings"][number]>,
          onSome: (shard) => shard.bindings,
        })
      ),
      A.map((binding) => binding.code),
      A.filter((code) => code === move.to || Str.startsWith(`${move.to}/`)(code))
    );
    const dangling = yield* danglingBindingCodes(repoRoot, moved);
    return A.map(dangling, (code) =>
      refusal(
        "target-module-missing",
        code,
        `${code} names no module of the checkout; create or rename the module (or the package) first, then rebind.`
      )
    );
  });

const runRebind = Effect.fn("IdentityShardEdit.runRebind")(function* (options: {
  readonly from: string;
  readonly to: string;
  readonly base: O.Option<string>;
}) {
  const move = moveOf(options);
  if (Result.isFailure(move)) {
    return yield* reportRefusals("rebind", move.failure);
  }
  return yield* runShardEdit("rebind", options.base, planRebind(move.success), rebindTargetRefusals(move.success));
});

/**
 * `beep identity rebind <from> <to>`: move the bindings of a renamed module, or of a renamed package, to its new code identities.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { identityRebindCommand } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * console.log(identityRebindCommand.name) // "rebind"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const identityRebindCommand = Command.make(
  "rebind",
  {
    from: Argument.String("from").pipe(
      Argument.withDescription(
        "Code identity the bindings move from, such as @beep/<package>/<old module path>, or the package @beep/<old package>"
      )
    ),
    to: Argument.String("to").pipe(
      Argument.withDescription(
        "Code identity the bindings move to, such as @beep/<package>/<new module path>, or the package @beep/<new package>"
      )
    ),
    base: baseFlag,
  },
  runRebind
).pipe(
  Command.withDescription(
    "Move the registry bindings of a code identity and every code under it, or of every code of a package, to new code identities that name modules of the checkout; no published IRI changes"
  )
);

/**
 * `beep identity deprecate <curie> [--replacement <curie>]`: retire a live term with an append-only deprecation.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { identityDeprecateCommand } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * console.log(identityDeprecateCommand.name) // "deprecate"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const identityDeprecateCommand = Command.make(
  "deprecate",
  {
    curie: Argument.String("curie").pipe(Argument.withDescription("CURIE of the live term to retire")),
    replacement: Flag.String("replacement").pipe(
      Flag.withDescription("CURIE of its successor, a live term of the same namespace"),
      Flag.optional
    ),
    base: baseFlag,
  },
  ({ base, curie, replacement }) =>
    runShardEdit("deprecate", base, planDeprecate(DeprecateRequest.make({ curie, replacement })))
).pipe(
  Command.withDescription(
    "Retire a live registry term: remove it from its shard and append its deprecation with the vocabulary release of the change against the base ref"
  )
);
