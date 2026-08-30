/**
 * Decoded public court/reporter artifacts and ambiguity-preserving lookups.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CourtsVocabularyData } from "../../internal/generated/free-law-project/courts-vocabulary.ts";
import { ReportersVocabularyData } from "../../internal/generated/free-law-project/reporters-vocabulary.ts";
import { CourtReporterCompatibilityPolicy } from "./CourtReporterVocabulary.compatibility.ts";
import {
  CourtReporterArtifactContract,
  CourtVocabularyArtifact,
  ReporterVocabularyArtifact,
} from "./CourtReporterVocabulary.model.ts";
import type { CourtId, ReporterId } from "./CourtReporterVocabulary.model.ts";

/**
 * Schema-decoded pinned courts-db public vocabulary.
 *
 * **Example** (Inspect the stable court count)
 *
 * ```ts
 * import { CourtVocabulary } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtVocabulary.stableIdCount) // 2809
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CourtVocabulary = S.decodeUnknownSync(CourtVocabularyArtifact)(CourtsVocabularyData);

/**
 * Schema-decoded pinned reporters-db public vocabulary.
 *
 * **Example** (Inspect the stable reporter count)
 *
 * ```ts
 * import { ReporterVocabulary } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(ReporterVocabulary.stableIdCount) // 1262
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReporterVocabulary = S.decodeUnknownSync(ReporterVocabularyArtifact)(ReportersVocabularyData);

/**
 * Combined exact-version artifact consumed by citation parsing integrations.
 *
 * **Example** (Read the pinned integration version)
 *
 * ```ts
 * import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtReporterArtifact.artifactVersion.startsWith("crv1:")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CourtReporterArtifact = CourtReporterArtifactContract.make({
  schemaVersion: CourtVocabulary.schemaVersion,
  projectionVersion: CourtVocabulary.projectionVersion,
  artifactVersion: CourtVocabulary.artifactVersion,
  policy: CourtReporterCompatibilityPolicy,
  courts: CourtVocabulary,
  reporters: ReporterVocabulary,
});

/**
 * Checks whether a consumer was built for the exact pinned artifact.
 *
 * **Gotchas**
 *
 * Lifecycle compatibility supports review between releases; runtime citation
 * parsing still fails closed unless the consumer declares the exact version.
 *
 * **Example** (Gate a citation parser)
 *
 * ```ts
 * import {
 *   CourtReporterArtifact,
 *   isCurrentCourtReporterArtifactVersion,
 * } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(isCurrentCourtReporterArtifactVersion(CourtReporterArtifact.artifactVersion)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isCurrentCourtReporterArtifactVersion = (version: string): boolean =>
  version === CourtReporterArtifact.artifactVersion;

const courtsById = pipe(
  CourtVocabulary.records,
  A.map((court) => [court.id, court] as const),
  R.fromEntries
);

const reportersById = pipe(
  ReporterVocabulary.records,
  A.map((reporter) => [reporter.id, reporter] as const),
  R.fromEntries
);

const courtsByAlias = pipe(
  CourtVocabulary.records,
  A.flatMap((court) =>
    pipe(
      court.aliases,
      A.appendAll(A.map(court.contextualAliases, (entry) => entry.alias)),
      A.map((alias) => [alias, court] as const)
    )
  ),
  A.groupBy(([alias]) => alias),
  R.map(A.map(([, court]) => court))
);

const reportersByAlias = pipe(
  ReporterVocabulary.records,
  A.flatMap((reporter) =>
    pipe(
      reporter.aliases,
      A.appendAll(A.map(reporter.contextualAliases, (entry) => entry.alias)),
      A.map((alias) => [alias, reporter] as const)
    )
  ),
  A.groupBy(([alias]) => alias),
  R.map(A.map(([, reporter]) => reporter))
);

/**
 * Looks up one court by its stable public identity.
 *
 * **Example** (Resolve the federal circuit)
 *
 * ```ts
 * import { CourtId, findCourtById } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isSome(findCourtById(S.decodeUnknownSync(CourtId)("cafc")))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findCourtById = (id: CourtId) => R.get(courtsById, id);

/**
 * Looks up one reporter by its stable public identity.
 *
 * **Example** (Handle an unknown identity)
 *
 * ```ts
 * import { ReporterId, findReporterById } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isNone(findReporterById(S.decodeUnknownSync(ReporterId)("reporter:missing")))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findReporterById = (id: ReporterId) => R.get(reportersById, id);

/**
 * Returns every court owning an alias instead of collapsing ambiguity.
 *
 * **Example** (Search by citation string)
 *
 * ```ts
 * import { findCourtsByAlias } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(findCourtsByAlias("Ala.").length > 0) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findCourtsByAlias = (alias: string) =>
  pipe(R.get(courtsByAlias, alias), O.getOrElse(A.empty<(typeof CourtVocabulary.records)[number]>));

/**
 * Returns every reporter owning an abbreviation or variation.
 *
 * **Gotchas**
 *
 * Reused abbreviations intentionally return more than one result. Consumers
 * must apply court and date context rather than taking the first match.
 *
 * **Example** (Preserve reused abbreviations)
 *
 * ```ts
 * import { findReportersByAlias } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(findReportersByAlias("Woolw.").length) // 2
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const findReportersByAlias = (alias: string) =>
  pipe(R.get(reportersByAlias, alias), O.getOrElse(A.empty<(typeof ReporterVocabulary.records)[number]>));
