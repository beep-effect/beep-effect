/**
 * AST integration contract for create-package style workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Context, Effect, flow, Tuple } from "effect";
import * as S from "effect/Schema";
import type { DomainError } from "@beep/repo-utils";

const $I = $RepoCliId.create("commands/CreatePackage/TsMorphIntegrationService");

/**
 * Supported AST mutation categories required by create-package.
 *
 * @example
 * ```ts
 * import { TsMorphMutationKind } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const value = "add-identity-composer"
 * console.log(S.is(TsMorphMutationKind)(value)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsMorphMutationKind = LiteralKit([
  "add-identity-composer",
  "add-entity-id-export",
  "wire-persistence",
  "wire-data-access",
]).pipe(
  $I.annoteSchema("TsMorphMutationKind", {
    description: "Supported AST mutation categories required by create-package.",
  })
);
/**
 * Supported AST mutation categories required by create-package.
 *
 * @category models
 * @since 0.0.0
 */
export type TsMorphMutationKind = typeof TsMorphMutationKind.Type;

class TsMorphMutationAddIdentityComposer extends S.Class<TsMorphMutationAddIdentityComposer>(
  $I`TsMorphMutationAddIdentityComposer`
)(
  {
    kind: S.tag("add-identity-composer"),
    filePath: S.String,
    symbolName: S.String,
    importPath: S.Option(S.String),
    statementText: S.Option(S.String),
  },
  $I.annote("TsMorphMutationAddIdentityComposer", {
    description: "Mutation descriptor for adding identity composer exports/imports.",
  })
) {
  static readonly thunkThis = () => TsMorphMutationAddIdentityComposer;
}

class TsMorphMutationAddEntityIdExport extends S.Class<TsMorphMutationAddEntityIdExport>(
  $I`TsMorphMutationAddEntityIdExport`
)(
  {
    kind: S.tag("add-entity-id-export"),
    filePath: S.String,
    symbolName: S.String,
    importPath: S.Option(S.String),
    statementText: S.Option(S.String),
  },
  $I.annote("TsMorphMutationAddEntityIdExport", {
    description: "Mutation descriptor for adding entity id exports.",
  })
) {
  static readonly thunkThis = () => TsMorphMutationAddEntityIdExport;
}

class TsMorphMutationWirePersistence extends S.Class<TsMorphMutationWirePersistence>(
  $I`TsMorphMutationWirePersistence`
)(
  {
    kind: S.tag("wire-persistence"),
    filePath: S.String,
    symbolName: S.String,
    importPath: S.Option(S.String),
    statementText: S.Option(S.String),
  },
  $I.annote("TsMorphMutationWirePersistence", {
    description: "Mutation descriptor for persistence wiring.",
  })
) {
  static readonly thunkThis = () => TsMorphMutationWirePersistence;
}

class TsMorphMutationWireDataAccess extends S.Class<TsMorphMutationWireDataAccess>($I`TsMorphMutationWireDataAccess`)(
  {
    kind: S.tag("wire-data-access"),
    filePath: S.String,
    symbolName: S.String,
    importPath: S.Option(S.String),
    statementText: S.Option(S.String),
  },
  $I.annote("TsMorphMutationWireDataAccess", {
    description: "Mutation descriptor for data-access wiring.",
  })
) {
  static readonly thunkThis = () => TsMorphMutationWireDataAccess;
}

/**
 * Input descriptor for one AST mutation.
 *
 * @returns Tagged union schema keyed by `kind`.
 * @example
 * ```ts
 * import { TsMorphMutation } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const value = "add-identity-composer"
 * console.log(S.is(TsMorphMutation)(value)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsMorphMutation = TsMorphMutationKind.mapMembers(
  Tuple.evolve([
    TsMorphMutationAddIdentityComposer.thunkThis,
    TsMorphMutationAddEntityIdExport.thunkThis,
    TsMorphMutationWirePersistence.thunkThis,
    TsMorphMutationWireDataAccess.thunkThis,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("TsMorphMutation", {
    description: "Input descriptor for one AST mutation.",
  })
);

/**
 * Input descriptor for one AST mutation.
 *
 * @category models
 * @since 0.0.0
 */
export type TsMorphMutation = typeof TsMorphMutation.Type;

class TsMorphMutationOutcomeApplied extends S.Class<TsMorphMutationOutcomeApplied>($I`TsMorphMutationOutcomeApplied`)(
  {
    status: S.tag("applied"),
    mutation: TsMorphMutation,
    detail: S.String,
  },
  $I.annote("TsMorphMutationOutcomeApplied", {
    description: "Applied mutation outcome.",
  })
) {
  static readonly thunkThis = () => this;
}

class TsMorphMutationOutcomeSkipped extends S.Class<TsMorphMutationOutcomeSkipped>($I`TsMorphMutationOutcomeSkipped`)(
  {
    status: S.tag("skipped"),
    mutation: TsMorphMutation,
    detail: S.String,
  },
  $I.annote("TsMorphMutationOutcomeSkipped", {
    description: "Skipped mutation outcome.",
  })
) {
  static readonly thunkThis = () => TsMorphMutationOutcomeSkipped;
}

/**
 * Outcome for one mutation.
 *
 * @returns Tagged union schema keyed by `status`.
 * @category models
 * @since 0.0.0
 */
const TsMorphMutationOutcome = LiteralKit(["applied", "skipped"])
  .mapMembers(Tuple.evolve([TsMorphMutationOutcomeApplied.thunkThis, TsMorphMutationOutcomeSkipped.thunkThis]))
  .pipe(
    S.toTaggedUnion("status"),
    $I.annoteSchema("TsMorphMutationOutcome", {
      description: "Outcome for one mutation.",
    })
  );

/**
 * Outcome for one mutation.
 *
 * @category models
 * @since 0.0.0
 */
export type TsMorphMutationOutcome = typeof TsMorphMutationOutcome.Type;

/**
 * Batch mutation result.
 *
 * @example
 * ```ts
 * import { TsMorphIntegrationResult } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { changed: false, filePath: "packages/example/src/index.ts" }
 * console.log(S.is(TsMorphIntegrationResult)(candidate)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class TsMorphIntegrationResult extends S.Class<TsMorphIntegrationResult>($I`TsMorphIntegrationResult`)(
  {
    outcomes: S.Array(TsMorphMutationOutcome),
  },
  $I.annote("TsMorphIntegrationResult", {
    description: "Batch mutation result.",
  })
) {
  static readonly new = (outcomes: ReadonlyArray<TsMorphMutationOutcome>) =>
    TsMorphIntegrationResult.make({ outcomes });
}

/**
 * Adapter boundary for concrete ts-morph-morph implementations.
 *
 * @example
 * ```ts
 * import type { TsMorphMutationAdapter } from "@beep/repo-cli/commands/CreatePackage"
 * const value = {} as TsMorphMutationAdapter
 * console.log(value) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type TsMorphMutationAdapter = {
  readonly applyMutation: (mutation: TsMorphMutation) => Effect.Effect<TsMorphMutationOutcome, DomainError>;
};

/**
 * Service contract expected by create-package orchestration.
 *
 * @example
 * ```ts
 * import type { TsMorphIntegrationServiceShape } from "@beep/repo-cli/commands/CreatePackage"
 * const value = {} as TsMorphIntegrationServiceShape
 * console.log(value) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type TsMorphIntegrationServiceShape = {
  readonly previewMutations: (mutations: ReadonlyArray<TsMorphMutation>) => ReadonlyArray<string>;
  readonly applyMutations: (
    mutations: ReadonlyArray<TsMorphMutation>
  ) => Effect.Effect<TsMorphIntegrationResult, DomainError>;
};

/**
 * Service tag for ts-morph integration orchestration.
 *
 * @example
 * ```ts
 * import { TsMorphIntegrationService } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const program = Effect.service(TsMorphIntegrationService)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category ports
 * @since 0.0.0
 */
export class TsMorphIntegrationService extends Context.Service<
  TsMorphIntegrationService,
  TsMorphIntegrationServiceShape
>()($I`TsMorphIntegrationService`) {}

const UnsupportedTsMorphAdapter: TsMorphMutationAdapter = {
  applyMutation: (mutation) =>
    Effect.succeed(
      TsMorphMutationOutcome.cases.skipped.make({
        mutation,
        detail:
          "No ts-morph-morph adapter configured. Provide a TsMorphMutationAdapter before executing AST mutations.",
      })
    ),
};

/**
 * Construct a ts-morph-morph integration service with an optional adapter.
 *
 * @param adapter - Adapter used to apply ts-morph-morph mutations.
 * @returns Integration service for previewing and applying mutations.
 * @example
 * ```ts
 * import { createTsMorphIntegrationService } from "@beep/repo-cli/commands/CreatePackage"
 *
 * const example = createTsMorphIntegrationService
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const createTsMorphIntegrationService = (
  adapter: TsMorphMutationAdapter = UnsupportedTsMorphAdapter
): TsMorphIntegrationServiceShape => ({
  previewMutations: A.map((mutation) => `${mutation.kind} ${mutation.symbolName} in ${mutation.filePath}`),
  applyMutations: flow(Effect.forEach(adapter.applyMutation), Effect.map(TsMorphIntegrationResult.new)),
});
