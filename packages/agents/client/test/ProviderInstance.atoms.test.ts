import { probeProviderInstanceAtom, providerInstancesAtom } from "@beep/agents-client/ProviderInstance.atoms";
import {
  ProviderInstanceTransport,
  providerInstanceTransportLayerAtom,
} from "@beep/agents-client/ProviderInstance.service";
import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance";
import { ProviderInstanceRpcs, ProviderUnauthenticated } from "@beep/agents-use-cases/public";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as RpcTest from "effect/unstable/rpc/RpcTest";

const instance = S.decodeUnknownSync(ProviderInstance)({
  ...productEntityFixtureInput("AgentsProviderInstance", 7),
  binaryPath: "/usr/bin/codex",
  envVars: {},
  homePath: null,
  kind: "codex",
  label: "Work",
  lastProbe: null,
});

const settle = Effect.repeat(Effect.yieldNow, { times: 4 });
let listReads = 0;
let probeFailure: O.Option<ProviderUnauthenticated> = O.none();
const isProviderUnauthenticated = S.is(ProviderUnauthenticated);
const unexpectedRpc = (tag: string) =>
  Effect.fnUntraced(function* () {
    return yield* Effect.die(`unexpected rpc: ${tag}`);
  });
const ProviderInstanceRpcHandlersTest = ProviderInstanceRpcs.toLayer({
  AddProviderInstance: unexpectedRpc("AddProviderInstance"),
  GetProviderInstance: unexpectedRpc("GetProviderInstance"),
  ListProviderInstances: Effect.fnUntraced(function* () {
    listReads += 1;
    return [instance];
  }),
  ProbeProviderInstance: Effect.fnUntraced(function* () {
    return yield* O.match(probeFailure, { onNone: () => Effect.succeed(instance), onSome: Effect.fail });
  }),
  RemoveProviderInstance: unexpectedRpc("RemoveProviderInstance"),
  UpdateProviderInstance: unexpectedRpc("UpdateProviderInstance"),
});
const ProviderInstanceTransportTest = Layer.effect(
  ProviderInstanceTransport,
  RpcTest.makeClient(ProviderInstanceRpcs, { flatten: true })
).pipe(Layer.provide(ProviderInstanceRpcHandlersTest));
const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [Atom.initialValue(providerInstanceTransportLayerAtom, O.some(ProviderInstanceTransportTest))],
  });

describe("@beep/agents-client ProviderInstance atoms", { concurrent: false }, () => {
  it.effect(
    "reads provider instances through the injected transport",
    Effect.fnUntraced(function* () {
      listReads = 0;
      probeFailure = O.none();
      const registry = makeRegistry();
      const unmount = registry.mount(providerInstancesAtom);

      yield* settle;

      const result = registry.get(providerInstancesAtom);
      expect(AsyncResult.isSuccess(result)).toBe(true);
      if (AsyncResult.isSuccess(result)) {
        expect(result.value).toStrictEqual([instance]);
      }
      unmount();
    })
  );

  it.effect(
    "invalidates the provider-instance list after a probe",
    Effect.fnUntraced(function* () {
      listReads = 0;
      probeFailure = O.none();
      const registry = makeRegistry();
      const unmountList = registry.mount(providerInstancesAtom);
      const unmountProbe = registry.mount(probeProviderInstanceAtom);

      yield* settle;
      expect(listReads).toBe(1);

      registry.set(probeProviderInstanceAtom, { id: instance.id });
      yield* settle;

      expect(listReads).toBe(2);
      unmountProbe();
      unmountList();
    })
  );

  it.effect(
    "surfaces ProviderUnauthenticated guidance to the caller",
    Effect.fnUntraced(function* () {
      const guidance = "Run `codex login` in your terminal, then probe again.";
      const error = ProviderUnauthenticated.make({ providerInstanceId: instance.id, guidance });
      probeFailure = O.some(error);
      const registry = makeRegistry();
      const unmount = registry.mount(probeProviderInstanceAtom);

      registry.set(probeProviderInstanceAtom, { id: Agents.ProviderInstanceId.make(7) });
      yield* settle;

      const result = registry.get(probeProviderInstanceAtom);
      expect(AsyncResult.isFailure(result)).toBe(true);
      if (AsyncResult.isFailure(result)) {
        const reason = result.cause.reasons[0];
        expect(Cause.isFailReason(reason)).toBe(true);
        if (Cause.isFailReason(reason)) {
          expect(isProviderUnauthenticated(reason.error)).toBe(true);
          if (isProviderUnauthenticated(reason.error)) {
            expect(reason.error.guidance).toBe(guidance);
          }
        }
      }
      unmount();
    })
  );
});
