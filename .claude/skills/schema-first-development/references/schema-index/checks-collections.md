# effect/Schema index: checks on collections and other inputs

Generated from effect 4.1.6 by `bun run beep schema-idioms index --write`. Do not edit by hand.

- S.isBetweenBigDecimal (check on BigDecimal.BigDecimal): Validates that a `BigDecimal` is within a specified range.
- S.isBetweenLength (check on has .length): Validates that a value's length is within the specified range.
- S.isBetweenProperties (check on object): Validates that an object contains between `minimum` and `maximum` own enumerable properties (inclusive), including both string and symbol keys.
- S.isBetweenSize (check on has .size): Validates that a value's size is within the specified range.
- S.isGreaterThanBigDecimal (check on BigDecimal.BigDecimal): Validates that a BigDecimal is greater than the specified value (exclusive).
- S.isGreaterThanOrEqualToBigDecimal (check on BigDecimal.BigDecimal): Validates that a BigDecimal is greater than or equal to the specified value (inclusive).
- S.isLessThanBigDecimal (check on BigDecimal.BigDecimal): Validates that a BigDecimal is less than the specified value (exclusive).
- S.isLessThanOrEqualToBigDecimal (check on BigDecimal.BigDecimal): Validates that a BigDecimal is less than or equal to the specified value (inclusive).
- S.isMaxLength (check on has .length): Validates that a value has at most the specified length.
- S.isMaxProperties (check on object): Validates that an object contains at most the specified number of own enumerable properties, including both string and symbol keys.
- S.isMaxSize (check on has .size): Validates that a value has at most the specified size.
- S.isMinLength (check on has .length): Validates that a value has at least the specified length.
- S.isMinProperties (check on object): Validates that an object contains at least the specified number of own enumerable properties, including both string and symbol keys.
- S.isMinSize (check on has .size): Validates that a value has at least the specified size.
- S.isNonEmpty (check on has .length): Validates that a value has at least one element.
- S.isPropertyNames (check on object): Validates that every own enumerable property key of an object satisfies the encoded side of the provided key schema.
- S.isUnique (check on readonly unknown[]): Validates that all items in an array are unique according to Effect equality.
- S.isUniqueKey (check on readonly (readonly [unknown, unknown])[]): Validates that all first elements in an array of key-value tuples are unique according to Effect equality.
- S.makeFilter (check on unknown): Creates a custom validation filter from a predicate function.
- S.makeFilterGroup (check on unknown): Groups multiple checks into a single SchemaAST.FilterGroup, applying optional shared annotations to the group as a whole.
