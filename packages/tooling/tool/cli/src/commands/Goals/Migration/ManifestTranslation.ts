/**
 * Pure actual-shape goal-manifest translation and fleet graph lint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { MutableHashMap, MutableHashSet, Order, Result } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { applyJsoncModification } from "../../../internal/cli/Jsonc.ts";
import { GoalManifest, GoalManifestSchemaVersion, isGoalStatus } from "../Goals.schemas.ts";
import { isJsonRecord, parseGoalManifestText } from "../Inventory.ts";
import {
  FleetLintFinding,
  ManifestShapeProbe,
  ManifestTranslation,
  ManifestTranslationPlan,
  TranslationAssumption,
  TranslationIssue,
} from "./Migration.schemas.ts";
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

const phaseShape = (manifest: JsonRecord): ManifestShapeProbe["phaseShape"] => {
  const phases = R.get(manifest, "phases");
  if (O.isNone(phases)) return "absent";
  if (A.isArray(phases.value)) return "array";
  return isJsonRecord(phases.value) ? "record" : "invalid";
};

const probeManifest = (slug: string, manifest: JsonRecord): ManifestShapeProbe =>
  ManifestShapeProbe.make({
    slug,
    ...pipe(
      stringField(manifest, "schemaVersion"),
      O.map((declaredVersion) => ({ declaredVersion })),
      O.getOrElse(() => ({}))
    ),
    hasInitiative: O.isSome(recordField(manifest, "initiative")),
    hasLifecycle: O.isSome(stringField(manifest, "lifecycle")),
    hasPacketPath: O.isSome(stringField(manifest, "packetPath")),
    hasCompletionGate: O.isSome(recordField(manifest, "completionGate")),
    phaseShape: phaseShape(manifest),
  });

const invalidProbe = (slug: string): ManifestShapeProbe =>
  ManifestShapeProbe.make({
    slug,
    hasInitiative: false,
    hasLifecycle: false,
    hasPacketPath: false,
    hasCompletionGate: false,
    phaseShape: "invalid",
  });

const issue = (slug: string, message: string): TranslationIssue =>
  TranslationIssue.make({ slug, severity: "violation", message });

const emptyPlan = (slug: string, message: string): ManifestTranslationPlan =>
  ManifestTranslationPlan.make({
    probe: invalidProbe(slug),
    translation: O.none(),
    issues: A.of(issue(slug, message)),
    assumptions: A.empty<TranslationAssumption>(),
  });

type ManifestFields = {
  readonly beforeVersion: O.Option<string>;
  readonly declaredVersion: O.Option<unknown>;
  readonly lifecycle: O.Option<string>;
  readonly packetPath: O.Option<string>;
  readonly status: O.Option<string>;
};

const isGoalManifestSchemaVersion = S.is(GoalManifestSchemaVersion);
const decodeGoalManifestResult = S.decodeUnknownResult(GoalManifest);

const issueWhen = (slug: string, condition: boolean, message: string): ReadonlyArray<TranslationIssue> =>
  condition ? A.of(issue(slug, message)) : A.empty<TranslationIssue>();

const inspectManifest = (
  record: GoalPacketRecord,
  manifest: JsonRecord,
  probe: ManifestShapeProbe
): readonly [fields: ManifestFields, issues: ReadonlyArray<TranslationIssue>] => {
  const initiative = recordField(manifest, "initiative");
  const status = O.flatMap(initiative, (value) => stringField(value, "status"));
  const declaredId = O.flatMap(initiative, (value) => stringField(value, "id"));
  const lifecycle = stringField(manifest, "lifecycle");
  const packetPath = stringField(manifest, "packetPath");
  const declaredIdMismatch = pipe(
    declaredId,
    O.filter((value) => value !== record.slug),
    O.map((value) => `initiative.id declares "${value}"`)
  );
  const lifecycleMismatch = pipe(
    O.all({ lifecycle, status }),
    O.filter(({ lifecycle: value, status: expected }) => value !== expected),
    O.map(
      ({ lifecycle: value, status: expected }) => `lifecycle "${value}" disagrees with initiative.status "${expected}"`
    )
  );
  const packetPathMismatch = pipe(
    packetPath,
    O.filter((value) => value !== `goals/${record.slug}`),
    O.map((value) => `packetPath declares "${value}"`)
  );
  const issues = A.flatten([
    issueWhen(record.slug, O.isNone(initiative), "initiative object is missing"),
    issueWhen(record.slug, O.isNone(status), "initiative.status is missing"),
    issueWhen(
      record.slug,
      O.isSome(status) && !isGoalStatus(status.value),
      `initiative.status "${O.getOrElse(status, () => "<missing>")}" is not a canonical goal status`
    ),
    issueWhen(record.slug, O.isNone(declaredId), "initiative.id is missing"),
    pipe(
      declaredIdMismatch,
      O.map((message) => A.of(issue(record.slug, message))),
      O.getOrElse(A.empty)
    ),
    issueWhen(record.slug, !probe.hasCompletionGate, "completionGate object is missing"),
    pipe(
      lifecycleMismatch,
      O.map((message) => A.of(issue(record.slug, message))),
      O.getOrElse(A.empty)
    ),
    pipe(
      packetPathMismatch,
      O.map((message) => A.of(issue(record.slug, message))),
      O.getOrElse(A.empty)
    ),
  ]);
  return [
    {
      beforeVersion: stringField(manifest, "schemaVersion"),
      declaredVersion: R.get(manifest, "schemaVersion"),
      lifecycle,
      packetPath,
      status,
    },
    issues,
  ];
};

const legacyTranslationPlan = (
  record: GoalPacketRecord,
  probe: ManifestShapeProbe,
  fields: ManifestFields
): ManifestTranslationPlan => {
  let content = record.manifestText ?? "";
  const needsVersionRewrite = !O.contains(fields.beforeVersion, "initiative-manifest/v2");
  let edits = needsVersionRewrite ? A.of("schemaVersion -> initiative-manifest/v2") : A.empty<string>();
  let drift = needsVersionRewrite
    ? A.of<ManifestTranslation["drift"][number]>("breaking")
    : A.empty<ManifestTranslation["drift"][number]>();
  if (needsVersionRewrite) {
    content = applyJsoncModification({ content, path: ["schemaVersion"], value: "initiative-manifest/v2" });
  }
  let assumptions = A.of(
    TranslationAssumption.make({
      slug: record.slug,
      message: "The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.",
    })
  );
  if (O.isNone(fields.lifecycle) && O.isSome(fields.status)) {
    content = applyJsoncModification({ content, path: ["lifecycle"], value: fields.status.value });
    edits = A.append(edits, "add lifecycle from initiative.status");
    drift = A.append(drift, "additive");
    assumptions = A.append(
      assumptions,
      TranslationAssumption.make({
        slug: record.slug,
        message: "lifecycle is a compatibility mirror of initiative.status, not independent history.",
      })
    );
  }
  if (O.isNone(fields.packetPath)) {
    content = applyJsoncModification({ content, path: ["packetPath"], value: `goals/${record.slug}` });
    edits = A.append(edits, "add packetPath from the scanned directory");
    drift = A.append(drift, "additive");
    assumptions = A.append(
      assumptions,
      TranslationAssumption.make({
        slug: record.slug,
        message: "The scanned goals/<slug> directory is the packet's canonical path.",
      })
    );
  }
  return ManifestTranslationPlan.make({
    probe,
    translation: O.some(
      ManifestTranslation.make({
        slug: record.slug,
        manifestPath: record.manifestPath,
        ...pipe(
          fields.beforeVersion,
          O.map((beforeVersion) => ({ beforeVersion })),
          O.getOrElse(() => ({}))
        ),
        afterVersion: "initiative-manifest/v2",
        drift: A.dedupe(drift),
        edits,
        content: Str.endsWith("\n")(content) ? content : `${content}\n`,
      })
    ),
    issues: A.empty<TranslationIssue>(),
    assumptions,
  });
};

const parsedManifestPlan = (record: GoalPacketRecord, manifest: JsonRecord): ManifestTranslationPlan => {
  const probe = probeManifest(record.slug, manifest);
  const [fields, issues] = inspectManifest(record, manifest, probe);
  const versionIssues = issueWhen(
    record.slug,
    O.isSome(fields.declaredVersion) && !isGoalManifestSchemaVersion(fields.declaredVersion.value),
    "schemaVersion is present but is not a recognized string migration source"
  );
  const allIssues = A.appendAll(issues, versionIssues);
  if (A.isReadonlyArrayNonEmpty(allIssues)) {
    return ManifestTranslationPlan.make({
      probe,
      translation: O.none(),
      issues: allIssues,
      assumptions: A.empty<TranslationAssumption>(),
    });
  }
  const plan =
    O.contains(fields.beforeVersion, "initiative-manifest/v2") && probe.hasLifecycle && probe.hasPacketPath
      ? ManifestTranslationPlan.make({
          probe,
          translation: O.none(),
          issues: A.empty<TranslationIssue>(),
          assumptions: A.empty<TranslationAssumption>(),
        })
      : legacyTranslationPlan(record, probe, fields);
  const candidateText = O.match(plan.translation, {
    onNone: () => record.manifestText,
    onSome: (translation) => translation.content,
  });
  const candidate = candidateText === undefined ? O.none() : parseGoalManifestText(candidateText);
  if (O.isNone(candidate)) {
    return ManifestTranslationPlan.make({
      probe,
      translation: O.none(),
      issues: A.of(issue(record.slug, "translated candidate does not parse as a JSON object")),
      assumptions: A.empty<TranslationAssumption>(),
    });
  }
  const decoded = decodeGoalManifestResult(candidate.value);
  return Result.isFailure(decoded)
    ? ManifestTranslationPlan.make({
        probe,
        translation: O.none(),
        issues: A.of(
          issue(record.slug, `translated candidate does not decode as GoalManifest: ${decoded.failure.message}`)
        ),
        assumptions: A.empty<TranslationAssumption>(),
      })
    : plan;
};

/**
 * Plan one surgical v2 translation from the fields actually present.
 *
 * **Details**
 *
 * The raw JSONC text remains the edit substrate so bespoke keys survive.
 * Declared versions are reported but never select a decoder. Missing identity,
 * status, completion gate, or a contradictory packet path blocks translation.
 *
 * **Example** (Translate a versionless half-migrated manifest)
 *
 * ```ts
 * import { planManifestTranslation } from "@beep/repo-cli/commands/Goals/Migration/ManifestTranslation"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 * import * as O from "effect/Option"
 *
 * const manifest = {
 *   initiative: { id: "demo", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 * }
 * const plan = planManifestTranslation(GoalPacketRecord.make({
 *   slug: "demo",
 *   packetPath: "goals/demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   readmePath: "goals/demo/README.md",
 *   manifestText: JSON.stringify(manifest),
 * }))
 * console.log(O.isSome(plan.translation)) // true
 * ```
 *
 * @param record - Scanned goal packet including raw manifest text.
 * @returns Shape probe, optional translation, and explicit Issues/Assumptions.
 * @category use-cases
 * @since 0.0.0
 */
export const planManifestTranslation = (record: GoalPacketRecord): ManifestTranslationPlan => {
  if (record.manifestText === undefined) return emptyPlan(record.slug, "manifest is missing");
  const parsed = parseGoalManifestText(record.manifestText);
  if (O.isNone(parsed) || !isJsonRecord(parsed.value)) {
    return emptyPlan(record.slug, "manifest does not parse as a JSON object");
  }
  return parsedManifestPlan(record, parsed.value);
};

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
