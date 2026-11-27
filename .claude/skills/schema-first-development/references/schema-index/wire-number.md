# effect/Schema index: number on the wire

Generated from effect 4.1.5 by `bun run beep schema-idioms index --write`. Do not edit by hand.

- S.ByteSizeFromNumber → ByteSize.ByteSize: Schema that decodes non-negative safe-integer byte counts.
- S.DateFromMillis → Date: Schema that decodes epoch milliseconds into a JavaScript `Date`.
- S.DateTimeUtcFromMillis → DateTime.Utc: Schema that decodes a number into a `DateTime.Utc`.
- S.DurationFromMillis → Duration.Duration: Schema that decodes a number into a `Duration`, treating the number as milliseconds.
- S.Finite: Schema for finite numbers, rejecting `NaN`, `Infinity`, and `-Infinity`.
- S.Int: Schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`.
- S.Natural: Schema for non-negative safe integers, including zero.
- S.Number: Schema for `number` values, including `NaN`, `Infinity`, and `-Infinity`.
- S.Port: Schema for TCP and UDP port numbers from 0 through 65535.
- S.isBetween (check): Validates that a number is within a specified range.
- S.isFinite (check): Validates that a number is finite (not `Infinity`, `-Infinity`, or `NaN`).
- S.isGreaterThan (check): Validates that a number is greater than the specified value (exclusive).
- S.isGreaterThanOrEqualTo (check): Validates that a number is greater than or equal to the specified value (inclusive).
- S.isInt (check): Validates that a number is a safe integer (within the safe integer range that can be exactly represented in JavaScript).
- S.isInt32 (check): Validates that a number is a 32-bit signed integer (range: -2,147,483,648 to 2,147,483,647).
- S.isLessThan (check): Validates that a number is less than the specified value (exclusive).
- S.isLessThanOrEqualTo (check): Validates that a number is less than or equal to the specified value (inclusive).
- S.isMultipleOf (check): Validates that a number is a multiple of the specified divisor.
- S.isUint32 (check): Validates that a number is a 32-bit unsigned integer (range: 0 to 4,294,967,295).
