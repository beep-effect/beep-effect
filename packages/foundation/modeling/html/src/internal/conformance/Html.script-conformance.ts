/**
 * Contextual script-state and attribute-applicability inspection.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Script } from "../../Html.model.ts";
import { resolveScriptState, ScriptState } from "../../Html.script.ts";
import { hasHtmlAttribute, makeHtmlConformanceIssue } from "./Html.conformance-contracts.ts";
import type { HtmlTag } from "../../Html.meta.ts";
import type { HtmlChildView, HtmlConformanceIssue } from "./Html.conformance-contracts.ts";

const isScript = S.is(Script);
const readProperty = (value: unknown, key: PropertyKey): unknown => Reflect.get(Object(value), key);

const ScriptContextualAttributeName = LiteralKit([
  "src",
  "nomodule",
  "async",
  "defer",
  "blocking",
  "crossorigin",
  "referrerpolicy",
  "integrity",
  "fetchpriority",
]);

type ScriptContextualAttributeName = typeof ScriptContextualAttributeName.Type;

const SCRIPT_EXTERNAL_CLASSIC_ATTRIBUTES = ScriptContextualAttributeName.Options;
const SCRIPT_INLINE_CLASSIC_ATTRIBUTES = ScriptContextualAttributeName.pickOptions([
  "nomodule",
  "crossorigin",
  "referrerpolicy",
]);
const SCRIPT_EXTERNAL_MODULE_ATTRIBUTES = ScriptContextualAttributeName.pickOptions([
  "src",
  "async",
  "blocking",
  "crossorigin",
  "referrerpolicy",
  "integrity",
  "fetchpriority",
]);
const SCRIPT_INLINE_MODULE_ATTRIBUTES = ScriptContextualAttributeName.pickOptions([
  "async",
  "crossorigin",
  "referrerpolicy",
]);
const noScriptContextualAttributes = (): ReadonlyArray<ScriptContextualAttributeName> => A.emptyReadonly();

const scriptAllowedContextualAttributes = (
  hasSource: boolean
): ((state: ScriptState) => ReadonlyArray<ScriptContextualAttributeName>) =>
  ScriptState.match({
    classic: () => (hasSource ? SCRIPT_EXTERNAL_CLASSIC_ATTRIBUTES : SCRIPT_INLINE_CLASSIC_ATTRIBUTES),
    module: () => (hasSource ? SCRIPT_EXTERNAL_MODULE_ATTRIBUTES : SCRIPT_INLINE_MODULE_ATTRIBUTES),
    importMap: noScriptContextualAttributes,
    speculationRules: noScriptContextualAttributes,
    dataBlock: noScriptContextualAttributes,
  });

const scriptContextualAttributeMessage = (
  state: ScriptState,
  name: ScriptContextualAttributeName,
  hasSource: boolean
): string =>
  name === "src"
    ? "<script src> is permitted only for classic and module scripts"
    : `<script ${name}> is not permitted on a ${state.state} script in ${hasSource ? "external" : "inline"} context`;

/**
 * Reports invalid script types and attributes that do not apply to the
 * effective classic, module, import-map, speculation-rules, or data-block state.
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const inspectScriptConformance: {
  (node: HtmlChildView, tag: HtmlTag, path: ReadonlyArray<string>): ReadonlyArray<HtmlConformanceIssue>;
  (tag: HtmlTag, path: ReadonlyArray<string>): (node: HtmlChildView) => ReadonlyArray<HtmlConformanceIssue>;
} = dual(3, (node: HtmlChildView, tag: HtmlTag, path: ReadonlyArray<string>): ReadonlyArray<HtmlConformanceIssue> => {
  if (tag !== "script" || !isScript(node)) return A.emptyReadonly();
  return pipe(
    resolveScriptState(node),
    Result.match({
      onFailure: ({ value }): ReadonlyArray<HtmlConformanceIssue> => [
        makeHtmlConformanceIssue(
          A.append(path, "attributes.type"),
          "attributeRelationship",
          `<script type="${value}"> must be empty, a JavaScript MIME type essence match, module, importmap, speculationrules, or a valid MIME string that is not a JavaScript essence match`
        ),
      ],
      onSuccess: (state): ReadonlyArray<HtmlConformanceIssue> => {
        const hasSource = hasHtmlAttribute(node.src);
        const allowed = scriptAllowedContextualAttributes(hasSource)(state);
        return A.flatMap(ScriptContextualAttributeName.Options, (name) =>
          hasHtmlAttribute(readProperty(node, name)) && !A.contains(allowed, name)
            ? [
                makeHtmlConformanceIssue(
                  A.append(path, `attributes.${name}`),
                  "attributeRelationship",
                  scriptContextualAttributeMessage(state, name, hasSource)
                ),
              ]
            : A.emptyReadonly()
        );
      },
    })
  );
});
