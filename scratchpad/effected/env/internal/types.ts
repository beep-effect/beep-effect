/**
 * A plain environment record: variable name to value.
 *
 * **Details**
 *
 * Every detector under `src/internal/` is a pure function of one of these, never of `process.env`.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type Env = Readonly<Record<string, string | undefined>>;
