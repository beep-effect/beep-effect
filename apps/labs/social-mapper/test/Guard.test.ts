import { describe, expect, it } from "@effect/vitest";
import * as Headers from "effect/http/Headers";
import * as Redacted from "effect/Redacted";
import { judge } from "../server/Guard.ts";

const admission = { token: Redacted.make("launch"), origins: ["http://app.localhost"] };

const signed = { authorization: "Bearer launch" };

describe("the loopback guard", () => {
  it("lets the window through", () => {
    expect(judge(Headers.fromInput({ ...signed, origin: "http://app.localhost" }), admission)).toBe("allowed");
  });

  it("lets a signed caller that is not a browser through", () => {
    expect(judge(Headers.fromInput(signed), admission)).toBe("allowed");
  });

  it("refuses a page of another site even when the request is signed", () => {
    expect(judge(Headers.fromInput({ ...signed, origin: "https://elsewhere.example" }), admission)).toBe("foreign");
  });

  it("refuses a caller without this launch's token", () => {
    expect(judge(Headers.fromInput({ authorization: "Bearer stale" }), admission)).toBe("unsigned");
    expect(judge(Headers.empty, admission)).toBe("unsigned");
  });
});
