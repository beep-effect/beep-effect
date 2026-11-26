import * as O from "effect/Option";
import * as R from "effect/Record";

const viteInlinedCaptures = import.meta.glob<string>("../fixtures/{peers,duplicates}/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The text of one capture, by its path relative to `test/fixtures`.
 *
 * A missing capture throws: it is a misspelled fixture path in a suite, and
 * the suite should fail loudly rather than compare against nothing.
 */
export const fixture = (relative: string): string =>
  O.getOrThrowWith(
    R.get(viteInlinedCaptures, `../fixtures/${relative}`),
    () => new Error(`no fixture at test/fixtures/${relative}`)
  );
