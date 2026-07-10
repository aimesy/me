import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const projectsSource = readFileSync(new URL("../assets/projects.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const builderSource = readFileSync(new URL("./build-project-data.mjs", import.meta.url), "utf8").replaceAll("\r\n", "\n");

for (const retiredDependency of [
  "archive/cases-index.ndjson",
  "archive/cases/",
  "loadSfscDockets",
  "loadSfscCaseRecord",
  "SFSC docket search is unavailable",
]) {
  assert.equal(
    projectsSource.includes(retiredDependency),
    false,
    `projects.js must not use the retired SFSC Pages dependency: ${retiredDependency}`,
  );
}

assert.match(indexSource, /data-sfsc-search/);
assert.match(indexSource, /data-sfsc-results/);
assert.match(projectsSource, /renderSfscResultRows\(container, \[sfscDocketSearchRow\(query\)\], label\)/);
assert.match(projectsSource, /window\.location\.assign\(sfscDocketSearchUrl\(event\.currentTarget\.value\)\)/);

const buildSfscStart = builderSource.indexOf("function buildSfsc()");
const buildSfscEnd = builderSource.indexOf("\nfunction buildTentatives()", buildSfscStart);
assert.notEqual(buildSfscStart, -1, "buildSfsc must exist");
assert.notEqual(buildSfscEnd, -1, "buildSfsc must have a complete function body");
const buildSfscSource = builderSource.slice(buildSfscStart, buildSfscEnd);
assert.doesNotMatch(buildSfscSource, /archive\/cases-index\.ndjson|archive\/document-index\.ndjson|archive\/cases\//);
assert.doesNotMatch(buildSfscSource, /searchSamples/);
assert.match(buildSfscSource, /data\/case-table-stats\.json/);
assert.match(buildSfscSource, /archive\/case-directory\/manifest\.json/);
assert.match(buildSfscSource, /readRepoFile\(config\.sfscData,/);

const sfscConfig = {};
const sfscDataConfig = {};
const builderContext = {
  config: { sfsc: sfscConfig, sfscData: sfscDataConfig },
  readRepoFile(repo, path) {
    if (repo !== sfscDataConfig) return "";
    if (path === "data/case-table-stats.json") {
      return JSON.stringify({ cases: 404019, case_documents: 4082942, docket_entries: 9092102 });
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

console.log("SFSC docket integration checks passed.");
