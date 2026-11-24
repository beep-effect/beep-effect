/**
 * Registry URL classification: the public npm registry, GitHub Packages, JSR or a custom host.
 *
 * **Details**
 *
 * Includes `DEFAULT_REGISTRY` and the host, short-label and display-name
 * helpers that registry reads use when reporting where a package came from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NpmSpecId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const $I = $NpmSpecId.create("RegistryKind");

/**
 * The public npm registry, used when a read names no other.
 *
 * **Example** (Read the default registry URL)
 *
 * ```ts
 * import { DEFAULT_REGISTRY } from "@beep/npm-spec/RegistryKind";
 *
 * console.log(DEFAULT_REGISTRY) // https://registry.npmjs.org
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

/**
 * **Details**
 *
 * The distinction is behavioral, not cosmetic: npm's `--provenance` is
 * meaningful only on the public npm registry, GitHub Packages needs classic
 * `_authToken` auth rather than a trusted-publisher exchange, and JSR is not
 * an npm-protocol registry at all — a JSR target must be routed away from the
 * npm publish path entirely.
 *
 *
 * **Example** (Decode a known registry kind)
 *
 * ```ts
 * import { RegistryKind } from "@beep/npm-spec/RegistryKind";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(RegistryKind)("github-packages")) // github-packages
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const RegistryKind = LiteralKit(["npm", "github-packages", "jsr", "custom"]).pipe(
  $I.annoteSchema("RegistryKind", { description: "Which well-known registry a URL points at." })
);

/**
 * The decoded type of {@link (RegistryKind:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type RegistryKind = typeof RegistryKind.Type;

const parseUrl = O.liftThrowable((value: string): URL => new URL(value));

const lowerCasedHostnameRetryingABareHostWithAScheme = (registry: string): O.Option<string> =>
  parseUrl(registry).pipe(
    O.orElse(() => parseUrl(`https://${registry}`)),
    O.map((url) => Str.toLowerCase(url.hostname))
  );

const isDomainOrADotGuardedSubdomain: {
  (hostname: O.Option<string>, domain: string): boolean;
  (domain: string): (hostname: O.Option<string>) => boolean;
} = dual(2, (hostname: O.Option<string>, domain: string): boolean =>
  O.exists(hostname, (host) => host === domain || Str.endsWith(`.${domain}`)(host))
);

/**
 * Classify a registry URL.
 *
 * **Details**
 *
 * An absent registry classifies as `"npm"`: no registry configured means the
 * public npm registry, which is every npm client's default and this package's
 * {@link DEFAULT_REGISTRY}.
 *
 * There is **one** classification rather than a boolean per registry, so a
 * consumer `switch`es exhaustively instead of composing booleans that can
 * disagree or negating one to mean "everything else".
 *
 * **Example** (Classify public and custom registry URLs)
 *
 * ```ts
 * import { classifyRegistry } from "@beep/npm-spec/RegistryKind";
 *
 * console.log(classifyRegistry("https://registry.npmjs.org/")) // npm
 * console.log(classifyRegistry("https://npm.pkg.github.com/")) // github-packages
 * console.log(classifyRegistry("https://npm.jsr.io/")) // jsr
 * console.log(classifyRegistry("https://registry.example.com/")) // custom
 * ```
 *
 * @param registry - A registry URL or bare host; absent or empty means the
 *   public npm registry.
 * @returns The registry's kind.
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const classifyRegistry = (registry: string | undefined): RegistryKind => {
  if (registry === undefined || registry === "") return "npm";
  const hostname = lowerCasedHostnameRetryingABareHostWithAScheme(registry);
  if (isDomainOrADotGuardedSubdomain(hostname, "npmjs.org")) return "npm";
  if (isDomainOrADotGuardedSubdomain(hostname, "pkg.github.com")) return "github-packages";
  if (isDomainOrADotGuardedSubdomain(hostname, "jsr.io")) return "jsr";
  return "custom";
};

const withoutScheme = (registry: string): string =>
  Str.startsWith("https://")(registry)
    ? Str.slice(8)(registry)
    : Str.startsWith("http://")(registry)
      ? Str.slice(7)(registry)
      : registry;

const beforeFirstSlashScannedNotRegexMatched = (value: string): string =>
  O.match(Str.indexOf("/")(value), {
    onNone: () => value,
    onSome: (slash) => Str.slice(0, slash)(value),
  });

/**
 * The host of a registry URL, for use as a label.
 *
 * **Details**
 *
 * The **port is kept**, unlike the hostname used for classification: two custom
 * registries on the same host and different ports are different registries, and
 * a label that collapsed them would be actively misleading in a publish report.
 *
 * A value that does not parse as a URL falls back to stripping the scheme and
 * everything from the first `/`, because npm config values are written both as
 * URLs and as bare hosts and a label must render either.
 *
 * **Example** (Preserve a custom registry port)
 *
 * ```ts
 * import { registryHost } from "@beep/npm-spec/RegistryKind";
 *
 * console.log(registryHost("https://registry.example.com:4873/path")) // registry.example.com:4873
 * ```
 *
 * @param registry - A registry URL or bare host.
 * @returns The host portion.
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const registryHost = (registry: string): string =>
  parseUrl(registry).pipe(
    O.map((url) => url.host),
    O.getOrElse(() => beforeFirstSlashScannedNotRegexMatched(withoutScheme(registry)))
  );

/**
 * A compact label for a registry: `npm`, `github`, `jsr`, or the host.
 *
 * **Details**
 *
 * For a log-tree row or any other place a full name would not fit. The
 * well-known registries collapse to a short name and everything else falls back
 * to {@link registryHost}.
 *
 * **This is a function over the registry string, not a `RegistryKind` lookup
 * table**, and that is forced rather than chosen: `"custom"` has no fixed
 * label — it renders as its own host — so a table keyed by kind cannot express
 * the projection at all.
 *
 * The classification comes from {@link classifyRegistry}, so the leading-dot
 * domain guard applies here too and a look-alike host such as
 * `evil-npmjs.org` cannot borrow the `npm` label.
 *
 * **Takes a plain `string`, deliberately** — unlike
 * {@link registryDisplayName}. Its callers always have a registry in hand, so
 * accepting a nullish value would silently absorb a wiring mistake that the
 * compile error currently catches. "No registry configured" is a real state
 * only where a display name is rendered.
 *
 * **Example** (Label a known registry and reject a look-alike)
 *
 * ```ts
 * import { registryShortLabel } from "@beep/npm-spec/RegistryKind";
 *
 * console.log(registryShortLabel("https://npm.pkg.github.com/")) // github
 * console.log(registryShortLabel("https://evil-npmjs.org/")) // evil-npmjs.org
 * ```
 *
 * @param registry - A registry URL or bare host.
 * @returns The short label.
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const registryShortLabel = (registry: string): string =>
  RegistryKind.match(classifyRegistry(registry), {
    npm: () => "npm",
    "github-packages": () => "github",
    jsr: () => "jsr",
    custom: () => registryHost(registry),
  });

/**
 * A human-readable display name for a registry: `npm`, `GitHub Packages`,
 * `JSR`, or the host.
 *
 * **Details**
 *
 * The spelled-out counterpart to {@link registryShortLabel}, for prose and
 * summaries rather than table rows. The same host fallback and the same
 * classification guard apply.
 *
 * An absent or empty registry resolves to the public npm registry **explicitly**
 * rather than by relying on `classifyRegistry("")` happening to answer `"npm"`,
 * so the intent survives a future change to that default.
 *
 * **Example** (Render configured and default registry names)
 *
 * ```ts
 * import { registryDisplayName } from "@beep/npm-spec/RegistryKind";
 *
 * console.log(registryDisplayName("https://npm.pkg.github.com/")) // GitHub Packages
 * console.log(registryDisplayName(undefined)) // npm
 * ```
 *
 * @param registry - A registry URL or bare host, or nothing when none is
 *   configured. Absent or empty means the public npm registry.
 * @returns The display name.
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export const registryDisplayName = (registry: string | null | undefined): string => {
  if (registry === null || registry === undefined || registry === "") return "npm";
  return RegistryKind.match(classifyRegistry(registry), {
    npm: () => "npm",
    "github-packages": () => "GitHub Packages",
    jsr: () => "JSR",
    custom: () => registryHost(registry),
  });
};
