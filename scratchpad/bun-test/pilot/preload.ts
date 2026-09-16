import { mock } from "bun:test";
import * as adapter from "../index.ts";

adapter.setDefaultTimeout(100);

// Install before fixture imports; the code under test is never replaced.
mock.module("@effect/vitest", () => adapter);
