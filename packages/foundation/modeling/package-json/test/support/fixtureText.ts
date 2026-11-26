import * as O from "effect/Option";
import * as R from "effect/Record";

declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }
    ): Readonly<Record<string, T>>;
  }
}

const unnormalizedFixtureBytes = import.meta.glob<string>("../fixtures/*.json.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The raw text of one frozen fixture under `test/fixtures/`, addressed by its name without the `.txt` suffix
 * (for example `"root.input.json"`); fails loudly for a fixture that does not exist.
 */
export const fixtureText = (name: string): string =>
  O.getOrThrowWith(
    R.get(unnormalizedFixtureBytes, `../fixtures/${name}.txt`),
    () => new Error(`no fixture test/fixtures/${name}.txt`)
  );
