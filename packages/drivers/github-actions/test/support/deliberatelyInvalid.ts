/**
 * Hands a test a value its type forbids, so the test can prove that a runtime check rejects it.
 *
 * **Details**
 *
 * The cast below is the one deliberate type assertion in this module's tests: every test that feeds
 * deliberately ill-typed input goes through this function instead of an inline `as`, so the intent
 * is named and every such site can be found by searching for the helper.
 *
 * @category testing
 * @since 0.0.0
 */
export const deliberatelyInvalid = <T>(value: unknown): T => value as T;
