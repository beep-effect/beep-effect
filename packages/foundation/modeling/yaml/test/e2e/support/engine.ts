import { buildAnchorMap, getNodeValue } from "@beep/yaml/internal/composer/anchors";
import { composeAllDocuments, composeFirstDocument } from "@beep/yaml/internal/composer/document";
import { isFatalCode } from "@beep/yaml/internal/diagnostics";
import { stringifyDocument as stringifyRawDocument, stringifyValue } from "@beep/yaml/internal/stringifier";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as P from "effect/Predicate";
import type { RawDiagnostic } from "@beep/yaml/internal/diagnostics";
import type { ParseOptionsInput, StringifyOptionsInput } from "@beep/yaml/internal/options";
import type { RawYamlDocument } from "@beep/yaml/internal/raw-document";
import type { YamlNode } from "@beep/yaml/YamlNode";

export { buildAnchorMap, getNodeValue };

/** Raw aggregate parse failure (the facade will materialize YamlParseError). */
export interface RawParseFailure {
  readonly errors: ReadonlyArray<RawDiagnostic>;
}

/** v3 `parseDocument` semantics: fail when any fatal-code diagnostic exists. */
export function parseDocument(
  text: string,
  options?: ParseOptionsInput
): Effect.Effect<RawYamlDocument, RawParseFailure>;
export function parseDocument(
  options?: ParseOptionsInput
): (text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>;
export function parseDocument(
  ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
):
  | Effect.Effect<RawYamlDocument, RawParseFailure>
  | ((text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>) {
  return dual<
    (
      ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
    ) =>
      | Effect.Effect<RawYamlDocument, RawParseFailure>
      | ((text: string) => Effect.Effect<RawYamlDocument, RawParseFailure>),
    (text: string, options?: ParseOptionsInput) => Effect.Effect<RawYamlDocument, RawParseFailure>
  >(
    (args) => P.isString(args[0]),
    function parseDocument(text: string, options?: ParseOptionsInput): Effect.Effect<RawYamlDocument, RawParseFailure> {
      return Effect.suspend(() => {
        const doc = composeFirstDocument(text, options);
        const fatal = A.filter(doc.errors, (e) => isFatalCode(e.code));
        return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(doc);
      });
    }
  )(...args);
}

/** v3 `parseAllDocuments` semantics: stream-level InvalidDirective + per-doc fatals. */
export function parseAllDocuments(
  text: string,
  options?: ParseOptionsInput
): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>;
export function parseAllDocuments(
  options?: ParseOptionsInput
): (text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>;
export function parseAllDocuments(
  ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
):
  | Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>
  | ((text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>) {
  return dual<
    (
      ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
    ) =>
      | Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>
      | ((text: string) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>),
    (text: string, options?: ParseOptionsInput) => Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure>
  >(
    (args) => P.isString(args[0]),
    function parseAllDocuments(
      text: string,
      options?: ParseOptionsInput
    ): Effect.Effect<ReadonlyArray<RawYamlDocument>, RawParseFailure> {
      return Effect.suspend(() => {
        const { documents, streamErrors } = composeAllDocuments(text, options);
        const fatal = [
          ...A.filter(streamErrors, (e) => e.code === "InvalidDirective"),
          ...A.flatMap(documents, (d) => A.filter(d.errors, (e) => isFatalCode(e.code))),
        ];
        return fatal.length > 0 ? Effect.fail({ errors: fatal }) : Effect.succeed(documents);
      });
    }
  )(...args);
}

/** v3 `parse` semantics: single-doc value parse with DuplicateKey promotion. */
export function parse(text: string, options?: ParseOptionsInput): Effect.Effect<unknown, RawParseFailure>;
export function parse(options?: ParseOptionsInput): (text: string) => Effect.Effect<unknown, RawParseFailure>;
export function parse(
  ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
): Effect.Effect<unknown, RawParseFailure> | ((text: string) => Effect.Effect<unknown, RawParseFailure>) {
  return dual<
    (
      ...args: [text: string, options?: ParseOptionsInput | undefined] | [options?: ParseOptionsInput | undefined]
    ) => Effect.Effect<unknown, RawParseFailure> | ((text: string) => Effect.Effect<unknown, RawParseFailure>),
    (text: string, options?: ParseOptionsInput) => Effect.Effect<unknown, RawParseFailure>
  >(
    (args) => P.isString(args[0]),
    function parse(text: string, options?: ParseOptionsInput): Effect.Effect<unknown, RawParseFailure> {
      const uniqueKeys = options?.uniqueKeys ?? true;
      return parseDocument(text, options).pipe(
        Effect.flatMap((doc) => {
          if (uniqueKeys) {
            const dupErrors = A.filter(doc.warnings, (w) => w.code === "DuplicateKey");
            if (dupErrors.length > 0) {
              return Effect.fail({ errors: dupErrors });
            }
          }
          const anchors = MutableHashMap.empty<string, YamlNode>();
          return Effect.succeed(getNodeValue(doc.contents, anchors));
        })
      );
    }
  )(...args);
}

/** Sync stringify of a plain value (engine `stringifyValue`). */
export function stringify(...[value, options]: [value: unknown, options?: StringifyOptionsInput]): string {
  return stringifyValue(value, options);
}

/** Sync stringify of a raw composed document. */
export function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string;
export function stringifyDocument(options?: StringifyOptionsInput): (doc: RawYamlDocument) => string;
export function stringifyDocument(
  ...args:
    | [doc: RawYamlDocument, options?: StringifyOptionsInput | undefined]
    | [options?: StringifyOptionsInput | undefined]
): string | ((doc: RawYamlDocument) => string) {
  return dual<
    (
      ...args:
        | [doc: RawYamlDocument, options?: StringifyOptionsInput | undefined]
        | [options?: StringifyOptionsInput | undefined]
    ) => string | ((doc: RawYamlDocument) => string),
    (doc: RawYamlDocument, options?: StringifyOptionsInput) => string
  >(
    (args) => args.length >= 2 || (args[0] !== undefined && "contents" in args[0]),
    function stringifyDocument(doc: RawYamlDocument, options?: StringifyOptionsInput): string {
      return stringifyRawDocument(doc, options);
    }
  )(...args);
}
