import * as Vercel from "@beep/alchemy-vercel";
import { describe, expect } from "@effect/vitest";
import { adopt, Unowned } from "alchemy/AdoptPolicy";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { FakeVercel, PENDING_SUFFIX, TEAM_ID } from "./fixtures/FakeVercel.ts";
import { failureTag, makeHarness, typed } from "./fixtures/Harness.ts";
import { domainRead } from "./fixtures/Readers.ts";

const { test } = makeHarness();

const onProject = Effect.fn("onProject")(function* (
  projectName: string,
  domain: Omit<Vercel.DomainProps, "project" | "teamId">
) {
  const project = yield* Vercel.Project("Web", { name: projectName, teamId: TEAM_ID });
  return yield* Vercel.Domain("Domain", { project: project.projectId, teamId: TEAM_ID, ...domain });
});

describe("Vercel.Domain", () => {
  test.provider("creates, updates and deletes a redirecting domain", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const created = yield* stack.deploy(
        onProject("vt-domain-crud", { name: "www.crud.test", redirect: "crud.test", redirectStatusCode: 308 })
      );
      expect(created.verified).toBe(true);
      expect(created.apexName).toBe("crud.test");
      expect(created.redirect).toBe("crud.test");
      expect(created.redirectStatusCode).toBe(308);

      const updated = yield* stack.deploy(
        onProject("vt-domain-crud", {
          name: "www.crud.test",
          redirect: "crud.test",
          redirectStatusCode: 307,
          gitBranch: "staging",
        })
      );
      expect(updated.redirectStatusCode).toBe(307);
      expect(updated.gitBranch).toBe("staging");

      yield* stack.destroy();
      expect(O.isNone(FakeVercel.domain("www.crud.test"))).toBe(true);
    })
  );

  test.provider("reports verification challenges for a domain Vercel cannot verify yet", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const name = `staging${PENDING_SUFFIX}`;
      const created = yield* stack.deploy(onProject("vt-domain-pending", { name }));
      expect(created.verified).toBe(false);
      expect(A.map(created.verification, (challenge) => challenge.type)).toEqual(["TXT"]);
      yield* stack.destroy();
    })
  );

  test.provider("moves the domain when its project changes", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const declare = Effect.fn("declare")(function* (target: "A" | "B") {
        const a = yield* Vercel.Project("A", { name: "vt-domain-move-a", teamId: TEAM_ID });
        const b = yield* Vercel.Project("B", { name: "vt-domain-move-b", teamId: TEAM_ID });
        return yield* Vercel.Domain("Domain", {
          project: target === "A" ? a.projectId : b.projectId,
          teamId: TEAM_ID,
          name: "move.test",
        });
      });
      const onA = yield* stack.deploy(declare("A"));
      const onB = yield* stack.deploy(declare("B"));
      expect(onB.projectId).not.toBe(onA.projectId);
      expect(O.getOrThrow(FakeVercel.domain("move.test")).projectId).toBe(onB.projectId);
      expect(A.contains(FakeVercel.requests(), "POST Move")).toBe(true);
      yield* stack.destroy();
    })
  );

  test.provider("reads an owned domain plainly and a foreign one as unowned", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const deployed = yield* stack.deploy(onProject("vt-domain-read", { name: "read.test" }));
      const read = yield* domainRead;
      const olds = { project: deployed.projectId, teamId: TEAM_ID, name: "read.test" };
      const input = { id: "Domain", fqn: "Domain", instanceId: "00", olds };

      const owned = yield* read({ ...input, output: deployed });
      expect(Unowned.is(owned)).toBe(false);

      const foreign = yield* read({ ...input, output: undefined });
      expect(Unowned.is(foreign)).toBe(true);

      const missing = yield* read({ ...input, olds: { ...olds, name: "absent.test" }, output: undefined });
      expect(missing).toBeUndefined();
      yield* stack.destroy();
    })
  );

  test.provider("adopts a domain from the project that holds it by moving it", (scratch) =>
    Effect.gen(function* () {
      const stack = typed(scratch);
      yield* stack.destroy();
      const legacy = FakeVercel.seedProject("vt-domain-legacy");
      FakeVercel.seedDomain("adopt.test", legacy.id);
      const declare = Effect.gen(function* () {
        const project = yield* Vercel.Project("Web", { name: "vt-domain-adopt", teamId: TEAM_ID });
        return yield* Vercel.Domain("Apex", {
          project: project.projectId,
          teamId: TEAM_ID,
          name: "adopt.test",
          moveFrom: legacy.name,
        }).pipe(adopt(true));
      });
      const refused = yield* Effect.exit(
        stack.deploy(
          Effect.gen(function* () {
            const project = yield* Vercel.Project("Web", { name: "vt-domain-adopt", teamId: TEAM_ID });
            return yield* Vercel.Domain("Apex", {
              project: project.projectId,
              teamId: TEAM_ID,
              name: "adopt.test",
              moveFrom: legacy.name,
            });
          })
        )
      );
      expect(failureTag(refused)).toEqual(O.some("OwnedBySomeoneElse"));
      expect(O.getOrThrow(FakeVercel.domain("adopt.test")).projectId).toBe(legacy.id);

      const adopted = yield* stack.deploy(declare);
      expect(adopted.projectId).not.toBe(legacy.id);
      expect(O.getOrThrow(FakeVercel.domain("adopt.test")).projectId).toBe(adopted.projectId);
      yield* stack.destroy();
      expect(O.isNone(FakeVercel.domain("adopt.test"))).toBe(true);
    })
  );
});
