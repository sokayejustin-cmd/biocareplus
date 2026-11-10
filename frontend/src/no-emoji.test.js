import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

function getSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(path);
    return [path];
  });
}

test("frontend source uses vector icons instead of emoji glyphs", () => {
  const sourceFiles = getSourceFiles(sourceRoot).filter((path) =>
    [".js", ".jsx"].includes(extname(path))
  );

  for (const path of sourceFiles) {
    assert.doesNotMatch(
      readFileSync(path, "utf8"),
      /\p{Extended_Pictographic}/u,
      `${path} should not contain emoji glyphs`
    );
  }
});
