// Shared @beep/schema typeperf baseline: import the public LiteralKit subpath and touch it once.
// Mirrors effect/typeperf/suites/schema/baseline.ts; every fixture in this suite repeats the warmup.
// The check-census gate measures this program and each fixture as separate single-checker rows.
import { LiteralKit } from "@beep/schema/LiteralKit";

LiteralKit;
