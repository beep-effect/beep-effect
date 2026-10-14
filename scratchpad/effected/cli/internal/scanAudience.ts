import * as S from "effect/Schema";
import * as A from "effect/Array";
import { $ScratchpadId } from "@beep/identity/packages";
import { AudienceKind } from "../../env/Audience.ts";

const $I = $ScratchpadId.create("effected/cli/internal/scanAudience");

/**
 * The four parsed audience flags, as core hands them to a shared-flag command.
 *
 * **Example** (Decode one explicit agent audience)
 *
 * ```ts
 * import { AudienceFlagValues } from "@beep/scratchpad/effected/cli/internal/scanAudience"
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
export const AudienceFlagValues = S.Struct({
	audience: S.Array(AudienceKind).annotate($I.annote("AudienceFlagValues.audience", { description: "Every explicit audience occurrence." })),
	human: S.Array(S.Boolean).annotate($I.annote("AudienceFlagValues.human", { description: "Every parsed human flag occurrence." })),
	agent: S.Array(S.Boolean).annotate($I.annote("AudienceFlagValues.agent", { description: "Every parsed agent flag occurrence." })),
	ci: S.Array(S.Boolean).annotate($I.annote("AudienceFlagValues.ci", { description: "Every parsed CI flag occurrence." })),
}).annotate($I.annote("AudienceFlagValues", { description: "The four parsed audience flag arrays, including disabled occurrences." }));

/**
 * The plain parsed audience flags.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AudienceFlagValues = typeof AudienceFlagValues.Type;

/**
 * What the flags named: one entry per TRUE occurrence, and whether that is more than one.
 *
 * **Example** (Validate a single audience tally)
 *
 * ```ts
 * import { AudienceTally } from "@beep/scratchpad/effected/cli/internal/scanAudience";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(AudienceTally)({ given: ["agent"], conflict: false })) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export const AudienceTally = S.Struct({
	given: S.Array(AudienceKind).annotate($I.annote("AudienceTally.given", { description: "Enabled audience occurrences in tally order." })),
	conflict: S.Boolean.annotate($I.annote("AudienceTally.conflict", { description: "Whether more than one audience occurrence was enabled." })),
}).annotate($I.annote("AudienceTally", { description: "Plain audience occurrences and their conflict result." }));

/**
 * The plain result shared by parsed flags and argv scanning.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AudienceTally = typeof AudienceTally.Type;

/**
 * The one counting rule, shared by the resolver that runs on parsed flags and by {@link scanAudience}, so the two
 * cannot drift: every `--audience` value counts, and a boolean counts only when it is true (`--agent=false` and
 * `--no-agent` mean "not given").
 *
 * **Example** (Count only enabled boolean flags)
 *
 * ```ts
 * import { tallyAudience } from "@beep/scratchpad/effected/cli/internal/scanAudience"
 * const tally = tallyAudience({ audience: [], human: [false], agent: [true], ci: [] })
 * console.log(tally.given.join(",")) // agent
 * console.log(tally.conflict) // false
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const tallyAudience = (input: AudienceFlagValues): AudienceTally => {
	const given: ReadonlyArray<AudienceKind> = [
		...input.audience,
		...input.human.filter(Boolean).map((): AudienceKind => "human"),
		...input.agent.filter(Boolean).map((): AudienceKind => "agent"),
		...input.ci.filter(Boolean).map((): AudienceKind => "ci"),
	];
	return { given, conflict: given.length > 1 };
};

// The spellings core's boolean parser accepts, exactly as it accepts them (and nothing else, case included).
const TRUE_WORDS: ReadonlyArray<string> = ["true", "yes", "on", "1", "y"];
const FALSE_WORDS: ReadonlyArray<string> = ["false", "no", "off", "0", "n"];

const isKind = S.is(AudienceKind);

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
 * import { scanAudience } from "@beep/scratchpad/effected/cli/internal/scanAudience"
 * const tally = scanAudience(["--agent", "--human=false", "--", "--ci"])
 * console.log(tally.given.join(",")) // agent
 * console.log(tally.conflict) // false
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanAudience = (argv: ReadonlyArray<string>): AudienceTally => {
	const audience: AudienceKind[] = [];
	const booleans: Record<AudienceKind, boolean[]> = { human: [], agent: [], ci: [] };
	const isBoolean = S.is(AudienceKind);

	for (let index = 0; index < argv.length; index++) {
		const token = A.getUnsafe(argv, index);
		if (token === "--") break;
		if (!token.startsWith("--")) continue;
		const equals = token.indexOf("=");
		const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
		const inline = equals === -1 ? undefined : token.slice(equals + 1);

		if (name === "audience") {
			let value = inline;
			if (value === undefined) {
				const next = argv[index + 1];
				// A following token that looks like a flag is not the value: core reports the value as missing.
				if (next !== undefined && !next.startsWith("-")) {
					value = next;
					index++;
				}
			}
			if (value !== undefined && isKind(value)) audience.push(value);
			continue;
		}

		if (isBoolean(name)) {
			if (inline !== undefined) {
				if (TRUE_WORDS.includes(inline)) booleans[name].push(true);
				else if (FALSE_WORDS.includes(inline)) booleans[name].push(false);
				continue;
			}
			const next = argv[index + 1];
			if (next !== undefined && TRUE_WORDS.includes(next)) {
				booleans[name].push(true);
				index++;
			} else if (next !== undefined && FALSE_WORDS.includes(next)) {
				booleans[name].push(false);
				index++;
			} else {
				booleans[name].push(true);
			}
			continue;
		}

		const negated = name.slice(3);
		if (name.startsWith("no-") && isBoolean(negated)) {
			booleans[negated].push(false);
		}
	}

	return tallyAudience({ audience, ...booleans });
};
