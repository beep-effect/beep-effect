/**
 * `beep identity rebind` and `beep identity deprecate`: the two edits of the
 * identity registry shards that keep the published term set stable.
 *
 * **Details**
 *
 * `rebind` moves the bindings of a code identity (and every code under it) to
 * a new code identity after a module or package rename, keeping each term and
 * its `since`, so no published IRI changes. `deprecate` retires a live term:
 * it removes the local from its shard and appends the append-only
 * deprecation row, with the vocabulary release the regenerated snapshot will
 * carry and an optional replacement in the same namespace. Both rewrite only
 * the shards they change and then regenerate the registry artifacts; neither
 * edits the generated files by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CodeId, RegistryShard, RegistryTable, registryConflictMessage, TermSnapshot } from "@beep/identity/Term";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  danglingBindingCodes,
  decodeBaseSnapshot,
  decodeShardFile,
  IdentityRegistryGeneratorError,
  issueLine,
  RegistryLayout,
  RegistrySourceFile,
  readShardFiles,
  renderRegistryJson,
  resolveRegistryLayout,
  writeRegistry,
} from "./Registry.ts";

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
      "Why a registry shard edit is refused: an invalid shard, a resulting registry conflict, a malformed code identity or CURIE, a rebind that moves nothing or onto a module the checkout does not have, a term that is not live or is still bound, or a replacement outside the namespace or not live.",
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
 * A rebind request: move the bindings of `from`, and of every code under `from/`, to `to`.
 *
 * **Example** (Request a module rename)
 *
 * ```ts
 * import { CodeId } from "@beep/identity/Term"
 * import { RebindRequest } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * const request = RebindRequest.make({
 *   from: CodeId.make("@beep/repo-cli/commands/Research/Library/Library.schemas"),
 *   to: CodeId.make("@beep/repo-cli/commands/Research/Catalog/Catalog.schemas")
 * })
 * console.log(request.to)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RebindRequest extends S.Opaque<RebindRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    from: CodeId.annotateKey({ description: "The code identity the bindings move from." }),
    to: CodeId.annotateKey({ description: "The code identity the bindings move to." }),
  }).pipe($I.annoteSchema("RebindRequest", { description: "Move the bindings of a code identity to a new one." }))
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
 * The inputs of a shard edit: the layout, the shard files and the committed snapshot.
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

// The edited shard as its file, validated by decoding the edited rows.
const editedFile = (
  file: RegistrySourceFile,
  encoded: RegistryShard.Encoded
): Result.Result<readonly [RegistrySourceFile, RegistryShard], ShardEditRefusal> =>
  pipe(
    decodeEncodedShard(encoded),
    Result.mapError((error) => refusal("shard-invalid", file.path, error.message)),
    Result.map(
      (shard) => [RegistrySourceFile.make({ path: file.path, content: renderRegistryJson(encoded) }), shard] as const
    )
  );

// The code a binding moves to: `to` for `from` itself, `to/<rest>` for `from/<rest>`.
const movedCode =
  ({ from, to }: RebindRequest) =>
  (code: string): string =>
    code === from ? to : Str.startsWith(`${from}/`)(code) ? `${to}${Str.slice(Str.length(from))(code)}` : code;

const byCode = Order.mapInput(Order.String, (binding: { readonly code: string }) => binding.code);
const byTerm = Order.mapInput(Order.String, (deprecation: { readonly term: string }) => deprecation.term);

/**
 * Plan a rebind: the shard files whose bindings move, or every refusal.
 *
 * **Details**
 *
 * The move is checked on the whole table first, so a move onto a code that
 * is already bound is refused with the `DuplicateBinding` conflict. A
 * request that moves no binding is refused, because a module rename that
 * finds nothing to move usually names the wrong code identity. The command
 * then refuses a move onto a code that names no module of the checkout
 * (`target-module-missing`), which would leave every moved class unbound. Terms,
 * namespaces and deprecations are untouched, so the regenerated snapshot
 * publishes exactly the IRIs it published before.
 *
 * **Example** (Rebind a test-runner module)
 *
 * ```ts
 * import { CodeId, TermSnapshot } from "@beep/identity/Term"
 * import { RegistryLayout, RegistrySourceFile, renderRegistryJson } from "@beep/repo-cli/commands/Identity/Registry"
 * import { planRebind, RebindRequest, ShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
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
 *   RebindRequest.make({ from: CodeId.make("@beep/test-runner/Vitest"), to: CodeId.make("@beep/test-runner/Runner") })
 * )
 * console.log(Result.getOrThrow(planned)[0]?.content.includes("@beep/test-runner/Runner/TestHang")) // true
 * ```
 *
 * @param input - The layout, shard files and committed snapshot.
 * @param request - The code identity to move and its destination.
 * @returns The rewritten shard files, or every refusal.
 * @category projections
 * @since 0.0.0
 */
export const planRebind: {
  (request: RebindRequest): (input: ShardEditInput) => ShardEditResult;
  (input: ShardEditInput, request: RebindRequest): ShardEditResult;
} = dual(
  2,
  (input: ShardEditInput, request: RebindRequest): ShardEditResult =>
    Result.gen(function* () {
      const files = yield* decodeShardFiles(input.shardFiles);
      const table = yield* tableOf(
        input.layout,
        A.map(files, ([, shard]) => shard)
      );
      yield* Result.mapError(
        RegistryTable.rebind(table, request.from, request.to),
        A.map((conflict) => refusal("registry-conflict", input.layout.shards, registryConflictMessage(conflict)))
      );
      const move = movedCode(request);
      const touched = A.filter(files, ([, shard]) =>
        A.some(shard.bindings, (binding) => move(binding.code) !== binding.code)
      );
      if (!A.isReadonlyArrayNonEmpty(touched)) {
        return yield* Result.fail(
          A.of(
            refusal(
              "nothing-bound",
              request.from,
              `No binding has the code ${request.from} or a code under ${request.from}/; nothing moves.`
            )
          )
        );
      }
      const edited = A.map(touched, ([file, shard]) => {
        const encoded = encodeShard(shard);
        return editedFile(file, {
          ...encoded,
          bindings: A.sort(
            A.map(encoded.bindings, (binding) => ({ ...binding, code: move(binding.code) })),
            byCode
          ),
        });
      });
      const refused = A.getFailures(edited);
      if (A.isReadonlyArrayNonEmpty(refused)) {
        return yield* Result.fail(refused);
      }
      return A.map(A.getSuccesses(edited), ([file]) => file);
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
 * be bound to it, since a binding names a live term. The deprecation's
 * `since` is the release the regenerated snapshot carries, the next major of
 * the committed snapshot, so the row and the snapshot agree. The edited
 * shards must still form a table, which refuses a replacement chain that the
 * retirement breaks.
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
 * @param input - The layout, shard files and committed snapshot.
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
              `${request.curie} is bound by ${A.join(codes, ", ")}; remove or rebind the binding before deprecating the term.`
            )
          )
        );
      }
      const replacement = yield* Result.mapError(replacementLocal(shard, local, request.replacement), A.of);
      const others = A.filterMap(files, ([other, otherShard]) =>
        other.path === file.path ? Result.failVoid : Result.succeed(otherShard)
      );
      // A first pass at the committed release finds the release the regenerated snapshot will carry.
      const [, draft] = yield* Result.mapError(
        editedFile(file, deprecatedRows(shard, local, replacement, input.previous.release)),
        A.of
      );
      const since = RegistryTable.snapshot(
        yield* tableOf(input.layout, A.append(others, draft)),
        input.previous
      ).release;
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

const ioError = (message: string) => (cause: unknown) => IdentityRegistryGeneratorError.make({ message, cause });

/**
 * Read the inputs of a shard edit from the checkout at `repoRoot`.
 *
 * **Example** (Read the edit inputs)
 *
 * ```ts
 * import { readShardEditInput } from "@beep/repo-cli/commands/Identity/ShardEdit"
 *
 * console.log(readShardEditInput("/repo"))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readShardEditInput = Effect.fn("IdentityShardEdit.readInput")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const layout = yield* resolveRegistryLayout(repoRoot);
  const shardFiles = yield* readShardFiles(repoRoot, layout);
  const snapshotPath = path.join(repoRoot, layout.snapshot);
  const exists = yield* fs.exists(snapshotPath).pipe(Effect.mapError(ioError(`Cannot stat ${layout.snapshot}.`)));
  const text = exists
    ? yield* fs
        .readFileString(snapshotPath)
        .pipe(Effect.mapBoth({ onFailure: ioError(`Cannot read ${layout.snapshot}.`), onSuccess: O.some }))
    : O.none<string>();
  return Result.map(decodeBaseSnapshot(layout.snapshot, text), (previous) =>
    ShardEditInput.make({ layout, shardFiles, previous })
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
) => Effect.Effect<ReadonlyArray<ShardEditRefusal>, IdentityRegistryGeneratorError, FileSystem.FileSystem | Path.Path>;

const noCheckoutRefusals: CheckoutRefusals = () => Effect.succeed(A.empty());

// Plan the edit, check it against the checkout, write the shards it changes and regenerate the
// registry artifacts.
const runShardEdit = Effect.fn("IdentityShardEdit.run")(function* (
  label: string,
  plan: (input: ShardEditInput) => ShardEditResult,
  checkout: CheckoutRefusals = noCheckoutRefusals
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(ioError("Cannot find the repository root.")));
  const input = yield* readShardEditInput(repoRoot);
  if (Result.isFailure(input)) {
    yield* Console.error(issueLine(input.failure));
    return yield* failWithReportedExit(`identity ${label}: the committed snapshot does not decode.`);
  }
  const planned = plan(input.success);
  if (Result.isFailure(planned)) {
    return yield* reportRefusals(label, planned.failure);
  }
  const refused = yield* checkout(repoRoot, planned.success);
  if (A.isReadonlyArrayNonEmpty(refused)) {
    return yield* reportRefusals(label, refused);
  }
  for (const shard of planned.success) {
    yield* fs
      .writeFileString(path.join(repoRoot, shard.path), shard.content)
      .pipe(Effect.mapError(ioError(`Cannot write ${shard.path}.`)));
    yield* Console.log(`[identity:${label}] rewrote ${shard.path}`);
  }
  const written = yield* writeRegistry(repoRoot, input.success.layout);
  if (Result.isFailure(written)) {
    for (const issue of written.failure) {
      yield* Console.error(issueLine(issue));
    }
    return yield* failWithReportedExit(`identity ${label}: the edited shards do not regenerate.`);
  }
  for (const artifact of written.success) {
    yield* Console.log(`[identity:${label}] regenerated ${artifact}`);
  }
});

const decodeCode = S.decodeUnknownResult(CodeId);

// A rebind onto a module the checkout does not have would leave every moved class unbound, so each
// moved code must name a module file of its package.
const rebindTargetRefusals = (request: RebindRequest): CheckoutRefusals =>
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
      A.filter((code) => code === request.to || Str.startsWith(`${request.to}/`)(code))
    );
    const dangling = yield* danglingBindingCodes(repoRoot, moved);
    return A.map(dangling, (code) =>
      refusal(
        "target-module-missing",
        code,
        `${code} names no module of the checkout; create or rename the module under its package's src first, then rebind.`
      )
    );
  });

const runRebind = Effect.fn("IdentityShardEdit.runRebind")(function* (options: {
  readonly from: string;
  readonly to: string;
}) {
  const from = decodeCode(options.from);
  const to = decodeCode(options.to);
  if (Result.isFailure(from) || Result.isFailure(to)) {
    return yield* reportRefusals(
      "rebind",
      A.of(
        refusal(
          "invalid-code",
          Result.isFailure(from) ? options.from : options.to,
          "Expected a code identity of the form @beep/<package>/<path>."
        )
      )
    );
  }
  const request = RebindRequest.make({ from: from.success, to: to.success });
  return yield* runShardEdit("rebind", planRebind(request), rebindTargetRefusals(request));
});

/**
 * `beep identity rebind <from> <to>`: move the bindings of a renamed module to its new code identity.
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
      Argument.withDescription("Code identity the bindings move from, such as @beep/<package>/<old module path>")
    ),
    to: Argument.String("to").pipe(
      Argument.withDescription("Code identity the bindings move to, such as @beep/<package>/<new module path>")
    ),
  },
  runRebind
).pipe(
  Command.withDescription(
    "Move the registry bindings of a code identity, and of every code under it, to a new code identity that names a module of the checkout; no published IRI changes"
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
  },
  ({ curie, replacement }) => runShardEdit("deprecate", planDeprecate(DeprecateRequest.make({ curie, replacement })))
).pipe(
  Command.withDescription(
    "Retire a live registry term: remove it from its shard and append its deprecation with the next vocabulary release"
  )
);
