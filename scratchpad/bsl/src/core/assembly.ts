/** Dialect-neutral graph records and deterministic relation naming. */
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as Str from "effect/String";
import { camelCase } from "../internal/case.ts";
import type * as Meta from "./Meta.ts";

/** Resolved directed foreign-key edge used during assembly. */
export interface Edge {
  readonly sourceKey: string;
  readonly sourceField: string;
  readonly targetKey: string;
  readonly targetField: string;
  readonly relationName: string;
  readonly optional: boolean;
  readonly reference: Meta.References;
}

/** Two foreign-key edges forming a narrow junction table. */
export interface Junction {
  readonly key: string;
  readonly left: Edge;
  readonly right: Edge;
}

/** Derive a forward relation name from an id field. */
export const relationName = (fieldName: string): string =>
  Str.endsWith("Id")(fieldName) ? Str.slice(0, -2)(fieldName) : `${fieldName}Relation`;

/** Stable alias shared by forward and reverse relations. */
export const relationAlias = (edge: Edge): string =>
  `${edge.sourceKey}_${edge.sourceField}_${edge.targetKey}`;

/** Deliberately narrow pluralization used by deterministic relation names. */
export const plural = (value: string): string => `${camelCase(value)}s`;

/** Derive the reverse relation name for one edge. */
export const reverseRelationName = (edge: Edge, edges: ReadonlyArray<Edge>): string => {
  const ambiguous =
    A.filter(
      edges,
      (candidate) =>
        Eq.equals(candidate.sourceKey, edge.sourceKey) &&
        Eq.equals(candidate.targetKey, edge.targetKey),
    ).length > 1;
  if (Eq.equals(edge.sourceKey, edge.targetKey) && Str.startsWith("parent")(edge.relationName)) {
    return `child${Str.capitalize(Str.slice(6)(edge.relationName))}s`;
  }
  const base = plural(edge.sourceKey);
  return ambiguous ? `${base}By${Str.capitalize(edge.relationName)}` : base;
};
