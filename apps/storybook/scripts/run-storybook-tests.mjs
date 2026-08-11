import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const storyFilePattern = /\.stories\.[cm]?[tj]sx?$/;
const defaultStoryRoots = [
  "../../packages/foundation/ui-system/ui/stories",
  "../../packages/foundation/ui-system/editor/stories",
];

const storyRoots = process.argv.slice(2);
const roots = storyRoots.length > 0 ? storyRoots : defaultStoryRoots;
const chunkSize = 20;

const run = (command, args) =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { shell: false, stdio: "inherit" });
    child.on("error", rejectCommand);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }
      rejectCommand(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}`));
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
  await run("playwright", ["install", "--only-shell", "chromium"]);
}

const storyFiles = (await Promise.all(roots.map((root) => collectStories(resolve(import.meta.dirname, "..", root)))))
  .flat()
  .sort();

if (storyFiles.length === 0) {
  throw new Error(`No Storybook stories found under: ${roots.join(", ")}`);
}

for (const storyFileChunk of chunk(storyFiles, chunkSize)) {
  await run("vitest", ["run", "--config", "vitest.storybook.config.ts", ...storyFileChunk]);
}
