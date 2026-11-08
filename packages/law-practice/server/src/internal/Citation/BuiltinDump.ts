/** Native builtin models to source-ordered dump observations, eyecite 2.7.6.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */

import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationDumpFailure, CitationDumpField, CitationDumpRow, CitationDumpScalar } from "./Dump.ts";
import { CitationExtractionLoopModel } from "./ExtractionLoop.ts";
import { projectCitationExtractionSelection } from "./ExtractionSelection.ts";
import { makeCitationNativeRendering } from "./NativeRendering.ts";
import type { CitationTokenSeed } from "@beep/law-practice-use-cases/server";

const invalid = () => CitationDumpFailure.make({ reason: "invalid-input" });
const configuration = () => CitationDumpFailure.make({ reason: "invalid-configuration" });
const Profile = S.Struct({
  schemaVersion: S.tag("citation-builtin-dump-profile/v1"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  classes: S.Array(S.Struct({ kind: S.String, metadata: S.Array(S.String), year: S.Boolean })).check(
    S.isBetweenLength(8, 8)
  ),
}).pipe(S.fromJsonString);
const Input = S.toType(CitationExtractionLoopModel);
const Metadata = S.toType(S.Record(S.String, S.Union([S.Null, CitationPythonUnicodeStorage, S.Int])));
const scalar = (value: CitationTokenSeed["groups"][string] | number): CitationDumpScalar =>
  value === null
    ? CitationDumpScalar.cases.None.make({})
    : typeof value === "number"
      ? CitationDumpScalar.cases.Integer.make({ value })
      : CitationDumpScalar.cases.Text.make({ value: CitationPythonUnicodeStorage.make(value) });
/** Capture original dataclass field order, then project actual native parser models.
 * Raw pin coordinates are retained here rather than inferred from semantic Citation
 * or derived min/max anchors. This adapter issues no proof or model identity.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationBuiltinDump = Effect.fn("Citation.makeBuiltinDump")(function* (policy: unknown, raw: unknown) {
  const text = yield* S.decodeUnknownEffect(ProfileText)(raw).pipe(Effect.mapError(configuration));
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
    Effect.mapError(configuration)
  );
  if (digest !== "9054c6bfa1d5095991daf5c5644858db3715e1cedfef96a931c561e9e88e7944") return yield* configuration();
  const profile = yield* S.decodeEffect(Profile)(text).pipe(Effect.mapError(configuration));
  const context = yield* makeCitationNativeRendering(policy, () =>
    CitationDumpFailure.make({ reason: "invalid-policy" })
  );
  const { timing, unicode } = context;

  const classes = HashMap.fromIterable(A.map(profile.classes, (row) => Tuple.make(row.kind, row)));
  if (HashMap.size(classes) !== 8) return yield* configuration();
  const project = Effect.fn("Citation.projectBuiltinDump")(function* (input: unknown) {
    const model = yield* S.decodeUnknownEffect(Input)(input).pipe(Effect.mapError(invalid));
    const budget = yield* context.budget;
    const label = Effect.fnUntraced(function* (value: string) {
      return (yield* unicode.fromTextReserved(value, budget.reserve)).storage;
    });

    const state = "outcome" in model ? model.outcome : model;
    const selection = yield* projectCitationExtractionSelection(0, model).pipe(Effect.mapError(invalid));
    const declaration = yield* Effect.fromOption(HashMap.get(classes, selection.kind), invalid);
    const metadata = yield* S.decodeUnknownEffect(Metadata)(state.metadata).pipe(Effect.mapError(invalid));
    const entries = yield* Effect.forEach(
      declaration.metadata,
      Effect.fnUntraced(function* (name) {
        const value = yield* Effect.fromOption(R.get(metadata, Str.snakeToCamel(name)), invalid);
        if (value === null) return O.none();
        const nativeName = yield* label(name);
        return O.some({ name: nativeName, value: scalar(value) });
      })
    );
    const groups = yield* Effect.forEach(
      R.toEntries(model.token.groups),
      Effect.fnUntraced(function* ([name, value]) {
        const nativeName = yield* label(name);
        return { name: nativeName, value: scalar(value) };
      })
    );
    const fields = [
      CitationDumpField.cases.Fields.make({ name: "groups", entries: groups }),
      CitationDumpField.cases.Fields.make({ name: "metadata", entries: A.getSomes(entries) }),
    ];
    if (!declaration.year) return CitationDumpRow.make({ kind: selection.kind, span: selection.span, fields });
    if (!("year" in state)) return yield* invalid();
    const year =
      state.year === null ? null : yield* S.decodeEffect(S.Int)(Number(state.year)).pipe(Effect.mapError(invalid));
    return CitationDumpRow.make({
      kind: selection.kind,
      span: selection.span,
      fields: A.append(fields, CitationDumpField.cases.Scalar.make({ name: "year", value: scalar(year) })),
    });
  }, timing.timed);
  const projectClosed: (input: unknown) => Effect.Effect<CitationDumpRow, Effect.Error<ReturnType<typeof project>>> =
    project;
  return { project: projectClosed };
});

const ProfileText = S.String.check(S.isMaxLength(32768));
