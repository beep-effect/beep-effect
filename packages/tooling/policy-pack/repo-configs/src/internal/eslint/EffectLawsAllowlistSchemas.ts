import { $RepoConfigsId } from "@beep/identity";
import { NativePathToPosixPath, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, flow, Inspectable, pipe, Result, SchemaIssue, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parse, printParseErrorCode } from "jsonc-parser";
import { PosixPath } from "../../eslint/Shared.ts";
import type { ParseError } from "jsonc-parser";

const $I = $RepoConfigsId.create("internal/eslint/EffectLawsAllowlistSchemas");

export const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
const DATE_YMD_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const NonEmptyString = S.NonEmptyString;
const DateYmdString = S.String.check(S.isPattern(DATE_YMD_PATTERN));
const ArrayOfStrings = S.Array(S.String);
export class EffectLawsAllowlistEntry extends S.Class<EffectLawsAllowlistEntry>($I`EffectLawsAllowlistEntry`)(
  {
    rule: NonEmptyString,
    file: NativePathToPosixPath,
    kind: NonEmptyString,
    reason: NonEmptyString,
    owner: NonEmptyString,
    issue: NonEmptyString,
    expiresOn: S.OptionFromOptionalKey(DateYmdString).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("EffectLawsAllowlistEntry", {
    description: "One allowlisted effect-law finding from the standards allowlist artifact.",
  })
) {}

export class EffectLawsAllowlistDocument extends S.Class<EffectLawsAllowlistDocument>($I`EffectLawsAllowlistDocument`)(
  {
    version: S.Literal(1),
    entries: S.Array(EffectLawsAllowlistEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectLawsAllowlistEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<(typeof EffectLawsAllowlistEntry)["Encoded"]>()))
    ),
  },
  $I.annote("EffectLawsAllowlistDocument", {
    description: "Decoded effect-law allowlist document loaded from JSONC.",
  })
) {}

export class EffectLawsAllowlistSnapshot extends S.Class<EffectLawsAllowlistSnapshot>($I`EffectLawsAllowlistSnapshot`)(
  {
    path: PosixPath,
    entries: S.Array(EffectLawsAllowlistEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectLawsAllowlistEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<(typeof EffectLawsAllowlistEntry)["Encoded"]>()))
    ),
    diagnostics: ArrayOfStrings.pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("EffectLawsAllowlistSnapshot", {
    description: "Generated snapshot of the effect-law allowlist and any schema diagnostics.",
  })
) {
  static readonly decodeResult = S.decodeUnknownResult(EffectLawsAllowlistSnapshot);
  static readonly encodeResult = S.encodeResult(EffectLawsAllowlistSnapshot);
}

export class EffectLawsAllowlistCheckInput extends S.Class<EffectLawsAllowlistCheckInput>(
  $I`EffectLawsAllowlistCheckInput`
)(
  {
    ruleId: NonEmptyString,
    filePath: NonEmptyString,
    kind: NonEmptyString,
  },
  $I.annote("EffectLawsAllowlistCheckInput", {
    description: "Runtime lookup input checked against the effect-law allowlist snapshot.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(EffectLawsAllowlistCheckInput);
}

export class EffectLawsAllowlistLookupKey extends S.Class<EffectLawsAllowlistLookupKey>(
  $I`EffectLawsAllowlistLookupKey`
)(
  {
    rule: NonEmptyString,
    file: PosixPath,
    kind: NonEmptyString,
  },
  $I.annote("EffectLawsAllowlistLookupKey", {
    description: "Normalized key used to compare effect-law findings with allowlist entries.",
  })
) {
  static readonly equivalence = S.toEquivalence(EffectLawsAllowlistLookupKey);
}

const toInvalidValueIssue = (actual: unknown, message: string): SchemaIssue.Issue =>
  new SchemaIssue.InvalidValue(O.some(actual), { message });

const encodeUnsupported =
  (transformationName: string) =>
  (value: unknown): Effect.Effect<string, SchemaIssue.Issue> =>
    Effect.fail(toInvalidValueIssue(value, `Encoding unknown values is not supported by ${transformationName}.`));

const parseAllowlistJsonc = (content: string): Effect.Effect<unknown, SchemaIssue.Issue> => {
  const parseErrors = A.empty<ParseError>();
  const parsed = parse(content, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  return A.match(parseErrors, {
    onEmpty: () => Effect.succeed(parsed),
    onNonEmpty: (errors) =>
      Effect.fail(
        toInvalidValueIssue(
          content,
          pipe(
            errors,
            A.map((error) => `${printParseErrorCode(error.error)}@${error.offset}:${error.length}`),
            A.join(", "),
            (details) => `Allowlist JSONC parse error (${details}).`
          )
        )
      ),
  });
};

export const AllowlistJsoncTextToUnknown = S.String.pipe(
  S.decodeTo(
    S.Unknown,
    SchemaTransformation.transformOrFail({
      decode: parseAllowlistJsonc,
      encode: encodeUnsupported("AllowlistJsoncTextToUnknown"),
    })
  ),
  $I.annoteSchema("AllowlistJsoncTextToUnknown", {
    description: "JSONC text transformation that parses allowlist source into unknown data.",
  }),
  SchemaUtils.withStatics((self) => ({
    decodeDocumentEffect: S.decodeUnknownEffect(self.pipe(S.decodeTo(EffectLawsAllowlistDocument))),
  }))
);

export const decodeAllowlistDocumentFromJsoncText = AllowlistJsoncTextToUnknown.decodeDocumentEffect;

export const decodeAllowlistCheckInput = EffectLawsAllowlistCheckInput.decodeOption;
export const decodeAllowlistSnapshot = (input: unknown): EffectLawsAllowlistSnapshot =>
  Result.getOrThrow(EffectLawsAllowlistSnapshot.decodeResult(input));
export const encodeAllowlistSnapshot = (
  input: EffectLawsAllowlistSnapshot
): (typeof EffectLawsAllowlistSnapshot)["Encoded"] =>
  Result.getOrThrow(EffectLawsAllowlistSnapshot.encodeResult(input));
export const areLookupKeysEquivalent = EffectLawsAllowlistLookupKey.equivalence;

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
