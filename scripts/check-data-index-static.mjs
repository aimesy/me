#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = ["index.html", "stats.html", "data.html", "fiction.html", "contact.html"];
const sources = new Map(pages.map((page) => [page, readFileSync(new URL(`../${page}`, import.meta.url), "utf8")]));
const dataScript = readFileSync(new URL("../assets/data-index.js", import.meta.url), "utf8");

for (const [page, source] of sources) {
  for (const target of pages) {
    const label = target === "index.html"
      ? "Projects"
      : target[0].toUpperCase() + target.slice(1, -5);
    assert.match(source, new RegExp(`href="${target.replace(".", "\\.")}"[^>]*>${label}<\\/a>`), `${page} must link to ${target}`);
  }
  assert.match(source, new RegExp(`href="${page.replace(".", "\\.")}"[^>]*aria-current="page"`), `${page} must mark itself current`);
}

const data = sources.get("data.html");
assert.match(data, /<title>Data \| AMYC\.US<\/title>/);
assert.equal((data.match(/<iframe\b/g) || []).length, 2);
assert.equal((data.match(/<details class="data-project"[^>]*data-persist-open/g) || []).length, 2);
for (const id of ["sfsc-data", "kcsc-data"]) {
  assert.match(data, new RegExp(`id="${id}"`));
}
for (const source of ["https://sfsc.amyc.us/", "https://kcsc.amyc.us/"]) {
  assert.ok(data.includes(`src="${source}"`), `data.html must embed ${source}`);
  assert.ok(data.includes(`href="${source}"`), `data.html must provide a full-screen action for ${source}`);
}
assert.match(data, /assets\/data-index\.css\?v=3/);
assert.match(data, /assets\/data-index\.js\?v=2/);
assert.match(data, /frame-src https:\/\/sfsc\.amyc\.us https:\/\/kcsc\.amyc\.us/);
assert.equal((data.match(/class="data-display-frame"/g) || []).length, 2);
assert.doesNotMatch(data, /<details[^>]*\sopen(?:\s|>)/i);
assert.doesNotMatch(data, /class="links"|github\.com\/aimesy\/(?:sfsc|kcsc)/i);
assert.doesNotMatch(data, /gift[- ]dispositions/i);
assert.match(dataScript, /const prefix = "amyc:data-index:"/);
assert.match(dataScript, /localStorage\.setItem/);
assert.match(dataScript, /hashchange/);

const themeMatches = [...data.matchAll(/https:\/\/cdn\.jsdelivr\.net\/gh\/aimesy\/themes@([0-9a-f]{40})\/src\/(theme\.css|theme-bar\.css|bug-report\.css|theme\.js|bug-report\.js)/g)];
assert.equal(themeMatches.length, 5);
assert.equal(new Set(themeMatches.map((match) => match[1])).size, 1);

console.log("AMYC collapsible inline Data display checks passed.");
