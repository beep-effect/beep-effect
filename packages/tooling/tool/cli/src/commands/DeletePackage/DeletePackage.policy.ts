/**
 * Pure refusal-policy evaluation for delete-package preflight.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isLabsWorkspacePath } from "@beep/repo-cli-kit/cli/Labs/index";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { DeletePackageRefusal } from "./DeletePackage.schemas.ts";
import type { DeletePackageAcknowledgement, DeletePackagePolicy } from "./DeletePackage.schemas.ts";
import type {
  AcknowledgedOccurrences,
  DependentHit,
  DependentsReport,
  RegistrationObservation,
  RegistrationTarget,
} from "./internal/RegistrationGeometry/index.ts";

const PROTECTED_SLUGS = ["identity", "schema", "utils", "types", "repo-cli", "repo-utils", "repo-configs"];
const HARD_DEPENDENT_KINDS = [
  "manifest-prod",
  "manifest-dev",
  "manifest-peer",
  "manifest-optional",
  "import-prod",
  "import-test",
  "script",
  "file-path",
];

const ACKNOWLEDGEABLE_KINDS = ["file-path", "script"];

const slugOf = (packageName: string): string => Str.replace("@beep/", Str.empty)(packageName);

const refuseWhen = (condition: boolean, refusal: () => DeletePackageRefusal): O.Option<DeletePackageRefusal> =>
  condition ? O.some(refusal()) : O.none();

const isAcknowledgeable = (hit: DependentHit): boolean => A.some(ACKNOWLEDGEABLE_KINDS, Str.equivalence(hit.kind));

const acknowledgementEntries = (policy: DeletePackagePolicy): ReadonlyArray<DeletePackageAcknowledgement> =>
  pipe(
    policy.acknowledgements,
    O.map((acknowledgements) => acknowledgements.entries),
    O.getOrElse(A.empty<DeletePackageAcknowledgement>)
  );

const targetAcknowledgementEntries = (
  report: DependentsReport,
  policy: DeletePackagePolicy
): ReadonlyArray<DeletePackageAcknowledgement> =>
  pipe(
    policy.acknowledgements,
    O.filter((acknowledgements) => Str.equivalence(acknowledgements.target, report.target.packageName)),
    O.map((acknowledgements) => acknowledgements.entries),
    O.getOrElse(A.empty<DeletePackageAcknowledgement>)
  );

const scriptNameEquivalence = O.makeEquivalence(Str.Equivalence);

const entryMatches =
  (entry: DeletePackageAcknowledgement) =>
  (hit: DependentHit): boolean =>
    Str.equivalence(hit.file, entry.path) &&
    scriptNameEquivalence(hit.script, entry.script) &&
    O.exists(hit.text, Str.equivalence(entry.text));

const matchesScriptByTextAlone =
  (entry: DeletePackageAcknowledgement) =>
  (hit: DependentHit): boolean =>
    O.isNone(entry.script) &&
    O.isSome(hit.script) &&
    Str.equivalence(hit.file, entry.path) &&
    O.exists(hit.text, Str.equivalence(entry.text));

const entryKey = (entry: DeletePackageAcknowledgement): string =>
  `${entry.path}\u0000${O.getOrElse(entry.script, () => Str.empty)}\u0000${entry.text}`;

const acknowledgingEntry =
  (entries: ReadonlyArray<DeletePackageAcknowledgement>) =>
  (hit: DependentHit): O.Option<DeletePackageAcknowledgement> =>
    isAcknowledgeable(hit) ? A.findFirst(entries, (entry) => entryMatches(entry)(hit)) : O.none();

const hardDependentHits = (report: DependentsReport, policy: DeletePackagePolicy) => {
  const acknowledging = acknowledgingEntry(targetAcknowledgementEntries(report, policy));
  return A.filter(
    report.hits,
    (hit) => A.some(HARD_DEPENDENT_KINDS, Str.equivalence(hit.kind)) && O.isNone(acknowledging(hit))
  );
};

const hitLocation = (hit: DependentHit): string =>
  `${hit.file}${pipe(
    hit.line,
    O.map((line) => `:${line}`),
    O.orElse(() => O.map(hit.script, (name) => `#${name}`)),
    O.getOrElse(() => Str.empty)
  )}`;

const entryLabel = (entry: DeletePackageAcknowledgement): string =>
  `${entry.path}${pipe(
    entry.script,
    O.map((name) => ` script \`${name}\``),
    O.getOrElse(() => Str.empty)
  )} line \`${entry.text}\``;

const acknowledgementRefusal = (detail: string): DeletePackageRefusal =>
  DeletePackageRefusal.cases.hard.make({ kind: "acknowledgement", detail });

const entryRefusal = (
  report: DependentsReport,
  entry: DeletePackageAcknowledgement
): O.Option<DeletePackageRefusal> => {
  const matched = A.filter(report.hits, entryMatches(entry));
  const label = entryLabel(entry);
  return pipe(
    A.findFirst(matched, (hit) => !isAcknowledgeable(hit)),
    O.map((edge) =>
      acknowledgementRefusal(
        `${label} names the ${edge.kind} hit at ${hitLocation(edge)}; manifest and import edges are never acknowledged.`
      )
    ),
    O.orElse(() =>
      pipe(
        A.findFirst(report.hits, matchesScriptByTextAlone(entry)),
        O.map((scriptHit) =>
          acknowledgementRefusal(
            `${label} names the root script at ${hitLocation(scriptHit)} by its command alone; add its \`script\` name.`
          )
        )
      )
    ),
    O.orElse(() =>
      refuseWhen(A.isReadonlyArrayEmpty(matched), () =>
        acknowledgementRefusal(`${label} matches no current dependent hit; remove the stale acknowledgement.`)
      )
    ),
    O.orElse(() =>
      refuseWhen(A.length(matched) !== entry.occurrences, () =>
        acknowledgementRefusal(
          `${label} matches ${A.length(matched)} hit(s); the acknowledgement declares ${entry.occurrences}.`
        )
      )
    )
  );
};

const duplicateEntryRefusal = (
  entries: ReadonlyArray<DeletePackageAcknowledgement>,
  entry: DeletePackageAcknowledgement,
  index: number
): O.Option<DeletePackageRefusal> =>
  refuseWhen(
    A.findFirstIndex(entries, (other) => Str.equivalence(entryKey(other), entryKey(entry))).pipe(
      O.exists((first) => first !== index)
    ),
    () => acknowledgementRefusal(`${entryLabel(entry)} is listed more than once; merge it into one entry.`)
  );

const acknowledgementRefusals = (
  target: RegistrationTarget,
  report: DependentsReport,
  policy: DeletePackagePolicy
): ReadonlyArray<DeletePackageRefusal> =>
  pipe(
    policy.acknowledgements,
    O.map((acknowledgements) =>
      Str.equivalence(acknowledgements.target, target.packageName)
        ? A.flatMap(acknowledgements.entries, (entry, index) =>
            pipe(
              duplicateEntryRefusal(acknowledgements.entries, entry, index),
              O.orElse(() => entryRefusal(report, entry)),
              O.toArray
            )
          )
        : A.of(
            acknowledgementRefusal(
              `The acknowledgement file names ${acknowledgements.target}, not the resolved target ${target.packageName}.`
            )
          )
    ),
    O.getOrElse(A.empty<DeletePackageRefusal>)
  );

const acknowledgedHitLines = (report: DependentsReport, policy: DeletePackagePolicy): ReadonlyArray<string> =>
  A.flatMap(report.hits, (hit) =>
    pipe(
      acknowledgingEntry(targetAcknowledgementEntries(report, policy))(hit),
      O.map((entry) => `${hit.kind}: ${hit.owner} ${hitLocation(hit)} (${entry.reason})`),
      O.toArray
    )
  );

const decodeScriptLine = S.decodeUnknownOption(S.fromJsonString(S.Record(S.String, S.String)));

const isScriptLine = (text: string, script: string, command: string): boolean =>
  O.exists(decodeScriptLine(`{${Str.endsWith(",")(text) ? Str.slice(0, -1)(text) : text}}`), (scripts) =>
    O.exists(R.get(scripts, script), (value) => Str.equivalence(Str.trim(value), command))
  );

const entryNamesLine = (entry: DeletePackageAcknowledgement, file: string, text: string): boolean =>
  Str.equivalence(entry.path, file) &&
  O.match(entry.script, {
    onNone: () => Str.equivalence(entry.text, text),
    onSome: (script) => isScriptLine(text, script, entry.text),
  });

const acknowledgedOccurrencesFor =
  (policy: DeletePackagePolicy): AcknowledgedOccurrences =>
  (file, text) =>
    Num.sumAll(
      A.map(
        A.filter(acknowledgementEntries(policy), (entry) => entryNamesLine(entry, file, text)),
        (entry) => entry.occurrences
      )
    );

const isRepositoryRootTarget = (target: RegistrationTarget): boolean =>
  Str.isEmpty(target.packagePath) || Str.equivalence(target.packagePath, ".");

const ownedTreeRefusal = (
  target: RegistrationTarget,
  workspacePaths: ReadonlyArray<string>
): O.Option<DeletePackageRefusal> => {
  if (isRepositoryRootTarget(target)) {
    // biome-ignore lint/plugin/prefer-schema-make-option: Fail closed: None reads as a pass here, so a refused input must throw
    return O.some(
      DeletePackageRefusal.cases.hard.make({
        kind: "dependent",
        detail: `${target.packageName} resolves to the repository root; recursive deletion is forbidden.`,
      })
    );
  }

  return pipe(
    A.findFirst(
      workspacePaths,
      (workspacePath) =>
        !Str.equivalence(workspacePath, target.packagePath) && Str.startsWith(`${target.packagePath}/`)(workspacePath)
    ),
    O.map((workspacePath) =>
      DeletePackageRefusal.cases.hard.make({
        kind: "dependent",
        detail: `${target.packageName} contains registered workspace ${workspacePath}; recursive deletion is forbidden.`,
      })
    )
  );
};

type RefusalRule = (
  target: RegistrationTarget,
  report: DependentsReport,
  policy: DeletePackagePolicy
) => O.Option<DeletePackageRefusal>;

const REFUSAL_RULES: ReadonlyArray<RefusalRule> = [
  (_target, report, policy) => {
    const hardHits = hardDependentHits(report, policy);
    return refuseWhen(A.isReadonlyArrayNonEmpty(hardHits), () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "dependent",
        detail: `${A.length(hardHits)} unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.`,
      })
    );
  },
  (target, _report, policy) =>
    refuseWhen(!target.private && !policy.allowPublished, () =>
      DeletePackageRefusal.cases.hard.make({ kind: "published", detail: "private:false requires --allow-published." })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.livePromotionRecord, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "promotion-record",
        detail: "A live shared-kernel promotion record requires the human doctrine-11 retirement process.",
      })
    ),
  (target) =>
    refuseWhen(A.some(PROTECTED_SLUGS, Str.equivalence(slugOf(target.packageName))), () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "protected-slug",
        detail: `${target.packageName} is protected infrastructure.`,
      })
    ),
  (target, _report, policy) =>
    refuseWhen(policy.retiredNameCollision, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "retired-name-collision",
        detail: `${target.packageName} is both live and retired; reconcile name provenance before deletion.`,
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.cascade && !policy.cascadeClosureAllowed, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "cascade-boundary",
        detail: "Cascade closure includes a target outside the allowed explicit set.",
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.skipBaselines && policy.inCi, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "ci-skip-baselines",
        detail: "--skip-baselines is forbidden in CI.",
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.pruneCatalog && !policy.catalogUniquenessProven, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "catalog-uniqueness",
        detail: "--prune-catalog requires proof that no survivor lists the dependency.",
      })
    ),
  (_target, report, policy) =>
    pipe(
      A.findFirst(report.hits, (hit) => Str.equivalence(hit.kind, "packet")),
      O.filter(() => !policy.rewritePackets && !policy.allowStalePackets),
      O.map((packetHit) =>
        DeletePackageRefusal.cases.soft.make({
          kind: "packet-claim",
          detail: `Packet reference remains at ${packetHit.file}; pass --rewrite-packets or --allow-stale-packets.`,
        })
      )
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.dropData && policy.dataConnectionNonLocal && !policy.allowNonLocalData, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "data-non-local",
        detail: "--drop-data against a non-local DATABASE_URL requires --allow-non-local-data.",
      })
    ),
  (_target, _report, policy) =>
    refuseWhen(policy.dataResourceDeclared && !policy.dataOwnershipProven, () =>
      DeletePackageRefusal.cases.hard.make({
        kind: "data-ownership",
        detail:
          "Declared postgres schema is not mechanically derived from the package; no database command was emitted.",
      })
    ),
];

const refusalReasons = (
  target: RegistrationTarget,
  report: DependentsReport,
  policy: DeletePackagePolicy
): ReadonlyArray<DeletePackageRefusal> =>
  A.appendAll(
    A.flatMap(REFUSAL_RULES, (rule) => O.toArray(rule(target, report, policy))),
    acknowledgementRefusals(target, report, policy)
  );

const dependentsCascadeLines = (report: DependentsReport): ReadonlyArray<string> => [
  `direct: ${A.isReadonlyArrayNonEmpty(report.directWorkspaceDependents) ? A.join(report.directWorkspaceDependents, ", ") : "(none)"}`,
  `transitive: ${A.isReadonlyArrayNonEmpty(report.transitiveWorkspaceDependents) ? A.join(report.transitiveWorkspaceDependents, ", ") : "(none)"}`,
  ...A.map(report.hits, (hit) => `${hit.kind}: ${hit.owner} ${hit.file}`),
];

const acceptedConsentObservation = (target: RegistrationTarget, item: RegistrationObservation): boolean =>
  Str.equivalence(item.status, "consent-required") &&
  Str.equivalence(item.surfaceId, "lab-postgres-schema") &&
  isLabsWorkspacePath(target.packagePath);

const doctorIsClean = (target: RegistrationTarget, observations: ReadonlyArray<RegistrationObservation>): boolean =>
  A.every(
    observations,
    (item) =>
      Str.equivalence(item.status, "clean") ||
      Str.equivalence(item.status, "historical") ||
      acceptedConsentObservation(target, item)
  );

/**
 * Evaluate deletion refusals, doctor cleanliness, the dependency cascade, and
 * the `--acknowledge` file.
 *
 * **Details**
 *
 * `refusalReasons` drops every `file-path` or `script` hit an acknowledgement
 * entry matches by path, script name and trimmed text from the hard-dependent
 * count, and refuses an entry that is listed twice, matches a manifest or
 * import edge, names a root script by its command alone, matches no hit, or
 * matches a different number of hits than its `occurrences`, plus a file that
 * names another target. `acknowledgedHitLines` renders the accepted hits with
 * their reasons; `acknowledgedOccurrencesFor` is the same file as the doctor's
 * per-line allowance. `hitLocation` renders a hit as `file:line`, `file#script`
 * for a root script, or the bare file.
 *
 * **Gotchas**
 *
 * - Only `file-path` and `script` hits are acknowledgeable. A manifest or import edge is real
 *   code that breaks when the target goes, so no entry ever accepts one.
 * - A script entry's name and command compare as decoded JSON values, so an escaped name in
 *   `package.json` still matches its entry.
 * - An acknowledged script's `package.json` line stays clean in the doctor after apply, while
 *   any other script naming the target is still residue.
 * - `doctorIsClean` accepts a `consent-required` observation only for the `lab-postgres-schema`
 *   surface on a labs-path target, so any other data resource still blocks the doctor.
 *
 * **Example** (Inspect available policy operations)
 *
 * ```ts
 * import { DeletePackagePolicyEvaluation } from "@beep/repo-cli/commands/DeletePackage"
 *
 * console.log(Object.keys(DeletePackagePolicyEvaluation))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const DeletePackagePolicyEvaluation = {
  acknowledgedHitLines,
  acknowledgedOccurrencesFor,
  dependentsCascadeLines,
  doctorIsClean,
  hitLocation,
  ownedTreeRefusal,
  refusalReasons,
};
