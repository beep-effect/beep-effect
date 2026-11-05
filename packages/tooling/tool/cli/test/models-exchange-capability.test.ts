import {
  ModelsApply,
  ModelsApplyLive,
  ModelsAtomicExchange,
  ModelsAtomicExchangeLive,
  makeModelsAtomicExchange,
  modelsExchangeErrnoFromStderr,
  modelsExchangeHostRefusal,
  modelsExchangeMountOf,
} from "@beep/repo-cli/commands/Models/Models.apply.service";
import {
  ModelsExchangeFault,
  ModelsExchangeLaunchError,
  ModelsExchangeProbeError,
} from "@beep/repo-cli/commands/Models/Models.errors";
import {
  ModelsExchangeFilesystemIdentity,
  ModelsExchangeMount,
} from "@beep/repo-cli/commands/Models/Models.exchange.schemas";
import { LocatorBinding, ModelsLocatorWrite } from "@beep/repo-cli/commands/Models/Models.manifest.schemas";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { makeModelsTestExchangeSystem, modelsTestMountId } from "./helpers/models-atomic-exchange.ts";
import type {
  ModelsAtomicExchangeShape,
  ModelsExchangeSystemShape,
} from "@beep/repo-cli/commands/Models/Models.apply.service";
import type { ModelsExchangeUnsupportedReason } from "@beep/repo-cli/commands/Models/Models.exchange.schemas";

const topLevel = ModelsLocatorWrite.make({
  locator: {
    _tag: "toml-top-level-key",
    binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
    render: { _tag: "verbatim" },
    key: "model",
  },
  expected: "gpt-6.1-sol",
});
const native = '# retained\nmodel = "old"\nunknown = { retained = true }\n';
const probePrefix = ".beep-models-exchange-probe-";

const writerWith = Effect.fn("ModelsExchangeTest.writerWith")(function* (capability: ModelsAtomicExchangeShape) {
  const services = yield* Layer.build(
    ModelsApplyLive.pipe(Layer.provide(Layer.succeed(ModelsAtomicExchange, capability)))
  );
  return Context.get(services, ModelsApply);
});

// Counts probe exchanges and lets a test replace identity, put the target on its
// own mount, refuse with an errno, or fail to launch the exchange.
const countingSystem = Effect.fn("ModelsExchangeTest.countingSystem")(function* (options: {
  readonly refuse?: ModelsExchangeUnsupportedReason;
  readonly device?: () => bigint;
  readonly noop?: boolean;
  readonly targetMount?: { readonly file: string; readonly id: bigint };
  readonly launchFailures?: number;
}) {
  const base = yield* makeModelsTestExchangeSystem();
  const counter = { probes: 0, identities: 0, launches: 0 };
  const system: ModelsExchangeSystemShape = {
    identify: (directory) => {
      counter.identities += 1;
      const device = options.device;
      return device === undefined
        ? base.identify(directory)
        : Effect.succeed(
            ModelsExchangeFilesystemIdentity.make({
              mount: modelsTestMountId,
              device: device(),
              filesystemType: O.none(),
            })
          );
    },
    mount: (target) => {
      const own = options.targetMount;
      return own !== undefined && own.file === target
        ? Effect.succeed(ModelsExchangeMount.make({ id: own.id, point: target }))
        : base.mount(target);
    },
    exchange: (left, right) => {
      counter.launches += 1;
      if (counter.launches <= (options.launchFailures ?? 0))
        return Effect.fail(ModelsExchangeLaunchError.make({ message: "simulated spawn EAGAIN" }));
      counter.probes += 1;
      if (options.refuse !== undefined)
        return Effect.fail(
          ModelsExchangeFault.make({ reason: options.refuse, message: `simulated ${options.refuse}` })
        );
      return options.noop === true ? Effect.void : base.exchange(left, right);
    },
  };
  return { counter, system };
});

const fixture = Effect.fn("ModelsExchangeTest.fixture")(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix });
  const file = path.join(root, "config.toml");
  const backups = path.join(root, "backups");
  yield* fs.writeFileString(file, native, { mode: 0o644 });
  return { backups, file, root };
});

layer(ModelsAtomicExchangeLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))), {
  timeout: "30 seconds",
})((it) => {
  it.effect("probes a supported target filesystem once, caches it and removes the disposable files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { backups, file, root } = yield* fixture("exchange-supported-");
      const sibling = path.join(root, "sibling.toml");
      yield* fs.writeFileString(sibling, native);
      const { counter, system } = yield* countingSystem({});
      const capability = yield* makeModelsAtomicExchange(system);
      const first = yield* capability.qualify(file);
      expect(first.capability._tag).toBe("supported");
      expect(first.directory).toBe(root);
      expect((yield* capability.qualify(sibling)).capability._tag).toBe("supported");
      expect(counter.probes).toBe(1);
      const readDirectory1 = yield* fs.readDirectory(root);
      expect(A.filter(readDirectory1, (entry) => Str.startsWith(probePrefix)(entry))).toEqual([]);
      const writer = yield* writerWith(capability);
      const apply2 = yield* writer.apply(file, [topLevel], "write", backups);
      const journal = O.getOrThrow(apply2);
      const readFileString3 = yield* fs.readFileString(journal.backup);
      expect(readFileString3).toBe(native);
      const readFileString4 = yield* fs.readFileString(file);
      expect(readFileString4).toContain('"gpt-6.1-sol"');
      yield* writer.restore(path.join(backups, `${journal.id}.json`), backups);
      const readFileString5 = yield* fs.readFileString(file);
      expect(readFileString5).toBe(native);
      expect(counter.probes).toBe(3);
      const readDirectory6 = yield* fs.readDirectory(root);
      expect(A.filter(readDirectory6, (entry) => Str.startsWith(probePrefix)(entry))).toEqual([]);
    })
  );

  it.effect("re-probes when the target filesystem identity changes", () =>
    Effect.gen(function* () {
      const { file } = yield* fixture("exchange-identity-");
      let device = 1n;
      const { counter, system } = yield* countingSystem({ device: () => device });
      const capability = yield* makeModelsAtomicExchange(system);
      yield* capability.qualify(file);
      yield* capability.qualify(file);
      expect(counter.probes).toBe(1);
      device = 2n;
      const changed = yield* capability.qualify(file);
      expect(changed.identity.device).toBe(2n);
      expect(counter.probes).toBe(2);
      device = 1n;
      yield* capability.qualify(file);
      expect(counter.probes).toBe(2);
      expect(counter.identities).toBe(4);
    })
  );

  for (const errno of ["exdev", "einval", "eperm"] as const) {
    it.effect(`refuses a ${errno} target filesystem before backup or publication`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { backups, file, root } = yield* fixture(`exchange-${errno}-`);
        const { counter, system } = yield* countingSystem({ refuse: errno });
        const madeModelsAtomicExchange = yield* makeModelsAtomicExchange(system);
        const writer = yield* writerWith(madeModelsAtomicExchange);
        for (const _attempt of [0, 1]) {
          const error = yield* Effect.flip(writer.apply(file, [topLevel], "write", backups));
          expect(error._tag).toBe("ModelsLocatorError");
          expect(error.reason).toBe("exchange-unsupported");
          expect(error.message).toContain(`Atomic exchange unsupported on the target filesystem (${errno}:`);
          expect(error.message).not.toContain("Journal:");
          const exists7 = yield* fs.exists(backups);
          expect(exists7).toBe(false);
          const readFileString8 = yield* fs.readFileString(file);
          expect(readFileString8).toBe(native);
          const readDirectory9 = yield* fs.readDirectory(root);
          expect(readDirectory9).toEqual(["config.toml"]);
        }
        expect(counter.probes).toBe(1);
      })
    );
  }

  it.effect("refuses restore on an unsupported filesystem without touching the applied target", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { backups, file, root } = yield* fixture("exchange-restore-");
      const supported = yield* countingSystem({});
      const madeModelsAtomicExchange29 = yield* makeModelsAtomicExchange(supported.system);
      const apply10 = yield* (yield* writerWith(madeModelsAtomicExchange29)).apply(file, [topLevel], "write", backups);
      const journal = O.getOrThrow(apply10);
      const applied = yield* fs.readFileString(file);
      const refusing = yield* countingSystem({ refuse: "einval" });
      const madeModelsAtomicExchange11 = yield* makeModelsAtomicExchange(refusing.system);
      const writer = yield* writerWith(madeModelsAtomicExchange11);
      const error = yield* Effect.flip(writer.restore(path.join(backups, `${journal.id}.json`), backups));
      expect(error.reason).toBe("exchange-unsupported");
      expect(error.message).toContain(`Journal: ${journal.id}`);
      const readFileString12 = yield* fs.readFileString(file);
      expect(readFileString12).toBe(applied);
      const readDirectory13 = yield* fs.readDirectory(root);
      expect(
        A.filter(readDirectory13, (entry) => Str.endsWith(".preimage")(entry) || Str.endsWith(".tmp")(entry))
      ).toEqual([]);
      const readFileString14 = yield* fs.readFileString(journal.backup);
      expect(readFileString14).toBe(native);
    })
  );

  it.effect("refuses a same-device bind-mounted target as exdev before probe, backup or journal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { backups, file, root } = yield* fixture("exchange-bind-");
      // Same st_dev as its parent (a real fixture file), but its own mount id.
      const { counter, system } = yield* countingSystem({ targetMount: { file, id: 99n } });
      const capability = yield* makeModelsAtomicExchange(system);
      const { capability: verdict } = yield* capability.qualify(file);
      expect(verdict).toMatchObject({ _tag: "unsupported", reason: "exdev" });
      const error = yield* Effect.flip((yield* writerWith(capability)).apply(file, [topLevel], "write", backups));
      expect(error.reason).toBe("exchange-unsupported");
      expect(error.message).toContain("(exdev: Target is on mount 99");
      expect(error.message).not.toContain("Journal:");
      const exists15 = yield* fs.exists(backups);
      expect(exists15).toBe(false);
      const readFileString16 = yield* fs.readFileString(file);
      expect(readFileString16).toBe(native);
      const readDirectory17 = yield* fs.readDirectory(root);
      expect(readDirectory17).toEqual(["config.toml"]);
      expect(counter.probes).toBe(0);
    })
  );

  it.effect("reports an exchange that cannot launch as an uncached probe failure", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { backups, file, root } = yield* fixture("exchange-launch-");
      const { counter, system } = yield* countingSystem({ launchFailures: 1 });
      const capability = yield* makeModelsAtomicExchange(system);
      const writer = yield* writerWith(capability);
      const error = yield* Effect.flip(writer.apply(file, [topLevel], "write", backups));
      expect(error.reason).toBe("exchange-probe-failed");
      expect(error.message).toContain("no host verdict: simulated spawn EAGAIN");
      const exists18 = yield* fs.exists(backups);
      expect(exists18).toBe(false);
      const readFileString19 = yield* fs.readFileString(file);
      expect(readFileString19).toBe(native);
      const readDirectory20 = yield* fs.readDirectory(root);
      expect(A.filter(readDirectory20, (entry) => Str.startsWith(probePrefix)(entry))).toEqual([]);
      // Not cached: the next qualification probes again and the host verdict is supported.
      expect((yield* capability.qualify(file)).capability._tag).toBe("supported");
      expect(counter.launches).toBe(2);
      expect(counter.probes).toBe(1);
      const apply21 = yield* writer.apply(file, [topLevel], "write", backups);
      const journal = O.getOrThrow(apply21);
      const readFileString22 = yield* fs.readFileString(journal.backup);
      expect(readFileString22).toBe(native);
      expect(counter.probes).toBe(2);
      // A launch failure during publication keeps the retain-artifacts boundary.
      const publishing = yield* makeModelsAtomicExchange({
        ...system,
        exchange: () => Effect.fail(ModelsExchangeLaunchError.make({ message: "simulated signal" })),
      });
      const published = yield* Effect.flip(publishing.exchange(file, journal.backup));
      expect(published.message).toContain("retain recovery artifacts. (launch: simulated signal)");
    })
  );

  it.effect("treats an exchange that leaves the probe files in place as unsupported", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { file, root } = yield* fixture("exchange-noop-");
      const { system } = yield* countingSystem({ noop: true });
      const { capability } = yield* (yield* makeModelsAtomicExchange(system)).qualify(file);
      expect(capability).toMatchObject({ _tag: "unsupported", reason: "unknown" });
      const readDirectory23 = yield* fs.readDirectory(root);
      expect(A.filter(readDirectory23, (entry) => Str.startsWith(probePrefix)(entry))).toEqual([]);
    })
  );

  it.effect("fails typed when the target filesystem cannot be identified and refuses before backup", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { backups, file } = yield* fixture("exchange-probe-error-");
      const { counter, system } = yield* countingSystem({});
      const capability = yield* makeModelsAtomicExchange({
        ...system,
        identify: (directory) => Effect.fail(ModelsExchangeProbeError.make({ message: "simulated", path: directory })),
      });
      const probeError = yield* Effect.flip(capability.qualify(file));
      expect(probeError._tag).toBe("ModelsExchangeProbeError");
      const error = yield* Effect.flip((yield* writerWith(capability)).apply(file, [topLevel], "write", backups));
      expect(error.reason).toBe("exchange-probe-failed");
      const exists24 = yield* fs.exists(backups);
      expect(exists24).toBe(false);
      const readFileString25 = yield* fs.readFileString(file);
      expect(readFileString25).toBe(native);
      expect(counter.probes).toBe(0);
      const missing = yield* Effect.flip(capability.qualify(`${file}.absent`));
      expect(missing._tag).toBe("ModelsExchangeProbeError");
    })
  );

  it.effect("qualifies a disposable target through the live primitives and cleans up", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const { file, root } = yield* fixture("exchange-live-");
      const live = yield* ModelsAtomicExchange;
      const qualification = yield* live.qualify(file);
      expect(["supported", "unsupported"]).toContain(qualification.capability._tag);
      expect(qualification.identity.device).toBe((yield* fs.stat(root)).dev);
      const readFileString26 = yield* fs.readFileString(file);
      expect(readFileString26).toBe(native);
      const readDirectory27 = yield* fs.readDirectory(root);
      expect(readDirectory27).toEqual(["config.toml"]);
      const left = `${file}.left`;
      yield* fs.writeFileString(left, "left");
      const exchanged = yield* live.exchange(left, file).pipe(Effect.result);
      if (qualification.capability._tag === "supported") {
        expect(exchanged._tag).toBe("Success");
        const readFileString28 = yield* fs.readFileString(file);
        expect(readFileString28).toBe("left");
      }
      const refused = yield* Effect.flip(live.exchange(`${file}.absent`, file));
      expect(refused.message).toContain("Atomic exchange failed; retain recovery artifacts.");
    })
  );

  it("separates host refusals from runs that gave no host verdict", () => {
    const refusal = "mv: cannot exchange 'a' and 'b': Invalid cross-device link";
    expect(O.getOrNull(modelsExchangeHostRefusal(1, refusal))).toBe("exdev");
    expect(O.getOrNull(modelsExchangeHostRefusal(1, "mv: something unexpected"))).toBe("unknown");
    assertNone(modelsExchangeHostRefusal(1, "  \n"));
    assertNone(modelsExchangeHostRefusal(137, refusal));
    assertNone(modelsExchangeHostRefusal(-1, refusal));
  });

  it("resolves the containing mount from mountinfo, including bind-mounted files", () => {
    const table = A.join(
      [
        "1 0 8:1 / / rw,relatime - ext4 /dev/sda1 rw",
        "22 1 8:1 /home /home rw - ext4 /dev/sda1 rw",
        "30 22 0:40 / /home/me/My\\040Config rw - tmpfs tmpfs rw",
        "31 30 0:41 / /home/me/My\\040Config rw - tmpfs tmpfs rw",
        "40 22 8:1 /srv/app.toml /home/me/app.toml rw - ext4 /dev/sda1 rw",
        "garbage",
        "x 1 8:1 / /broken rw - ext4 /dev/sda1 rw",
        "",
      ],
      "\n"
    );
    const idOf = (target: string) => O.map(modelsExchangeMountOf(table, target), (mount) => mount.id);
    expect(O.getOrNull(idOf("/home/me/app.toml"))).toBe(40n);
    expect(O.getOrNull(idOf("/home/me"))).toBe(22n);
    expect(O.getOrNull(idOf("/home/me/app.toml.tmp"))).toBe(22n);
    expect(O.getOrNull(idOf("/home/me/My Config/settings.json"))).toBe(31n);
    expect(O.getOrNull(idOf("/etc/hosts"))).toBe(1n);
    expect(O.getOrNull(idOf("/broken/file"))).toBe(1n);
    assertSome(
      O.map(modelsExchangeMountOf(table, "/home/me/My Config"), (mount) => mount.point),
      "/home/me/My Config"
    );
    assertNone(modelsExchangeMountOf("", "/etc"));
  });

  it("maps C-locale exchange errno text onto typed reasons", () => {
    const cases: ReadonlyArray<readonly [string, ModelsExchangeUnsupportedReason]> = [
      ["mv: cannot exchange 'a' and 'b': Invalid cross-device link", "exdev"],
      ["mv: cannot exchange 'a' and 'b': Invalid argument", "einval"],
      ["mv: cannot exchange 'a' and 'b': Operation not permitted", "eperm"],
      ["mv: cannot exchange 'a' and 'b': Function not implemented", "enosys"],
      ["mv: unrecognized option '--exchange'", "unknown"],
      ["", "unknown"],
    ];
    for (const [stderr, reason] of cases) expect(modelsExchangeErrnoFromStderr(stderr)).toBe(reason);
  });
});
