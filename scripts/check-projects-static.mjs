import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const projectsSource = readFileSync(new URL("../assets/projects.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const fictionSource = readFileSync(new URL("../fiction/index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const contactSource = readFileSync(new URL("../contact/index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const statsSource = readFileSync(new URL("../stats/index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
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
assert.doesNotMatch(indexSource, /data-sfsc-results/, "the SFSC panel must not return to a canned one-row search result");
assert.match(indexSource, /<div class="title-block">\s*<h1>Projects<\/h1>\s*<\/div>/);
assert.doesNotMatch(indexSource, /class="mini-pill"/);
assert.match(indexSource, /<link rel="icon" href="data:,">/);
assert.match(fictionSource, /<link rel="icon" href="data:,">/);
assert.match(contactSource, /<link rel="icon" href="data:,">/);
assert.match(statsSource, /<link rel="icon" href="data:,">/);
assert.match(statsSource, /src="https:\/\/sfsc\.amyc\.us\/#statistics"/);
assert.match(statsSource, /src="https:\/\/kcsc\.amyc\.us\/\?scope=statistics"/);
assert.match(statsSource, /frame-src https:\/\/sfsc\.amyc\.us https:\/\/kcsc\.amyc\.us/);
assert.match(statsSource, /Choose Attorney rankings or Judgment rankings below/);
assert.equal((statsSource.match(/<details class="data-project"[^>]*data-persist-open/g) || []).length, 2);
assert.equal((statsSource.match(/class="data-display-frame"/g) || []).length, 2);
assert.match(statsSource, /id="sfsc-statistics"[^>]*data-persist-open open/);
assert.match(statsSource, /id="kcsc-statistics"[^>]*data-persist-open>/);
assert.match(statsSource, /assets\/data-index\.css\?v=3/);
assert.match(statsSource, /assets\/data-index\.js\?v=2/);
assert.match(contactSource, /<title>Amy C<\/title>/);
for (const [source, activePage] of [
  [indexSource, "/"],
  [statsSource, "/stats/"],
  [fictionSource, "/fiction/"],
  [contactSource, "/contact/"],
]) {
  assert.match(source, /href="\/"[^>]*>Projects<\/a>/);
  assert.match(source, /href="\/stats\/"[^>]*>Stats<\/a>/);
  assert.match(source, /href="\/fiction\/"[^>]*>Fiction<\/a>/);
  assert.match(source, /href="\/contact\/"[^>]*>Contact<\/a>/);
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
assert.match(projectsSource, /input\.setAttribute\("aria-label", `Search \$\{mode\.label\}`\)/);
assert.match(projectsSource, /sfscSearchMode === "dockets" \? sfscDocketSearchUrl\(query\) : sfscRulingSearchUrl\(query\)/);
assert.match(projectsSource, /\$\('\[data-sfsc-form\]'\)\?\.addEventListener\("submit"/);
assert.match(indexSource, /<form class="mini-tools sfsc-search" data-sfsc-form role="search">/);
assert.match(indexSource, /data-sfsc-search aria-label="Search court dockets"/);
assert.match(indexSource, /data-mini-search="tentatives" aria-label="Search counties"/);
assert.match(indexSource, /data-mini-list="tentatives" aria-live="polite"/);
assert.match(indexSource, /data-mini-more="tentatives" aria-controls="tentatives-county-list">Load more<\/button>/);
const projectSection = (id) => {
  const start = indexSource.indexOf(`<section class="project`);
  const projectStart = indexSource.indexOf(`id="${id}"`, start);
  assert.notEqual(projectStart, -1, `${id} project card must exist`);
  const sectionStart = indexSource.lastIndexOf("<section", projectStart);
  const sectionEnd = indexSource.indexOf("</section>", projectStart);
  assert.notEqual(sectionEnd, -1, `${id} project card must be complete`);
  return indexSource.slice(sectionStart, sectionEnd + "</section>".length);
};
// The SFSC card nests <section> blocks, so slice it up to the next card.
const sfscSection = indexSource.slice(
  indexSource.lastIndexOf("<section", indexSource.indexOf('id="sfsc"')),
  indexSource.indexOf('<section class="project" id="tentatives">'),
);
assert.match(sfscSection, /<section class="project has-live-panel" id="sfsc">/);
const sfscPanelOrder = [
  'id="sfsc-recent"',
  'id="sfsc-upcoming"',
  'id="sfsc-numbers"',
  'id="sfsc-judgment-rankings"',
  'id="sfsc-attorney-rankings"',
].map((marker) => sfscSection.indexOf(marker));
assert.ok(sfscPanelOrder.every((index) => index > 0), "the SFSC panel must keep all five sections");
assert.deepEqual(
  [...sfscPanelOrder].sort((a, b) => a - b),
  sfscPanelOrder,
  "the SFSC panel leads with recent tentatives, then upcoming hearings, numbers, and rankings",
);
assert.match(
  sfscSection,
  /as the <a href="#sfsc-judgment-rankings" data-sfsc-jump>judgment<\/a> and <a href="#sfsc-attorney-rankings" data-sfsc-jump>attorney<\/a> rankings attest\./,
  "the SFSC copy must link judgment and attorney to their rankings",
);
assert.match(sfscSection, /data-sfsc-recent/);
assert.match(sfscSection, /data-sfsc-upcoming/);
assert.match(sfscSection, /data-sfsc-judgments/);
assert.match(stylesSource, /\.sfsc-panel \{[^}]*contain: size;/, "the SFSC panel must take the copy column's height and scroll inside it");
assert.match(stylesSource, /\.project\.has-live-panel \.project-copy \{\s*display: contents;/, "single-column SFSC cards must lead with the live panel");
for (const rulingSource of ["raw/dept", "tentatives.parquet", "tentative_dispositions"]) {
  assert.equal(projectsSource.includes(rulingSource), false, `projects.js must read rulings from project-data.json, not ${rulingSource}`);
}
const tentativesSection = projectSection("tentatives");
const themesSection = projectSection("themes");
const kcscSection = projectSection("kcsc");
assert.doesNotMatch(tentativesSection, /class="chip warn"/);
assert.doesNotMatch(themesSection, /class="chip warn"/);
assert.match(themesSection, /data-theme-toggle>Theme Selector<\/button>/);
assert.match(themesSection, /href="https:\/\/github\.com\/aimesy\/themes">Repository<\/a>/);
assert.match(kcscSection, /<span class="chip warn">BETA<\/span>/);
assert.match(
  projectsSource,
  /metric\(target === "kcsc" \? "Documents Indexed" : "files", formatNumber\(target === "kcsc" \? metrics\.documents : metrics\.mirroredFiles \|\| metrics\.documents\)\)/,
  "KCSC must show document index rows without changing unrelated file metrics",
);
assert.ok(indexSource.indexOf('id="kcsc"') < indexSource.indexOf('id="nysc"'), "KCSC must appear above NYSC");
assert.match(projectsSource, /const TENTATIVES_PAGE_SIZE = 9;/);
assert.match(projectsSource, /const visible = filtered\.slice\(0, tentativesVisibleCount\);/);
assert.match(projectsSource, /tentativesVisibleCount \+= TENTATIVES_PAGE_SIZE;[\s\S]*renderTentativesSearch\(\);/);
assert.match(stylesSource, /\.mini-load-more\[hidden\]\s*\{\s*display:\s*none;/);
for (const repositoryHref of [
  "https://github.com/aimesy/themes",
]) {
  assert.match(indexSource, new RegExp(`href="${repositoryHref}">Repository<\\/a>`));
}

for (const repo of ["tentatives", "nysc", "nysc-data", "ndcs-data", "kcsc-data", "sfsc", "sfsc-data", "civproidx"]) {
  assert.ok(!indexSource.includes(`https://github.com/aimesy/${repo}\"`), `${repo} must not expose a private Repository button`);
}
assert.match(projectsSource, /https:\/\/sfsc-data\.amyc\.us\/master\/archive\/case-directory\/manifest\.json/);
assert.match(indexSource, /connect-src[^;]*https:\/\/sfsc-data\.amyc\.us/);
const liveReposStart = projectsSource.indexOf("const LIVE_REPOS = {");
const liveReposEnd = projectsSource.indexOf("\n};", liveReposStart);
assert.notEqual(liveReposStart, -1, "LIVE_REPOS must exist");
assert.notEqual(liveReposEnd, -1, "LIVE_REPOS must have a complete object body");
const liveReposSource = projectsSource.slice(liveReposStart, liveReposEnd + 3);
assert.doesNotMatch(liveReposSource, /cividx/);
assert.match(liveReposSource, /nysc:[\s\S]*manifestPaths: \["data\/common\/manifest\.json"\]/);
assert.doesNotMatch(liveReposSource, /archive\/case-directory|shards\/documents|releaseAssetPrefix/);
assert.match(projectsSource, /const PROJECT_KEYS = \["sfsc", "tentatives", "themes", "kcsc", "nysc", "ndcs", "civproidx"\];/);
assert.match(builderSource, /themes: buildThemes\(previous\)/);
assert.match(refreshWorkflowSource, /- name: Check out Themes[\s\S]*repository: aimesy\/themes[\s\S]*path: themes/);
assert.match(refreshWorkflowSource, /THEMES_REPO: \.\.\/themes/);

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

function checkSharedTheme(source, page) {
  const matches = [...source.matchAll(/https:\/\/aimesy\.github\.io\/themes\/src\/(theme\.css|theme-bar\.css|bug-report\.css|theme\.js|bug-report\.js)"/g)];
  assert.equal(matches.length, 5, `${page} must reference five hosted shared theme assets`);
  assert.deepEqual(
    new Set(matches.map((match) => match[1])),
    new Set(["theme.css", "theme-bar.css", "bug-report.css", "theme.js", "bug-report.js"]),
    `${page} must reference the complete shared theme asset set`,
  );
  assert.doesNotMatch(source, /cdn\.jsdelivr\.net\/gh\/aimesy\/themes/i);
  assert.ok(
    source.indexOf("assets/styles.css") < source.indexOf("/src/theme.css"),
    `${page} must load shared theme CSS after local viewer CSS`,
  );
  assert.ok(
    source.indexOf("/src/theme.css") < source.indexOf("/src/theme-bar.css"),
    `${page} must load the shared theme bar after theme tokens`,
  );
  assert.equal((source.match(/class="status-strip amyc-theme-bar"/g) || []).length, 1);
}

checkSharedTheme(indexSource, "index.html");
checkSharedTheme(fictionSource, "fiction/index.html");
checkSharedTheme(contactSource, "contact/index.html");
checkSharedTheme(statsSource, "stats/index.html");

assert.doesNotMatch(refreshWorkflowSource, /actions\/(?:configure-pages|upload-pages-artifact|deploy-pages)@/);
assert.doesNotMatch(refreshWorkflowSource, /^\s+(?:pages|id-token):\s*write\s*$/m);
assert.match(refreshWorkflowSource, /^\s+actions:\s*write\s*$/m);
assert.match(
  refreshWorkflowSource,
  /git fetch origin main[\s\S]*git rebase origin\/main[\s\S]*node scripts\/check-projects-static\.mjs[\s\S]*node scripts\/check-shared-theme\.mjs[\s\S]*git push origin HEAD:main/,
);
assert.match(refreshWorkflowSource, /id: page_base[\s\S]*git rev-parse HEAD/);
assert.match(
  refreshWorkflowSource,
  /git diff --quiet "\$PAGE_BASE_SHA\.\.origin\/main" --[\s\S]*scripts\/build-project-data\.mjs/,
);
assert.match(refreshWorkflowSource, /node scripts\/check-shared-theme\.mjs/);
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
  /node scripts\/check-projects-static\.mjs[\s\S]*node scripts\/check-shared-theme\.mjs[\s\S]*actions\/upload-pages-artifact@/,
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
assert.equal(builderContext.sfscProject.metrics.cases, 1012384);
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
  1012384,
  "the scheduled build must use current canonical SFSC case count even when the cached total includes restricted rows",
);

const liveHelperSource = ["numberText", "parseBytes", "parseLiveTable", "liveCount", "liveBytes"].map((name) => {
  const start = builderSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  return builderSource.slice(start, builderSource.indexOf("\n}\n", start) + 3);
}).join("\n");
const sfscLiveTable = (rulings) => `| Metric | Count |\n|---|---:|\n| Tentative rulings | ${rulings} |\n`;
const liveContext = {
  config: { sfsc: sfscConfig, sfscData: sfscDataConfig },
  dataLive: sfscLiveTable("384,308"),
  readRepoFile(repo, path) {
    if (path !== "LIVE.md") return "";
    return repo === sfscDataConfig ? liveContext.dataLive : sfscLiveTable("382,361");
  },
  parseSfsc: () => ({ departments: [], tentativeRulings: 0 }),
  parseJson: (value) => value ? JSON.parse(value) : null,
  repoHead: () => "test-ref",
  repoUpdatedAt: () => "2026-10-04T00:00:00Z",
  repoFileSize: () => 0,
};
vm.createContext(liveContext);
vm.runInContext(`${liveHelperSource}\n${buildSfscSource}
this.fromData = buildSfsc();
this.dataLive = "";
this.fromFallback = buildSfsc();`, liveContext);
assert.equal(liveContext.fromData.metrics.tentativeRulings, 384308,
  "sfsc-data's LIVE.md, rewritten by each daily publication, must supply SFSC tentative rulings first");
assert.equal(liveContext.fromFallback.metrics.tentativeRulings, 382361,
  "aimesy/sfsc's committed LIVE.md must remain the fallback");
const sfscDataCheckoutStart = refreshWorkflowSource.indexOf("      - name: Check out SFSC data");
const sfscDataCheckoutSource = refreshWorkflowSource.slice(
  sfscDataCheckoutStart,
  refreshWorkflowSource.indexOf("\n      - name:", sfscDataCheckoutStart + 1),
);
assert.match(sfscDataCheckoutSource, /sparse-checkout:\s*\|[\s\S]*^\s+LIVE\.md$/m,
  "the refresh must check out sfsc-data's LIVE.md");

const feedStart = builderSource.indexOf("const SFSC_FEED_DAYS");
const feedEnd = builderSource.indexOf("\nfunction buildSfsc(", feedStart);
assert.notEqual(feedStart, -1, "the SFSC feed builder must exist");
assert.notEqual(feedEnd, -1, "the SFSC feed builder must precede buildSfsc");
const feedSource = builderSource.slice(feedStart, feedEnd);
assert.doesNotMatch(feedSource, /archive\/|\.parquet|\.attorneys\b|\["attorneys"\]/, "the SFSC feed reads raw captures and case-level judgment fields only");
assert.match(refreshWorkflowSource, /- name: Check out SFSC data[\s\S]*?^\s+data\/judgment-rankings\.json$/m);
const captureFiles = {
  "raw/dept302/2026-10-05-000100.json": {
    scraped_at: "2026-10-02T00:01:00Z",
    rulings: [{
      "Case Number": "CGC26000001",
      "Case Title": "ALPHA VS. BETA",
      "Court Date": "2026-10-05 09:00 AM",
      "Calendar Matter": "Demurrer",
      Judge: "A. Judge",
      Rulings: "Set for Law and Motion/Discovery Calendar on Monday, October 5, 2026, Line 1. Defendant's demurrer is overruled.",
    }],
  },
  "raw/dept302/2026-10-05-030000.json": {
    scraped_at: "2026-10-03T03:00:00Z",
    rulings: [
      {
        "Case Number": "CGC26000001",
        "Case Title": "ALPHA VS. BETA",
        "Court Date": "2026-10-05 09:00 AM",
        "Calendar Matter": "Demurrer",
        Judge: "A. Judge",
        Rulings: "Set for Law and Motion/Discovery Calendar on Monday, October 5, 2026, Line 1. Defendant's demurrer is sustained with leave to amend. For the 9:00 a.m. calendar, all attorneys and parties may appear remotely.",
      },
      {
        "Case Number": "CGC26000003",
        "Case Title": "DELTA VS. EPSILON",
        "Court Date": "2026-10-05 09:00 AM",
        "Calendar Matter": "Motion to strike",
        Rulings: "(PART 2 OF 2) (Tentative ruling continued from previous entry) 8. No later than October 13.",
      },
    ],
  },
  "raw/dept204/2026-10-05-000025.json": {
    scraped_at: "2026-10-02T00:00:25Z",
    rulings: [{
      "Case Number": "PES26000002",
      "Case Title": "ESTATE OF X",
      "Court Date": "2026-10-05 09:00 AM",
      "Calendar Matter": "Petition",
      Rulings: "Grant without hearing.",
    }],
  },
  "raw/dept301/2026-10-02-000047.json": {
    scraped_at: "2026-10-01T00:00:47Z",
    rulings: [{
      "Case Number": "CGC26000004",
      "Case Title": "GAMMA VS. ZETA",
      "Court Date": "2026-10-02 09:00 AM",
      "Calendar Matter": "MOTION TO COMPEL",
      Judge: "B. Judge",
      Rulings: "PLAINTIFF GAMMA's MOTION TO COMPEL. Plaintiff Gamma's motion to compel is granted in part.",
    }],
  },
  "raw/deptundefined/2015-11-05-150208.json": { scraped_at: "2015-11-05T00:00:00Z", rulings: [] },
};
const feedContext = {
  config: { sfscData: {} },
  listRepoFiles: (repo, prefix, options) => {
    assert.equal(prefix, "raw/");
    assert.equal(options?.tree, true);
    return Object.keys(captureFiles);
  },
  readRepoFile: (repo, path) => {
    if (path === "data/judgment-rankings.json") {
      return JSON.stringify({
        published_judgment_count: 2,
        rankings: [
          { case_number: "CGC10000001", case_title: "SMALL VS. CLAIM", judgment_amount: 10, judgment_date: "2010-01-02 10:00:00", attorneys: [{ name: "Counsel" }] },
          { case_number: "CPF15000002", case_title: "LARGE VS. AWARD", judgment_amount: 5000, judgment_date: "2015-03-04 10:00:00", attorneys: [{ name: "Counsel" }] },
        ],
      });
    }
    return captureFiles[path] ? JSON.stringify(captureFiles[path]) : "";
  },
  parseJson: (value) => (value ? JSON.parse(value) : null),
};
vm.createContext(feedContext);
vm.runInContext(`${feedSource}\nthis.feed = buildSfscFeed();\nthis.rankings = buildSfscRankings();`, feedContext);
const { feed, rankings } = feedContext;
assert.deepEqual(JSON.parse(JSON.stringify(feed.days)), [
  { date: "2026-10-05", total: 3, departments: [{ department: "302", count: 2 }, { department: "204", count: 1 }] },
  { date: "2026-10-02", total: 1, departments: [{ department: "301", count: 1 }] },
]);
assert.equal(feed.rulings.length, 2, "probate rulings are counted but not quoted, and continuation fragments are skipped");
assert.equal(feed.rulings[0].caseNumber, "CGC26000001");
assert.equal(feed.rulings[0].text, "Defendant's demurrer is sustained with leave to amend.", "the later capture wins and calendar boilerplate is trimmed");
assert.equal(feed.rulings[0].outcome.key, "sustained-leave");
assert.equal(feed.rulings[0].time, "09:00 AM");
assert.equal(feed.rulings[1].text, "Plaintiff Gamma's motion to compel is granted in part.", "a caption echo that decides nothing is dropped");
assert.equal(feed.rulings[1].outcome.key, "partial");
assert.deepEqual(rankings.judgments.top.map((row) => row.caseNumber), ["CPF15000002", "CGC10000001"]);
assert.equal(rankings.judgments.count, 2);
assert.equal("attorneys" in rankings.judgments.top[0], false, "attorney lists stay in the SFSC viewer");
assert.equal(rankings.judgments.top[0].judgmentDate, "2015-03-04");

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
      kcsc: {
        metrics: { cases: 662520, documents: 0, mirroredFiles: 662528 },
        charts: {},
      },
    },
  },
};
vm.createContext(runtimeContext);
vm.runInContext(`${liveMetricSources}\napplyLiveMetrics("sfsc", new Map([
  ["case records", "1,012,384"],
]));
applySfscAggregateSources({
  rulingManifest: null,
  caseTableStats: { case_documents: 4082942, docket_entries: 9092102 },
  caseDirectoryManifest: null,
});`, runtimeContext);
assert.equal(
  runtimeContext.projectData.projects.sfsc.metrics.cases,
  1012384,
  "a current live table must correct the cached SFSC count when the manifest is unavailable",
);

vm.runInContext(`applySfscAggregateSources({
  caseDirectoryManifest: { case_count: 1012384, restricted_count: 192671, source_counts: { case_table_rows: 1205055 } },
});
applyPublicDataManifests("kcsc", new Map([["data/manifest.json", {
  archive: { cases: 662520 }, features: { documents: { rows: 15024602 } },
}]]));`, runtimeContext);
assert.equal(runtimeContext.projectData.projects.sfsc.metrics.cases, 1012384);
assert.equal(runtimeContext.projectData.projects.kcsc.metrics.documents, 15024602);

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
