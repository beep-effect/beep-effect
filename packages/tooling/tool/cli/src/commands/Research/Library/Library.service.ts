/**
 * Library configuration separate from the operational knowledge vault.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { LibraryError } from "./Library.errors.ts";

/**
 * Resolve a flag, BEEP_RESEARCH_LIBRARY, or ~/YeeBois/research/beep-effect.
 * **Example** (Choose an explicit library)
 * ```ts
 * import { resolveLibraryRoot } from "@beep/repo-cli/commands/Research"
 * import * as O from "effect/Option"
 * console.log(resolveLibraryRoot(O.some("/library")).pipe !== undefined)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const resolveLibraryRoot = Effect.fn("ResearchLibrary.resolveRoot")(function* (flag: O.Option<string>) {
  const path = yield* Path.Path;
  if (O.isSome(flag)) return path.resolve(flag.value);
  const home = yield* Config.String("HOME").pipe(
    Effect.mapError((cause) => LibraryError.make({ message: "HOME is required to resolve the library.", cause }))
  );
  const configured = yield* Config.String("BEEP_RESEARCH_LIBRARY").pipe(
    Config.option,
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve library configuration.", cause }))
  );
  return path.resolve(
    O.getOrElse(
      O.orElse(flag, () => configured),
      () => path.join(home, "YeeBois/research/beep-effect")
    )
  );
});
