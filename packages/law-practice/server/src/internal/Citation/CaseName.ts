/** Default find_case_name composition adapted from eyecite 2.7.6 helpers.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  CitationCaseNameProcessConfiguration,
  CitationCaseNameProcessInput,
  CitationCaseNameProcessPatch,
  citationUnchangedCaseNamePatch,
  installCitationCaseNameProcess,
  verifyCitationCaseNameProcessConfiguration,
} from "./CaseNameProcess.ts";
import {
  CitationCaseNameScanConfiguration,
  CitationCaseNameScanFailure,
  CitationCaseNameScanInput,
  CitationCaseNameScanState,
  installCitationCaseNameScan,
  verifyCitationCaseNameScanConfiguration,
} from "./CaseNameScan.ts";
import { ownedField } from "./ConfigurationOwnership.ts";
import { makeCitationMetadataStage, ownCitationStageCall } from "./MetadataComposition.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import type { CitationOwned } from "./ConfigurationOwnership.ts";
import type { CitationNativeProcessRuntime } from "./NativeProcess.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CaseName");
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameConfiguration extends S.Opaque<
  CitationCaseNameConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({ scan: CitationCaseNameScanConfiguration, process: CitationCaseNameProcessConfiguration }).pipe(
    $I.annoteSchema("CitationCaseNameConfiguration", {
      description: "Captured original scan and processing programs; not request configuration.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameInput extends S.Opaque<CitationCaseNameInput, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CitationCaseNameScanInput.fields,
    spanStart: CitationCaseNameProcessInput.fields.spanStart,
    short: S.Boolean,
  }).pipe(
    $I.annoteSchema("CitationCaseNameInput", {
      description:
        "Original built-in words and citation position before default initialization and conditional processing.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationCaseNameResult extends S.Opaque<CitationCaseNameResult, { readonly brand: unique symbol }>()(
  S.Struct({ state: CitationCaseNameScanState, patch: CitationCaseNameProcessPatch, reservedUnits: S.Natural }).pipe(
    $I.annoteSchema("CitationCaseNameResult", {
      description: "Complete source search state and assigned metadata under one captured invocation authority.",
    })
  )
) {}
const noneText = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([78, 111, 110, 101]) });
/** Project the built-in None token spelling without changing native text values.
 * @internal @category utilities @since 0.0.0
 */
export const citationCaseNameWordText = (data: CitationPythonUnicodeStorage | null) =>
  data === null ? noneText : data;
const CaseNameInputValue = S.toType(CitationCaseNameInput).pipe(
  $I.annoteSchema("CaseNameInputValue", {
    description: "Captured static boundary codec for bounded citation processing.",
  })
);
/** Run the built-in name helper inside an existing captured operation.
 * @internal @category operations @since 0.0.0
 */
export const installCitationPlainCaseName = Effect.fn("Citation.installPlainCaseName")(function* (
  limits: CitationEngineLimits,
  runtime: CitationNativeProcessRuntime,
  config: CitationCaseNameConfiguration
) {
  const scan = yield* installCitationCaseNameScan(limits, runtime, config.scan);
  const processName = yield* installCitationCaseNameProcess(limits, runtime, config.process);
  return Effect.fn("Citation.findPlainCaseName")(function* (raw: unknown) {
    const request = yield* S.decodeUnknownEffect(CaseNameInputValue)(raw).pipe(
      Effect.mapError(() => CitationCaseNameScanFailure.make({ reason: "invalid-input" }))
    );
    const state = yield* scan(request).pipe(
      Effect.catchTag("CitationCaseNamePredicateFailure", () =>
        Effect.fail(CitationCaseNameScanFailure.make({ reason: "empty-word" }))
      )
    );
    if (state.candidateCaseName === null || state.candidateCaseName.bytes.length === 0)
      return { state, patch: citationUnchangedCaseNamePatch };
    let hasV = false;
    if (state.vTokenIndex !== null) {
      const word = yield* Effect.fromOption(A.get(request.words, state.vTokenIndex), () =>
        CitationCaseNameScanFailure.make({ reason: "index-out-of-range" })
      );
      if (word.data === null) return yield* CitationCaseNameScanFailure.make({ reason: "invalid-token-length" });
      hasV = word.data.bytes.length !== 0;
    }
    const patch = yield* processName({
      words: A.map(request.words, (word) => citationCaseNameWordText(word.data)),
      index: request.index,
      spanStart: request.spanStart,
      short: request.short,
      candidateCaseName: state.candidateCaseName,
      hasV,
      startIndex: state.startIndex,
      preCiteYear: state.preCiteYear,
    });
    return { state, patch };
  });
});
/** Authenticate owned helper configuration for enclosing metadata composition.
 * @internal @category operations @since 0.0.0
 */
export const verifyCitationCaseNameConfiguration = Effect.fn("Citation.ownCaseNameConfiguration")(function* (
  limits: CitationEngineLimits,
  config: CitationOwned<CitationCaseNameConfiguration>
) {
  const scan = yield* verifyCitationCaseNameScanConfiguration(limits, ownedField(config, "scan"));
  const process = yield* verifyCitationCaseNameProcessConfiguration(limits, ownedField(config, "process"));
  return CitationCaseNameConfiguration.make({ scan, process });
});
const ownPlainCaseName = ownCitationStageCall({
  verify: verifyCitationCaseNameConfiguration,
  install: installCitationPlainCaseName,
});
/** Both phases share operation admission, deadline, native Scope and text budget;
 * each invocation initializes fresh source state and extract requires R=never.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationCaseName = makeCitationMetadataStage({
  method: "extract",
  own: ownPlainCaseName,
  prepare: (_limits, _runtime, run: Effect.Success<ReturnType<typeof ownPlainCaseName>>, raw) => run(raw),
  project: (result, reservedUnits) => CitationCaseNameResult.make({ ...result, reservedUnits }),
});
