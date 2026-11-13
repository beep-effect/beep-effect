/**
 * Provider wiring for the Vercel resources.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Credentials from "@distilled.cloud/vercel/Credentials";
import * as Provider from "alchemy/Provider";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import { Domain, DomainProvider } from "./Domain.ts";
import { EnvVar, EnvVarProvider } from "./EnvVar.ts";
import { Project, ProjectProvider } from "./Project.ts";

/**
 * Provider collection of the Vercel resources.
 *
 * **Example** (Find a registered provider)
 *
 * ```ts
 * import { Providers } from "@beep/alchemy-vercel/Providers"
 *
 * console.log(Providers.key) // "Vercel"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export class Providers extends Provider.ProviderCollection<Providers>()("Vercel") {}

/**
 * The Vercel resource providers without credentials or an HTTP client.
 *
 * **Details**
 *
 * The layer still requires the distilled `Credentials` and an
 * `HttpClient`. {@link providers} supplies both from the environment; tests
 * supply an in-memory HTTP client instead.
 *
 * **Example** (Provide a custom HTTP client)
 *
 * ```ts
 * import { resources } from "@beep/alchemy-vercel/Providers"
 * import * as Credentials from "@distilled.cloud/vercel/Credentials"
 * import * as FetchHttpClient from "effect/http/FetchHttpClient"
 * import * as Layer from "effect/Layer"
 *
 * const layer = resources.pipe(
 *   Layer.provideMerge(Credentials.CredentialsFromEnv),
 *   Layer.provideMerge(FetchHttpClient.layer)
 * )
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const resources = Layer.effect(Providers, Provider.collection([Project, EnvVar, Domain])).pipe(
  Layer.provide(Layer.mergeAll(ProjectProvider, EnvVarProvider, DomainProvider))
);

/**
 * Vercel providers with credentials from the environment.
 *
 * **Details**
 *
 * The token is `VERCEL_TOKEN` (and `VERCEL_API_URL`, default
 * `https://api.vercel.com`), resolved per request through distilled's
 * `CredentialsFromEnv`. There is no Alchemy profile; pass the token through
 * `op run`. The team is a per-resource `teamId` prop, because one token can
 * reach several teams.
 *
 * **Example** (A stack with the Vercel providers)
 *
 * ```ts
 * import * as Vercel from "@beep/alchemy-vercel"
 * import * as Layer from "effect/Layer"
 *
 * const layer = Vercel.providers
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const providers = resources.pipe(
  Layer.provideMerge(Credentials.CredentialsFromEnv),
  Layer.provideMerge(FetchHttpClient.layer)
);
