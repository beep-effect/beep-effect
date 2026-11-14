/**
 * Typed access to the registered Vercel providers' read lifecycles.
 */
import * as Vercel from "@beep/alchemy-vercel";
import * as Provider from "alchemy/Provider";
import * as Effect from "effect/Effect";
import type { TypedRead } from "./Harness.ts";

const unavailable = Effect.die("provider has no read lifecycle");

const readOf = <R extends Vercel.Project | Vercel.EnvVar | Vercel.Domain>(
  read: TypedRead<R> | undefined
): TypedRead<R> => read ?? (() => unavailable);

/** Read lifecycle of the registered `Vercel.Project` provider. */
export const projectRead = Provider.findProvider(Vercel.Project).pipe(
  Effect.map((provider): TypedRead<Vercel.Project> => readOf<Vercel.Project>(provider.read))
);

/** Read lifecycle of the registered `Vercel.EnvVar` provider. */
export const envVarRead = Provider.findProvider(Vercel.EnvVar).pipe(
  Effect.map((provider): TypedRead<Vercel.EnvVar> => readOf<Vercel.EnvVar>(provider.read))
);

/** Read lifecycle of the registered `Vercel.Domain` provider. */
export const domainRead = Provider.findProvider(Vercel.Domain).pipe(
  Effect.map((provider): TypedRead<Vercel.Domain> => readOf<Vercel.Domain>(provider.read))
);
