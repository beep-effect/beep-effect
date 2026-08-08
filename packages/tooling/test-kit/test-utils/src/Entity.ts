/**
 * Shared entity fixture helpers for package tests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";

type BaseEntityFixtureInput = {
  readonly createdAt: number;
  readonly createdByPrincipal: typeof systemPrincipal;
  readonly entityType: string;
  readonly id: number;
  readonly orgId: number;
  readonly publicId: string;
  readonly rowVersion: number;
  readonly schemaVersion: string;
  readonly source: "System";
  readonly updatedAt: number;
  readonly updatedByPrincipal: typeof systemPrincipal;
};

/**
 * Runtime system principal used by deterministic entity fixture rows.
 *
 * **Example** (System principal kind field)
 *
 * ```ts
 * import { systemPrincipal } from "@beep/test-utils"
 *
 * console.log(systemPrincipal.kind)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const systemPrincipal = {
  component: "Runtime",
  kind: "System",
} as const;

const publicIdFor = (entityType: string, id: number) =>
  `${entityType.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_a${id}`;

/**
 * Build the common BaseEntity fields used by model decode tests.
 *
 * **Example** (Build base entity fixture)
 *
 * ```ts
 * import { baseEntityFixtureInput } from "@beep/test-utils"
 *
 * console.log(baseEntityFixtureInput("ExampleEntity", 1).entityType)
 * ```
 *
 * @param entityType - Stable entity type tag expected by the decoded model.
 * @param id - Deterministic numeric entity id for the fixture row.
 * @category testing
 * @since 0.0.0
 */
export const baseEntityFixtureInput: {
  (entityType: string, id: number): BaseEntityFixtureInput;
  (id: number): (entityType: string) => BaseEntityFixtureInput;
} = dual(
  2,
  (entityType: string, id: number): BaseEntityFixtureInput => ({
    createdAt: id,
    createdByPrincipal: systemPrincipal,
    entityType,
    id,
    orgId: 1,
    publicId: publicIdFor(entityType, id),
    rowVersion: 1,
    schemaVersion: "0.0.0",
    source: "System",
    updatedAt: id + 1,
    updatedByPrincipal: systemPrincipal,
  })
);
