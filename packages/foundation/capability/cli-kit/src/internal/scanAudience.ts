import { $CliKitId } from "@beep/identity/packages";
import { AudienceKind } from "@beep/runtime-env/Audience";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $CliKitId.create("internal/scanAudience");

/**
 * The four parsed audience flags, as core hands them to a shared-flag command.
 *
 * **Example** (Decode one explicit agent audience)
 *
 * ```ts
 * import { AudienceFlagValues } from "@beep/cli-kit/internal/scanAudience"
 * import * as S from "effect/Schema"
 *
 * const flags = S.decodeUnknownSync(AudienceFlagValues)({ audience: ["agent"], human: [], agent: [true], ci: [] })
 * console.log(flags.audience, flags.agent) // [ "agent" ] [ true ]
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class AudienceFlagValues extends S.Opaque<AudienceFlagValues, { readonly brand: unique symbol }>()(
  S.Struct({
    audience: S.Array(AudienceKind).pipe(
      $I.annoteKey("AudienceFlagValues.audience", { description: "Every explicit audience occurrence." })
    ),
    human: S.Array(S.Boolean).pipe(
      $I.annoteKey("AudienceFlagValues.human", { description: "Every parsed human flag occurrence." })
    ),
    agent: S.Array(S.Boolean).pipe(
      $I.annoteKey("AudienceFlagValues.agent", { description: "Every parsed agent flag occurrence." })
    ),
    ci: S.Array(S.Boolean).pipe(
      $I.annoteKey("AudienceFlagValues.ci", { description: "Every parsed CI flag occurrence." })
    ),
  }).pipe(
    $I.annoteSchema("AudienceFlagValues", {
      description: "The four parsed audience flag arrays, including disabled occurrences.",
    })
  )
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { AudienceFlagValues } from "@beep/cli-kit/internal/scanAudience"
 *
 * const accepts = (_value: AudienceFlagValues.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudienceFlagValues {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AudienceFlagValues.Encoded;
}

/**
 * What the flags named: one entry per TRUE occurrence, and whether that is more than one.
 *
 * **Example** (Validate a single audience tally)
 *
 * ```ts
 * import { AudienceTally } from "@beep/cli-kit/internal/scanAudience";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(AudienceTally)({ given: ["agent"], conflict: false })) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export class AudienceTally extends S.Opaque<AudienceTally, { readonly brand: unique symbol }>()(
  S.Struct({
    given: S.Array(AudienceKind).pipe(
      $I.annoteKey("AudienceTally.given", { description: "Enabled audience occurrences in tally order." })
    ),
    conflict: S.Boolean.pipe(
      $I.annoteKey("AudienceTally.conflict", { description: "Whether more than one audience occurrence was enabled." })
    ),
  }).pipe($I.annoteSchema("AudienceTally", { description: "Plain audience occurrences and their conflict result." }))
) {}

/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { AudienceTally } from "@beep/cli-kit/internal/scanAudience"
 *
 * const accepts = (_value: AudienceTally.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AudienceTally {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AudienceTally.Encoded;
}

/**
 * The one counting rule, shared by the resolver that runs on parsed flags and by {@link scanAudience}, so the two
 * cannot drift: every `--audience` value counts, and a boolean counts only when it is true (`--agent=false` and
 * `--no-agent` mean "not given").
 *
 * **Example** (Count only enabled boolean flags)
 *
 * ```ts
 * import { tallyAudience } from "@beep/cli-kit/internal/scanAudience"
 * const tally = tallyAudience({ audience: [], human: [false], agent: [true], ci: [] })
 * console.log(tally.given.join(",")) // agent
 * console.log(tally.conflict) // false
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const tallyAudience = (input: AudienceFlagValues.Encoded): AudienceTally.Encoded => {
  const given: ReadonlyArray<AudienceKind> = [
    ...input.audience,
    ...pipe(
      input.human,
      A.filter(Boolean),
      A.map((): AudienceKind => "human")
    ),
    ...pipe(
      input.agent,
      A.filter(Boolean),
      A.map((): AudienceKind => "agent")
    ),
    ...pipe(
      input.ci,
      A.filter(Boolean),
      A.map((): AudienceKind => "ci")
    ),
  ];
  return { given, conflict: given.length > 1 };
};

// The spellings core's boolean parser accepts, exactly as it accepts them (and nothing else, case included).
const TRUE_WORDS: ReadonlyArray<string> = ["true", "yes", "on", "1", "y"];
const FALSE_WORDS: ReadonlyArray<string> = ["false", "no", "off", "0", "n"];

const isKind = S.is(AudienceKind);

const booleanValue = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  if (A.contains(TRUE_WORDS, value)) return true;
  if (A.contains(FALSE_WORDS, value)) return false;
  return undefined;
};

const audienceValue = (argv: ReadonlyArray<string>, index: number, inline: string | undefined) => {
  if (inline !== undefined) return { value: inline, index };
  const next = A.get(argv, index + 1).pipe(O.getOrUndefined);
  return next !== undefined && !Str.startsWith("-")(next)
    ? { value: next, index: index + 1 }
    : { value: undefined, index };
};

const scanBoolean = (
  argv: ReadonlyArray<string>,
  index: number,
  inline: string | undefined,
  values: boolean[]
): number => {
  if (inline !== undefined) {
    const parsed = booleanValue(inline);
    if (parsed !== undefined) values.push(parsed);
    return index;
  }
  const parsed = booleanValue(A.get(argv, index + 1).pipe(O.getOrUndefined));
  values.push(parsed ?? true);
  return parsed === undefined ? index : index + 1;
};

const scanFlag = (
  argv: ReadonlyArray<string>,
  index: number,
  audience: AudienceKind[],
  booleans: Record<AudienceKind, boolean[]>
): number => {
  const token = A.getUnsafe(argv, index);
  if (!Str.startsWith("--")(token)) return index;
  const equals = Str.indexOf("=")(token);
  const name = O.match(equals, { onNone: () => Str.slice(2)(token), onSome: (at) => Str.slice(2, at)(token) });
  const inline = O.getOrUndefined(O.map(equals, (at) => Str.slice(at + 1)(token)));
  if (name === "audience") {
    const parsed = audienceValue(argv, index, inline);
    if (parsed.value !== undefined && isKind(parsed.value)) audience.push(parsed.value);
    return parsed.index;
  }
  if (isKind(name)) return scanBoolean(argv, index, inline, booleans[name]);
  const negated = Str.slice(3)(name);
  if (Str.startsWith("no-")(name) && isKind(negated)) booleans[negated].push(false);
  return index;
};

/**
 * Read the audience flags straight out of `argv`, the way core will parse them later.
 *
 * **Details**
 *
 * Pure, and needed because the audience must be known BEFORE core parses: a fallback prompt fires during the
 * parse, which happens before any parsed flag is visible to it. Mirrors the syntax core accepts for the four
 * flags: `--audience v`, `--audience=v`, `--human`, `--agent` and `--ci`, each boolean with an optional `=true`
 * or `=false` (and the other spellings core accepts), or a following `true` or `false` token, `--no-<name>`,
 * repeats, and anywhere before a `--`, which ends flag parsing. A value core would reject (a bad `--audience`
 * kind, an unknown boolean spelling, a missing value) is left uncounted: core reports that as its own usage error.
 *
 * **Example** (Ignore disabled flags and stop at the delimiter)
 *
 * ```ts
 * import { scanAudience } from "@beep/cli-kit/internal/scanAudience"
 * const tally = scanAudience(["--agent", "--human=false", "--", "--ci"])
 * console.log(tally.given.join(",")) // agent
 * console.log(tally.conflict) // false
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanAudience = (argv: ReadonlyArray<string>): AudienceTally.Encoded => {
  const audience: AudienceKind[] = [];
  const booleans: Record<AudienceKind, boolean[]> = { human: [], agent: [], ci: [] };
  for (let index = 0; index < argv.length; index++) {
    if (A.getUnsafe(argv, index) === "--") break;
    index = scanFlag(argv, index, audience, booleans);
  }

  return tallyAudience({ audience, ...booleans });
};
