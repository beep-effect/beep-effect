import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import type { CommandBinding, ViewBinding } from "./Bindings.ts";
import { Credentials, fixedCredentials } from "./Credentials.context.ts";

/**
 * What the Party screens run on: the two contract clients, the caller's
 * credentials and an id source. The browser app gives HTTP clients and its
 * session's credentials; a test sets `partyRuntime.layer` to its own.
 *
 * @category layers
 * @since 0.0.0
 */
export const PartyWebLive: Layer.Layer<
  | Layer.Success<typeof ReviewerContract.layerClient>
  | Layer.Success<typeof IntakeContract.layerClient>
  | Credentials
  | SecureRandom.SecureRandom
> = Layer.mergeAll(
  ReviewerContract.layerClientHttp("/api/reviewer"),
  IntakeContract.layerClientHttp("/api/intake"),
  fixedCredentials({}),
  SecureRandom.layerWebCrypto,
).pipe(Layer.provide(FetchHttpClient.layer));

/**
 * The atom runtime every Party binding atom runs in.
 *
 * @category runtimes
 * @since 0.0.0
 */
export const partyRuntime = Atom.runtime(PartyWebLive);

/** The services a binding may need, all provided by the runtime. */
type PartyServices = Layer.Success<typeof PartyWebLive>;

/**
 * A command atom: call it with target and input (and a command id to retry);
 * its value is the outcome.
 *
 * @category constructors
 * @since 0.0.0
 */
export const commandAtom = <Id extends PartyServices, Target, Input, Rejection>(
  binding: CommandBinding<Id, Target, Input, Rejection>,
) =>
  partyRuntime.fn<{ readonly target: Target; readonly input: Input; readonly commandId?: string | undefined }>()(
    (call) => binding.send(call),
  );

/**
 * One subscription atom per view key: the latest state with its revision.
 *
 * @category constructors
 * @since 0.0.0
 */
export const viewAtom = <Id extends PartyServices, Key, St, E>(binding: ViewBinding<Id, Key, St, E>) =>
  Atom.family((key: Key) => partyRuntime.atom(binding.subscribe(key)));
