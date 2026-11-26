/**
 * The configured matter authority and the source-text resolver walled by it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";
import { MatterGrant, MatterScope } from "@beep/law-practice-domain/values/MatterScope";
import { GrantedScopes, LawPrincipal, MatterAccess, MatterAuthority } from "@beep/law-practice-use-cases/MatterWall";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MatterAccessKind, PracticeKgFamilyKey } from "@beep/law-practice-domain/values/MatterScope";
import type * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import type * as Shared from "@beep/shared-domain/identity/Shared";

const $I = $LawPracticeServerId.create("MatterAuthority/MatterAuthority.layer");

/**
 * Span attribute naming the access kind a walled path asked for.
 *
 * **Example** (Name the access kind span attribute)
 *
 * ```ts
 * import { MatterAccessKindAttribute } from "@beep/law-practice-server/MatterAuthority"
 *
 * console.log(MatterAccessKindAttribute) // "beep.law_practice.matter_access"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MatterAccessKindAttribute = "beep.law_practice.matter_access";

/**
 * Span attribute naming the matter wall's answer, `Granted` or `Denied`.
 *
 * **Example** (Name the outcome span attribute)
 *
 * ```ts
 * import { MatterAccessOutcomeAttribute } from "@beep/law-practice-server/MatterAuthority"
 *
 * console.log(MatterAccessOutcomeAttribute) // "beep.law_practice.matter_outcome"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MatterAccessOutcomeAttribute = "beep.law_practice.matter_outcome";

/**
 * Span attribute naming why the matter wall denied a path.
 *
 * **Example** (Name the denial reason span attribute)
 *
 * ```ts
 * import { MatterDenialReasonAttribute } from "@beep/law-practice-server/MatterAuthority"
 *
 * console.log(MatterDenialReasonAttribute) // "beep.law_practice.matter_denial_reason"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MatterDenialReasonAttribute = "beep.law_practice.matter_denial_reason";

const familySpelling = (key: PracticeKgFamilyKey): string => `${key.client}.${key.family}`;

type Binding = readonly [string, LawPractice.MatterId];

const scopeBindings = (scopes: ReadonlyArray<MatterScope>): ReadonlyArray<Binding> =>
  A.flatMap(scopes, (scope) => A.map(A.fromIterable(scope.scopeRefs), (ref): Binding => [ref, scope.matter]));

const familyBindings = (scopes: ReadonlyArray<MatterScope>): ReadonlyArray<Binding> =>
  A.flatMap(scopes, (scope) =>
    A.map(A.fromIterable(scope.familyKeys), (key): Binding => [familySpelling(key), scope.matter])
  );

const bindsOneMatterPerKey = (bindings: ReadonlyArray<Binding>): boolean =>
  A.every(bindings, ([key, matter]) =>
    A.every(bindings, ([other, otherMatter]) => key !== other || matter === otherMatter)
  );

const mailPrefixesStayApart = (scopes: ReadonlyArray<MatterScope>): boolean => {
  const folders = A.flatMap(scopes, (scope) =>
    A.map(A.fromIterable(scope.mailFolders), (folder) => ({ ...folder, matter: scope.matter }))
  );
  return A.every(folders, (folder) =>
    A.every(
      folders,
      (other) =>
        folder.matter === other.matter ||
        folder.archive !== other.archive ||
        !Str.startsWith(folder.folderPrefix)(other.folderPrefix)
    )
  );
};

const MatterAuthorityConfigFields = S.Struct({
  scopes: S.Array(MatterScope).annotateKey({ description: "The scope keys bound to each matter." }),
  grants: S.Array(MatterGrant).annotateKey({ description: "The matters each principal is staffed on." }),
});

/**
 * **Details**
 *
 * A scope reference or family key bound to two matters, or a mail folder
 * prefix that is a prefix of another matter's prefix in the same archive, is
 * refused at decode, so `authorize` never sees two answers. The empty
 * configuration denies every walled path.
 *
 * **Example** (Decode the empty configuration)
 *
 * ```ts
 * import { MatterAuthorityConfig } from "@beep/law-practice-server/MatterAuthority"
 * import * as S from "effect/Schema"
 *
 * const empty = S.decodeUnknownSync(MatterAuthorityConfig)({ scopes: [], grants: [] })
 * console.log(empty.scopes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterAuthorityConfig extends S.Opaque<MatterAuthorityConfig, { readonly brand: unique symbol }>()(
  MatterAuthorityConfigFields.check(
    S.makeFilter(
      (config: typeof MatterAuthorityConfigFields.Type) =>
        bindsOneMatterPerKey(scopeBindings(config.scopes)) && bindsOneMatterPerKey(familyBindings(config.scopes)),
      $I.annote("MatterAuthorityKeyBindsOneMatter", {
        title: "Matter Authority Key Binds One Matter",
        description: "No scope reference or family key is bound to two matters.",
        message: "Expected every scope reference and family key to be bound to one matter",
      })
    ),
    S.makeFilter(
      (config: typeof MatterAuthorityConfigFields.Type) => mailPrefixesStayApart(config.scopes),
      $I.annote("MatterAuthorityMailPrefixesStayApart", {
        title: "Matter Authority Mail Prefixes Stay Apart",
        description: "No mail folder prefix of one matter is a prefix of another matter's prefix in the same archive.",
        message: "Expected mail folder prefixes of different matters in one archive not to overlap",
      })
    )
  ).pipe($I.annoteSchema("MatterAuthorityConfig", { description: "Matter scope bindings and staffing grants." }))
) {}

/**
 * The configuration that binds nothing and staffs no one: every walled path
 * is denied.
 *
 * **Example** (Bind nothing and staff no one)
 *
 * ```ts
 * import { EmptyMatterAuthorityConfig } from "@beep/law-practice-server/MatterAuthority"
 *
 * console.log(EmptyMatterAuthorityConfig.scopes.length, EmptyMatterAuthorityConfig.grants.length) // 0 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EmptyMatterAuthorityConfig = MatterAuthorityConfig.make({ scopes: [], grants: [] });

/**
 * The matter authority configuration read from `BEEP_LAW_PRACTICE_MATTER_AUTHORITY`
 * as JSON, with the empty configuration as the default.
 *
 * **Example** (Read the configuration from a provider)
 *
 * ```ts
 * import { MatterAuthorityConfigFromEnv } from "@beep/law-practice-server/MatterAuthority"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const config = Effect.runSync(MatterAuthorityConfigFromEnv.parse(ConfigProvider.fromUnknown({})))
 * console.log(config.grants.length) // 0
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MatterAuthorityConfigFromEnv: Config.Config<MatterAuthorityConfig> = Config.schema(
  S.fromJsonString(MatterAuthorityConfig),
  "BEEP_LAW_PRACTICE_MATTER_AUTHORITY"
).pipe(Config.withDefault(EmptyMatterAuthorityConfig));

const accessAttributes = (access: MatterAccessKind, answer: MatterAccess) =>
  MatterAccess.match(answer, {
    Granted: () => ({ [MatterAccessKindAttribute]: access, [MatterAccessOutcomeAttribute]: "Granted" }),
    Denied: ({ reason }) => ({
      [MatterAccessKindAttribute]: access,
      [MatterAccessOutcomeAttribute]: "Denied",
      [MatterDenialReasonAttribute]: reason,
    }),
  });

const makeMatterAuthority = (config: MatterAuthorityConfig) => {
  const scopeIndex = HashMap.fromIterable(scopeBindings(config.scopes));
  const familyIndex = HashMap.fromIterable(familyBindings(config.scopes));
  const staffing = A.reduce(
    config.grants,
    HashMap.empty<Shared.UserId, HashSet.HashSet<LawPractice.MatterId>>(),
    (index, grant) =>
      HashMap.modifyAt(index, grant.principal, (current) =>
        O.some(O.match(current, { onNone: () => grant.matters, onSome: HashSet.union(grant.matters) }))
      )
  );
  const staffedOn = (principal: Shared.UserId) =>
    O.getOrElse(HashMap.get(staffing, principal), HashSet.empty<LawPractice.MatterId>);
  const decide = (principal: Shared.UserId, bound: O.Option<LawPractice.MatterId>): MatterAccess =>
    O.match(bound, {
      onNone: () => MatterAccess.cases.Denied.make({ reason: "unbound-scope" }),
      onSome: (matter) =>
        HashSet.has(staffedOn(principal), matter)
          ? MatterAccess.cases.Granted.make({ matter })
          : MatterAccess.cases.Denied.make({ reason: "not-staffed" }),
    });
  const answered = (access: MatterAccessKind, answer: MatterAccess) =>
    Effect.as(Effect.annotateCurrentSpan(accessAttributes(access, answer)), answer);
  return MatterAuthority.of({
    authorize: Effect.fn("MatterAuthority.authorize")(function* (request) {
      return yield* answered(request.access, decide(request.principal, HashMap.get(scopeIndex, request.scope)));
    }),
    authorizeFamily: Effect.fn("MatterAuthority.authorizeFamily")(function* (request) {
      return yield* answered(
        request.access,
        decide(request.principal, HashMap.get(familyIndex, familySpelling(request.family)))
      );
    }),
    grantedScopes: Effect.fn("MatterAuthority.grantedScopes")(function* (principal) {
      const matters = staffedOn(principal);
      const granted = A.filter(config.scopes, (scope) => HashSet.has(matters, scope.matter));
      yield* Effect.annotateCurrentSpan({ "beep.law_practice.granted_matter_count": HashSet.size(matters) });
      return GrantedScopes.make({
        scopeRefs: HashSet.fromIterable(A.flatMap(granted, (scope) => A.fromIterable(scope.scopeRefs))),
        familyKeys: HashSet.fromIterable(A.flatMap(granted, (scope) => A.fromIterable(scope.familyKeys))),
        mailFolders: HashSet.fromIterable(A.flatMap(granted, (scope) => A.fromIterable(scope.mailFolders))),
      });
    }),
  });
};

/**
 * The matter authority over an explicit configuration.
 *
 * **Example** (Deny every path)
 *
 * ```ts
 * import { EmptyMatterAuthorityConfig, MatterAuthorityLayer } from "@beep/law-practice-server/MatterAuthority"
 *
 * const layer = MatterAuthorityLayer(EmptyMatterAuthorityConfig)
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MatterAuthorityLayer = (config: MatterAuthorityConfig): Layer.Layer<MatterAuthority> =>
  Layer.succeed(MatterAuthority, makeMatterAuthority(config));

/**
 * The matter authority over {@link MatterAuthorityConfigFromEnv}; an unset
 * variable denies every walled path.
 *
 * **Example** (Provide the configured authority)
 *
 * ```ts
 * import { MatterAuthorityLive } from "@beep/law-practice-server/MatterAuthority"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MatterAuthorityLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MatterAuthorityLive: Layer.Layer<MatterAuthority, Config.ConfigError> = Layer.effect(
  MatterAuthority,
  Effect.map(MatterAuthorityConfigFromEnv, makeMatterAuthority)
);

/**
 * The principal a single-user host runs as, read from
 * `BEEP_LAW_PRACTICE_PRINCIPAL`; `None` when the variable is unset.
 *
 * **Example** (Read the configured principal)
 *
 * ```ts
 * import { LawPrincipalFromEnv } from "@beep/law-practice-server/MatterAuthority"
 *
 * console.log(typeof LawPrincipalFromEnv) // "object"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LawPrincipalFromEnv = Config.option(
  Config.schema(S.FiniteFromString.pipe(S.decodeTo(LawPrincipalId)), "BEEP_LAW_PRACTICE_PRINCIPAL")
);

const unconfiguredPrincipal = LawPrincipalId.make(2_147_483_647);

/**
 * The matter wall a single-user host provides: its `LawPrincipal` and the
 * configured `MatterAuthority`.
 *
 * **Details**
 *
 * A host without `BEEP_LAW_PRACTICE_PRINCIPAL` gets the empty authority
 * whatever grants are configured, so every walled path is denied rather than
 * the host failing to start (decision
 * `p6-an-unconfigured-principal-gets-the-empty-authority`).
 *
 * **Example** (Provide the host wall)
 *
 * ```ts
 * import { MatterWallLive } from "@beep/law-practice-server/MatterAuthority"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MatterWallLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MatterWallLive: Layer.Layer<MatterAuthority | LawPrincipal, Config.ConfigError> = Layer.effectContext(
  Effect.gen(function* () {
    const principal = yield* LawPrincipalFromEnv;
    const config = yield* O.match(principal, {
      onNone: () => Effect.succeed(EmptyMatterAuthorityConfig),
      onSome: () => MatterAuthorityConfigFromEnv,
    });
    return Context.make(MatterAuthority, makeMatterAuthority(config)).pipe(
      Context.add(LawPrincipal, { principal: O.getOrElse(principal, () => unconfiguredPrincipal) })
    );
  })
);

/**
 * Walls source retrieval: the resolver asks the matter authority for
 * `source-retrieval` on the requested scope before it delegates.
 *
 * **Details**
 *
 * A denial fails with the `scope-unavailable` reason an absent scope already
 * gets, so a denial does not reveal that the scope exists.
 *
 * **Example** (Wall the source resolver)
 *
 * ```ts
 * import { AuthorizedSourceTextResolver } from "@beep/law-practice-server/MatterAuthority"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(AuthorizedSourceTextResolver)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const AuthorizedSourceTextResolver: Layer.Layer<
  SourceTextResolver,
  never,
  SourceTextResolver | MatterAuthority | LawPrincipal
> = Layer.effect(
  SourceTextResolver,
  Effect.gen(function* () {
    const inner = yield* SourceTextResolver;
    const authority = yield* MatterAuthority;
    const { principal } = yield* LawPrincipal;
    return SourceTextResolver.of({
      resolve: Effect.fn("MatterAuthority.resolveSourceText")(function* (request) {
        const access = yield* authority.authorize({
          principal,
          scope: request.identity.scopeRef,
          access: "source-retrieval",
        });
        return yield* MatterAccess.match(access, {
          Granted: () => inner.resolve(request),
          Denied: () =>
            Effect.fail(SourceTextResolverError.new("scope-unavailable", "The source-text scope is unavailable.")),
        });
      }),
    });
  })
);
