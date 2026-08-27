import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = ["index.html", "stats.html", "fiction.html", "contact.html"];
const refs = [];

for (const page of pages) {
  const source = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
  const matches = [...source.matchAll(
    /https:\/\/cdn\.jsdelivr\.net\/gh\/aimesy\/themes@([0-9a-f]{40})\/src\/theme\.css/g,
  )];
  assert.equal(matches.length, 1, `${page} must contain one commit-pinned theme.css reference`);
  refs.push(matches[0][1]);
}

assert.equal(new Set(refs).size, 1, "all pages must pin the same theme.css commit");
const ref = refs[0];
async function fetchPinnedAsset(asset) {
  const url = `https://cdn.jsdelivr.net/gh/aimesy/themes@${ref}/src/${asset}`;
  let source = "";
  let lastFailure = "no response";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        source = await response.text();
        break;
      }
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error?.message || String(error);
    }
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  assert.ok(source, `could not fetch pinned ${asset}: ${lastFailure}`);
  return source;
}

const [css, themeBarCss] = await Promise.all([
  fetchPinnedAsset("theme.css"),
  fetchPinnedAsset("theme-bar.css"),
]);
assert.match(themeBarCss, /\.amyc-theme-bar\s*\{/);
assert.match(themeBarCss, /\.amyc-theme-bar \.grow\s*\{/);

function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing theme selector: ${selector}`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)]
      .map((token) => [token[1], token[2].toLowerCase()]),
  );
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const base = declarations(":root");
const themes = ["sand", "mist", "lilac", "glacier", "rose", "tidepool", "cypress", "starlight"];

for (const theme of themes) {
  const tokens = theme === "sand"
    ? base
    : { ...base, ...declarations(`:root[data-theme="${theme}"]`) };
  for (const background of ["paper", "paper-2"]) {
    const ratio = contrastRatio(tokens["ink-3"], tokens[background]);
    assert.ok(
      ratio >= 4.5,
      `${theme} ink-3 contrast on ${background} is ${ratio.toFixed(3)}, below 4.5`,
    );
  }
}

console.log(`Pinned theme ${ref} passes base secondary-text contrast.`);
