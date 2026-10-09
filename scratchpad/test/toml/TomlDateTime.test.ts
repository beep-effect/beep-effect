import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../../effected/toml/TomlDateTime.ts";

describe("TomlDateTime classes", () => {
	it("constructs a valid local date and prints canonically", () => {
		const d = TomlLocalDate.make({ year: 1979, month: 5, day: 27 });
		assert.strictEqual(d.toString(), "1979-05-27");
	});
	it("rejects impossible calendar dates", () => {
		assert.throws(() => TomlLocalDate.make({ year: 2021, month: 2, day: 29 }));
		assert.throws(() => TomlLocalDate.make({ year: 2021, month: 4, day: 31 }));
	});
	it("accepts leap-day and century rules", () => {
		assert.strictEqual(TomlLocalDate.make({ year: 2000, month: 2, day: 29 }).day, 29);
		assert.throws(() => TomlLocalDate.make({ year: 1900, month: 2, day: 29 }));
	});
	it("structural equality holds", () => {
		const a = TomlLocalTime.make({ hour: 7, minute: 32, second: 0, nanosecond: 0 });
		const b = TomlLocalTime.make({ hour: 7, minute: 32, second: 0, nanosecond: 0 });
		assert.isTrue(Equal.equals(a, b));
	});
	it("prints offsets, Z for zero, fractional trimming", () => {
		const z = TomlOffsetDateTime.make({
			year: 1979,
			month: 5,
			day: 27,
			hour: 7,
			minute: 32,
			second: 0,
			nanosecond: 0,
			offsetMinutes: 0,
		});
		assert.strictEqual(z.toString(), "1979-05-27T07:32:00Z");
		const off = TomlOffsetDateTime.make({
			year: 1979,
			month: 5,
			day: 27,
			hour: 0,
			minute: 32,
			second: 0,
			nanosecond: 600_000_000,
			offsetMinutes: -420,
		});
		assert.strictEqual(off.toString(), "1979-05-27T00:32:00.6-07:00");
	});
	it("allows the leap second", () => {
		assert.strictEqual(TomlLocalTime.make({ hour: 23, minute: 59, second: 60, nanosecond: 0 }).second, 60);
	});
	it("constructs a local date-time and prints canonically", () => {
		const dt = TomlLocalDateTime.make({ year: 1979, month: 5, day: 27, hour: 7, minute: 32, second: 0, nanosecond: 0 });
		assert.strictEqual(dt.toString(), "1979-05-27T07:32:00");
	});
	it("rejects impossible calendar dates on TomlLocalDateTime", () => {
		assert.throws(() =>
			TomlLocalDateTime.make({ year: 2021, month: 2, day: 29, hour: 0, minute: 0, second: 0, nanosecond: 0 }),
		);
	});
	it("accepts inclusive upper bounds on date fields", () => {
		assert.strictEqual(TomlLocalDate.make({ year: 2021, month: 12, day: 31 }).month, 12);
		assert.strictEqual(TomlLocalDate.make({ year: 2021, month: 1, day: 31 }).day, 31);
		assert.strictEqual(TomlLocalDate.make({ year: 9999, month: 1, day: 1 }).year, 9999);
		// negative spot-check: the upper-bound acceptance above would pass even with
		// an off-by-one bound unless a value just past it is confirmed to still throw
		assert.throws(() => TomlLocalDate.make({ year: 2021, month: 13, day: 1 }));
	});
	it("accepts inclusive upper bounds on time fields", () => {
		assert.strictEqual(TomlLocalTime.make({ hour: 23, minute: 59, second: 0, nanosecond: 0 }).minute, 59);
		const nines = TomlLocalTime.make({ hour: 0, minute: 0, second: 0, nanosecond: 999_999_999 });
		assert.strictEqual(nines.toString(), "00:00:00.999999999");
	});
	it("accepts inclusive upper and lower bounds on offsetMinutes", () => {
		const positive = TomlOffsetDateTime.make({
			year: 1979,
			month: 5,
			day: 27,
			hour: 7,
			minute: 32,
			second: 0,
			nanosecond: 0,
			offsetMinutes: 1439,
		});
		assert.strictEqual(positive.toString(), "1979-05-27T07:32:00+23:59");
		const negative = TomlOffsetDateTime.make({
			year: 1979,
			month: 5,
			day: 27,
			hour: 7,
			minute: 32,
			second: 0,
			nanosecond: 0,
			offsetMinutes: -1439,
		});
		assert.strictEqual(negative.toString(), "1979-05-27T07:32:00-23:59");
	});
	it("trims fractional seconds to the shortest exact representation", () => {
		const middle = TomlLocalTime.make({ hour: 0, minute: 0, second: 0, nanosecond: 105_000_000 });
		assert.strictEqual(middle.toString(), "00:00:00.105");
		const smallest = TomlLocalTime.make({ hour: 0, minute: 0, second: 0, nanosecond: 1 });
		assert.strictEqual(smallest.toString(), "00:00:00.000000001");
	});
});
