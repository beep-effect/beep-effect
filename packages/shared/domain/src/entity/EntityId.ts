/**
 * Shared-kernel entity identifier constructor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import { Str } from "@beep/utils";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { IdentityComposer } from "@beep/identity";
import type * as BrandNS from "effect/Brand";

const $I = $SharedDomainId.create("entity/EntityId");
const entityIdTokenPattern = /^[a-z][a-z0-9_]*$/u;
const entityIdResourcePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const entityIdPascalPattern = /^[A-Z][A-Za-z0-9]*$/u;

const EntityIdToken = S.NonEmptyString.check(
  S.isPattern(entityIdTokenPattern, {
    identifier: $I`EntityIdTokenPattern`,
    title: "Entity id token pattern",
    description: "Lowercase snake-case token used for entity-id slice, name, and table metadata.",
    message: "Expected a lowercase snake-case entity-id token",
  })
).pipe(
  $I.annoteSchema("EntityIdToken", {
    description: "Lowercase snake-case token used for shared entity-id metadata.",
  })
);

const EntityIdResource = S.NonEmptyString.check(
  S.isPattern(entityIdResourcePattern, {
    identifier: $I`EntityIdResourcePattern`,
    title: "Entity id resource pattern",
    description: "Dot-separated lowercase resource token used for authorization metadata.",
    message: "Expected a dot-separated lowercase resource token",
  })
).pipe(
  $I.annoteSchema("EntityIdResource", {
    description: "Dot-separated lowercase resource token used by shared entity-id metadata.",
  })
);

const EntityIdPascalToken = S.NonEmptyString.check(
  S.isPattern(entityIdPascalPattern, {
    identifier: $I`EntityIdPascalTokenPattern`,
    title: "Entity id PascalCase token pattern",
    description: "PascalCase token used for entity type and brand metadata.",
    message: "Expected a PascalCase entity-id token",
  })
).pipe(
  $I.annoteSchema("EntityIdPascalToken", {
    description: "PascalCase token used by shared entity-id metadata.",
  })
);

const EntityIdDescription = S.NonEmptyString.pipe(
  $I.annoteSchema("EntityIdDescription", {
    description: "Human-readable entity-id description text.",
  })
);

/**
 * Storage-neutral positive integer used by every v1 persisted entity id.
 *
 * **Example** (Decode entity id value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { EntityIdValue } from "@beep/shared-domain/entity/EntityId"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(EntityIdValue)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityIdValue = PosInt.check(
  S.isBetween(
    {
      minimum: 1,
      maximum: 2_147_483_647,
    },
    {
      description: "A positive generated entity id in the v1 integer id range.",
      title: "Generated Entity Id Range",
    }
  )
).pipe(
  S.brand("EntityIdValue"),
  $I.annoteSchema("EntityIdValue", {
    description: "Storage-neutral positive integer used by shared-kernel persisted entity ids.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption", "decodeUnknownSync", "is"])
);

/**
 * Runtime type for {@link EntityIdValue}.
 *
 * **Example** (Type annotated entity id)
 *
 * ```ts
 * import { EntityIdValue } from "@beep/shared-domain/entity/EntityId"
 * import * as S from "effect/Schema"
 *
 * const id: EntityIdValue = S.decodeUnknownSync(EntityIdValue)(1)
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdValue = typeof EntityIdValue.Type;

/**
 * Entity id value branded with the concrete entity-id brand.
 *
 * **Example** (Branded organization id value)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity/packages"
 * import * as EntityId from "@beep/shared-domain/entity/EntityId"
 * import * as S from "effect/Schema"
 *
 * const $I = $SharedDomainId.create("identity/Shared")
 * const OrganizationId = EntityId.factory("shared", $I)("organization")
 * const id: EntityId.EntityIdValueFor<"SharedOrganizationId"> = S.decodeUnknownSync(OrganizationId)(1)
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdValueFor<TBrand extends string> = BrandNS.Branded<EntityIdValue, TBrand>;

/**
 * Constrained metadata overrides accepted by {@link factory}.
 *
 * **Example** (Make options with tableName)
 *
 * ```ts
 * import { Options } from "@beep/shared-domain/entity/EntityId"
 * import * as O from "effect/Option"
 *
 * const options = Options.make({ tableName: O.some("shared_organization") })
 * console.log(O.getOrThrow(options.tableName))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Options extends S.Class<Options>($I`Options`)(
  {
    brand: S.OptionFromOptionalKey(EntityIdPascalToken).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional schema brand override for the generated entity id." })
    ),
    description: S.OptionFromOptionalKey(EntityIdDescription).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional human-readable description override for the generated entity id." })
    ),
    entityType: S.OptionFromOptionalKey(EntityIdPascalToken).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional PascalCase entity type override for the generated entity id." })
    ),
    resource: S.OptionFromOptionalKey(EntityIdResource).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional dot-separated authorization resource override." })
    ),
    tableName: S.OptionFromOptionalKey(EntityIdToken).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({ description: "Optional SQL table-name override for the generated entity id." })
    ),
  },
  $I.annote("Options", {
    description: "Constrained metadata overrides accepted by EntityId.factory.",
  })
) {}

/**
 * Default SQL table name derived from a slice and entity segment.
 *
 * **Example** (Default shared organization table)
 *
 * ```ts
 * import type { TableName } from "@beep/shared-domain/entity/EntityId"
 *
 * const tableName: TableName<"shared", "organization"> = "shared_organization"
 * console.log(tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TableName<Slice extends string, Name extends string> = `${Slice}_${Name}`;

/**
 * Default permission resource derived from a slice and entity segment.
 *
 * **Example** (Default shared organization resource)
 *
 * ```ts
 * import type { Resource } from "@beep/shared-domain/entity/EntityId"
 *
 * const resource: Resource<"shared", "organization"> = "shared.organization"
 * console.log(resource)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Resource<Slice extends string, Name extends string> = `${Slice}.${Name}`;

type Snake<S extends string> = ReturnType<typeof Str.snakeCase<S>>;
type SnakeToPascal<S extends string> = ReturnType<typeof Str.snakeToPascal<Snake<S>>>;

/**
 * Default entity type derived from a slice and entity segment.
 *
 * **Example** (Default SharedOrganization type)
 *
 * ```ts
 * import type { EntityType } from "@beep/shared-domain/entity/EntityId"
 *
 * const entityType: EntityType<"shared", "organization"> = "SharedOrganization"
 * console.log(entityType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityType<Slice extends string, Name extends string> = `${SnakeToPascal<Slice>}${SnakeToPascal<Name>}`;

/**
 * Default schema brand derived from a slice and entity segment.
 *
 * **Example** (Default SharedOrganizationId brand)
 *
 * ```ts
 * import type { Brand } from "@beep/shared-domain/entity/EntityId"
 *
 * const brand: Brand<"shared", "organization"> = "SharedOrganizationId"
 * console.log(brand)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Brand<Slice extends string, Name extends string> = `${EntityType<Slice, Name>}Id`;

/**
 * Constructor input for {@link Options}.
 *
 * **Example** (Options input with tableName)
 *
 * ```ts
 * import type { OptionsInput } from "@beep/shared-domain/entity/EntityId"
 *
 * const input: OptionsInput = { tableName: "shared_organization" }
 * console.log(input.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OptionsInput = typeof Options.Encoded;

type OverrideString<Overrides, Key extends keyof OptionsInput, Default extends string> = Overrides extends undefined
  ? Default
  : Key extends keyof Overrides
    ? Extract<Overrides[Key], string> extends never
      ? Default
      : Extract<Overrides[Key], string>
    : Default;

type ResolvedTableName<Slice extends string, Name extends string, Overrides> = OverrideString<
  Overrides,
  "tableName",
  TableName<Slice, Name>
>;
type ResolvedResource<Slice extends string, Name extends string, Overrides> = OverrideString<
  Overrides,
  "resource",
  Resource<Slice, Name>
>;
type ResolvedEntityType<Slice extends string, Name extends string, Overrides> = OverrideString<
  Overrides,
  "entityType",
  EntityType<Slice, Name>
>;
type ResolvedBrand<Slice extends string, Name extends string, Overrides> = OverrideString<
  Overrides,
  "brand",
  Brand<Slice, Name>
>;

/**
 * Materialized entity-id definition metadata.
 *
 * **Example** (Make full definition metadata)
 *
 * ```ts
 * import { Definition, Options } from "@beep/shared-domain/entity/EntityId"
 *
 * const definition = Definition.make({
 *   brand: "SharedOrganizationId",
 *   description: "SharedOrganization entity identifier.",
 *   entityType: "SharedOrganization",
 *   name: "organization",
 *   overrides: Options.make({}),
 *   resource: "shared.organization",
 *   slice: "shared",
 *   tableName: "shared_organization"
 * })
 * console.log(definition.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Definition extends S.Class<Definition>($I`Definition`)(
  {
    brand: EntityIdPascalToken.annotateKey({ description: "Resolved schema brand for the generated entity id." }),
    description: EntityIdDescription.annotateKey({
      description: "Human-readable description for the generated entity id.",
    }),
    entityType: EntityIdPascalToken.annotateKey({
      description: "Resolved PascalCase entity type for the generated entity id.",
    }),
    name: EntityIdToken.annotateKey({ description: "Entity segment used to derive shared entity-id metadata." }),
    overrides: Options.annotateKey({ description: "Original metadata overrides supplied to EntityId.factory." }),
    resource: EntityIdResource.annotateKey({ description: "Resolved dot-separated authorization resource token." }),
    slice: EntityIdToken.annotateKey({ description: "Slice segment used to derive shared entity-id metadata." }),
    tableName: EntityIdToken.annotateKey({ description: "Resolved SQL table name for the generated entity id." }),
  },
  $I.annote("Definition", {
    description: "Materialized entity-id metadata derived from a slice and entity name.",
  })
) {}

/**
 * Literal-preserving entity-id definition metadata.
 *
 * **Example** (Literal organization definition type)
 *
 * ```ts
 * import type { DefinitionFor } from "@beep/shared-domain/entity/EntityId"
 *
 * type OrganizationDefinition = DefinitionFor<"shared", "organization">
 *
 * const tableName: OrganizationDefinition["tableName"] = "shared_organization"
 * console.log(tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DefinitionFor<
  Slice extends string,
  Name extends string,
  TTableName extends string = TableName<Slice, Name>,
  TResource extends string = Resource<Slice, Name>,
  TEntityType extends string = EntityType<Slice, Name>,
  TBrand extends string = Brand<Slice, Name>,
> = Omit<Definition, "brand" | "entityType" | "name" | "resource" | "slice" | "tableName"> & {
  readonly brand: TBrand;
  readonly entityType: TEntityType;
  readonly name: Name;
  readonly resource: TResource;
  readonly slice: Slice;
  readonly tableName: TTableName;
};

/**
 * Branded schema with deterministic entity metadata statics.
 *
 * **Example** (Factory branded organization schema)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity/packages"
 * import * as EntityId from "@beep/shared-domain/entity/EntityId"
 *
 * const $I = $SharedDomainId.create("identity/Shared")
 * const OrganizationId: EntityId.EntityId<"shared", "organization"> = EntityId.factory("shared", $I)("organization")
 * console.log(OrganizationId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityId<
  Slice extends string = string,
  Name extends string = string,
  TTableName extends string = TableName<Slice, Name>,
  TResource extends string = Resource<Slice, Name>,
  TEntityType extends string = EntityType<Slice, Name>,
  TBrand extends string = Brand<Slice, Name>,
> = S.Codec<EntityIdValueFor<TBrand>, number> &
  EntityIdStatics<Slice, Name, TTableName, TResource, TEntityType, TBrand>;

type EntityIdStatics<
  Slice extends string,
  Name extends string,
  TTableName extends string,
  TResource extends string,
  TEntityType extends string,
  TBrand extends string,
> = {
  readonly brand: TBrand;
  readonly definition: DefinitionFor<Slice, Name, TTableName, TResource, TEntityType, TBrand>;
  readonly entityType: TEntityType;
  readonly equivalence: EntityIdEquivalence<TBrand>;
  readonly resource: TResource;
  readonly slice: Slice;
  readonly tableName: TTableName;
};

type EntityIdEquivalence<TBrand extends string> = {
  bivarianceHack(self: EntityIdValueFor<TBrand>, that: EntityIdValueFor<TBrand>): boolean;
}["bivarianceHack"];

type EntityIdSchema<TBrand extends string> = S.Codec<EntityIdValueFor<TBrand>, number>;

/**
 * Codec statics carried by every entity id built with {@link factory}.
 *
 * **Details**
 *
 * The factory pipes each branded id schema through
 * `SchemaUtils.withCodecStatics`, selecting the direct codec runners used
 * across the entity-id fleet: `is`, `decodeSync`, `decodeUnknownSync`,
 * `decodeUnknownOption`, `decodeEffect`, `decodeUnknownEffect`, `encodeEffect`,
 * and `encodeUnknownEffect`. JSON
 * boundaries remain explicit `S.fromJsonString(...)` schemas. The dual
 * `equivalence` helper is omitted because the factory deliberately attaches
 * its own plain two-argument entity-id equivalence.
 *
 * **Example** (Guard through factory-attached codec statics)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity/packages"
 * import * as EntityId from "@beep/shared-domain/entity/EntityId"
 *
 * const $I = $SharedDomainId.create("identity/Shared")
 * const OrganizationId = EntityId.factory("shared", $I)("organization")
 * const statics: EntityId.EntityIdCodecStatics<"SharedOrganizationId"> = OrganizationId
 *
 * console.log(statics.is(1))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityIdCodecStatics<TBrand extends string> = SchemaUtils.SelectedCodecStatics<
  EntityIdSchema<TBrand>,
  readonly [
    "decodeEffect",
    "decodeSync",
    "decodeUnknownEffect",
    "decodeUnknownOption",
    "decodeUnknownSync",
    "encodeEffect",
    "encodeUnknownEffect",
    "is",
  ]
>;

const decodeOptionsResult = S.decodeUnknownResult(Options);

/**
 * Any entity id schema produced by {@link factory}.
 *
 * **Gotchas**
 *
 * `Any` intentionally omits {@link EntityIdCodecStatics}: widening it would
 * break `extends EntityId.Any` consumers through `Brand` invariance. Narrowing
 * a factory id to `Any` keeps the entity metadata statics but drops the codec
 * groups, so keep the concrete id type when you need them.
 *
 * **Example** (Any factory entity id)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity/packages"
 * import * as EntityId from "@beep/shared-domain/entity/EntityId"
 *
 * const $I = $SharedDomainId.create("identity/Shared")
 * const entityId: EntityId.Any = EntityId.factory("shared", $I)("organization")
 * console.log(entityId.resource)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Any = EntityId<string, string, string, string, string, string>;

type Maker<Slice extends string> = <
  const Name extends string,
  const Overrides extends OptionsInput | undefined = undefined,
>(
  name: Name,
  overrides?: Overrides
) => EntityId<
  Slice,
  Name,
  ResolvedTableName<Slice, Name, Overrides>,
  ResolvedResource<Slice, Name, Overrides>,
  ResolvedEntityType<Slice, Name, Overrides>,
  ResolvedBrand<Slice, Name, Overrides>
> &
  EntityIdCodecStatics<ResolvedBrand<Slice, Name, Overrides>>;

type Factory = {
  <const Slice extends string>(slice: Slice, identity: IdentityComposer<string>): Maker<Slice>;
  (identity: IdentityComposer<string>): <const Slice extends string>(slice: Slice) => Maker<Slice>;
};

const defaultResource = <const Slice extends string, const Name extends string>(
  slice: Slice,
  name: Name
): Resource<Slice, Name> => `${slice}.${name}`;

const defaultTableName = <const Slice extends string, const Name extends string>(
  slice: Slice,
  name: Name
): TableName<Slice, Name> => `${slice}_${name}`;

const literalDefinition = <
  const Slice extends string,
  const Name extends string,
  const Overrides extends OptionsInput | undefined,
>(
  definition: Definition
): DefinitionFor<
  Slice,
  Name,
  ResolvedTableName<Slice, Name, Overrides>,
  ResolvedResource<Slice, Name, Overrides>,
  ResolvedEntityType<Slice, Name, Overrides>,
  ResolvedBrand<Slice, Name, Overrides>
> =>
  definition as DefinitionFor<
    Slice,
    Name,
    ResolvedTableName<Slice, Name, Overrides>,
    ResolvedResource<Slice, Name, Overrides>,
    ResolvedEntityType<Slice, Name, Overrides>,
    ResolvedBrand<Slice, Name, Overrides>
  >;

const attachEntityIdStatics = <
  const Slice extends string,
  const Name extends string,
  const TTableName extends string,
  const TResource extends string,
  const TEntityType extends string,
  const TBrand extends string,
  const Schema extends S.Codec<EntityIdValueFor<TBrand>, number, never, never>,
>(
  schema: Schema,
  statics: EntityIdStatics<Slice, Name, TTableName, TResource, TEntityType, TBrand>
): Schema & EntityIdStatics<Slice, Name, TTableName, TResource, TEntityType, TBrand> =>
  SchemaUtils.withStatics(schema, () => statics);

const buildDefinition = <
  const Slice extends string,
  const Name extends string,
  const Overrides extends OptionsInput | undefined,
>(
  slice: Slice,
  name: Name,
  input?: Overrides
): DefinitionFor<
  Slice,
  Name,
  ResolvedTableName<Slice, Name, Overrides>,
  ResolvedResource<Slice, Name, Overrides>,
  ResolvedEntityType<Slice, Name, Overrides>,
  ResolvedBrand<Slice, Name, Overrides>
> => {
  const overrides = Result.getOrThrow(decodeOptionsResult(input ?? {}));
  const defaultEntityType = Str.prefix(
    pipe(name, Str.snakeCase, Str.snakeToPascal),
    pipe(slice, Str.snakeCase, Str.snakeToPascal)
  );
  const entityType = O.getOrElse(overrides.entityType, () => defaultEntityType);
  const brand = O.getOrElse(overrides.brand, () => Str.postfix(entityType, "Id"));
  return literalDefinition<Slice, Name, Overrides>(
    Definition.make({
      brand,
      description: O.getOrElse(overrides.description, () => `${entityType} entity identifier.`),
      entityType,
      name,
      overrides,
      resource: O.getOrElse(overrides.resource, () => defaultResource(slice, name)),
      slice,
      tableName: O.getOrElse(overrides.tableName, () => defaultTableName(slice, name)),
    })
  );
};

/**
 * Build a slice-scoped entity id maker.
 *
 * **Details**
 *
 * Every produced id schema carries the entity metadata statics plus the
 * selected direct codec surface described by {@link EntityIdCodecStatics}.
 * The codec helpers are attached before the entity metadata statics so the
 * factory's plain entity-id `equivalence` stays canonical, including on
 * schemas produced by a later `.annotate(...)` call.
 *
 * **Example** (Build slice-scoped id maker)
 *
 * ```ts
 * import { $SharedDomainId } from "@beep/identity/packages"
 * import * as EntityId from "@beep/shared-domain/entity/EntityId"
 *
 * const $I = $SharedDomainId.create("identity/Shared")
 * const make = EntityId.factory("shared", $I)
 * const OrganizationId = make("organization")
 *
 * console.log(OrganizationId.tableName)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const factory: Factory = dual(
  2,
  <const Slice extends string>(slice: Slice, identity: IdentityComposer<string>): Maker<Slice> =>
    <const Name extends string, const Overrides extends OptionsInput | undefined = undefined>(
      name: Name,
      overrides?: Overrides
    ): EntityId<
      Slice,
      Name,
      ResolvedTableName<Slice, Name, Overrides>,
      ResolvedResource<Slice, Name, Overrides>,
      ResolvedEntityType<Slice, Name, Overrides>,
      ResolvedBrand<Slice, Name, Overrides>
    > &
      EntityIdCodecStatics<ResolvedBrand<Slice, Name, Overrides>> => {
      const definition = buildDefinition(slice, name, overrides);
      const schema = EntityIdValue.pipe(
        S.brand(definition.brand),
        identity.annoteSchema(definition.brand, {
          description: definition.description,
        })
      );
      const typedSchema = schema as S.Codec<EntityIdValueFor<ResolvedBrand<Slice, Name, Overrides>>, number>;

      return attachEntityIdStatics(
        typedSchema.pipe(
          SchemaUtils.withCodecStatics([
            "decodeEffect",
            "decodeSync",
            "decodeUnknownEffect",
            "decodeUnknownOption",
            "decodeUnknownSync",
            "encodeEffect",
            "encodeUnknownEffect",
            "is",
          ])
        ),
        {
          brand: definition.brand,
          definition,
          entityType: definition.entityType,
          equivalence: S.toEquivalence(typedSchema),
          resource: definition.resource,
          slice,
          tableName: definition.tableName,
        }
      );
    }
);
