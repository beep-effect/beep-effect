/**
 * Inline rule fixture sources.
 *
 * Each rule has an `invalid` source (expected to trip the rule N times) and a `valid`
 * source (expected to be silent). Keeping these as string constants — rather than
 * on-disk `.ts` fixture files — avoids the intentional violations being linted/parsed by
 * Biome, tsc, and ESLint; the harness writes each source to a temp file before linting.
 */

import * as A from "effect/Array";
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
    invalid: A.join(["export const boom = () => new Error('nope');", "export const boom2 = () => new Error();"], "\n"),
    valid: "export const ok = () => 'no native error here';",
  },
  "no-bigint-literals": {
    invalidCount: 3,
    messageIncludes: "BigInt literals",
    invalid: A.join(["export const a = 1n;", "export const b = 0xffn;", "export const c = 0b1010n;"], "\n"),
    valid: A.join(["export const a = BigInt(1);", "export const b = BigInt('255');", "export const c = 42;"], "\n"),
  },
  "no-empty-named-blocks": {
    invalidCount: 1,
    messageIncludes: "empty named import",
    invalid: "import {} from './side-effect.ts';",
    valid: A.join(["import { join } from 'node:path';", "export const p = join('a', 'b');"], "\n"),
  },
  "prefer-array-flat-map": {
    invalidCount: 1,
    messageIncludes: ".map(...).flat()",
    invalid: "export const flattened = [[1], [2]].map((x) => x).flat();",
    valid: A.join(
      ["export const flattened = [[1], [2]].flatMap((x) => x);", "export const mapped = [1, 2].map((x) => x + 1);"],
      "\n"
    ),
  },
};
