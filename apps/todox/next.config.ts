import type { NextConfig } from "next";

// Transitional guard for the coverage lane's job-wide node wrapper (removed
// from heavy.yml by this branch, but PR runs resolve heavy.yml@main): the
// wrapper injects --js-float16array into every node process, and Next copies
// process.execArgv into its build workers' NODE_OPTIONS, where V8 rejects
// feature flags. Strip it before any worker spawns; once the wrapper is gone
// from main this filter matches nothing.
process.execArgv = process.execArgv.filter((flag) => flag !== "--js-float16array");

const nextConfig: NextConfig = {};

export default nextConfig;
