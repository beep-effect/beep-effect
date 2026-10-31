/**
 * Fleet graph lint over goal-packet manifests (duplicate ids, dependency
 * cycles, unknown references), consumed by `beep explore check`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { isJsonRecord, parseGoalManifestText } from "../Inventory.ts";
import { FleetLintFinding } from "./Migration.schemas.ts";
import type { GoalPacketRecord } from "../Inventory.ts";

type JsonRecord = Readonly<Record<string, unknown>>;

type PacketNode = {
  readonly slug: string;
  readonly declaredId: string;
  readonly blockedBy: ReadonlyArray<string>;
  readonly supersededBy: O.Option<string>;
  readonly version: O.Option<string>;
};

const stringField = (record: JsonRecord, key: string): O.Option<string> =>
  pipe(R.get(record, key), O.filter(P.isString));

const recordField = (record: JsonRecord, key: string): O.Option<JsonRecord> =>
  pipe(R.get(record, key), O.filter(isJsonRecord));

const stringArrayField = (record: JsonRecord, key: string): ReadonlyArray<string> =>
  pipe(
    R.get(record, key),
    O.filter((value): value is ReadonlyArray<unknown> => A.isArray(value)),
    O.map(A.filter(P.isString)),
    O.getOrElse(A.empty<string>)
  );

const packetReference = (value: string): O.Option<string> => {
  const withoutFragment = pipe(
    value,
    Str.split("#"),
    A.head,
    O.getOrElse(() => value)
  );
  if (Str.startsWith("explorations/")(withoutFragment)) return O.none();
  return O.some(
    Str.startsWith("goals/")(withoutFragment) ? Str.slice("goals/".length)(withoutFragment) : withoutFragment
  );
};

const packetNode = (record: GoalPacketRecord): O.Option<PacketNode> => {
  if (record.manifestText === undefined) return O.none();
  const parsed = parseGoalManifestText(record.manifestText);
  if (O.isNone(parsed) || !isJsonRecord(parsed.value)) return O.none();
  const initiative = recordField(parsed.value, "initiative");
  const declaredId = O.flatMap(initiative, (value) => stringField(value, "id"));
  if (O.isNone(declaredId)) return O.none();
  return O.some({
    slug: record.slug,
    declaredId: declaredId.value,
    blockedBy: stringArrayField(parsed.value, "blockedBy"),
    supersededBy: O.flatMap(stringField(parsed.value, "supersededBy"), packetReference),
    version: stringField(parsed.value, "schemaVersion"),
  });
};

const findingOrder = Order.mapInput(
  Order.String,
  (item: FleetLintFinding) => `${item.slug}\u0000${item.kind}\u0000${A.join(item.related, ",")}`
);

const cycleFinding = (
  slug: string,
  path: ReadonlyArray<string>,
  reported: MutableHashSet.MutableHashSet<string>
): O.Option<FleetLintFinding> => {
  const start = A.findFirstIndex(path, (item) => item === slug);
  const cycle = A.append(O.isSome(start) ? A.drop(path, start.value) : path, slug);
  const key = A.join(A.sort(A.dedupe(cycle), Order.String), "|");
  if (MutableHashSet.has(reported, key)) return O.none();
  MutableHashSet.add(reported, key);
  return O.some(
    FleetLintFinding.make({
      slug,
      kind: "dependency-cycle",
      severity: "violation",
      related: cycle,
      message: `blockedBy dependency cycle: ${A.join(cycle, " -> ")}`,
    })
  );
};

const knownDependencies = (
  node: O.Option<PacketNode>,
  bySlug: MutableHashMap.MutableHashMap<string, PacketNode>
): ReadonlyArray<string> =>
  O.isNone(node)
    ? A.empty<string>()
    : A.getSomes(
        A.map(node.value.blockedBy, (reference) =>
          pipe(
            packetReference(reference),
            O.filter((slug) => O.isSome(MutableHashMap.get(bySlug, slug)))
          )
        )
      );

const dependencyCycleFindings = (nodes: ReadonlyArray<PacketNode>): ReadonlyArray<FleetLintFinding> => {
  const bySlug = MutableHashMap.empty<string, PacketNode>();
  for (const node of nodes) MutableHashMap.set(bySlug, node.slug, node);
  const visited = MutableHashSet.empty<string>();
  const active = MutableHashSet.empty<string>();
  const reported = MutableHashSet.empty<string>();
  let findings = A.empty<FleetLintFinding>();

  const visit = (slug: string, path: ReadonlyArray<string>): void => {
    if (MutableHashSet.has(active, slug)) {
      findings = pipe(
        cycleFinding(slug, path, reported),
        O.match({ onNone: () => findings, onSome: (finding) => A.append(findings, finding) })
      );
      return;
    }
    if (MutableHashSet.has(visited, slug)) return;
    MutableHashSet.add(active, slug);
    for (const related of knownDependencies(MutableHashMap.get(bySlug, slug), bySlug))
      visit(related, A.append(path, slug));
    MutableHashSet.remove(active, slug);
    MutableHashSet.add(visited, slug);
  };

  for (const node of nodes) visit(node.slug, A.empty<string>());
  return findings;
};

const duplicateIdentityFindings = (nodes: ReadonlyArray<PacketNode>): ReadonlyArray<FleetLintFinding> => {
  const declared = MutableHashMap.empty<string, ReadonlyArray<string>>();
  for (const node of nodes) {
    const slugs = pipe(MutableHashMap.get(declared, node.declaredId), O.getOrElse(A.empty<string>));
    MutableHashMap.set(declared, node.declaredId, A.append(slugs, node.slug));
  }
  return A.getSomes(
    A.map(A.fromIterable(MutableHashMap.keys(declared)), (id) =>
      pipe(
        MutableHashMap.get(declared, id),
        O.flatMap((slugs) =>
          A.length(slugs) > 1
            ? O.some(
                FleetLintFinding.make({
                  slug: id,
                  kind: "duplicate-slug",
                  severity: "violation",
                  related: A.sort(slugs, Order.String),
                  message: `initiative.id "${id}" is declared by ${A.join(A.sort(slugs, Order.String), ", ")}`,
                })
              )
            : O.none<FleetLintFinding>()
        )
      )
    )
  );
};

const packetReferenceFinding = (
  node: PacketNode,
  reference: string,
  known: MutableHashSet.MutableHashSet<string>,
  bySlug: MutableHashMap.MutableHashMap<string, PacketNode>
): O.Option<FleetLintFinding> =>
  pipe(
    packetReference(reference),
    O.flatMap((related) => {
      if (!MutableHashSet.has(known, related)) {
        return O.some(
          FleetLintFinding.make({
            slug: node.slug,
            kind: "unreachable-packet",
            severity: "violation",
            related: [related],
            message: `packet reference "${reference}" does not resolve to a goal manifest`,
          })
        );
      }
      const version = pipe(
        MutableHashMap.get(bySlug, related),
        O.flatMap((relatedNode) => relatedNode.version)
      );
      return O.contains(version, "initiative-manifest/v2")
        ? O.none()
        : O.some(
            FleetLintFinding.make({
              slug: node.slug,
              kind: "unmigrated-reference",
              severity: "warning",
              related: [related],
              message: `packet reference "${reference}" resolves, but its target is not yet v2`,
            })
          );
    })
  );

const packetReferenceFindings = (nodes: ReadonlyArray<PacketNode>): ReadonlyArray<FleetLintFinding> => {
  const known = MutableHashSet.fromIterable(A.map(nodes, (node) => node.slug));
  const bySlug = MutableHashMap.empty<string, PacketNode>();
  for (const node of nodes) MutableHashMap.set(bySlug, node.slug, node);
  return A.flatMap(nodes, (node) =>
    A.getSomes(
      A.map(A.appendAll(node.blockedBy, O.toArray(node.supersededBy)), (reference) =>
        packetReferenceFinding(node, reference, known, bySlug)
      )
    )
  );
};

/**
 * Lint duplicate identities, dependency cycles, and dangling packet edges.
 *
 * **Example** (Detect duplicate declared slugs)
 *
 * ```ts
 * import { lintGoalFleet } from "@beep/repo-cli/commands/Goals/Migration/ManifestTranslation"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 *
 * const make = (slug: string) => GoalPacketRecord.make({
 *   slug,
 *   packetPath: `goals/${slug}`,
 *   manifestPath: `goals/${slug}/ops/manifest.json`,
 *   readmePath: `goals/${slug}/README.md`,
 *   manifestText: '{ "initiative": { "id": "same", "status": "active" } }',
 * })
 * console.log(lintGoalFleet([make("a"), make("b")])[0]?.kind) // "duplicate-slug"
 * ```
 *
 * @param records - Complete scanned goal fleet.
 * @returns Stable sorted cross-packet findings.
 * @category use-cases
 * @since 0.0.0
 */
export const lintGoalFleet = (records: ReadonlyArray<GoalPacketRecord>): ReadonlyArray<FleetLintFinding> => {
  const nodes = A.getSomes(A.map(records, packetNode));
  return A.sort(
    A.appendAll(
      A.appendAll(duplicateIdentityFindings(nodes), packetReferenceFindings(nodes)),
      dependencyCycleFindings(nodes)
    ),
    findingOrder
  );
};
