/**
 * Generated `researchReports` projection of a goal packet's `research/` directory.
 *
 * **Details**
 *
 * A hand-maintained list of the files in a directory is a projection of that
 * directory, and hand-appending to it is how eleven sibling PRs conflicted at
 * once on 2026-11-04 (every lane appended one `research/<file>` row at the same
 * tail position of `ops/manifest.json`). This module owns the pure core that
 * `beep goals manifest --write` and the `research-reports-drift` doctor finding
 * share: the projection of a file listing, the drift diff against a manifest's
 * current array, and the comment-preserving JSONC rewrite that lands the
 * projection. Entries that name anything outside `research/` are not part of
 * the projection; the writer moves them to the hand-maintained
 * `researchReferences` key so no pointer is lost.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli-kit/cli/Jsonc";
import { A, O, pipe, Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isGoalResearchReportPath } from "./Goals.schemas.ts";
import { isJsonRecord, parseGoalManifestText } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/ManifestProjection");

/**
 * Manifest key that holds the generated `research/` projection.
 *
 * **Example** (Read the projected key name)
 *
 * ```ts
 * import { RESEARCH_REPORTS_KEY } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * console.log(RESEARCH_REPORTS_KEY) // "researchReports"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RESEARCH_REPORTS_KEY = "researchReports";

/**
 * Manifest key that holds hand-maintained pointers to research outside the packet.
 *
 * **Example** (Read the references key name)
 *
 * ```ts
 * import { RESEARCH_REFERENCES_KEY } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * console.log(RESEARCH_REFERENCES_KEY) // "researchReferences"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const RESEARCH_REFERENCES_KEY = "researchReferences";

const sortedUnique = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(paths, A.dedupe, A.sort(Order.String));

const sameList = A.makeEquivalence(Str.Equivalence);

/**
 * Projects a packet's `research/` file listing onto the `researchReports` array.
 *
 * **Details**
 *
 * Keeps every packet-relative path that {@link isGoalResearchReportPath}
 * admits (inside `research/`, no dot-leading segment, so `.gitkeep` and
 * `research/.scratch/**` are hidden), deduplicates, and sorts by code point
 * so two checkouts always render the same bytes.
 *
 * **Example** (Project a listing)
 *
 * ```ts
 * import { projectResearchReports } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * console.log(
 *   projectResearchReports(["research/b.md", "research/.gitkeep", "research/a/x.json", "research/b.md"])
 * ) // ["research/a/x.json", "research/b.md"]
 * ```
 *
 * @param files - Packet-relative `research/...` paths of the regular files on disk.
 * @returns The sorted, deduplicated projection.
 * @category projections
 * @since 0.0.0
 */
export const projectResearchReports = (files: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(files, A.filter(isGoalResearchReportPath), sortedUnique);

/**
 * How one manifest's `researchReports` differs from its `research/` projection.
 *
 * **Details**
 *
 * `missing` are listed `research/` paths with no file on disk, `unlisted` are
 * files on disk the array does not name, `references` are listed entries that
 * point outside `research/` (the writer moves them to `researchReferences`),
 * and `reordered` is set when the two sets agree but the order or
 * duplication does not.
 *
 * **Example** (Construct a drift record)
 *
 * ```ts
 * import { ResearchReportsDrift } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * const drift = ResearchReportsDrift.make({
 *   missing: [],
 *   unlisted: ["research/review-2026-11-04.json"],
 *   references: [],
 *   reordered: false,
 * })
 * console.log(drift.unlisted.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResearchReportsDrift extends S.Opaque<ResearchReportsDrift, { readonly brand: unique symbol }>()(
  S.Struct({
    missing: S.Array(S.String),
    unlisted: S.Array(S.String),
    references: S.Array(S.String),
    reordered: S.Boolean,
  }).pipe(
    $I.annoteSchema("ResearchReportsDrift", {
      description: "Difference between a manifest's researchReports array and its research/ projection.",
    })
  )
) {}

/**
 * Diffs a manifest's current `researchReports` against the projection.
 *
 * **Example** (A stale append)
 *
 * ```ts
 * import { diffResearchReports } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 * import * as O from "effect/Option"
 *
 * const drift = diffResearchReports(["research/SOURCES.md", "../../explorations/x/RESEARCH.md"], [
 *   "research/SOURCES.md",
 *   "research/review.json",
 * ])
 * console.log(O.isSome(drift)) // true
 * console.log(diffResearchReports(["research/SOURCES.md"], ["research/SOURCES.md"])) // none
 * ```
 *
 * @param listed - The manifest's current array (`undefined` when the key is absent).
 * @param expected - The projection from {@link projectResearchReports}.
 * @returns `None` when the array already equals the projection byte for byte.
 * @category projections
 * @since 0.0.0
 */
export const diffResearchReports: {
  (expected: ReadonlyArray<string>): (listed: ReadonlyArray<string> | undefined) => O.Option<ResearchReportsDrift>;
  (listed: ReadonlyArray<string> | undefined, expected: ReadonlyArray<string>): O.Option<ResearchReportsDrift>;
} = dual(
  2,
  (listed: ReadonlyArray<string> | undefined, expected: ReadonlyArray<string>): O.Option<ResearchReportsDrift> => {
    const current = listed ?? A.empty<string>();
    if (sameList(current, expected)) return O.none();
    const inside = A.filter(current, isGoalResearchReportPath);
    const references = A.filter(current, P.not(isGoalResearchReportPath));
    const missing = sortedUnique(A.difference(inside, expected));
    const unlisted = sortedUnique(A.difference(expected, inside));
    return O.some(
      ResearchReportsDrift.make({
        missing,
        unlisted,
        references: sortedUnique(references),
        reordered:
          A.isReadonlyArrayEmpty(missing) && A.isReadonlyArrayEmpty(unlisted) && A.isReadonlyArrayEmpty(references),
      })
    );
  }
);

/**
 * Renders a drift as one line for doctor and `--check` output.
 *
 * **Example** (Render a drift)
 *
 * ```ts
 * import { renderResearchReportsDrift, ResearchReportsDrift } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * console.log(
 *   renderResearchReportsDrift(
 *     ResearchReportsDrift.make({ missing: ["research/gone.md"], unlisted: [], references: [], reordered: false })
 *   )
 * ) // "researchReports drifts from research/: -1 missing (research/gone.md)"
 * ```
 *
 * @param drift - The drift from {@link diffResearchReports}.
 * @returns One line naming the unlisted, missing and out-of-tree entries with capped samples.
 * @category formatting
 * @since 0.0.0
 */
export const renderResearchReportsDrift = (drift: ResearchReportsDrift): string => {
  const sample = (paths: ReadonlyArray<string>): string =>
    pipe(A.take(paths, 3), A.join(", "), (shown) =>
      A.length(paths) > 3 ? `${shown}, +${A.length(paths) - 3} more` : shown
    );
  const parts = A.getSomes([
    A.isReadonlyArrayNonEmpty(drift.unlisted)
      ? O.some(`+${A.length(drift.unlisted)} unlisted (${sample(drift.unlisted)})`)
      : O.none(),
    A.isReadonlyArrayNonEmpty(drift.missing)
      ? O.some(`-${A.length(drift.missing)} missing (${sample(drift.missing)})`)
      : O.none(),
    A.isReadonlyArrayNonEmpty(drift.references)
      ? O.some(`${A.length(drift.references)} outside research/ (${sample(drift.references)})`)
      : O.none(),
    drift.reordered ? O.some("unsorted or duplicated entries") : O.none(),
  ]);
  return `researchReports drifts from research/: ${A.join(parts, "; ")}`;
};

/**
 * Reads a manifest's current string array at one top-level key.
 *
 * **Example** (Read the listed reports)
 *
 * ```ts
 * import { listedManifestStrings } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * console.log(listedManifestStrings({ researchReports: ["research/a.md", 1] }, "researchReports")) // ["research/a.md"]
 * console.log(listedManifestStrings({}, "researchReports")) // undefined
 * ```
 *
 * @param raw - The parsed manifest object.
 * @param key - The top-level key to read.
 * @returns The string members of the array at `key`, or `undefined` when the key is absent or not an array.
 * @category getters
 * @since 0.0.0
 */
export const listedManifestStrings: {
  (key: string): (raw: Readonly<Record<string, unknown>>) => ReadonlyArray<string> | undefined;
  (raw: Readonly<Record<string, unknown>>, key: string): ReadonlyArray<string> | undefined;
} = dual(2, (raw: Readonly<Record<string, unknown>>, key: string): ReadonlyArray<string> | undefined => {
  const value = raw[key];
  return A.isArray(value) ? A.filter(value, P.isString) : undefined;
});

/**
 * Rewrites a manifest text so `researchReports` equals the projection.
 *
 * **Details**
 *
 * Applies at most two comment-preserving JSONC edits: `researchReports` is set
 * to `expected` (deleted when the projection is empty) and every listed entry
 * outside `research/` joins `researchReferences`, which stays sorted and
 * deduplicated and is only written when it has members. A key the manifest
 * never had is appended after its last property; `biome format` then settles
 * line breaks, which is why the writer formats what it wrote.
 *
 * **Example** (Land a projection)
 *
 * ```ts
 * import { planResearchProjection } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 * import * as O from "effect/Option"
 *
 * const text = '{\n  "researchReports": ["research/SOURCES.md", "history/p1.md"]\n}\n'
 * const next = planResearchProjection(text, ["research/SOURCES.md", "research/review.json"])
 * console.log(O.isSome(next)) // true
 * console.log(O.isNone(planResearchProjection('{\n  "researchReports": ["research/a.md"]\n}\n', ["research/a.md"]))) // true
 * ```
 *
 * @param manifestText - The manifest's current JSON text.
 * @param expected - The projection from {@link projectResearchReports}.
 * @returns The rewritten text, or `None` when nothing would change or the text is not a JSON object.
 * @category projections
 * @since 0.0.0
 */
export const planResearchProjection: {
  (expected: ReadonlyArray<string>): (manifestText: string) => O.Option<string>;
  (manifestText: string, expected: ReadonlyArray<string>): O.Option<string>;
} = dual(2, (manifestText: string, expected: ReadonlyArray<string>): O.Option<string> => {
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed) || !isJsonRecord(parsed.value)) return O.none();
  const raw = parsed.value;
  const listed = listedManifestStrings(raw, RESEARCH_REPORTS_KEY);
  const drift = diffResearchReports(listed, expected);
  if (O.isNone(drift)) return O.none();
  const existingReferences = listedManifestStrings(raw, RESEARCH_REFERENCES_KEY) ?? A.empty<string>();
  const references = sortedUnique(A.appendAll(existingReferences, drift.value.references));
  const edits: ReadonlyArray<{ readonly path: string; readonly value: unknown }> = A.getSomes([
    O.some({
      path: RESEARCH_REPORTS_KEY,
      value: A.isReadonlyArrayEmpty(expected) ? undefined : expected,
    }),
    A.isReadonlyArrayNonEmpty(references) && !sameList(references, existingReferences)
      ? O.some({ path: RESEARCH_REFERENCES_KEY, value: references })
      : O.none(),
  ]);
  const next = A.reduce(edits, manifestText, (content, edit) =>
    applyJsoncModification(JsoncModification.make({ content, path: [edit.path], value: edit.value }))
  );
  return Str.isEmpty(next) ? O.none() : O.some(next);
});
