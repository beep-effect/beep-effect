import * as A from "effect/Array";
import type { NextConfig } from "next";

// decision: strip-wrapper-float16array-flag
const execArgvWithoutFloat16Array = A.filter(process.execArgv, (flag) => flag !== "--js-float16array");
process.execArgv = execArgvWithoutFloat16Array;

const nextConfig: NextConfig = {
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
