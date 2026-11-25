import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../next.config.mjs";

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(frontendRoot, "src");

const redirects = await config.redirects();

const expectedAliases = [
  ["/login", "/g2p"],
  ["/signup", "/g2p"],
  ["/dashboard", "/g2p"],
  ["/g2p/dashboard", "/g2p"],
  ["/printshop", "/g2p/nearby"],
  ["/send", "/p2p?mode=send"],
];

for (const [source, destination] of expectedAliases) {
  const rule = redirects.find((entry) => entry.source === source);
  assert.ok(rule, `Missing redirect for ${source}`);
  assert.equal(rule.destination, destination, `Wrong destination for ${source}`);
  assert.equal(rule.permanent, false, `${source} must use a temporary (307) redirect`);
}

const priceRule = redirects.find((entry) => entry.source === "/price");
assert.ok(priceRule, "Existing /price redirect must be preserved");
assert.equal(priceRule.destination, "/pricing");
assert.equal(priceRule.permanent, true);

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles(srcRoot);
for (const file of sourceFiles) {
  const contents = readFileSync(file, "utf8");
  assert.ok(
    !contents.includes("https://www.share2me.in"),
    `Stale www canonical URL found in ${file}`,
  );
}

const readSrc = (relativePath) =>
  readFileSync(join(srcRoot, relativePath), "utf8");

const auth = readSrc("auth.ts");
assert.ok(
  auth.includes('url.startsWith("/") && !url.startsWith("//")'),
  "Auth redirect must not treat protocol-relative URLs as relative paths",
);
assert.ok(
  auth.includes("return `${origin}${url}`;"),
  "Relative auth callbacks must stay on the visitor's current origin",
);

const g2pPage = readSrc("app/g2p/page.tsx");
assert.ok(
  g2pPage.includes('signIn("google", { callbackUrl: "/g2p" })'),
  "G2P login must explicitly return to /g2p",
);

const p2pPage = readSrc("app/p2p/page.tsx");
assert.ok(
  p2pPage.includes('params.set("mode", nextMode)'),
  "P2P mode toggle must write the mode to the URL",
);
assert.ok(
  p2pPage.includes("router.replace(`/p2p?${params.toString()}`, { scroll: false })"),
  "P2P mode toggle must update the URL without scrolling",
);

const sendPage = readSrc("app/send/page.tsx");
assert.ok(
  sendPage.includes('redirect("/p2p?mode=send")'),
  "/send must redirect to the P2P workspace",
);

console.log(
  `Routing checks passed (${redirects.length} redirects, ${sourceFiles.length} source files).`,
);
