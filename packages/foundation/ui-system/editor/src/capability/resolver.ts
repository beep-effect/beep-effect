/**
 * Pure deterministic resolver from app-owned profiles to editor runtime plans.
 *
 * @packageDocumentation \@beep/editor/capability/resolver
 * @since 0.0.0
 */

import { A, dual, O } from "@beep/utils";
import { Effect, Equal, Result } from "effect";
import * as Graph from "effect/Graph";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import {
  CapabilityConflictError,
  DependencyCycleError,
  DevelopmentOnlyCapabilityError,
  IncompatibleRegistrationError,
  KeybindingConflictError,
  MissingDependencyError,
  UnknownCapabilityError,
  UnknownCommandError,
} from "./errors.ts";
import { CapabilityRegistrations, ResolvedCapability, ResolvedCommand, ResolvedEditorProfile } from "./schemas.ts";
import type { ProfileResolutionError } from "./errors.ts";
import type { CapabilityCatalog, CapabilityDescriptor, CapabilityId, EditorProfile, Keybinding } from "./schemas.ts";

const descriptorIndex = (
  catalog: CapabilityCatalog
): MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor> => {
  const index = MutableHashMap.empty<CapabilityId, CapabilityDescriptor>();
  for (const descriptor of catalog) {
    MutableHashMap.set(index, descriptor.id, descriptor);
  }
  return index;
};

const enabledIdSet = (profile: EditorProfile): MutableHashSet.MutableHashSet<CapabilityId> => {
  const enabled = MutableHashSet.empty<CapabilityId>();
  for (const id of profile.capabilities) {
    MutableHashSet.add(enabled, id);
  }
  return enabled;
};

const enabledDescriptors = (
  catalog: CapabilityCatalog,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>
): ReadonlyArray<CapabilityDescriptor> => A.filter(catalog, (descriptor) => MutableHashSet.has(enabled, descriptor.id));

const makeDependencyGraph = (descriptors: ReadonlyArray<CapabilityDescriptor>) => {
  const nodeIndexes = MutableHashMap.empty<CapabilityId, Graph.NodeIndex>();
  const enabled = MutableHashSet.empty<CapabilityId>();
  for (const descriptor of descriptors) {
    MutableHashSet.add(enabled, descriptor.id);
  }
  return Graph.mutate(Graph.directed<CapabilityId, CapabilityId>(), (mutable) => {
    for (const descriptor of descriptors) {
      MutableHashMap.set(nodeIndexes, descriptor.id, Graph.addNode(mutable, descriptor.id));
    }
    for (const descriptor of descriptors) {
      for (const dependency of descriptor.dependencies) {
        if (MutableHashSet.has(enabled, dependency)) {
          const source = MutableHashMap.get(nodeIndexes, descriptor.id);
          const target = MutableHashMap.get(nodeIndexes, dependency);
          if (O.isSome(source) && O.isSome(target)) {
            Graph.addEdge(mutable, source.value, target.value, dependency);
          }
        }
      }
    }
  });
};

const dependencyCycle = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  index: MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor>
): O.Option<A.NonEmptyReadonlyArray<CapabilityId>> => {
  const visiting = MutableHashSet.empty<CapabilityId>();
  const visited = MutableHashSet.empty<CapabilityId>();
  const enabled = MutableHashSet.empty<CapabilityId>();
  for (const descriptor of descriptors) {
    MutableHashSet.add(enabled, descriptor.id);
  }

  const visit = (
    capabilityId: CapabilityId,
    stack: ReadonlyArray<CapabilityId>
  ): O.Option<A.NonEmptyReadonlyArray<CapabilityId>> => {
    if (MutableHashSet.has(visiting, capabilityId)) {
      return O.some(
        A.append(
          A.dropWhile(stack, (candidate) => !Equal.equals(candidate, capabilityId)),
          capabilityId
        )
      );
    }
    if (MutableHashSet.has(visited, capabilityId)) {
      return O.none();
    }

    MutableHashSet.add(visiting, capabilityId);
    const descriptor = MutableHashMap.get(index, capabilityId);
    if (O.isSome(descriptor)) {
      for (const dependency of descriptor.value.dependencies) {
        if (MutableHashSet.has(enabled, dependency)) {
          const found = visit(dependency, A.append(stack, capabilityId));
          if (O.isSome(found)) {
            return found;
          }
        }
      }
    }
    MutableHashSet.remove(visiting, capabilityId);
    MutableHashSet.add(visited, capabilityId);
    return O.none();
  };

  for (const descriptor of descriptors) {
    const found = visit(descriptor.id, []);
    if (O.isSome(found)) {
      return found;
    }
  }
  return O.none();
};

const defaultCommands = (descriptors: ReadonlyArray<CapabilityDescriptor>): ReadonlyArray<ResolvedCommand> =>
  A.flatMap(descriptors, (descriptor) =>
    A.map(descriptor.commands, (command) =>
      ResolvedCommand.make({
        id: command.id,
        capabilityId: descriptor.id,
        label: command.label,
        helpText: command.helpText,
        surfaces: command.surfaces,
        keybindings: command.keybindings,
      })
    )
  );

const applyOverrides = (
  commands: ReadonlyArray<ResolvedCommand>,
  profile: EditorProfile
): Result.Result<ReadonlyArray<ResolvedCommand>, UnknownCommandError> => {
  for (const override of profile.keybindingOverrides) {
    if (!A.some(commands, (command) => Equal.equals(command.id, override.commandId))) {
      return Result.fail(
        UnknownCommandError.make({
          profileId: profile.id,
          commandId: override.commandId,
        })
      );
    }
  }

  return Result.succeed(
    A.map(commands, (command) => {
      const override = A.findFirst(profile.keybindingOverrides, (candidate) =>
        Equal.equals(candidate.commandId, command.id)
      );
      return ResolvedCommand.make({
        id: command.id,
        capabilityId: command.capabilityId,
        label: command.label,
        helpText: command.helpText,
        surfaces: command.surfaces,
        keybindings: O.isSome(override) ? override.value.keybindings : command.keybindings,
      });
    })
  );
};

const keybindingConflict = (
  commands: ReadonlyArray<ResolvedCommand>,
  profile: EditorProfile
): O.Option<KeybindingConflictError> => {
  const bindings = A.flatMap(commands, (command) =>
    A.map(command.keybindings, (keybinding) => ({ commandId: command.id, keybinding }))
  );

  for (const binding of bindings) {
    const collisions = A.filter(
      bindings,
      (candidate) =>
        Equal.equals(candidate.keybinding.platform, binding.keybinding.platform) &&
        Equal.equals(candidate.keybinding.chord, binding.keybinding.chord)
    );
    if (A.length(collisions) > 1) {
      return A.match(collisions, {
        onEmpty: O.none,
        onNonEmpty: (nonEmpty) =>
          O.some(
            KeybindingConflictError.make({
              profileId: profile.id,
              platform: binding.keybinding.platform,
              chord: binding.keybinding.chord,
              commandIds: A.map(nonEmpty, ({ commandId }) => commandId),
            })
          ),
      });
    }
  }
  return O.none();
};

const findRegistrationOwner = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  registration: string
): O.Option<CapabilityDescriptor> =>
  A.findFirst(
    descriptors,
    (descriptor) =>
      A.contains(descriptor.registrations.nodes, registration) ||
      A.contains(descriptor.registrations.extensions, registration) ||
      A.contains(descriptor.registrations.transformers, registration)
  );

/**
 * Resolves a profile into a deterministic runtime plan without effects or hidden defaults.
 *
 * **Details**
 *
 * Validation follows the ratified first-failure order: unknown ids, profile kind,
 * dependencies, cycles, conflicts, registration invariants, commands, and chords.
 * Successful registrations and commands always follow catalog declaration order.
 *
 * **Example** (Resolve an empty catalog)
 *
 * ```ts
 * import { resolveEditorProfile } from "@beep/editor/capability/resolver"
 * import { EditorProfile, ProfileId } from "@beep/editor/capability/schemas"
 * import { Result } from "effect"
 *
 * const result = resolveEditorProfile([], EditorProfile.make({
 *   id: ProfileId.make("editor.empty"), capabilities: []
 * }))
 * console.log(Result.isSuccess(result)) // true
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const resolveEditorProfile: {
  (
    profile: EditorProfile
  ): (catalog: CapabilityCatalog) => Result.Result<ResolvedEditorProfile, ProfileResolutionError>;
  (catalog: CapabilityCatalog, profile: EditorProfile): Result.Result<ResolvedEditorProfile, ProfileResolutionError>;
} = dual(
  2,
  (
    catalog: CapabilityCatalog,
    profile: EditorProfile
  ): Result.Result<ResolvedEditorProfile, ProfileResolutionError> => {
    const index = descriptorIndex(catalog);
    for (const capabilityId of profile.capabilities) {
      if (!MutableHashMap.has(index, capabilityId)) {
        return Result.fail(UnknownCapabilityError.make({ profileId: profile.id, capabilityId }));
      }
    }

    const enabled = enabledIdSet(profile);
    const descriptors = enabledDescriptors(catalog, enabled);

    for (const descriptor of descriptors) {
      if (CapabilityDispositionDevelopmentOnly(descriptor) && !Equal.equals(profile.kind, "development-reference")) {
        return Result.fail(DevelopmentOnlyCapabilityError.make({ profileId: profile.id, capabilityId: descriptor.id }));
      }
    }

    for (const descriptor of descriptors) {
      for (const dependency of descriptor.dependencies) {
        if (!MutableHashSet.has(enabled, dependency)) {
          return Result.fail(
            MissingDependencyError.make({
              profileId: profile.id,
              capabilityId: descriptor.id,
              dependencyId: dependency,
            })
          );
        }
      }
    }

    const graph = makeDependencyGraph(descriptors);
    if (!Graph.isAcyclic(graph)) {
      const cycle = dependencyCycle(descriptors, index);
      if (O.isSome(cycle)) {
        return Result.fail(DependencyCycleError.make({ profileId: profile.id, cycle: cycle.value }));
      }
    }

    for (const descriptor of descriptors) {
      for (const conflict of descriptor.conflicts) {
        if (MutableHashSet.has(enabled, conflict)) {
          return Result.fail(
            CapabilityConflictError.make({
              profileId: profile.id,
              capabilityId: descriptor.id,
              conflictsWith: conflict,
            })
          );
        }
      }
    }

    const nodes = A.flatMap(catalog, (descriptor) => descriptor.registrations.nodes);
    const extensions = A.flatMap(descriptors, (descriptor) => descriptor.registrations.extensions);
    const transformers = A.flatMap(descriptors, (descriptor) => descriptor.registrations.transformers);

    if (A.length(transformers) > 0 && !A.contains(extensions, "MarkdownShortcutPlugin")) {
      const owner = A.findFirst(descriptors, (descriptor) => A.length(descriptor.registrations.transformers) > 0);
      if (O.isSome(owner)) {
        return A.match(owner.value.registrations.transformers, {
          onEmpty: () =>
            Result.fail(
              IncompatibleRegistrationError.make({
                profileId: profile.id,
                capabilityId: owner.value.id,
                registration: "unknown-transformer",
                reason: "transformer requires interchange.markdown",
              })
            ),
          onNonEmpty: ([registration]) =>
            Result.fail(
              IncompatibleRegistrationError.make({
                profileId: profile.id,
                capabilityId: owner.value.id,
                registration,
                reason: "transformer requires interchange.markdown",
              })
            ),
        });
      }
    }

    if (A.contains(extensions, "CheckListPlugin") && !A.contains(extensions, "ListPlugin")) {
      const owner = findRegistrationOwner(descriptors, "CheckListPlugin");
      if (O.isSome(owner)) {
        return Result.fail(
          IncompatibleRegistrationError.make({
            profileId: profile.id,
            capabilityId: owner.value.id,
            registration: "CheckListPlugin",
            reason: "CheckListPlugin requires ListPlugin",
          })
        );
      }
    }

    const commandResult = applyOverrides(defaultCommands(descriptors), profile);
    if (Result.isFailure(commandResult)) {
      return Result.fail(commandResult.failure);
    }
    const commandConflict = keybindingConflict(commandResult.success, profile);
    if (O.isSome(commandConflict)) {
      return Result.fail(commandConflict.value);
    }

    const disabledDescriptors: ReadonlyArray<CapabilityDescriptor> = A.filter(
      catalog,
      (descriptor) => !MutableHashSet.has(enabled, descriptor.id)
    );
    const guardedChords: ReadonlyArray<Keybinding> = A.flatMap(disabledDescriptors, (descriptor) =>
      A.flatMap(descriptor.commands, (command) => command.keybindings)
    );

    return Result.succeed(
      ResolvedEditorProfile.make({
        profileId: profile.id,
        kind: profile.kind,
        capabilities: A.map(catalog, (descriptor) =>
          ResolvedCapability.make({
            id: descriptor.id,
            mode: MutableHashSet.has(enabled, descriptor.id) ? ("authoring" as const) : ("read-only" as const),
            readOnlyFallback: descriptor.readOnlyFallback,
          })
        ),
        registrations: CapabilityRegistrations.make({ nodes, extensions, transformers }),
        commands: commandResult.success,
        guardedChords,
      })
    );
  }
);

const CapabilityDispositionDevelopmentOnly = (descriptor: CapabilityDescriptor): boolean =>
  Equal.equals(descriptor.classification.disposition, "development-only");

/**
 * Effect wrapper for {@link resolveEditorProfile} with the same typed failure channel.
 *
 * **Example** (Resolve through Effect)
 *
 * ```ts
 * import { resolveEditorProfileEffect } from "@beep/editor/capability/resolver"
 * import { EditorProfile, ProfileId } from "@beep/editor/capability/schemas"
 * import { Effect } from "effect"
 *
 * const program = resolveEditorProfileEffect([], EditorProfile.make({
 *   id: ProfileId.make("editor.empty"), capabilities: []
 * }))
 * Effect.runPromise(program).then((resolved) => console.log(resolved.commands))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const resolveEditorProfileEffect = Effect.fn("EditorCapability.resolveEditorProfile")(function* (
  catalog: CapabilityCatalog,
  profile: EditorProfile
) {
  return yield* Effect.fromResult(resolveEditorProfile(catalog, profile));
});
