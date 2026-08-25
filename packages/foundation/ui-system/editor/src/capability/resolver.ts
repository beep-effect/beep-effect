/**
 * Pure deterministic resolver from app-owned profiles to editor runtime plans.
 *
 * @packageDocumentation \@beep/editor/capability/resolver
 * @since 0.0.0
 */

import { A, dual, O } from "@beep/utils";
import { Effect, Equal, Graph, MutableHashMap, MutableHashSet, pipe, Result } from "effect";
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

const addDependencyNodes = (
  mutable: Graph.MutableDirectedGraph<CapabilityId, CapabilityId>,
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  nodeIndexes: MutableHashMap.MutableHashMap<CapabilityId, Graph.NodeIndex>
): void => {
  for (const descriptor of descriptors) {
    MutableHashMap.set(nodeIndexes, descriptor.id, Graph.addNode(mutable, descriptor.id));
  }
};

const addDescriptorEdges = (
  mutable: Graph.MutableDirectedGraph<CapabilityId, CapabilityId>,
  descriptor: CapabilityDescriptor,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  nodeIndexes: MutableHashMap.MutableHashMap<CapabilityId, Graph.NodeIndex>
): void => {
  for (const dependency of descriptor.dependencies) {
    if (MutableHashSet.has(enabled, dependency)) {
      const source = MutableHashMap.get(nodeIndexes, descriptor.id);
      const target = MutableHashMap.get(nodeIndexes, dependency);
      if (O.isSome(source) && O.isSome(target)) {
        Graph.addEdge(mutable, source.value, target.value, dependency);
      }
    }
  }
};

const addDependencyEdges = (
  mutable: Graph.MutableDirectedGraph<CapabilityId, CapabilityId>,
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  nodeIndexes: MutableHashMap.MutableHashMap<CapabilityId, Graph.NodeIndex>
): void => {
  for (const descriptor of descriptors) {
    addDescriptorEdges(mutable, descriptor, enabled, nodeIndexes);
  }
};

const makeDependencyGraph = (descriptors: ReadonlyArray<CapabilityDescriptor>) => {
  const nodeIndexes = MutableHashMap.empty<CapabilityId, Graph.NodeIndex>();
  const enabled = MutableHashSet.empty<CapabilityId>();
  for (const descriptor of descriptors) {
    MutableHashSet.add(enabled, descriptor.id);
  }
  return Graph.mutate(Graph.directed<CapabilityId, CapabilityId>(), (mutable) => {
    addDependencyNodes(mutable, descriptors, nodeIndexes);
    addDependencyEdges(mutable, descriptors, enabled, nodeIndexes);
  });
};

const cycleFromStack = (
  stack: ReadonlyArray<CapabilityId>,
  capabilityId: CapabilityId
): A.NonEmptyReadonlyArray<CapabilityId> =>
  A.append(
    A.dropWhile(stack, (candidate) => !Equal.equals(candidate, capabilityId)),
    capabilityId
  );

const visitDependencies = (
  dependencies: ReadonlyArray<CapabilityId>,
  stack: ReadonlyArray<CapabilityId>,
  index: MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor>,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  visiting: MutableHashSet.MutableHashSet<CapabilityId>,
  visited: MutableHashSet.MutableHashSet<CapabilityId>
): O.Option<A.NonEmptyReadonlyArray<CapabilityId>> =>
  A.reduce(dependencies, O.none<A.NonEmptyReadonlyArray<CapabilityId>>(), (found, dependency) =>
    O.orElse(found, () =>
      MutableHashSet.has(enabled, dependency)
        ? visitCapability(dependency, stack, index, enabled, visiting, visited)
        : O.none()
    )
  );

const visitCapability = (
  capabilityId: CapabilityId,
  stack: ReadonlyArray<CapabilityId>,
  index: MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor>,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  visiting: MutableHashSet.MutableHashSet<CapabilityId>,
  visited: MutableHashSet.MutableHashSet<CapabilityId>
): O.Option<A.NonEmptyReadonlyArray<CapabilityId>> => {
  if (MutableHashSet.has(visiting, capabilityId)) {
    return O.some(cycleFromStack(stack, capabilityId));
  }
  if (MutableHashSet.has(visited, capabilityId)) {
    return O.none();
  }

  MutableHashSet.add(visiting, capabilityId);
  const nextStack = A.append(stack, capabilityId);
  const found = pipe(
    MutableHashMap.get(index, capabilityId),
    O.flatMap((descriptor) => visitDependencies(descriptor.dependencies, nextStack, index, enabled, visiting, visited))
  );
  if (O.isNone(found)) {
    MutableHashSet.remove(visiting, capabilityId);
    MutableHashSet.add(visited, capabilityId);
  }
  return found;
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
  return A.reduce(descriptors, O.none<A.NonEmptyReadonlyArray<CapabilityId>>(), (found, descriptor) =>
    O.orElse(found, () => visitCapability(descriptor.id, [], index, enabled, visiting, visited))
  );
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

const firstSome = <A, B>(values: ReadonlyArray<A>, find: (value: A) => O.Option<B>): O.Option<B> =>
  A.reduce(values, O.none<B>(), (found, value) => O.orElse(found, () => find(value)));

const CapabilityDispositionDevelopmentOnly = (descriptor: CapabilityDescriptor): boolean =>
  Equal.equals(descriptor.classification.disposition, "development-only");

const unknownCapability = (
  index: MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  pipe(
    A.findFirst(profile.capabilities, (capabilityId) => !MutableHashMap.has(index, capabilityId)),
    O.map((capabilityId) => UnknownCapabilityError.make({ profileId: profile.id, capabilityId }))
  );

const developmentOnlyInProduction = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  pipe(
    A.findFirst(
      descriptors,
      (descriptor) =>
        CapabilityDispositionDevelopmentOnly(descriptor) && !Equal.equals(profile.kind, "development-reference")
    ),
    O.map((descriptor) => DevelopmentOnlyCapabilityError.make({ profileId: profile.id, capabilityId: descriptor.id }))
  );

const missingDependency = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  firstSome(descriptors, (descriptor) =>
    pipe(
      A.findFirst(descriptor.dependencies, (dependency) => !MutableHashSet.has(enabled, dependency)),
      O.map((dependencyId) =>
        MissingDependencyError.make({
          profileId: profile.id,
          capabilityId: descriptor.id,
          dependencyId,
        })
      )
    )
  );

const dependencyCycleError = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  index: MutableHashMap.MutableHashMap<CapabilityId, CapabilityDescriptor>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  Graph.isAcyclic(makeDependencyGraph(descriptors))
    ? O.none()
    : pipe(
        dependencyCycle(descriptors, index),
        O.map((cycle) => DependencyCycleError.make({ profileId: profile.id, cycle }))
      );

const capabilityConflict = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  firstSome(descriptors, (descriptor) =>
    pipe(
      A.findFirst(descriptor.conflicts, (conflict) => MutableHashSet.has(enabled, conflict)),
      O.map((conflictsWith) =>
        CapabilityConflictError.make({
          profileId: profile.id,
          capabilityId: descriptor.id,
          conflictsWith,
        })
      )
    )
  );

const transformerRegistrationError = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  pipe(
    A.findFirst(descriptors, (descriptor) => A.length(descriptor.registrations.transformers) > 0),
    O.map((owner) =>
      A.match(owner.registrations.transformers, {
        onEmpty: () =>
          IncompatibleRegistrationError.make({
            profileId: profile.id,
            capabilityId: owner.id,
            registration: "unknown-transformer",
            reason: "transformer requires interchange.markdown",
          }),
        onNonEmpty: ([registration]) =>
          IncompatibleRegistrationError.make({
            profileId: profile.id,
            capabilityId: owner.id,
            registration,
            reason: "transformer requires interchange.markdown",
          }),
      })
    )
  );

const checklistRegistrationError = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  pipe(
    findRegistrationOwner(descriptors, "CheckListPlugin"),
    O.map((owner) =>
      IncompatibleRegistrationError.make({
        profileId: profile.id,
        capabilityId: owner.id,
        registration: "CheckListPlugin",
        reason: "CheckListPlugin requires ListPlugin",
      })
    )
  );

const incompatibleRegistration = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  extensions: ReadonlyArray<string>,
  transformers: ReadonlyArray<string>,
  profile: EditorProfile
): O.Option<ProfileResolutionError> =>
  pipe(
    A.length(transformers) > 0 && !A.contains(extensions, "MarkdownShortcutPlugin")
      ? transformerRegistrationError(descriptors, profile)
      : O.none(),
    O.orElse(() =>
      A.contains(extensions, "CheckListPlugin") && !A.contains(extensions, "ListPlugin")
        ? checklistRegistrationError(descriptors, profile)
        : O.none()
    )
  );

const resolvedCommands = (
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  profile: EditorProfile
): Result.Result<ReadonlyArray<ResolvedCommand>, ProfileResolutionError> =>
  pipe(
    applyOverrides(defaultCommands(descriptors), profile),
    Result.flatMap((commands) =>
      pipe(
        keybindingConflict(commands, profile),
        O.match({
          onNone: () => Result.succeed(commands),
          onSome: Result.fail,
        })
      )
    )
  );

const guardedChordsOf = (
  catalog: CapabilityCatalog,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>
): ReadonlyArray<Keybinding> =>
  pipe(
    catalog,
    A.filter((descriptor) => !MutableHashSet.has(enabled, descriptor.id)),
    A.flatMap((descriptor) => A.flatMap(descriptor.commands, (command) => command.keybindings))
  );

const assembleResolved = (
  catalog: CapabilityCatalog,
  profile: EditorProfile,
  enabled: MutableHashSet.MutableHashSet<CapabilityId>,
  descriptors: ReadonlyArray<CapabilityDescriptor>,
  commands: ReadonlyArray<ResolvedCommand>
): ResolvedEditorProfile =>
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
    registrations: CapabilityRegistrations.make({
      nodes: A.flatMap(catalog, (descriptor) => descriptor.registrations.nodes),
      extensions: A.flatMap(descriptors, (descriptor) => descriptor.registrations.extensions),
      transformers: A.flatMap(descriptors, (descriptor) => descriptor.registrations.transformers),
    }),
    commands,
    guardedChords: guardedChordsOf(catalog, enabled),
  });

const firstResolutionError = (
  checks: ReadonlyArray<() => O.Option<ProfileResolutionError>>
): O.Option<ProfileResolutionError> =>
  A.reduce(checks, O.none<ProfileResolutionError>(), (error, check) => O.orElse(error, check));

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
    const enabled = enabledIdSet(profile);
    const descriptors = enabledDescriptors(catalog, enabled);
    const extensions = A.flatMap(descriptors, (descriptor) => descriptor.registrations.extensions);
    const transformers = A.flatMap(descriptors, (descriptor) => descriptor.registrations.transformers);
    const error = firstResolutionError([
      () => unknownCapability(index, profile),
      () => developmentOnlyInProduction(descriptors, profile),
      () => missingDependency(descriptors, enabled, profile),
      () => dependencyCycleError(descriptors, index, profile),
      () => capabilityConflict(descriptors, enabled, profile),
      () => incompatibleRegistration(descriptors, extensions, transformers, profile),
    ]);

    return pipe(
      error,
      O.match({
        onSome: Result.fail,
        onNone: () =>
          pipe(
            resolvedCommands(descriptors, profile),
            Result.map((commands) => assembleResolved(catalog, profile, enabled, descriptors, commands))
          ),
      })
    );
  }
);

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
