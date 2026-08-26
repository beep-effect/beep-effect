import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const storyFilePattern = /\.stories\.[cm]?[tj]sx?$/;
const defaultStoryRoots = [
  "../../packages/foundation/ui-system/ui/stories",
  "../../packages/foundation/ui-system/editor/stories",
  "../../packages/foundation/ui-system/dock-react/stories",
  "../../packages/drivers/graph-3d/stories",
];

const storyRoots = process.argv.slice(2);
const roots = storyRoots.length > 0 ? storyRoots : defaultStoryRoots;
const chunkSize = 20;

const run = (command, args) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { shell: false, stdio: "inherit" });
    child.on("error", rejectCommand);
    child.on("exit", (code) => {
      resolveCommand(code ?? 1);
    });
  });

const collectStories = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return collectStories(path);
      }
      if (entry.isFile() && storyFilePattern.test(entry.name)) {
        return [path];
      }
      return [];
    })
  );

  return files.flat();
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

if (process.env.CI !== "true") {
  const installCode = await run("playwright", ["install", "--only-shell", "chromium"]);
  if (installCode !== 0) {
    throw new Error(`playwright install exited with code ${installCode}`);
  }
}

const storyFiles = (await Promise.all(roots.map((root) => collectStories(resolve(import.meta.dirname, "..", root)))))
  .flat()
  .sort();

if (storyFiles.length === 0) {
  throw new Error(`No Storybook stories found under: ${roots.join(", ")}`);
}

const chunkResults = [];
for (const [index, storyFileChunk] of chunk(storyFiles, chunkSize).entries()) {
  const code = await run("vitest", ["run", "--config", "vitest.storybook.config.ts", ...storyFileChunk]);
  chunkResults.push({ code, files: storyFileChunk, index });
}

const failedChunks = chunkResults.filter((result) => result.code !== 0);
console.log(
  `\nStorybook test summary: ${chunkResults.length - failedChunks.length}/${chunkResults.length} chunks passed`
);
for (const result of chunkResults) {
  const status = result.code === 0 ? "pass" : `FAIL (exit ${result.code})`;
  console.log(`  chunk ${result.index + 1}: ${status}`);
  for (const file of result.files) {
    console.log(`    ${relative(process.cwd(), file)}`);
  }
}

if (failedChunks.length > 0) {
  process.exitCode = 1;
}
