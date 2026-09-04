import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import {
  AddProviderInstanceCommand,
  GetProviderInstanceQuery,
  ListProviderInstancesQuery,
  ProbeProviderInstanceCommand,
  ProviderInstanceNotFound,
  ProviderUnauthenticated,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "@beep/agents-use-cases/public";
import { ProviderInstance } from "@beep/agents-use-cases/server";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ProviderInstanceRepositoryShape, ProviderProbeShape } from "@beep/agents-use-cases/server";

const id = Agents.ProviderInstanceId.make(1);
const missingId = Agents.ProviderInstanceId.make(99);
const probedAt = DateTime.makeUnsafe("2026-07-12T00:00:00.000Z");
const isProviderInstanceNotFound = S.is(ProviderInstanceNotFound);
const isProviderUnauthenticated = S.is(ProviderUnauthenticated);

const makeInstance = (kind: Domain.ProviderKind = "claude"): Domain.ProviderInstance =>
  Domain.ProviderInstance.decodeUnknownSync({
    ...productEntityFixtureInput("AgentsProviderInstance", 1),
    binaryPath: kind === "claude" ? "/usr/bin/claude" : "/usr/bin/codex",
    envVars: {},
    homePath: null,
    kind,
    label: "Personal",
    lastProbe: null,
  });

const makeRepository = (initial: ReadonlyArray<Domain.ProviderInstance>) => {
  let stored = initial;
  const unavailable = () => Effect.die("unreachable test path");
  const get = (providerInstanceId: Agents.ProviderInstanceId) =>
    Effect.fromOption(
      A.findFirst(stored, (instance) => instance.id === providerInstanceId),
      () => ProviderInstanceNotFound.make({ providerInstanceId })
    );
  const repository: ProviderInstanceRepositoryShape = {
    add: () => unavailable(),
    get,
    list: Effect.sync(() => stored),
    remove: Effect.fnUntraced(function* (providerInstanceId: Agents.ProviderInstanceId) {
      yield* get(providerInstanceId);
      stored = A.filter(stored, (instance) => instance.id !== providerInstanceId);
    }),
    save: Effect.fnUntraced(function* (instance: Domain.ProviderInstance) {
      yield* get(instance.id);
      stored = A.map(stored, (current) => (current.id === instance.id ? instance : current));
      return instance;
    }),
  };
  return { repository, read: () => stored };
};

describe("@beep/agents-use-cases ProviderInstance", () => {
  it.effect(
    "runs add, update, list, get, and remove command/query logic",
    Effect.fnUntraced(function* () {
      const initial = makeInstance();
      const state = makeRepository([initial]);
      const repository: ProviderInstanceRepositoryShape = {
        ...state.repository,
        add: () => Effect.succeed(initial),
      };
      const probe: ProviderProbeShape = {
        probe: () => Effect.succeed(Domain.AuthenticatedSnapshot.make({ probedAt })),
      };
      const useCases = ProviderInstance.makeProviderInstanceUseCases(repository, probe);
      const add = AddProviderInstanceCommand.make({
        binaryPath: initial.binaryPath,
        envVars: {},
        homePath: O.none(),
        kind: "claude",
        label: initial.label,
      });
      expect((yield* useCases.add(add)).id).toBe(id);
      const updated = yield* useCases.update(
        UpdateProviderInstanceCommand.make({
          id,
          binaryPath: Domain.BinaryPath.make("/usr/bin/codex"),
          envVars: {},
          homePath: O.none(),
          kind: "codex",
          label: Domain.InstanceLabel.make("Work"),
        })
      );
      expect(updated.kind).toBe("codex");
      expect((yield* useCases.get(GetProviderInstanceQuery.make({ id }))).label).toBe("Work");
      expect(yield* useCases.list(ListProviderInstancesQuery.make({}))).toHaveLength(1);
      yield* useCases.remove(RemoveProviderInstanceCommand.make({ id }));
      expect(state.read()).toHaveLength(0);
    })
  );

  it.effect(
    "persists an authenticated probe snapshot",
    Effect.fnUntraced(function* () {
      const state = makeRepository([makeInstance()]);
      const snapshot = Domain.AuthenticatedSnapshot.make({ probedAt });
      const useCases = ProviderInstance.makeProviderInstanceUseCases(state.repository, {
        probe: () => Effect.succeed(snapshot),
      });
      const result = yield* useCases.probe(ProbeProviderInstanceCommand.make({ id }));
      expect(O.getOrThrow(result.lastProbe)).toBe(snapshot);
      expect(O.getOrThrow(state.read()[0]?.lastProbe ?? O.none())).toBe(snapshot);
    })
  );

  for (const [kind, command] of [
    ["claude", "claude auth login"],
    ["codex", "codex login"],
  ] as const) {
    it.effect(
      `persists ${kind} logged-out snapshots and returns exact login guidance`,
      Effect.fnUntraced(function* () {
        const state = makeRepository([makeInstance(kind)]);
        const snapshot = Domain.UnauthenticatedSnapshot.make({ probedAt });
        const useCases = ProviderInstance.makeProviderInstanceUseCases(state.repository, {
          probe: () => Effect.succeed(snapshot),
        });
        const failure = yield* Effect.flip(useCases.probe(ProbeProviderInstanceCommand.make({ id })));
        expect(isProviderUnauthenticated(failure)).toBe(true);
        if (isProviderUnauthenticated(failure)) {
          expect(failure.guidance).toContain(command);
        }
        expect(O.getOrThrow(state.read()[0]?.lastProbe ?? O.none())).toBe(snapshot);
      })
    );
  }

  it.effect(
    "surfaces not-found paths for get, update, remove, and probe",
    Effect.fnUntraced(function* () {
      const state = makeRepository([]);
      const useCases = ProviderInstance.makeProviderInstanceUseCases(state.repository, {
        probe: () => Effect.die("must not run"),
      });
      const update = UpdateProviderInstanceCommand.make({
        id: missingId,
        binaryPath: Domain.BinaryPath.make("/usr/bin/claude"),
        envVars: {},
        homePath: O.none(),
        kind: "claude",
        label: Domain.InstanceLabel.make("Missing"),
      });
      const failures = yield* Effect.all([
        Effect.flip(useCases.get(GetProviderInstanceQuery.make({ id: missingId }))),
        Effect.flip(useCases.update(update)),
        Effect.flip(useCases.remove(RemoveProviderInstanceCommand.make({ id: missingId }))),
        Effect.flip(useCases.probe(ProbeProviderInstanceCommand.make({ id: missingId }))),
      ]);
      expect(A.every(failures, isProviderInstanceNotFound)).toBe(true);
    })
  );
});
