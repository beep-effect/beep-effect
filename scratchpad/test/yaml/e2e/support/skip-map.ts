/**
 * Skip maps for the yaml-test-suite.
 *
 * - SKIP: tests that never run (not applicable to this implementation).
 * - SKIP_ASSERTIONS: tests where specific assertion families are skipped.
 *
 * Every entry must include a reason string explaining WHY. All maps are
 * empty — the v3 source passed the full 1,226-assertion suite with no skips,
 * and the port must too. The mechanism is kept so a future regression can be
 * quarantined with an explicit reason rather than deleted.
 */

/** Tests to skip entirely — not applicable to this implementation. */
export const SKIP: Record<string, string> = {};

/**
 * Tests to skip specific assertions for.
 * - "json" — skip JSON output comparison
 * - "output" — skip out.yaml canonical output comparison
 * - "roundtrip" — skip stringify roundtrip comparison
 */
export const SKIP_ASSERTIONS: Record<string, string[]> = {};
