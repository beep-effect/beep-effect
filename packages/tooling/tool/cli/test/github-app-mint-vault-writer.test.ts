import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  GitHubAppVaultWriter,
  preflightGitHubAppVaultWriter,
  resolveGitHubAppVaultWriter,
} from "@beep/repo-cli/commands/Github";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { SpawnScript } from "@beep/commands/ScriptedSpawner";

// The vault writer the mint stores credentials with, and the create-then-delete preflight that runs
// before the loopback server listens. Every process is scripted; no vault is touched. The command-level
// refusal before the server binds is in github-app-mint-serve.test.ts, which replaces the Bun server.

const PREFLIGHT_TITLE = "beep github app mint preflight fixture-nonce";
const opHuman = GitHubAppVaultWriter.make({ command: "op-human", source: "op-human" });

const resolveWith = (script: SpawnScript, override: O.Option<string>) => {
  const spawner = ScriptedSpawner.make(script);
  return Effect.map(resolveGitHubAppVaultWriter(override).pipe(provideSpawner(spawner)), (writer) => ({
    writer,
    spawns: A.map(spawner.spawns, (spawn) => [spawn.command, ...spawn.args]),
  }));
};

const preflightWith = (createExit: number, deleteExit: number) => {
  const spawner = ScriptedSpawner.make((command) => ({ exit: command === "bash" ? createExit : deleteExit }));
  return Effect.map(
    Effect.result(preflightGitHubAppVaultWriter(opHuman, "fixture-nonce").pipe(provideSpawner(spawner))),
    (result) => ({ result, spawns: A.map(spawner.spawns, (spawn) => [spawn.command, ...spawn.args]) })
  );
};

describe("github app mint vault writer", () => {
  it.effect(
    "an explicit override wins without probing PATH",
    Effect.fnUntraced(function* () {
      const { writer, spawns } = yield* resolveWith(() => ({ exit: 0 }), O.some("/opt/op"));
      expect(writer).toEqual(GitHubAppVaultWriter.make({ command: "/opt/op", source: "override" }));
      expect(spawns).toEqual([]);
    })
  );

  it.effect(
    "prefers op-human on PATH and ignores an empty override",
    Effect.fnUntraced(function* () {
      const { writer, spawns } = yield* resolveWith(() => ({ exit: 0 }), O.some(""));
      expect(writer).toEqual(opHuman);
      expect(spawns).toEqual([["sh", "-c", "command -v op-human"]]);
    })
  );

  it.effect(
    "falls back to op when op-human is absent or the probe cannot spawn",
    Effect.fnUntraced(function* () {
      const absent = yield* resolveWith(() => ({ exit: 1 }), O.none());
      const unspawnable = yield* resolveWith(() => ScriptedSpawner.notFound("sh"), O.none());
      expect(absent.writer).toEqual(GitHubAppVaultWriter.make({ command: "op", source: "op" }));
      expect(unspawnable.writer).toEqual(absent.writer);
    })
  );

  it.effect(
    "preflight creates through the credential pipe, then deletes the throwaway item by title",
    Effect.fnUntraced(function* () {
      const { result, spawns } = yield* preflightWith(0, 0);
      expect(result._tag).toBe("Success");
      expect(spawns).toEqual([
        [
          "bash",
          "-o",
          "pipefail",
          "-c",
          'cat | "$1" item create --vault BEEP_SECRETS -',
          "github-app-mint",
          "op-human",
        ],
        ["op-human", "item", "delete", PREFLIGHT_TITLE, "--vault", "BEEP_SECRETS"],
      ]);
    })
  );

  it.effect(
    "preflight refuses when the writer cannot create items and never tries the delete",
    Effect.fnUntraced(function* () {
      const { result, spawns } = yield* preflightWith(1, 0);
      expect(A.length(spawns)).toBe(1);
      expect(result).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "GithubCommandError", path: "op-human (op-human) -> BEEP_SECRETS" },
      });
      expect(result._tag === "Failure" && result.failure.message).toContain(
        "op-human cannot create items in BEEP_SECRETS (exit 1); refusing to start"
      );
    })
  );

  it.effect(
    "preflight refuses when the throwaway item cannot be deleted and names it",
    Effect.fnUntraced(function* () {
      const { result } = yield* preflightWith(0, 5);
      expect(result._tag === "Failure" && result.failure.message).toContain(
        `created the preflight item "${PREFLIGHT_TITLE}" in BEEP_SECRETS but could not delete it (exit 5)`
      );
    })
  );
});
