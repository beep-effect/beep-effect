import { Comparator, Range, SemVer, VersionCache, VersionDiff } from "../semver/index.ts";
import { Effect, Equal, Hash, Result } from "effect";
import * as O from "effect/Option";

const log = (label: string, value: unknown) => {
	console.log(label, JSON.stringify(value));
};

const vFail = SemVer.parseResult("v1.2.3");
if (Result.isFailure(vFail)) log("InvalidVersionError.message", vFail.failure.message);

const rFail = Range.parseResult("not a range");
if (Result.isFailure(rFail)) log("InvalidRangeError.message", rFail.failure.message);

const cFail = Comparator.parseResult("^1.2.3");
if (Result.isFailure(cFail)) log("InvalidComparatorError.message", cFail.failure.message);

const range = Result.getOrThrow(Range.parseResult("^1.0.0 || ^1.5.0"));
log("range.toString", range.toString());
log("Range.simplify", Range.simplify(range).toString());

const lower = Result.getOrThrow(Range.parseResult(">=2.0.0"));
const upper = Result.getOrThrow(Range.parseResult("<1.0.0"));
const merged = Range.intersectResult(lower, upper);
if (Result.isFailure(merged)) log("UnsatisfiableConstraintError.message", merged.failure.message);

const caret = Result.getOrThrow(Range.parseResult("^1.0.0"));
log("caret.toString", caret.toString());
log(
	"range.filter",
	caret.filter([SemVer.of(1, 5, 0), SemVer.of(2, 0, 0), SemVer.of(1, 0, 0)]).map((version) => version.toString()),
);

const versions = [SemVer.of(1, 1, 0), SemVer.of(2, 0, 0), SemVer.of(1, 0, 0)];
const grouped = SemVer.groupBy(versions, "major");
log("groupBy.1", grouped["1"]?.map((version) => version.toString()));
log("groupBy.2", grouped["2"]?.map((version) => version.toString()));

const left = SemVer.of(1, 0, 0, [], ["build.1"]);
const right = SemVer.of(1, 0, 0, [], ["build.2"]);
log("Equal.equals build twins", Equal.equals(left, right));
log("Hash.hash build twins", Hash.hash(left) === Hash.hash(right));
log("Hash.hash vs patch", Hash.hash(left) === Hash.hash(SemVer.of(1, 0, 1)));

const empty = Effect.runSync(
	Effect.gen(function* () {
		const cache = yield* VersionCache;
		return yield* Effect.result(cache.latest());
	}).pipe(Effect.provide(VersionCache.layer)),
);
if (Result.isFailure(empty)) log("EmptyCacheError.message", empty.failure.message);

const missing = Effect.runSync(
	Effect.gen(function* () {
		const cache = yield* VersionCache;
		yield* cache.load([SemVer.of(1, 0, 0)]);
		return yield* Effect.result(cache.next(SemVer.of(2, 0, 0)));
	}).pipe(Effect.provide(VersionCache.layer)),
);
if (Result.isFailure(missing)) log("VersionNotFoundError.message", missing.failure.message);

const unsatisfied = Effect.runSync(
	Effect.gen(function* () {
		const cache = yield* VersionCache;
		yield* cache.load([SemVer.of(1, 0, 0)]);
		const unmatched = Result.getOrThrow(Range.parseResult("^2.0.0"));
		return yield* Effect.result(cache.resolve(unmatched));
	}).pipe(Effect.provide(VersionCache.layer)),
);
if (Result.isFailure(unsatisfied)) log("UnsatisfiedRangeError.message", unsatisfied.failure.message);

log("VersionDiff.toString", VersionDiff.between(SemVer.of(1, 2, 3), SemVer.of(2, 0, 0)).toString());
log("max", O.getOrThrow(SemVer.max([SemVer.of(1, 0, 0), SemVer.of(2, 0, 0), SemVer.of(1, 5, 0)])).toString());
log("Comparator.=", Result.getOrThrow(Comparator.parseResult("=1.2.3")).toString());
