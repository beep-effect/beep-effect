/**
 * Typed pins of the W8 KPI reading (S7 contract §9; launch sitting Rulings 5 and 8).
 *
 * **Details**
 *
 * The `run4-fleet` manifest and canonical admission journal, the 2026-10-01
 * redacted snapshot projection, the change-event ledger and the committed
 * adoption table, each by repo-relative path and SHA-256. The evidence script,
 * the adoption-table generator and the end-to-end tests share these values;
 * the service checks every digest over the raw bytes before decoding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import { changeEventLedgerSha256 } from "./ChangeEvents.ts";
import { KpiReadingInput, PinnedKpiInput } from "./Schemas.ts";
import type { RepoRelativePath } from "../projection/Schemas.ts";

const run4FleetPin = "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet";

/**
 * Repo-relative paths of the KPI reading's committed outputs and its adoption table.
 *
 * **Example** (Read the reading's JSON path)
 *
 * ```ts
 * import { kpiOutputPaths } from "@/kpi/Pins"
 *
 * console.log(kpiOutputPaths.readingJson) // "goals/ciops-ontology-pipeline/research/kpi-reading.json"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const kpiOutputPaths: {
  readonly adoptionTable: RepoRelativePath;
  readonly readingJson: RepoRelativePath;
  readonly readingMarkdown: RepoRelativePath;
} = {
  adoptionTable: "goals/ciops-ontology-pipeline/research/kpi-adoption-table.json",
  readingJson: "goals/ciops-ontology-pipeline/research/kpi-reading.json",
  readingMarkdown: "goals/ciops-ontology-pipeline/research/kpi-reading.md",
};

/**
 * The four source pins the fold and the adoption-table probes read (every role but `adoption-table`).
 *
 * **Example** (Count the source pins)
 *
 * ```ts
 * import { kpiSourcePins } from "@/kpi/Pins"
 *
 * console.log(kpiSourcePins.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const kpiSourcePins: A.NonEmptyReadonlyArray<PinnedKpiInput> = [
  PinnedKpiInput.make({
    role: "fleet-manifest",
    path: `${run4FleetPin}/MANIFEST.yaml`,
    sha256: Sha256Hex.make("7d22f37b879ce6e43d6dc41c5c388ea53f837e07abf1c2ad4e5a21cfeda5be6c"),
  }),
  PinnedKpiInput.make({
    role: "fleet-admission-journal",
    path: `${run4FleetPin}/admission/canonical/journal.ndjson`,
    sha256: Sha256Hex.make("b691253cee4b7859dea4b3b40f339dfd7c68c6cbdfc0326e594230a6aac5df6d"),
  }),
  PinnedKpiInput.make({
    role: "admission-snapshot",
    path: "explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/journal.redacted.ndjson",
    sha256: Sha256Hex.make("8cceaf17163669f5ec031624ebcffeeb8ea0c56281f2f1a29180ea7c04134762"),
  }),
  PinnedKpiInput.make({
    role: "change-event-ledger",
    path: "explorations/beep-ci-operational-ontology/research/control-interventions.yaml",
    sha256: changeEventLedgerSha256,
  }),
];

/**
 * SHA-256 of the committed adoption table the reading consumes.
 *
 * **Example** (Read the table digest prefix)
 *
 * ```ts
 * import { adoptionTableSha256 } from "@/kpi/Pins"
 *
 * console.log(adoptionTableSha256.length) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const adoptionTableSha256: Sha256Hex = Sha256Hex.make(
  "c57f8a33501e6064c943e48a94f2a077d12f49908092c2482b6310e0d7acdee6"
);

/**
 * Builds a reading request over the KPI pins under one repo root.
 *
 * **Details**
 *
 * `repoRoot` locates the checkout (scripts run from the package directory use
 * `../../..`); the adoption-table pin is appended after the four source pins.
 *
 * **Example** (Build the reading request from the package directory)
 *
 * ```ts
 * import { kpiReadingInput } from "@/kpi/Pins"
 *
 * console.log(kpiReadingInput("../../..").inputs.length) // 5
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const kpiReadingInput = (repoRoot: string): KpiReadingInput =>
  KpiReadingInput.make({
    repoRoot,
    inputs: A.append(
      kpiSourcePins,
      PinnedKpiInput.make({ role: "adoption-table", path: kpiOutputPaths.adoptionTable, sha256: adoptionTableSha256 })
    ),
  });
