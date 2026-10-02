// visibility: public; classification: integration-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const THEME_ORIGIN = "https://aimesy.github.io";
const THEME_BASE = `${THEME_ORIGIN}/themes/src/`;
const pages = ["index.html", "stats/index.html", "fiction/index.html", "contact/index.html"];
const neededAssets = ["theme.css", "theme-bar.css", "bug-report.css", "theme.js", "bug-report.js"];
const referencedAssets = new Set();

for (const page of pages) {
  const source = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /cdn\.jsdelivr\.net\/gh\/aimesy\/themes/,
    `${page} must load the shared theme from ${THEME_BASE}, not jsDelivr`,
  );
  const assets = [...source.matchAll(/https:\/\/aimesy\.github\.io\/themes\/src\/([^"'\s?#]+)/g)]
    .map((match) => match[1]);
  for (const asset of neededAssets) {
    assert.equal(
      assets.filter((name) => name === asset).length,
      1,
      `${page} must reference ${THEME_BASE}${asset} exactly once`,
    );
  }
  assert.equal(new Set(assets).size, assets.length, `${page} must not repeat a shared theme asset`);
  assets.forEach((asset) => referencedAssets.add(asset));

  const csp = source.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1];
  assert.ok(csp, `${page} must declare a Content-Security-Policy`);
  for (const directive of ["script-src", "style-src"]) {
    const sources = csp.match(new RegExp(`(?:^|;)\\s*${directive}\\s+([^;]*)`))?.[1].trim().split(/\s+/) || [];
    assert.ok(sources.includes(THEME_ORIGIN), `${page} CSP ${directive} must allow ${THEME_ORIGIN}`);
  }
}

async function fetchHostedAsset(asset) {
  const url = `${THEME_BASE}${asset}`;
  let source = "";
  let contentType = "";
  let lastFailure = "no response";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        contentType = response.headers.get("content-type") || "";
        source = await response.text();
        break;
      }
      lastFailure = `HTTP ${response.status}`;
    } catch (error) {
      lastFailure = error?.message || String(error);
    }
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  assert.ok(source, `could not fetch hosted ${url}: ${lastFailure}`);
  const expectedType = asset.endsWith(".css") ? /^text\/css\b/i : /javascript/i;
  assert.match(contentType, expectedType, `${url} is served as "${contentType}"`);
  return source;
}

const hosted = Object.fromEntries(await Promise.all(
  [...referencedAssets].map(async (asset) => [asset, await fetchHostedAsset(asset)]),
));
const css = hosted["theme.css"];
const themeBarCss = hosted["theme-bar.css"];
assert.match(themeBarCss, /\.amyc-theme-bar\s*\{/);
assert.match(themeBarCss, /\.amyc-theme-bar \.grow\s*\{/);

const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    body: match[2],
  }));

function declarations(selector) {
  return Object.fromEntries(
    rules
      .filter((rule) => rule.selectors.includes(selector))
      .flatMap((rule) => [...rule.body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)])
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

const declaredThemes = [...new Set(rules
  .flatMap((rule) => rule.selectors)
  .map((selector) => selector.match(/^:root\[data-theme="([a-z0-9-]+)"\]$/)?.[1])
  .filter(Boolean))];
const expectedThemes = ["sand", "mist", "lilac", "glacier", "rose", "tidepool", "cypress", "starlight", "crimson", "ember", "ultramarine", "orchid"];
for (const theme of expectedThemes) {
  assert.ok(declaredThemes.includes(theme), `missing theme selector: :root[data-theme="${theme}"]`);
}

// The shared bar paints --chrome-ink text on --chrome, and page copy uses
// --ink-3 on --paper and --paper-2. Check those pairings as computed from the
// hosted palette instead of assuming a light or dark header.
const pairings = [
  ["ink-3", "paper"],
  ["ink-3", "paper-2"],
  ["chrome-ink", "chrome"],
];
const base = declarations(":root");
const families = [["default", base], ...declaredThemes.map((theme) => [
  theme,
  { ...base, ...declarations(`:root[data-theme="${theme}"]`) },
])];

for (const [family, tokens] of families) {
  for (const [foreground, background] of pairings) {
    assert.ok(tokens[foreground], `${family} must define --${foreground} as a hex color`);
    assert.ok(tokens[background], `${family} must define --${background} as a hex color`);
    const ratio = contrastRatio(tokens[foreground], tokens[background]);
    assert.ok(
      ratio >= 4.5,
      `${family} ${foreground} contrast on ${background} is ${ratio.toFixed(3)}, below 4.5`,
    );
  }
}

console.log(`Hosted theme ${THEME_BASE} passes page-text and header contrast for the default palette and all ${declaredThemes.length} families.`);
