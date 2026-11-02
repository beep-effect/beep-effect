import { $RepoConfigsId } from "@beep/identity";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { NativePathToPosixPath } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as Inspectable from "effect/Inspectable";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { PosixPath } from "../../laws/Shared.ts";

const $I = $RepoConfigsId.create("internal/laws/EffectLawsAllowlistSchemas");

export const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
const DATE_YMD_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const NonEmptyString = S.NonEmptyString;
const DateYmdString = S.String.check(S.isPattern(DATE_YMD_PATTERN));
const ArrayOfStrings = S.Array(S.String);
export class EffectLawsAllowlistEntry extends S.Opaque<EffectLawsAllowlistEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: NonEmptyString,
    file: NativePathToPosixPath,
    kind: NonEmptyString,
    reason: NonEmptyString,
    owner: NonEmptyString,
    issue: NonEmptyString,
    expiresOn: S.OptionFromOptionalKey(DateYmdString).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistEntry", {
      description: "One allowlisted effect-law finding from the standards allowlist artifact.",
    })
  )
) {}

export class EffectLawsAllowlistDocument extends S.Opaque<
  EffectLawsAllowlistDocument,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag(1),
    entries: ArrayKeyDefaultEmpty(EffectLawsAllowlistEntry),
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistDocument", {
      description: "Decoded effect-law allowlist document loaded from JSONC.",
    })
  )
) {}

export class EffectLawsAllowlistSnapshot extends S.Opaque<
  EffectLawsAllowlistSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: PosixPath,
    entries: ArrayKeyDefaultEmpty(EffectLawsAllowlistEntry),
    diagnostics: ArrayOfStrings.pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefaultKey(Effect.succeed(A.empty<string>()))
    ),
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistSnapshot", {
      description: "Generated snapshot of the effect-law allowlist and any schema diagnostics.",
    })
  )
) {
  static readonly decodeResult = S.decodeUnknownResult(EffectLawsAllowlistSnapshot);
  static readonly encodeResult = S.encodeResult(EffectLawsAllowlistSnapshot);
}

export class EffectLawsAllowlistCheckInput extends S.Opaque<
  EffectLawsAllowlistCheckInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ruleId: NonEmptyString,
    filePath: NonEmptyString,
    kind: NonEmptyString,
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistCheckInput", {
      description: "Runtime lookup input checked against the effect-law allowlist snapshot.",
    })
  )
) {
  static readonly decodeOption = S.decodeUnknownOption(EffectLawsAllowlistCheckInput);
}

export class EffectLawsAllowlistLookupKey extends S.Opaque<
  EffectLawsAllowlistLookupKey,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    rule: NonEmptyString,
    file: PosixPath,
    kind: NonEmptyString,
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistLookupKey", {
      description: "Normalized key used to compare effect-law findings with allowlist entries.",
    })
  )
) {
  static readonly equivalence = S.toEquivalence(EffectLawsAllowlistLookupKey);
}

const encodeUnsupported = (transformationName: string) => (): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue({
      message: `Encoding unknown values is not supported by ${transformationName}.`,
    })
  );

// The allowlist's own error text names each recovered parse error as
// `<code>@<offset>:<length>`, the shape the jsonc-parser reading printed.
const parseAllowlistJsonc = (content: string): Effect.Effect<unknown, SchemaIssue.Issue> =>
  Jsonc.parseResult(content).pipe(
    Result.mapError(
      (error) =>
        new SchemaIssue.InvalidValue({
          message: pipe(
            error.errors,
            A.map((detail) => `${detail.code}@${detail.offset}:${detail.length}`),
            A.join(", "),
            (details) => `Allowlist JSONC parse error (${details}).`
          ),
        })
    ),
    Effect.fromResult
  );

export const AllowlistJsoncTextToUnknown = S.String.pipe(
  S.decodeTo(
    S.Unknown,
    SchemaTransformation.transformEffect({
      decode: parseAllowlistJsonc,
      encode: encodeUnsupported("AllowlistJsoncTextToUnknown"),
    })
  ),
  $I.annoteSchema("AllowlistJsoncTextToUnknown", {
    description: "JSONC text transformation that parses allowlist source into unknown data.",
  })
);

const AllowlistJsoncTextToDocument = AllowlistJsoncTextToUnknown.pipe(S.decodeTo(EffectLawsAllowlistDocument));

// unary by contract: a dual is undecidable here because `input` is `unknown`.
export const decodeAllowlistDocumentFromJsoncText: (
  input: unknown
) => Effect.Effect<EffectLawsAllowlistDocument, S.SchemaError> = S.decodeUnknownEffect(AllowlistJsoncTextToDocument);

export const decodeAllowlistCheckInput: (input: unknown) => O.Option<EffectLawsAllowlistCheckInput> =
  EffectLawsAllowlistCheckInput.decodeOption;
export const decodeAllowlistSnapshot = (input: unknown): EffectLawsAllowlistSnapshot =>
  Result.getOrThrow(EffectLawsAllowlistSnapshot.decodeResult(input));
export const encodeAllowlistSnapshot = (
  input: EffectLawsAllowlistSnapshot
): (typeof EffectLawsAllowlistSnapshot)["Encoded"] =>
  Result.getOrThrow(EffectLawsAllowlistSnapshot.encodeResult(input));
export const areLookupKeysEquivalent: {
  (that: EffectLawsAllowlistLookupKey): (self: EffectLawsAllowlistLookupKey) => boolean;
  (self: EffectLawsAllowlistLookupKey, that: EffectLawsAllowlistLookupKey): boolean;
} = dual(2, EffectLawsAllowlistLookupKey.equivalence);

export const formatSchemaDiagnostics = (issue: SchemaIssue.Issue): ReadonlyArray<string> => {
  const formatter = SchemaIssue.makeFormatterStandardSchemaV1();
  return pipe(
    formatter(issue).issues,
    A.map((diagnostic) => {
      const pathLabel = pipe(
        O.fromNullishOr(diagnostic.path),
        O.filter(A.isReadonlyArrayNonEmpty),
        O.map(
          flow(
            A.map((segment) => Inspectable.toStringUnknown(segment, 0)),
            A.join(".")
          )
        ),
        O.getOrElse(() => "<root>")
      );
      return `${pathLabel}: ${diagnostic.message}`;
    })
  );
};

export const toSnapshotDecodeDiagnostics = (cause: unknown): ReadonlyArray<string> =>
  pipe(
    O.fromNullishOr(cause),
    O.filter(S.isSchemaError),
    O.map((value) => formatSchemaDiagnostics(value.issue)),
    O.getOrElse(() => A.make(`Invalid allowlist snapshot payload: ${Inspectable.toStringUnknown(cause, 0)}`))
  );
