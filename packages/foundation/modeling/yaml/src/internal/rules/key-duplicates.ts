import { $YamlId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as S from "effect/Schema";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { YamlMap, YamlScalar, YamlSeq } from "../../YamlNode.ts";
import { keyIdentity } from "../composer/block.ts";
import { positionAt } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlNode } from "../../YamlNode.ts";

const $I = $YamlId.create("internal/rules/key-duplicates");
const isMap = S.is(YamlMap);
const isScalar = S.is(YamlScalar);
const isSeq = S.is(YamlSeq);

/**
 * Configure the reporting severity for duplicate mapping keys.
 *
 * **Details**
 *
 * Options for `key-duplicates` (severity only — duplicates are duplicates).
 *
 * **Example** (Decode key-duplicates options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { keyDuplicatesOptions } from "@beep/yaml/internal/rules/key-duplicates";
 *
 * const options = S.decodeUnknownSync(keyDuplicatesOptions)({ severity: "warning" });
 * console.log(options.severity) // warning
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class keyDuplicatesOptions extends S.Opaque<keyDuplicatesOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("keyDuplicatesOptions.severity", {
        description: "Reporting level for duplicate mapping-key findings, defaulting to `error`",
      })
    ),
  }).pipe(
    $I.annoteSchema("keyDuplicatesOptions", {
      description: "Options for `key-duplicates` (severity only — duplicates are duplicates).",
    })
  )
) {}

const checkKey = (
  key: YamlScalar,
  seen: MutableHashSet.MutableHashSet<string>,
  out: Array<YamlLintDiagnostic>,
  ctx: LintContext
): void => {
  const id = keyIdentity(key, ctx.text);
  if (MutableHashSet.has(seen, id)) {
    const pos = positionAt(ctx.lines, key.offset);
    out.push(
      YamlLintDiagnostic.make({
        rule: "key-duplicates",
        severity: "error",
        message: `Duplicate key: ${String(key.value)}`,
        offset: key.offset,
        length: key.length,
        line: pos.line,
        character: pos.character,
      })
    );
  }
  MutableHashSet.add(seen, id);
};

const walkMap = (node: YamlMap, text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): void => {
  const seen = MutableHashSet.empty<string>();
  for (const pair of node.items) {
    if (isScalar(pair.key)) checkKey(pair.key, seen, out, ctx);
    walk(pair.key, text, out, ctx);
    walk(pair.value, text, out, ctx);
  }
};

const walk: {
  (node: YamlNode | null, text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): void;
  (text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): (node: YamlNode | null) => void;
} = dual(4, (node: YamlNode | null, text: string, out: Array<YamlLintDiagnostic>, ctx: LintContext): void => {
  if (node === null) return;
  if (isMap(node)) {
    walkMap(node, text, out, ctx);
    return;
  }
  if (isSeq(node)) {
    for (const item of node.items) walk(item, text, out, ctx);
  }
});

/**
 * Report duplicate mapping keys anywhere in the document.
 *
 * **Details**
 *
 * Every occurrence after the first is reported within its mapping. Key
 * identity includes type and value, so an integer key `1` does not collide
 * with the string key `"1"`. The lint context composes with engine duplicate
 * checks disabled so this rule owns the policy.
 *
 * **Gotchas**
 *
 * There is no fix: dropping a mapping pair changes the document's meaning.
 *
 * **Example** (Find a repeated mapping key)
 *
 * ```ts
 * import { keyDuplicates } from "@beep/yaml/internal/rules/key-duplicates";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "key-duplicates": {} },
 * });
 * const diagnostics = YamlLint.run("name: Ada\nname: Grace\n", [keyDuplicates], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const keyDuplicates = YamlRule.make({
  id: "key-duplicates",
  check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
    const out: Array<YamlLintDiagnostic> = [];
    walk(ctx.document.contents, ctx.text, out, ctx);
    return out;
  }),
});
