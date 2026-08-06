import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const projectsSource = readFileSync(new URL("../assets/projects.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const fictionSource = readFileSync(new URL("../fiction.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const contactSource = readFileSync(new URL("../contact.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const stylesSource = readFileSync(new URL("../assets/styles.css", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const builderSource = readFileSync(new URL("./build-project-data.mjs", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const refreshWorkflowSource = readFileSync(new URL("../.github/workflows/project-data.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const pagesWorkflowSource = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8").replaceAll("\r\n", "\n");

for (const retiredDependency of [
  "archive/cases-index.ndjson",
  "archive/cases/",
  "loadSfscDockets",
  "loadSfscCaseRecord",
  "SFSC docket search is unavailable",
  "@duckdb/duckdb-wasm",
  "data/tentatives-",
  "registerFileBuffer",
  "githubCommitsUrl",
  "releaseAssetPrefix",
  "data/common/shards/documents/manifest.json",
]) {
  assert.equal(
    projectsSource.includes(retiredDependency),
    false,
    `projects.js must not use the retired SFSC Pages dependency: ${retiredDependency}`,
  );
}

assert.match(indexSource, /data-sfsc-search/);
assert.match(indexSource, /data-sfsc-results/);
assert.match(indexSource, /<div class="title-block">\s*<h1>Projects<\/h1>\s*<\/div>/);
assert.doesNotMatch(indexSource, /class="mini-pill"/);
assert.match(indexSource, /<link rel="icon" href="data:,">/);
assert.match(fictionSource, /<link rel="icon" href="data:,">/);
assert.match(contactSource, /<link rel="icon" href="data:,">/);
assert.match(contactSource, /<title>Amy C<\/title>/);
for (const [source, activePage] of [
  [indexSource, "index.html"],
  [fictionSource, "fiction.html"],
  [contactSource, "contact.html"],
]) {
  assert.match(source, /href="index\.html"[^>]*>Projects<\/a>/);
  assert.match(source, /href="fiction\.html"[^>]*>Fiction<\/a>/);
  assert.match(source, /href="contact\.html"[^>]*>Contact<\/a>/);
  assert.match(source, new RegExp(`href="${activePage}"[^>]*aria-current="page"`));
  assert.match(source, /<html lang="en" data-amyc-public-records-footer="off">/);
  assert.match(source, /<body class="amyc-has-public-records-footer">/);
  assert.match(source, /<div class="amyc-public-records-footer" role="contentinfo" aria-label="Copyright">&copy; Amy Chattopadhyay<\/div>/);
}
assert.doesNotMatch(contactSource, /Amy Chattopadhyay\. Public court data, research tools, and other inquiries\./);
assert.doesNotMatch(fictionSource, /<p class="lede">Ocilentra, a science fiction book I completed in 2015 as a teenager\.<\/p>/);
assert.doesNotMatch(contactSource, /<form\b|assets\/contact\.js|I build public court archives/);
assert.match(contactSource, /<h2 id="contact-info-title">Contact information<\/h2>/);
assert.match(contactSource, /mailto:me@amyc\.us/);
assert.match(contactSource, /mailto:db@amyc\.us/);
assert.match(contactSource, /https:\/\/github\.com\/aimesy/);
assert.match(projectsSource, /const row = sfscSearchMode === "dockets"[\s\S]*sfscDocketSearchRow\(query\)[\s\S]*sfscRulingSearchRow\(query\)/);
assert.match(projectsSource, /renderSfscResultRows\(container, \[row\], label\)/);
assert.match(projectsSource, /input\.setAttribute\("aria-label", `Search \$\{label\}`\)/);
assert.match(projectsSource, /sfscSearchMode === "dockets"\s*\?\s*sfscDocketSearchUrl\(event\.currentTarget\.value\)\s*:\s*sfscRulingSearchUrl\(event\.currentTarget\.value\)/);
assert.match(indexSource, /data-sfsc-search aria-label="Search court dockets"/);
assert.match(indexSource, /data-mini-search="tentatives" aria-label="Search counties"/);
assert.match(indexSource, /data-sfsc-results aria-live="polite"/);
assert.match(indexSource, /data-mini-list="tentatives" aria-live="polite"/);
assert.match(indexSource, /data-mini-more="tentatives" aria-controls="tentatives-county-list">Load more<\/button>/);
assert.match(projectsSource, /const TENTATIVES_PAGE_SIZE = 9;/);
assert.match(projectsSource, /const visible = filtered\.slice\(0, tentativesVisibleCount\);/);
assert.match(projectsSource, /tentativesVisibleCount \+= TENTATIVES_PAGE_SIZE;[\s\S]*renderTentativesSearch\(\);/);
assert.match(stylesSource, /\.mini-load-more\[hidden\]\s*\{\s*display:\s*none;/);
for (const repositoryHref of [
  "https://github.com/aimesy/nysc",
  "https://github.com/aimesy/ndcs-data",
  "https://github.com/aimesy/civproidx",
]) {
  assert.match(indexSource, new RegExp(`href="${repositoryHref}">Repository<\\/a>`));
}

const liveReposStart = projectsSource.indexOf("const LIVE_REPOS = {");
const liveReposEnd = projectsSource.indexOf("\n};", liveReposStart);
assert.notEqual(liveReposStart, -1, "LIVE_REPOS must exist");
assert.notEqual(liveReposEnd, -1, "LIVE_REPOS must have a complete object body");
const liveReposSource = projectsSource.slice(liveReposStart, liveReposEnd + 3);
assert.doesNotMatch(liveReposSource, /cividx/);
assert.match(liveReposSource, /nysc:[\s\S]*manifestPaths: \["data\/common\/manifest\.json"\]/);
assert.doesNotMatch(liveReposSource, /archive\/case-directory|shards\/documents|releaseAssetPrefix/);

assert.match(fictionSource, /class="map-switcher" role="radiogroup" aria-label="Ocilentra supplemental views"/);
assert.doesNotMatch(fictionSource, /role="tablist"|role="tab"/);
assert.match(stylesSource, /ocilentra-view-political:focus-visible[\s\S]*ocilentra-view-supplement:focus-visible/);

function cssColor(name) {
  const match = stylesSource.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "i"));
  assert.ok(match, `CSS color --${name} must exist`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex.match(/../g).map((value) => Number.parseInt(value, 16) / 255);
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

assert.ok(
  contrastRatio(cssColor("ink-3"), cssColor("paper")) >= 4.5,
  "the local ink-3 fallback must contrast with the local paper fallback",
);
assert.ok(
  contrastRatio(cssColor("ink-3"), cssColor("paper-2")) >= 4.5,
  "the local ink-3 fallback must contrast with the local paper-2 fallback",
);

function sharedThemeRefs(source, page) {
  const matches = [...source.matchAll(/https:\/\/cdn\.jsdelivr\.net\/gh\/aimesy\/themes@([0-9a-f]{40})\/src\/(theme\.css|theme-bar\.css|bug-report\.css|theme\.js|bug-report\.js)/g)];
  assert.equal(matches.length, 5, `${page} must reference five commit-pinned shared theme assets`);
  assert.deepEqual(
    new Set(matches.map((match) => match[2])),
    new Set(["theme.css", "theme-bar.css", "bug-report.css", "theme.js", "bug-report.js"]),
    `${page} must reference the complete shared theme asset set`,
  );
  assert.doesNotMatch(source, /aimesy\/themes@(master|main|latest)\//i);
  assert.doesNotMatch(source, /aimesy\/themes\/src\//i);
  assert.ok(
    source.indexOf("assets/styles.css") < source.indexOf("/src/theme.css"),
    `${page} must load shared theme CSS after local viewer CSS`,
  );
  assert.ok(
    source.indexOf("/src/theme.css") < source.indexOf("/src/theme-bar.css"),
    `${page} must load the shared theme bar after theme tokens`,
  );
  assert.equal((source.match(/class="status-strip amyc-theme-bar"/g) || []).length, 1);
  return matches.map((match) => match[1]);
}

const themeRefs = [
  ...sharedThemeRefs(indexSource, "index.html"),
  ...sharedThemeRefs(fictionSource, "fiction.html"),
  ...sharedThemeRefs(contactSource, "contact.html"),
];
assert.equal(new Set(themeRefs).size, 1, "all shared theme assets must use the same commit");

assert.doesNotMatch(refreshWorkflowSource, /actions\/(?:configure-pages|upload-pages-artifact|deploy-pages)@/);
assert.doesNotMatch(refreshWorkflowSource, /^\s+(?:pages|id-token):\s*write\s*$/m);
assert.match(refreshWorkflowSource, /^\s+actions:\s*write\s*$/m);
assert.match(
  refreshWorkflowSource,
  /git fetch origin main[\s\S]*git rebase origin\/main[\s\S]*node scripts\/check-projects-static\.mjs[\s\S]*node scripts\/check-pinned-theme\.mjs[\s\S]*git push origin HEAD:main/,
);
assert.match(refreshWorkflowSource, /id: page_base[\s\S]*git rev-parse HEAD/);
assert.match(
  refreshWorkflowSource,
  /git diff --quiet "\$PAGE_BASE_SHA\.\.origin\/main" --[\s\S]*scripts\/build-project-data\.mjs[\s\S]*scripts\/sync-theme-ref\.mjs/,
);
assert.match(refreshWorkflowSource, /node scripts\/check-pinned-theme\.mjs/);
const tentativesCheckoutStart = refreshWorkflowSource.indexOf("      - name: Check out Tentatives");
const tentativesCheckoutEnd = refreshWorkflowSource.indexOf("\n      - name:", tentativesCheckoutStart + 1);
assert.notEqual(tentativesCheckoutStart, -1, "the Tentatives checkout must exist");
assert.notEqual(tentativesCheckoutEnd, -1, "the Tentatives checkout must have a complete step");
const tentativesCheckoutSource = refreshWorkflowSource.slice(tentativesCheckoutStart, tentativesCheckoutEnd);
assert.match(tentativesCheckoutSource, /sparse-checkout:\s*\|[\s\S]*README\.md[\s\S]*LIVE\.md/);
assert.match(tentativesCheckoutSource, /sparse-checkout-cone-mode:\s*false/);
assert.doesNotMatch(tentativesCheckoutSource, /^\s+(?:archive|data)(?:\/|\s|$)/m);
assert.match(
  refreshWorkflowSource,
  /if: steps\.commit\.outputs\.pushed == 'true' \|\| github\.event_name == 'workflow_dispatch'[\s\S]*gh workflow run pages\.yml --repo "\$\{\{ github\.repository \}\}" --ref main/,
);
assert.match(pagesWorkflowSource, /concurrency:\s*[\s\S]*group: pages\s*[\s\S]*cancel-in-progress: true/);
assert.equal((pagesWorkflowSource.match(/actions\/deploy-pages@/g) || []).length, 1);
assert.match(
  pagesWorkflowSource,
  /node scripts\/check-projects-static\.mjs[\s\S]*node scripts\/check-pinned-theme\.mjs[\s\S]*actions\/upload-pages-artifact@/,
);

const buildSfscStart = builderSource.indexOf("function buildSfsc(");
const buildSfscEnd = builderSource.indexOf("\nfunction buildTentatives(", buildSfscStart);
assert.notEqual(buildSfscStart, -1, "buildSfsc must exist");
assert.notEqual(buildSfscEnd, -1, "buildSfsc must have a complete function body");
const buildSfscSource = builderSource.slice(buildSfscStart, buildSfscEnd);
assert.doesNotMatch(buildSfscSource, /archive\/cases-index\.ndjson|archive\/document-index\.ndjson|archive\/cases\//);
assert.doesNotMatch(buildSfscSource, /searchSamples/);
assert.match(buildSfscSource, /data\/case-table-stats\.json/);
assert.match(buildSfscSource, /archive\/case-directory\/manifest\.json/);
assert.match(buildSfscSource, /readRepoFile\(config\.sfscData,/);
assert.equal(
  buildSfscSource.includes("caseTableStats?.cases"),
  false,
  "the partial case-table statistics must never supply the SFSC case total",
);
assert.equal(
  projectsSource.includes("caseTableStats.cases"),
  false,
  "browser refreshes must never use the partial case-table count as the SFSC case total",
);

const sfscConfig = {};
const sfscDataConfig = {};
const builderContext = {
  config: { sfsc: sfscConfig, sfscData: sfscDataConfig },
  readRepoFile(repo, path) {
    if (repo !== sfscDataConfig) return "";
    if (path === "data/case-table-stats.json") {
      return JSON.stringify({ case_documents: 4082942, docket_entries: 9092102 });
    }
    if (path === "archive/case-directory/manifest.json") {
      return JSON.stringify({
        case_count: 1012384,
        restricted_count: 192671,
        indexed_count: 0,
        source_counts: { case_json_rows: 408062, case_table_rows: 1205055, case_index_rows: 326330 },
      });
    }
    return "";
  },
  parseLiveTable: () => new Map(),
  parseSfsc: () => ({ departments: [], tentativeRulings: 0 }),
  parseJson: (value) => value ? JSON.parse(value) : null,
  liveCount: () => 0,
  liveBytes: () => 0,
  repoHead: () => "test-ref",
  repoUpdatedAt: () => "2026-07-10T00:00:00Z",
  repoFileSize: () => 0,
};
vm.createContext(builderContext);
vm.runInContext(`${buildSfscSource}\nthis.sfscProject = buildSfsc();`, builderContext);
assert.equal(builderContext.sfscProject.metrics.cases, 1205055);
assert.equal(builderContext.sfscProject.metrics.documents, 4082942);
assert.equal(builderContext.sfscProject.metrics.docketEntries, 9092102);
assert.equal("searchSamples" in builderContext.sfscProject, false);

const buildTentativesStart = builderSource.indexOf("function buildTentatives(");
const buildTentativesEnd = builderSource.indexOf("\nfunction countCivProIdxCitationsFromManifests()", buildTentativesStart);
assert.notEqual(buildTentativesStart, -1, "buildTentatives must exist");
assert.notEqual(buildTentativesEnd, -1, "buildTentatives must have a complete function body");
const buildTentativesSource = builderSource.slice(buildTentativesStart, buildTentativesEnd);
assert.doesNotMatch(
  buildTentativesSource,
  /captures\.ndjson|listRepoFiles|sumRepoFileSizes|rulings\.parquet|tentativesCaptureStats/,
  "the project-data refresh must use Tentatives summaries instead of traversing its archive",
);
assert.doesNotMatch(builderSource, /function tentativesCaptureStats\(/);

vm.runInContext(`this.sfscNonRegressingProject = buildSfsc({
  projects: { sfsc: { metrics: { cases: 1265222 } } },
});`, builderContext);
assert.equal(
  builderContext.sfscNonRegressingProject.metrics.cases,
  1265222,
  "the scheduled build must not replace a canonical SFSC count with a partial source count",
);

const parseCountStart = projectsSource.indexOf("function parseCount(");
const liveMetricsEnd = projectsSource.indexOf("\nfunction renderLiveMetricValues(", parseCountStart);
assert.notEqual(parseCountStart, -1, "parseCount must exist");
assert.notEqual(liveMetricsEnd, -1, "SFSC runtime metric functions must exist");
const liveMetricSources = projectsSource.slice(parseCountStart, liveMetricsEnd);
const runtimeContext = {
  PUBLIC_DATA_KEYS: new Set(["ndcs", "nysc", "kcsc"]),
  projectData: {
    projects: {
      sfsc: {
        metrics: { cases: 1265222, documents: 4082942, docketEntries: 9092102 },
        charts: { rulingsByDepartment: [] },
      },
    },
  },
};
vm.createContext(runtimeContext);
vm.runInContext(`${liveMetricSources}\napplyLiveMetrics("sfsc", new Map([
  ["case records", "1"],
]));
applySfscAggregateSources({
  rulingManifest: null,
  caseTableStats: { case_documents: 4082942, docket_entries: 9092102 },
  caseDirectoryManifest: null,
});`, runtimeContext);
assert.equal(
  runtimeContext.projectData.projects.sfsc.metrics.cases,
  1265222,
  "a partial live table and missing full manifest must not overwrite the canonical SFSC count",
);

const functionStart = projectsSource.indexOf("function sfscDocketSearchUrl");
const functionEnd = projectsSource.indexOf("\n}\n", functionStart);
assert.notEqual(functionStart, -1, "sfscDocketSearchUrl must exist");
assert.notEqual(functionEnd, -1, "sfscDocketSearchUrl must have a complete function body");

const functionSource = projectsSource.slice(functionStart, functionEnd + 2);
const context = { encodeURIComponent };
vm.createContext(context);
vm.runInContext(`
  const SFSC_BASE_URL = "https://sfsc.amyc.us/";
  ${functionSource}
  this.emptyUrl = sfscDocketSearchUrl();
  this.queryUrl = sfscDocketSearchUrl("  CGC 26 277384  ");
`, context);

assert.equal(context.emptyUrl, "https://sfsc.amyc.us/#/cases");
assert.equal(context.queryUrl, "https://sfsc.amyc.us/#/cases?q=CGC%2026%20277384");

const rulingFunctionStart = projectsSource.indexOf("function sfscRulingSearchUrl");
const rulingFunctionEnd = projectsSource.indexOf("\n}\n", rulingFunctionStart);
assert.notEqual(rulingFunctionStart, -1, "sfscRulingSearchUrl must exist");
assert.notEqual(rulingFunctionEnd, -1, "sfscRulingSearchUrl must have a complete function body");
const rulingFunctionSource = projectsSource.slice(rulingFunctionStart, rulingFunctionEnd + 2);
const rulingContext = { encodeURIComponent };
vm.createContext(rulingContext);
vm.runInContext(`
  const SFSC_BASE_URL = "https://sfsc.amyc.us/";
  ${rulingFunctionSource}
  this.emptyUrl = sfscRulingSearchUrl();
  this.queryUrl = sfscRulingSearchUrl("  demurrer & injunction  ");
`, rulingContext);

assert.equal(rulingContext.emptyUrl, "https://sfsc.amyc.us/#q=");
assert.equal(rulingContext.queryUrl, "https://sfsc.amyc.us/#q=demurrer%20%26%20injunction");

console.log("Project integration checks passed.");
