/**
 * A plain environment record: variable name to value. Every detector under
 * `src/internal/` is a pure function of one of these, never of `process.env`.
 *
 * @internal
 */
export type Env = Readonly<Record<string, string | undefined>>;
