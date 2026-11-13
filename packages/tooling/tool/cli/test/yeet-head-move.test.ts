import { Git } from "@beep/git/Git";
import {
  layerYeetHeadMoveClassifierTest,
  YeetHeadMoveClassifier,
  YeetHeadMoveRequest,
  YeetHeadMoveUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { commit, FILE_A, FILE_B, git, init, stack } from "./support/YeetHeadMove.ts";

const classify = Effect.fn("HeadMoveTest.classify")(function* (
  root: string,
  before: string,
  after: string,
  base: string
) {
  const context = yield* Layer.build(YeetHeadMoveClassifier.layer(root));
  const service = Context.get(context, YeetHeadMoveClassifier);
  return yield* service.classify(YeetHeadMoveRequest.make({ before, after, base }));
});
const expectChange = (verdict: Awaited<Effect.Success<ReturnType<typeof classify>>>, change: string) => {
  expect(verdict._tag).toBe("changed");
  if (verdict._tag === "changed") expect(verdict.change, verdict.detail).toBe(change);
};
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));
it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "120 seconds" })(
  "head-move real Git",
  (it) => {
    it.effect("propagates interruption while failures and defects remain unknown", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const interruptCause = Cause.interrupt(42);
        const interrupted = Git.layerTest({ isAncestor: () => Effect.failCause(interruptCause) });
        const serviceContext = yield* Layer.build(
          YeetHeadMoveClassifier.layer(s.root).pipe(Layer.provide(interrupted))
        );
        const exit = yield* Context.get(serviceContext, YeetHeadMoveClassifier)
          .classify(YeetHeadMoveRequest.make({ before: s.l2, after: s.c2, base: s.squash }))
          .pipe(Effect.exit);
        const cause = exit.pipe(Exit.getCause, O.getOrThrow);
        expect(cause.reasons).toMatchObject([{ _tag: "Interrupt", fiberId: 42 }]);
      })
    );
    it.effect("carries all six recorded cascade/restack pairs with sanitized identities", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const pairs: ReadonlyArray<readonly [string, string, string]> = [
          [s.l2, s.c2, s.squash],
          [s.c2, s.r2, s.restackBase],
          [s.l2, s.r2, s.restackBase],
          [s.l3, s.c3, s.c2],
          [s.c3, s.r3, s.r2],
          [s.l3, s.r3, s.r2],
        ];
        for (const [before, after, base] of pairs) {
          const result = yield* classify(s.root, before, after, base);
          expect(result, `${before} -> ${after}`).toMatchObject({ _tag: "unchanged", commits: 1 });
        }
      })
    );
    it.effect("rejects stale-base and retarget-before-cascade heads", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const verdict1 = yield* classify(s.root, s.l3, s.c3, s.r2);
        expectChange(verdict1, "base-mismatch");
        const result = yield* classify(s.root, s.l2, s.l2, s.squash);
        expectChange(result, "lane-push");
        const retargetedMain = yield* commit(
          s.root,
          [s.restackBase],
          { [FILE_B]: O.some(s.b) },
          "squash layer two",
          undefined,
          "noreply@github.com"
        );
        const verdict2 = yield* classify(s.root, s.l3, s.r3, retargetedMain);
        expectChange(verdict2, "base-mismatch");
      })
    );
    it.effect("rejects fast forwards, identical heads and lane-identity rebases", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const verdict3 = yield* classify(s.root, s.l1, s.l2, s.main);
        expectChange(verdict3, "lane-push");
        const verdict4 = yield* classify(s.root, s.l2, s.l2, s.main);
        expectChange(verdict4, "lane-push");
        const lane = yield* commit(s.root, [s.squash], { [FILE_B]: O.some(s.b) }, s.m2);
        const verdict5 = yield* classify(s.root, s.l2, lane, s.squash);
        expectChange(verdict5, "not-github-rewrite");
      })
    );
    it.effect("rejects local noreply identities and mismatched signature shapes", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        yield* git(s.root, ["config", "user.email", "12345+octocat@users.noreply.github.com"]);
        const localIdentity = yield* classify(s.root, s.l2, s.c2, s.squash);
        expectChange(localIdentity, "not-github-rewrite");
        yield* git(s.root, ["config", "--unset", "user.email"]);
        const unsignedWeb = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(s.b) },
          s.m2,
          undefined,
          "noreply@github.com",
          undefined,
          O.none()
        );
        const unsignedResult = yield* classify(s.root, s.l2, unsignedWeb, s.squash);
        expectChange(unsignedResult, "not-github-rewrite");
        const signedCascade = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(s.b) },
          s.m2,
          undefined,
          "12345+octocat@users.noreply.github.com",
          undefined,
          O.some("-----BEGIN SSH SIGNATURE-----")
        );
        const signedResult = yield* classify(s.root, s.l2, signedCascade, s.squash);
        expectChange(signedResult, "not-github-rewrite");
        const absentIdentity = yield* classify(s.root, s.l2, s.c2, s.squash);
        expect(absentIdentity).toMatchObject({ _tag: "unchanged" });
      })
    );
    it.effect("detects whitespace edits, metadata edits and raw-entry changes", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const whitespace = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(Str.replace("Second", "Second ")(s.b)) },
          s.m2,
          undefined,
          "noreply@github.com"
        );
        const verdict6 = yield* classify(s.root, s.l2, whitespace, s.squash);
        expectChange(verdict6, "patch");
        const date = yield* commit(
          s.root,
          [s.squash],
          { [FILE_B]: O.some(s.b) },
          s.m2,
          "2026-11-09T20:23:50-06:00",
          "noreply@github.com"
        );
        const verdict7 = yield* classify(s.root, s.l2, date, s.squash);
        expectChange(verdict7, "metadata");
        const crossLayer = yield* classify(s.root, s.l2, s.c3, s.c2);
        expectChange(crossLayer, "patch");
        // Also isolate the raw-entry mismatch while holding metadata constant.
        const deletion = yield* commit(
          s.root,
          [s.c2],
          { [FILE_A]: O.none(), [FILE_B]: O.none() },
          s.m2,
          undefined,
          "noreply@github.com"
        );
        const verdict8 = yield* classify(s.root, s.l2, deletion, s.c2);
        expectChange(verdict8, "patch");
      })
    );
    it.effect("drops trailing S32 empty commits and ignores new empty commits", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const oldEmpty = yield* commit(s.root, [s.l2], {}, "chore: re-request beep-reviewer (S32)");
        const newEmpty = yield* commit(s.root, [s.c2], {}, "chore: re-request beep-reviewer (S32)");
        const verdict9 = yield* classify(s.root, oldEmpty, s.c2, s.squash);
        expect(verdict9).toMatchObject({ _tag: "unchanged", commits: 1 });
        const verdict10 = yield* classify(s.root, oldEmpty, newEmpty, s.squash);
        expect(verdict10).toMatchObject({ _tag: "unchanged", commits: 1 });
        const onlyEmpty = yield* commit(s.root, [s.squash], {}, "empty");
        const verdict11 = yield* classify(s.root, s.l2, onlyEmpty, s.squash);
        expectChange(verdict11, "empty-range");
        const verdict12 = yield* classify(s.root, s.l2, s.squash, s.squash);
        expectChange(verdict12, "empty-range");
      })
    );
    it.effect("refuses a dropped lane commit whose old base was not absorbed", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const oldBase = yield* commit(s.root, [s.l1], { "dropped.md": O.some("lost\n") }, "lane commit");
        const before = yield* commit(s.root, [oldBase], { [FILE_B]: O.some(s.b) }, s.m2);
        const verdict13 = yield* classify(s.root, before, s.c2, s.squash);
        expectChange(verdict13, "old-base-not-absorbed");
      })
    );
    it.effect("rejects merges on either side and too-short old tails", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const merge = yield* commit(s.root, [s.c2, s.l2], {}, "merge", undefined, "noreply@github.com");
        const verdict14 = yield* classify(s.root, s.l3, merge, s.squash);
        expectChange(verdict14, "merge-commit");
        const oldMerge = yield* commit(s.root, [s.l2, s.moved], {}, s.m2);
        const verdict15 = yield* classify(s.root, oldMerge, s.c2, s.squash);
        expectChange(verdict15, "merge-commit");
        const extra = yield* commit(
          s.root,
          [s.c2],
          { "extra.md": O.some("extra\n") },
          "extra",
          undefined,
          "noreply@github.com"
        );
        const orphan = yield* commit(s.root, [], { "orphan.md": O.some("orphan\n") }, "orphan");
        const verdict16 = yield* classify(s.root, orphan, extra, s.squash);
        expectChange(verdict16, "commit-count");
      })
    );
    it.effect("catches relocated identical hunks with exact replay-tree equality", () =>
      Effect.gen(function* () {
        const root = yield* init();
        // Repeated context makes the normalized per-path patches equal at two distinct locations.
        const block = "before-one\nbefore-two\nbefore-three\nold\nafter-one\nafter-two\nafter-three\n";
        const base = yield* commit(root, [], { "repeat.txt": O.some(`${block}separator\n${block}`) }, "base");
        const before = yield* commit(
          root,
          [base],
          { "repeat.txt": O.some(`${Str.replace("old", "new")(block)}separator\n${block}`) },
          "edit"
        );
        const moved = yield* commit(root, [base], { "main.txt": O.some("advance\n") }, "main");
        const after = yield* commit(
          root,
          [moved],
          { "repeat.txt": O.some(`${block}separator\n${Str.replace("old", "new")(block)}`) },
          "edit",
          undefined,
          "noreply@github.com"
        );
        const verdict17 = yield* classify(root, before, after, moved);
        expectChange(verdict17, "replay-tree");
      })
    );
    it.effect("fetches missing pinned objects once without replacing FETCH_HEAD", () =>
      Effect.gen(function* () {
        const remote = yield* stack();
        yield* git(remote.root, ["update-ref", "refs/heads/probe", remote.c2]);
        const local = yield* init();
        yield* git(local, ["remote", "add", "origin", remote.root]);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fetchHead = path.join(local, ".git", "FETCH_HEAD");
        yield* fs.writeFileString(fetchHead, "preserve concurrent reader\n");
        const verdict = yield* classify(local, remote.l2, remote.c2, remote.squash);
        expect(verdict).toMatchObject({ _tag: "unchanged", commits: 1 });
        const preserved = yield* fs.readFileString(fetchHead);
        expect(preserved).toBe("preserve concurrent reader\n");
      })
    );
    it.effect("adds BatchMode only to an OpenSSH transport when fetching over ssh", () =>
      Effect.gen(function* () {
        const remote = yield* stack();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bin = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-head-move-ssh-" });
        const log = path.join(bin, "argv.log");
        // A stand-in transport: record argv, answer the variant probe, run the remote command locally.
        const transport = Effect.fnUntraced(function* (name: string) {
          const file = path.join(bin, name);
          yield* fs.writeFileString(
            file,
            `#!/bin/sh\nprintf '%s\\n' "${name} $*" >> '${log}'\nfor a; do [ "$a" = "-G" ] && exit 0; done\nfor last; do :; done\nexec sh -c "$last"\n`
          );
          yield* fs.chmod(file, 0o755);
          return file;
        });
        const ssh = yield* transport("ssh-fake");
        const plink = yield* transport("plink-fake");
        const fetchVia = Effect.fnUntraced(function* (env: Record<string, string>, sshCommand: O.Option<string>) {
          const local = yield* init();
          yield* git(local, ["remote", "add", "origin", `localhost:${remote.root}`]);
          if (O.isSome(sshCommand)) yield* git(local, ["config", "core.sshCommand", sshCommand.value]);
          return yield* classify(local, remote.l2, remote.c2, remote.squash).pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
          );
        });
        const quoted = yield* fetchVia({ GIT_SSH_COMMAND: `"${ssh}"` }, O.none());
        expect(quoted).toMatchObject({ _tag: "unchanged", commits: 1 });
        const sshLog = yield* fs.readFileString(log);
        const sshLines = A.filter(Str.split(sshLog, "\n"), Str.startsWith("ssh-fake"));
        expect(A.isReadonlyArrayNonEmpty(sshLines)).toBe(true);
        expect(A.every(sshLines, Str.includes("-o BatchMode=yes"))).toBe(true);
        const configured = yield* fetchVia({}, O.some(plink));
        expect(configured).toMatchObject({ _tag: "unchanged", commits: 1 });
        const plinkLog = yield* fs.readFileString(log);
        const plinkLines = A.filter(Str.split(plinkLog, "\n"), Str.startsWith("plink-fake"));
        expect(A.isReadonlyArrayNonEmpty(plinkLines)).toBe(true);
        expect(A.some(plinkLines, Str.includes("BatchMode"))).toBe(false);
      })
    );
    it.effect("returns unknown when a missing object cannot be fetched from origin", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const result = yield* classify(s.root, Str.repeat(40)("0"), s.c2, s.squash);
        expect(result._tag).toBe("unknown");
      })
    );
    it.effect("fails closed with a typed error for invalid UTF-8 commit metadata", () =>
      Effect.gen(function* () {
        const s = yield* stack();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const object = yield* git(s.root, ["cat-file", "commit", s.c2]);
        const bytes = new TextEncoder().encode(`${object}\n`);
        bytes[bytes.length - 2] = 0xff;
        const input = path.join(s.root, "invalid-utf8-commit");
        yield* fs.writeFile(input, bytes);
        const after = yield* git(s.root, ["hash-object", "-t", "commit", "-w", input]);
        const result = yield* classify(s.root, s.l2, after, s.squash);
        expect(result._tag).toBe("unknown");
        if (result._tag === "unknown") expect(result.reason).toContain("UTF-8");
      })
    );
    it.effect("provides a requirement-free deterministic test service", () =>
      Effect.gen(function* () {
        const request = YeetHeadMoveRequest.make({ before: "b", after: "a", base: "s" });
        const context = yield* Layer.build(
          layerYeetHeadMoveClassifierTest((input) => YeetHeadMoveUnknown.make({ ...input, reason: "fixture" }))
        );
        const service = Context.get(context, YeetHeadMoveClassifier);
        const result = yield* service.classify(request);
        expect(result._tag).toBe("unknown");
        const instant = yield* service.committerInstant("a");
        expect(O.isNone(instant)).toBe(true);
      })
    );
  }
);
