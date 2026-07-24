/**
 * Inline rule fixture sources.
 *
 * Each rule has an `invalid` source (expected to trip the rule N times) and a `valid`
 * source (expected to be silent). Keeping these as string constants — rather than
 * on-disk `.ts` fixture files — avoids the intentional violations being linted/parsed by
 * Biome, tsc, and ESLint; the harness writes each source to a temp file before linting.
 */
import type { RuleName } from "@beep/lint-rules";

export type RuleSource = {
  readonly invalid: string;
  readonly invalidCount: number;
  readonly valid: string;
  readonly messageIncludes: string;
};

export const SOURCES: { readonly [K in RuleName]: RuleSource } = {
  "no-native-error": {
    invalidCount: 2,
    messageIncludes: "native Error",
    invalid: ["export const boom = () => new Error('nope');", "export const boom2 = () => new Error();"].join("\n"),
    valid: "export const ok = () => 'no native error here';",
  },
  "no-bigint-literals": {
    invalidCount: 3,
    messageIncludes: "BigInt literals",
    invalid: ["export const a = 1n;", "export const b = 0xffn;", "export const c = 0b1010n;"].join("\n"),
    valid: ["export const a = BigInt(1);", "export const b = BigInt('255');", "export const c = 42;"].join("\n"),
  },
  "no-empty-named-blocks": {
    invalidCount: 1,
    messageIncludes: "empty named import",
    invalid: "import {} from './side-effect.ts';",
    valid: ["import { join } from 'node:path';", "export const p = join('a', 'b');"].join("\n"),
  },
  "prefer-array-flat-map": {
    invalidCount: 1,
    messageIncludes: ".map(...).flat()",
    invalid: "export const flattened = [[1], [2]].map((x) => x).flat();",
    valid: [
      "export const flattened = [[1], [2]].flatMap((x) => x);",
      "export const mapped = [1, 2].map((x) => x + 1);",
    ].join("\n"),
  },
};
