// Ported from @pnpm/matcher@1000.1.0 createMatcher (MIT).

import { ReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
import * as A from "effect/Array";
import * as Str from "effect/String";

/**
 * A predicate over a peer name.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PeerNameMatcher = (name: string) => boolean;

const backtrackingSafeMatcherOf =
  (pattern: string): PeerNameMatcher =>
  (name) =>
    ReleaseAgeGate.matchesExclude(name, [pattern]);

const isNegation = (pattern: string): boolean => Str.startsWith("!")(pattern);

/**
 * Compiles one `ignoreMissing` / `allowAny` list into a predicate over peer
 * names, with `@pnpm/matcher`'s composition rules.
 *
 * **Details**
 *
 * An empty list matches nothing. All-negative lists match every name that is not
 * excluded. Mixed lists apply inclusions and exclusions in their original order.
 *
 * **Gotchas**
 *
 * Patterns match peer names only; parent-qualified keys do not select a parent.
 * A later matching inclusion can restore a match removed by an earlier negation.
 *
 * **Example** (Observe ordered peer inclusions and exclusions)
 *
 * ```ts
 * import { peerNameMatcher } from "@beep/repo-workspaces/internal/peerPatterns";
 *
 * console.log(peerNameMatcher(["*", "!redux"])("redux")); // false
 * console.log(peerNameMatcher(["!redux", "*"])("redux")); // true
 * console.log(peerNameMatcher(["!redux"])("react")); // true
 * console.log(peerNameMatcher([])("react")); // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const peerNameMatcher = (patterns: ReadonlyArray<string>): PeerNameMatcher => {
  if (patterns.length === 0) return () => false;
  const compiled = A.map(patterns, (pattern) =>
    isNegation(pattern)
      ? { negation: true, match: backtrackingSafeMatcherOf(Str.slice(1)(pattern)) }
      : { negation: false, match: backtrackingSafeMatcherOf(pattern) }
  );
  const negations = A.filter(compiled, (entry) => entry.negation);
  if (negations.length === 0) return (name) => A.some(compiled, (entry) => entry.match(name));
  if (negations.length === compiled.length) return (name) => !A.some(negations, (entry) => entry.match(name));
  return (name) => {
    let matched = false;
    for (const entry of compiled) {
      if (entry.negation) {
        if (entry.match(name)) matched = false;
      } else if (!matched && entry.match(name)) {
        matched = true;
      }
    }
    return matched;
  };
};
