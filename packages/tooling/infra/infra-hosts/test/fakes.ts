// Hermetic provider layers for the host stack tests: fake Docker providers that
// record the props each resource is reconciled with, and Alchemy's real
// `Command.Exec` provider over a fake executor that records every command
// instead of running it. Nothing here touches Docker, SSH or a shell.

import * as Docker from "@alchemy.run/docker";
import * as Command from "alchemy/Command";
import * as Provider from "alchemy/Provider";
import * as State from "alchemy/State";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";

export interface Recording {
  /** Commands the fake executor received, in order. */
  readonly commands: Array<{ readonly command: string; readonly env: Record<string, unknown> }>;
  /** Volumes the fake engine already holds, for `Docker.Volume.lookup`. */
  readonly existingVolumes: ReadonlyArray<string>;
  /** Props each resource was last reconciled with, keyed by `<type>/<logical id>`. */
  readonly props: MutableHashMap.MutableHashMap<string, unknown>;
}

export const makeRecording = (existingVolumes: ReadonlyArray<string> = []): Recording => ({
  props: MutableHashMap.empty(),
  commands: [],
  existingVolumes,
});

const record = (recording: Recording, type: string, id: string, news: unknown) =>
  Effect.sync(() => MutableHashMap.set(recording.props, `${type}/${id}`, news));

const fakeContext = (recording: Recording) =>
  Provider.succeed(Docker.Context, {
    list: () => Effect.succeed([]),
    reconcile: ({ id, news }) =>
      record(recording, "Docker.Context", id, news).pipe(
        Effect.as({
          id: news.name ?? id,
          name: news.name ?? id,
          description: news.description ?? "",
          ...(news.docker === undefined ? {} : { docker: news.docker }),
        })
      ),
    delete: () => Effect.void,
  });

const fakeNetwork = (recording: Recording) =>
  Provider.succeed(Docker.Network, {
    list: () => Effect.succeed([]),
    reconcile: ({ id, news }) =>
      record(recording, "Docker.Network", id, news).pipe(
        Effect.as({
          id: `network-${id}`,
          name: news.name ?? id,
          driver: news.driver ?? "bridge",
          internal: false,
          attachable: false,
          enableIPv4: true,
          enableIPv6: false,
          driverOpts: {},
          ipam: { driver: "default", options: {}, config: [] },
          labels: {},
          createdAt: 0,
        })
      ),
    delete: () => Effect.void,
  });

const volumeAttributes = (name: string) => ({
  id: name,
  name,
  driver: "local",
  driverOpts: {},
  labels: {},
  createdAt: 0,
});

const fakeVolume = (recording: Recording) =>
  Provider.succeed(Docker.Volume, {
    list: () => Effect.succeed([]),
    lookup: ({ name }) =>
      Effect.succeed(A.contains(recording.existingVolumes, name) ? volumeAttributes(name) : undefined),
    reconcile: ({ id, news }) =>
      record(recording, "Docker.Volume", id, news).pipe(Effect.as(volumeAttributes(news.name ?? id))),
    delete: () => Effect.void,
  });

const fakeContainer = (recording: Recording) =>
  Provider.succeed(Docker.Container, {
    list: () => Effect.succeed([]),
    reconcile: ({ id, news }) =>
      record(recording, "Docker.Container", id, news).pipe(
        Effect.as({
          id: `container-${id}`,
          name: news.name ?? id,
          status: "running" as const,
          createdAt: 0,
          imageRef: typeof news.image === "string" ? news.image : news.image.imageRef,
          ports: {},
        })
      ),
    delete: () => Effect.void,
  });

/** Fake Docker provider collection, shaped like `Docker.providers()`. */
export const fakeDockerProviders = (recording: Recording) =>
  Layer.effect(
    Docker.Providers,
    Provider.collection([Docker.Container, Docker.Network, Docker.Volume, Docker.Context])
  ).pipe(
    Layer.provide(
      Layer.mergeAll(fakeContainer(recording), fakeNetwork(recording), fakeVolume(recording), fakeContext(recording))
    )
  );

const fakeExecutor = (recording: Recording) =>
  Layer.succeed(Command.CommandExecutor, {
    spawn: Effect.fn("FakeCommandExecutor.spawn")(function* () {
      return yield* Effect.die("the fake executor never spawns");
    }),
    run: Effect.fn("FakeCommandExecutor.run")(function* (props: Command.CommandRunProps) {
      recording.commands.push({ command: props.command, env: { ...props.env } });
      return { exitCode: 0, stdout: "", stderr: "" };
    }),
  });

/** Alchemy's real `Command.Exec` provider over the recording executor. */
export const fakeCommandProviders = (recording: Recording) =>
  Command.ExecProvider().pipe(Layer.provide(fakeExecutor(recording)));

/** A fresh in-memory state store whose contents the test can read back. */
export const makeInspectableState = () => {
  const store: NonNullable<Parameters<typeof State.inMemoryState>[0]> = {};
  const outputs: NonNullable<Parameters<typeof State.inMemoryState>[1]> = {};
  return { store, outputs, layer: State.inMemoryState(store, outputs) };
};
