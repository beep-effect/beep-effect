/**
 * Provider-instance use-case implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { ProviderProbeUnavailable, ProviderUnauthenticated } from "./ProviderInstance.errors.ts";
import type {
  AddProviderInstanceCommand,
  GetProviderInstanceQuery,
  ListProviderInstancesQuery,
  ProbeProviderInstanceCommand,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "./ProviderInstance.commands.ts";
import type { ProviderInstanceRepositoryShape, ProviderProbeShape } from "./ProviderInstance.repository.ts";
import type { ProviderInstanceUseCasesShape } from "./ProviderInstance.use-cases.ts";

/** Builds provider-instance operations from persistence and probe ports.
 * @example
 * ```ts
 * import { makeProviderInstanceUseCases } from "@beep/agents-use-cases/server"
 * import type { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance"
 * import { Effect } from "effect"
 * const repository = { add: () => Effect.die("example"), get: () => Effect.die("example"), list: Effect.succeed([]), remove: () => Effect.void, save: (instance: ProviderInstance) => Effect.succeed(instance) }
 * const useCases = makeProviderInstanceUseCases(repository, { probe: () => Effect.die("example") })
 * console.log(useCases.list)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const makeProviderInstanceUseCases: {
  (repository: ProviderInstanceRepositoryShape, providerProbe: ProviderProbeShape): ProviderInstanceUseCasesShape;
  (providerProbe: ProviderProbeShape): (repository: ProviderInstanceRepositoryShape) => ProviderInstanceUseCasesShape;
} = dual(2, (repository: ProviderInstanceRepositoryShape, providerProbe: ProviderProbeShape) => ({
  add: Effect.fn("Agents.ProviderInstance.add")(function* (command: AddProviderInstanceCommand) {
    return yield* repository.add(command);
  }),
  update: Effect.fn("Agents.ProviderInstance.update")(function* (command: UpdateProviderInstanceCommand) {
    const current = yield* repository.get(command.id);
    return yield* repository.save(
      Domain.ProviderInstance.make({
        ...current,
        binaryPath: command.binaryPath,
        envVars: command.envVars,
        homePath: command.homePath,
        kind: command.kind,
        label: command.label,
      })
    );
  }),
  remove: Effect.fn("Agents.ProviderInstance.remove")(function* (command: RemoveProviderInstanceCommand) {
    return yield* repository.remove(command.id);
  }),
  probe: Effect.fn("Agents.ProviderInstance.probe")(function* (command: ProbeProviderInstanceCommand) {
    const current = yield* repository.get(command.id);
    const snapshot = yield* providerProbe.probe({
      binaryPath: current.binaryPath,
      envVars: current.envVars,
      homePath: current.homePath,
      kind: current.kind,
    });
    const saved = yield* repository.save(Domain.ProviderInstance.make({ ...current, lastProbe: O.some(snapshot) }));
    return yield* Domain.AuthSnapshot.match(snapshot, {
      authenticated: () => Effect.succeed(saved),
      unauthenticated: () =>
        Effect.fail(
          ProviderUnauthenticated.make({
            providerInstanceId: current.id,
            guidance: Domain.loginGuidance(current.kind, snapshot),
          })
        ),
      "probe-failed": () =>
        Effect.fail(ProviderProbeUnavailable.make({ guidance: Domain.loginGuidance(current.kind, snapshot) })),
    });
  }),
  get: Effect.fn("Agents.ProviderInstance.get")(function* (query: GetProviderInstanceQuery) {
    return yield* repository.get(query.id);
  }),
  list: Effect.fn("Agents.ProviderInstance.list")(function* (_query: ListProviderInstancesQuery) {
    return yield* repository.list;
  }),
}));
