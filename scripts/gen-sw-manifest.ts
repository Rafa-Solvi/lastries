// Post-build: genera dist/sw.js con la lista de ficheros a precargar y un hash de versión.
// Uso: node scripts/gen-sw-manifest.ts (tras vite build)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = join(import.meta.dirname, "..", "dist");
const TEMPLATE = join(DIST, "sw.template.js");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(DIST)
  .filter((f) => !f.endsWith("sw.template.js") && !f.endsWith(".map") && !f.endsWith(`${sep}sw.js`))
  .sort();

const hash = createHash("sha256");
let bytes = 0;
for (const f of files) {
  const content = readFileSync(f);
  bytes += content.length;
  hash.update(relative(DIST, f));
  hash.update(content);
}
const version = hash.digest("hex").slice(0, 12);
const urls = ["./", ...files.map((f) => "./" + relative(DIST, f).split(sep).join("/"))];

const template = readFileSync(TEMPLATE, "utf8");
const VERSION_STMT = 'const VERSION = "__VERSION__";';
const PRECACHE_STMT = "const PRECACHE = __PRECACHE__;";
if (!template.includes(VERSION_STMT) || !template.includes(PRECACHE_STMT)) {
  throw new Error("sw.template.js no contiene las sentencias VERSION/PRECACHE esperadas");
}
const sw = template
  .replace(VERSION_STMT, `const VERSION = ${JSON.stringify(version)};`)
  .replace(PRECACHE_STMT, `const PRECACHE = ${JSON.stringify(urls)};`);
if (/^\s*const (VERSION|PRECACHE) = .*__(VERSION|PRECACHE)__/m.test(sw)) {
  throw new Error("Quedan marcadores sin sustituir en sw.js");
}
writeFileSync(join(DIST, "sw.js"), sw);
rmSync(TEMPLATE);

console.log(`sw.js: versión ${version}, ${files.length} ficheros, ${(bytes / 1048576).toFixed(1)} MB`);
