/**
 * Declared command outcomes no story or test executes yet, each with why. `bun run outcomes
 * --check` fails on a gap missing here, and on an entry here that has since been covered.
 */
export const uncoveredOutcomes: ReadonlyArray<{
  readonly aggregate: string;
  readonly command: string;
  readonly outcome: string;
  readonly reason: string;
}> = [];
