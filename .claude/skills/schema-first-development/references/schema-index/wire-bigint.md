# effect/Schema index: bigint on the wire

Generated from effect 4.1.5 by `bun run beep schema-idioms index --write`. Do not edit by hand.

- S.BigInt: Schema for `bigint` values.
- S.ByteSizeFromBigInt → ByteSize.ByteSize: Schema that decodes non-negative bigint byte counts.
- S.DurationFromNanos → Duration.Duration: Schema that decodes a `bigint` into a `Duration`, treating the bigint as nanoseconds.
- S.isBetweenBigInt (check): Validates that a BigInt is within a specified range.
- S.isGreaterThanBigInt (check): Validates that a BigInt is greater than the specified value (exclusive).
- S.isGreaterThanOrEqualToBigInt (check): Validates that a BigInt is greater than or equal to the specified value (inclusive).
- S.isLessThanBigInt (check): Validates that a BigInt is less than the specified value (exclusive).
- S.isLessThanOrEqualToBigInt (check): Validates that a BigInt is less than or equal to the specified value (inclusive).
