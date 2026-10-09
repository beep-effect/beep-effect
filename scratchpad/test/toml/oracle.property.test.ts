// @effect-diagnostics nodeBuiltinImport:skip-file
// The smol-toml differential oracle: property tests cross-checking the engine
// against the reference implementation (smol-toml 1.7.0, exact-pinned), plus
// a corpus-wide differential over every toml-test valid file. This is the
// ONLY file that may import smol-toml.
//
// TOML 1.1 coverage: smol-toml 1.7.0 was probed against the 1.1 relaxations
// (optional seconds, inline-table newlines/comments/trailing commas, \e and
// \xHH escapes) and accepts them all, so the corpus differential exercises
// the full 1.1.0 valid tree. The generator emits only 1.0-spelling documents
// (our stringify writes conservative 1.0 output by design); the corpus is
// the 1.1 authority and wins any disagreement.
//
// Probe-derived decisions (all probed against the installed 1.7.0 before the
// normalizer was written):
// - Datetimes are EXCLUDED from generation: smol-toml models all four TOML
//   date-time types as TomlDate (a Date subclass) and truncates fractional
//   seconds to milliseconds (`.999999999` parses back as `.999`,
//   `07:32:00.123456` as `.123`) — lossy against our nanosecond-carrying
//   classes. The corpus differential still cross-checks every corpus
//   datetime, compared modulo the oracle's millisecond truncation.
// - The oracle always parses with `{ integersAsBigInt: true }`: default-mode
//   smol-toml throws "integer value cannot be represented losslessly" at the
//   int64 extremes the corpus and the generator both exercise. Under the
//   option EVERY integer comes back bigint, so the canonicalizer unifies
//   integral bigints within ±(2^53 − 1) to number on BOTH sides before any
//   comparison.
// - smol-toml stringify accepts bigint inputs natively (probed: `123n` emits
//   `x = 123`, int64 max emits its exact digits), so the oracle-stringify
//   property passes generated values through unmapped.
// - Lone surrogates are excluded from generation: smol-toml stringify happily
//   emits `\ud800` as a basic-string escape, which is invalid TOML (escaped
//   values must be Unicode scalar values) and our parser correctly rejects.
// - NaN is excluded from the equality properties (canonicalized to a sentinel
//   defensively for the corpus side) and round-trips in a dedicated test.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Schema, Result } from "effect";
import { parse as oracleParse, stringify as oracleStringify } from "smol-toml";
import { Toml } from "../../effected/toml/Toml.ts";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../../effected/toml/TomlDateTime.ts";
import { assertMatchesTagged } from "./e2e/taggedJson.ts";

// ── The canonicalizer ──────────────────────────────────────────────────────

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/i;

/** The oracle's millisecond truncation, applied to a fraction-digits string. */
const fractionToMs = (fraction: string | undefined): number =>
	fraction === undefined ? 0 : Number(fraction.padEnd(3, "0").slice(0, 3));

/** `Z`/`+hh:mm`/`-hh:mm` → signed minutes, with `-00:00` canonicalized to 0. */
const offsetToMinutes = (offset: string): number => {
	if (offset.toUpperCase() === "Z") {
		return 0;
	}
	const total = Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6));
	return offset.startsWith("-") && total !== 0 ? -total : total;
};

/**
 * A smol-toml TomlDate (the one Date subclass covering all four TOML
 * date-time kinds), keyed off its custom `toISOString` output shape and
 * mapped onto the same tagged record our classes canonicalize to.
 */
const canonOracleDate = (value: Date): unknown => {
	const iso = value.toISOString();
	const dateTime = DATETIME_RE.exec(iso);
	if (dateTime !== null) {
		const base = {
			year: Number(dateTime[1]),
			month: Number(dateTime[2]),
			day: Number(dateTime[3]),
			hour: Number(dateTime[4]),
			minute: Number(dateTime[5]),
			second: Number(dateTime[6]),
			ms: fractionToMs(dateTime[7]),
		};
		const offset = dateTime[8];
		return offset === undefined
			? { $dt: "datetime-local", ...base }
			: { $dt: "datetime", ...base, offset: offsetToMinutes(offset) };
	}
	const date = DATE_RE.exec(iso);
	if (date !== null) {
		return { $dt: "date-local", year: Number(date[1]), month: Number(date[2]), day: Number(date[3]) };
	}
	const time = TIME_RE.exec(iso);
	if (time !== null) {
		return {
			$dt: "time-local",
			hour: Number(time[1]),
			minute: Number(time[2]),
			second: Number(time[3]),
			ms: fractionToMs(time[4]),
		};
	}
	return { $dt: "unrecognized", iso };
};

/**
 * Map either parser's result onto one comparable model: integral bigints
 * within ±(2^53 − 1) become number, NaN becomes a sentinel record, our
 * datetime classes and the oracle's TomlDate both become tagged records
 * truncated to millisecond precision (the oracle's ceiling), containers
 * recurse.
 */
const canon = (value: unknown): unknown => {
	switch (typeof value) {
		case "bigint":
			return value >= -MAX_SAFE_BIG && value <= MAX_SAFE_BIG ? Number(value) : value;
		case "number":
			return Number.isNaN(value) ? { $nan: true } : value;
		case "string":
		case "boolean":
			return value;
		default:
			break;
	}
	if (Schema.is(TomlOffsetDateTime)(value)) {
		return {
			$dt: "datetime",
			year: value.year,
			month: value.month,
			day: value.day,
			hour: value.hour,
			minute: value.minute,
			second: value.second,
			ms: Math.floor(value.nanosecond / 1_000_000),
			offset: value.offsetMinutes === 0 ? 0 : value.offsetMinutes,
		};
	}
	if (Schema.is(TomlLocalDateTime)(value)) {
		return {
			$dt: "datetime-local",
			year: value.year,
			month: value.month,
			day: value.day,
			hour: value.hour,
			minute: value.minute,
			second: value.second,
			ms: Math.floor(value.nanosecond / 1_000_000),
		};
	}
	if (Schema.is(TomlLocalDate)(value)) {
		return { $dt: "date-local", year: value.year, month: value.month, day: value.day };
	}
	if (Schema.is(TomlLocalTime)(value)) {
		return {
			$dt: "time-local",
			hour: value.hour,
			minute: value.minute,
			second: value.second,
			ms: Math.floor(value.nanosecond / 1_000_000),
		};
	}
	if (value instanceof Date) {
		return canonOracleDate(value);
	}
	if (Array.isArray(value)) {
		return value.map(canon);
	}
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(Object.keys(record).map((key) => [key, canon(record[key])]));
	}
	return value;
};

/** Parse through the oracle in the mode the canonicalizer expects. */
const oracle = (text: string): unknown => oracleParse(text, { integersAsBigInt: true });

// ── The arbitraries ────────────────────────────────────────────────────────
// Recursive TOML-representable plain values, bounded at depth 4 and width 5.
// Array form ONLY for it.effect.prop: the named-record form silently discards
// Schema conversion in @effect/vitest 4.0.0-beta.94.
//
// The native Arbitrary module has no weighted choice and no array-of-Arbitrary
// combinator (only Schema-derived collections), so the two helpers below build
// them from `flatMap` over a Schema-generated ticket or length. Both shrink the
// way fast-check did: a weighted pick shrinks toward its first branch, a
// collection shrinks its length before its elements.

/** Picks one branch with the given relative weights. */
function weighted<A>(
	first: readonly [weight: number, arbitrary: Arbitrary.Arbitrary<A>],
	...rest: ReadonlyArray<readonly [weight: number, arbitrary: Arbitrary.Arbitrary<A>]>
): Arbitrary.Arbitrary<A> {
	const total = rest.reduce((sum, [weight]) => sum + weight, first[0]);
	return Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: total - 1 }))).pipe(
		Arbitrary.flatMap((ticket) => {
			let remaining = ticket - first[0];
			for (const [weight, arbitrary] of rest) {
				if (remaining < 0) break;
				if (remaining < weight) return arbitrary;
				remaining -= weight;
			}
			return first[1];
		}),
	);
}

/** A collection of `minLength`..`maxLength` independent draws from `item`. */
function arrayOf<A>(
	item: Arbitrary.Arbitrary<A>,
	{ minLength = 0, maxLength }: { readonly minLength?: number; readonly maxLength: number },
): Arbitrary.Arbitrary<Array<A>> {
	return Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: minLength, maximum: maxLength }))).pipe(
		Arbitrary.flatMap((length) => Arbitrary.all(Array.from({ length }, () => item))),
	);
}

/** Any Unicode scalar value from space upward (escaping handled by emitters). */
const scalarCharArb = Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: 0x20, maximum: 0x10ffff }))).pipe(
	Arbitrary.filter((codePoint) => codePoint < 0xd800 || codePoint > 0xdfff),
	Arbitrary.map((codePoint) => String.fromCodePoint(codePoint)),
);

/** The characters that stress escaping: quotes, backslashes, controls, DEL. */
const nastyCharArb = Arbitrary.schema(
	Schema.Literals(['"', "\\", "\n", "\r", "\t", "\b", "\f", "\u0000", "\u001f", "\u007f", "'", " "]),
);

const stringArb = arrayOf(weighted([5, scalarCharArb], [3, nastyCharArb]), { maxLength: 12 }).pipe(
	Arbitrary.map((chars) => chars.join("")),
);

const bareKeyArb = Arbitrary.schema(Schema.String.check(Schema.isPattern(/^[abzAZ_\-019]{1,8}$/)));

/** Keys that force quoting: dots, spaces, the empty key, quotes, unicode. */
const quotedKeyArb = weighted<string>(
	[1, Arbitrary.schema(Schema.Literals(["", "a.b", "a b", 'quo"te', "back\\slash", "uni é中", "\ttab", "new\nline"]))],
	[1, stringArb],
);

const keyArb = weighted([3, bareKeyArb], [2, quotedKeyArb]);

/** Half 32-bit integers (fast-check's default range), half the full safe range. */
const integerArb = Arbitrary.schema(
	Schema.Union([
		Schema.Int.check(Schema.isBetween({ minimum: -(2 ** 31), maximum: 2 ** 31 - 1 })),
		Schema.Int.check(Schema.isBetween({ minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER })),
	]),
);

const INT64_MAX = 2n ** 63n - 1n;

const bigintArb = Arbitrary.schema(
	Schema.BigInt.check(Schema.isBetweenBigInt({ minimum: -INT64_MAX, maximum: INT64_MAX })),
);

/** Finite-or-infinite doubles — NaN stays out of the equality properties. */
// TOML float round-trip properties must include infinities, as the scalar tests require.
// @effect-diagnostics-next-line schemaNumber:off
const floatArb = Arbitrary.schema(Schema.Number.check(Schema.makeFilter((n) => !Number.isNaN(n))));

const leafArb: Arbitrary.Arbitrary<unknown> = weighted<unknown>(
	[3, stringArb],
	[2, integerArb],
	[2, floatArb],
	[1, bigintArb],
	[1, Arbitrary.schema(Schema.Boolean)],
);

function valueArb(depth: number): Arbitrary.Arbitrary<unknown> {
	if (depth <= 0) {
		return leafArb;
	}
	return weighted<unknown>([4, leafArb], [2, arrayOf(valueArb(depth - 1), { maxLength: 5 })], [2, tableArb(depth - 1)]);
}

function tableArb(depth: number): Arbitrary.Arbitrary<Record<string, unknown>> {
	return arrayOf(Arbitrary.all([keyArb, valueArb(depth)]), { maxLength: 5 }).pipe(
		Arbitrary.map((entries) => Object.fromEntries(entries)),
	);
}

/** A TOML document is a table: the root arbitrary is always an object. */
const documentArb = tableArb(3);

// ── The differential properties ────────────────────────────────────────────

/**
 * Fixed seed so a CI property failure reproduces locally: an unseeded run
 * draws a fresh seed per invocation, making a red CI run unreplayable. Bump
 * the seed deliberately (with a green run) when fresh coverage is wanted;
 * the corpus differential below is exhaustive and does not depend on it.
 */
const ORACLE_CHECK_OPTIONS: Arbitrary.CheckOptions = { runs: 250, seed: 20260710 };

describe("smol-toml differential oracle", () => {
	it.effect.prop(
		"our stringify parses identically under both parsers",
		[documentArb],
		([document]) =>
			Effect.gen(function* () {
				const text = yield* Toml.stringify(document);
				const ours = yield* Toml.parse(text);
				assert.deepStrictEqual(canon(ours), canon(oracle(text)), text);
			}),
		{ arbitrary: ORACLE_CHECK_OPTIONS },
	);

	it.effect.prop(
		"the oracle's stringify parses identically under both parsers",
		[documentArb],
		([document]) =>
			Effect.gen(function* () {
				const text = oracleStringify(document);
				const ours = yield* Toml.parse(text);
				assert.deepStrictEqual(canon(ours), canon(oracle(text)), text);
			}),
		{ arbitrary: ORACLE_CHECK_OPTIONS },
	);

	it.effect("NaN round-trips through our stringify into NaN under both parsers", () =>
		Effect.gen(function* () {
			const text = yield* Toml.stringify({ x: Number.NaN });
			const ours = (yield* Toml.parse(text)) as { readonly x: number };
			const theirs = oracle(text) as { readonly x: number };
			assert.isTrue(Number.isNaN(ours.x), "our parse must yield NaN");
			assert.isTrue(Number.isNaN(theirs.x), "the oracle's parse must yield NaN");
		}),
	);
});

// ── The corpus differential ────────────────────────────────────────────────
// Every toml-test valid file through both parsers, agreement asserted modulo
// `canon`. Where the oracle disagrees (rejects a valid file or parses it
// differently), OUR result is asserted against the corpus expectation instead
// and the file is recorded — the pinned list below is the console-free
// divergence log.

const CORPUS_DIR = resolve(import.meta.dirname, "fixtures/toml-test/valid");

// Guard against a silently-empty walk (count recorded in the fixture README).
const README_VALID_COUNT = 214;

const validCases: ReadonlyArray<string> = readdirSync(CORPUS_DIR, { recursive: true, encoding: "utf8" })
	.filter((entry) => entry.endsWith(".toml"))
	.map((entry) => entry.replaceAll("\\", "/"))
	.sort();

/**
 * The corpus files where smol-toml 1.7.0 diverges from the toml-test
 * expectation (and from us). Empty means full three-way agreement.
 */
const EXPECTED_ORACLE_DIVERGENCES: ReadonlyArray<string> = [];

interface Divergence {
	readonly file: string;
	readonly detail: string;
}

describe("corpus differential", () => {
	const divergences: Array<Divergence> = [];

	it("discovers the full valid corpus", () => {
		assert.isAtLeast(validCases.length, README_VALID_COUNT, "valid corpus walk came up short");
	});

	for (const relPath of validCases) {
		it.effect(relPath, () =>
			Effect.gen(function* () {
				const source = readFileSync(join(CORPUS_DIR, relPath), "utf8");
				const ours = yield* Toml.parse(source);
				const oracleResult = Result.try(() => oracle(source));
				if (Result.isFailure(oracleResult)) {
					divergences.push({ file: relPath, detail: `oracle rejected: ${String(oracleResult.failure).split("\n")[0]}` });
					assertOursAgainstCorpus(ours, relPath);
					return;
				}
				const theirs = oracleResult.success;
				if (isDeepStrictEqual(canon(ours), canon(theirs))) {
					return;
				}
				divergences.push({ file: relPath, detail: "oracle parse disagrees with ours" });
				assertOursAgainstCorpus(ours, relPath);
			}),
		);
	}

	// Defined last so every per-file test above has already run.
	it("pins the oracle divergence log", () => {
		assert.deepStrictEqual(divergences.map((divergence) => `${divergence.file}: ${divergence.detail}`).sort(), [
			...EXPECTED_ORACLE_DIVERGENCES,
		]);
	});
});

/** Where the oracle diverges, the corpus expectation decides: assert ours against it. */
function assertOursAgainstCorpus(ours: unknown, relPath: string): void {
	const expected: unknown = JSON.parse(readFileSync(join(CORPUS_DIR, relPath.replace(/\.toml$/, ".json")), "utf8"));
	assertMatchesTagged(ours, expected, "$");
}
