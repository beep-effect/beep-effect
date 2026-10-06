import {
  PracticeKgDocketRegisterError,
  PracticeKgDocketRegisterRow,
  practiceKgRegisterClientNames,
  practiceKgRegisterDocketClients,
  readPracticeKgDocketRegister,
} from "@beep/law-practice-server";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const row = (client: string, docket: string, clientName: string | null = null): PracticeKgDocketRegisterRow =>
  PracticeKgDocketRegisterRow.make({ client, clientName, docket });

describe("practice KG docket register", () => {
  it("answers a docket's client only when the register lists exactly one", () => {
    const clientOf = practiceKgRegisterDocketClients([
      row("11111", "20001US01"),
      row("11111", " 20001us01 "),
      row("11111", "20001US02"),
      row("22222", "20001US02"),
    ]);
    expect(O.getOrNull(clientOf("20001us01"))).toBe("11111");
    expect(O.getOrNull(clientOf("20001US02"))).toBeNull();
    expect(O.getOrNull(clientOf("30002US01"))).toBeNull();
  });

  it("answers a client's name only when every naming row agrees", () => {
    const nameOf = practiceKgRegisterClientNames([
      row("11111", "20001US01", "Example Client"),
      row("11111", "20001US02", " Example Client "),
      row("11111", "20001US03"),
      row("22222", "30002US01", "Second Client"),
      row("22222", "30002US02", "Second Client LLC"),
      row("33333", "40004US01", ""),
    ]);
    expect(O.getOrNull(nameOf("11111"))).toBe("Example Client");
    expect(O.getOrNull(nameOf("22222"))).toBeNull();
    expect(O.getOrNull(nameOf("33333"))).toBeNull();
    expect(O.getOrNull(nameOf("44444"))).toBeNull();
  });

  it("compares PracticeKgDocketRegisterError by its diagnostic fields, not its cause", () => {
    const same = S.toEquivalence(PracticeKgDocketRegisterError);
    const make = (lineNumber: number, diagnostic: string) =>
      PracticeKgDocketRegisterError.make({
        cause: { diagnostic },
        lineNumber,
        message: "Register line is invalid.",
        path: "/register.jsonl",
      });
    pipe(same(make(2, "first"), make(2, "second")), assertTrue);
    pipe(same(make(2, "first"), make(3, "first")), assertFalse);
  });

  it.layer(Layer.fresh(NodeServices.layer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "reads register rows in file order, skipping blank lines and defaulting a missing name",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-register-" });
        const registerPath = path.join(directory, "register.jsonl");
        yield* fs.writeFileString(
          registerPath,
          '{"client":"11111","docket":"20001US01","clientName":"Example Client"}\r\n\n{"client":"22222","docket":"30002BR01","clientName":null}\n{"client":"33333","docket":"40004ZA01"}\n'
        );

        const rows = yield* readPracticeKgDocketRegister(registerPath);

        expect(A.map(rows, (entry) => [entry.client, entry.docket, entry.clientName])).toStrictEqual([
          ["11111", "20001US01", "Example Client"],
          ["22222", "30002BR01", null],
          ["33333", "40004ZA01", null],
        ]);
      })
    );

    it.effect(
      "fails with the line number of the first row that is not a register row",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-register-" });
        const registerPath = path.join(directory, "register.jsonl");
        yield* fs.writeFileString(
          registerPath,
          '{"client":"11111","docket":"20001US01","clientName":"Example Client"}\n\n{"client":"","docket":"20001US02"}\nnot json\n'
        );

        const error = yield* Effect.flip(readPracticeKgDocketRegister(registerPath));

        expect(error).toBeInstanceOf(PracticeKgDocketRegisterError);
        expect([error.lineNumber, error.path]).toStrictEqual([3, registerPath]);
        expect(error.message).toBe(`Docket register "${registerPath}" line 3 is not a valid register row.`);
      })
    );

    it.effect(
      "fails without a line number when the register file cannot be read",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-register-" });
        const registerPath = path.join(directory, "missing.jsonl");

        const error = yield* Effect.flip(readPracticeKgDocketRegister(registerPath));

        expect(error.lineNumber).toBeUndefined();
        expect(error.message).toBe(`Failed reading docket register "${registerPath}".`);
      })
    );
  });
});
