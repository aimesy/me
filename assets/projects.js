const DATA_URL = "assets/project-data.json";
const SFSC_BASE_URL = "https://sfsc.amyc.us/";
const SFSC_MANIFEST_URL = `${SFSC_BASE_URL}data/manifest.json`;
const SFSC_CASE_TABLE_STATS_URL = `${SFSC_BASE_URL}data/case-table-stats.json`;
const SFSC_CASE_DIRECTORY_MANIFEST_URL = "https://raw.githubusercontent.com/aimesy/sfsc-data/master/archive/case-directory/manifest.json";
const PROJECT_KEYS = ["sfsc", "tentatives", "themes", "kcsc", "nysc", "ndcs", "civproidx"];
const PUBLIC_DATA_KEYS = new Set(["ndcs", "nysc", "kcsc"]);
const LIVE_REPOS = {
  sfsc: { repo: "aimesy/sfsc", branch: "master", path: "LIVE.md" },
  tentatives: { repo: "aimesy/tentatives", branch: "master", path: "LIVE.md" },
  ndcs: { repo: "aimesy/ndcs-data", branch: "master", manifestPaths: ["data/common/manifest.json", "data/manifest.json"] },
  nysc: {
    repo: "aimesy/nysc-data",
    branch: "master",
    manifestPaths: ["data/common/manifest.json"],
  },
  kcsc: { repo: "aimesy/kcsc-data", branch: "master", manifestPaths: ["data/manifest.json"] },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatArchiveSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const units = [
    ["TB", 1024 ** 4],
    ["GB", 1024 ** 3],
    ["MB", 1024 ** 2],
    ["KB", 1024],
  ];
  const [unit, divisor] = units.find(([, size]) => value >= size) || ["bytes", 1];
  const scaled = value / divisor;
  const options = scaled >= 10 || unit === "bytes"
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return `${new Intl.NumberFormat("en-US", options).format(scaled)} ${unit}`;
};

const shortHash = (hash) => (hash ? hash.slice(0, 7) : "unknown");
const formatLabel = (value) => String(value || "").replaceAll("-", " ");
const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

let liveAgeTimer = null;
let liveStatus = {
  generatedAt: null,
  projects: {},
};

function metric(label, value, note = "") {
  return `
    <div class="metric">
      <b>${value}</b>
      <span>${label}</span>
      ${note ? `<small>${note}</small>` : ""}
    </div>
  `;
}

let sfscSearchMode = "dockets";
let projectData = null;
const TENTATIVES_PAGE_SIZE = 9;
let tentativesVisibleCount = TENTATIVES_PAGE_SIZE;
let tentativesSearchQuery = "";

function formatAgo(value) {
  if (!value) return "unknown";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const delta = date.getTime() - Date.now();
  const abs = Math.abs(delta);
  if (abs < 60 * 1000) return "just now";
  const units = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["week", 7 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ];
  for (const [unit, size] of units) {
    if (abs >= size || unit === "minute") return relativeTime.format(Math.round(delta / size), unit);
  }
  return "just now";
}

function setLiveText(key, text, title = "") {
  $$(`[data-live="${key}"]`).forEach((node) => {
    node.textContent = text;
    if (title) node.title = title;
  });
}

function renderLiveAges() {
  const liveDates = Object.values(liveStatus.projects)
    .map((project) => project?.updatedAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (liveDates.length) {
    const freshest = new Date(Math.max(...liveDates.map((date) => date.getTime())));
    setLiveText("generated", `updated ${formatAgo(freshest)}`, freshest.toLocaleString());
  } else if (liveStatus.generatedAt) {
    const fallbackDate = new Date(liveStatus.generatedAt);
    setLiveText("generated", `fallback ${formatAgo(fallbackDate)}`, fallbackDate.toLocaleString());
  }

  for (const key of PROJECT_KEYS) {
    const updatedAt = liveStatus.projects[key]?.updatedAt || projectData?.projects?.[key]?.updatedAt;
    const date = updatedAt ? new Date(updatedAt) : null;
    setLiveText(`${key}-updated`, date ? formatAgo(date) : "unknown", date ? date.toLocaleString() : "");
  }
}

function startLiveAgeTimer() {
  renderLiveAges();
  if (liveAgeTimer) return;
  liveAgeTimer = window.setInterval(renderLiveAges, 60 * 1000);
}

function renderMetrics(target, metrics) {
  const container = $(`[data-metrics="${target}"]`);
  if (!container) return;

  if (target === "sfsc") {
    container.innerHTML = [
      metric("rulings", formatNumber(metrics.tentativeRulings)),
      metric("case records", formatNumber(metrics.cases)),
      metric("documents indexed", formatNumber(metrics.documents)),
      metric("archive size", formatArchiveSize(metrics.documentBytes)),
    ].join("");
  }

  if (target === "tentatives") {
    container.innerHTML = [
      metric("rulings", formatNumber(metrics.tentativeRulings)),
      metric("counties", formatNumber(metrics.parsedCounties)),
      metric("documents indexed", formatNumber(metrics.documents)),
      metric("archive size", formatArchiveSize(metrics.documentBytes)),
    ].join("");
  }

  if (target === "civproidx") {
    container.innerHTML = [
      metric("jurisdictions", formatNumber(metrics.jurisdictions)),
      metric("citations", formatNumber(metrics.citations)),
    ].join("");
  }

  if (PUBLIC_DATA_KEYS.has(target)) {
    const rows = [
      metric("case records", formatNumber(metrics.cases)),
    ];
    if (Number(metrics.documents || 0) > 0) {
      rows.push(metric("documents indexed", formatNumber(metrics.documents)));
    }
    rows.push(
      metric("files", formatNumber(metrics.mirroredFiles || metrics.documents)),
      metric("archive size", formatArchiveSize(metrics.documentBytes)),
    );
    container.innerHTML = rows.join("");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function topRows(rows, limit) {
  return [...rows].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, limit);
}

function renderMiniList(selector, rows, formatter = formatNumber, options = {}) {
  const container = $(selector);
  if (!container) return;
  const { empty = "No matches.", hrefFor = null } = options;

  if (!rows.length) {
    container.innerHTML = `<div class="mini-empty">${escapeHtml(empty)}</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => {
    const content = `
      <span>${escapeHtml(formatLabel(row.label))}</span>
      <b>${escapeHtml(formatter(row.value, row))}</b>
    `;

    if (hrefFor) {
      return `<a class="mini-row mini-row-link" href="${escapeAttribute(hrefFor(row))}">${content}</a>`;
    }

    return `<div class="mini-row">${content}</div>`;
  }).join("");
}

function countySlug(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tentativesViewerUrl(row = null, query = "") {
  const url = new URL("https://aimesy.github.io/tentatives/");
  if (row) url.searchParams.set("counties", countySlug(row.label));
  if (query) url.searchParams.set("q", query);
  return url.toString();
}

function renderTentativesSearch() {
  const input = $('[data-mini-search="tentatives"]');
  const openLink = $('[data-mini-open="tentatives"]');
  const loadMoreWrap = $('[data-mini-more-wrap="tentatives"]');
  const loadMoreButton = $('[data-mini-more="tentatives"]');
  const query = input?.value?.trim() || "";
  if (query !== tentativesSearchQuery) {
    tentativesSearchQuery = query;
    tentativesVisibleCount = TENTATIVES_PAGE_SIZE;
  }
  const rows = projectData?.projects?.tentatives?.charts?.rulingsByCounty || [];
  const filtered = topRows(rows.filter((row) => {
    const haystack = [row.label, row.value, row.documents].join(" ").toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  }), rows.length);
  const visible = filtered.slice(0, tentativesVisibleCount);

  if (openLink) openLink.href = tentativesViewerUrl(null, query);

  renderMiniList(
    '[data-mini-list="tentatives"]',
    visible,
    (value) => `${formatNumber(value)} rulings`,
    {
      empty: "No counties matched this search.",
      hrefFor: (row) => tentativesViewerUrl(row, query),
    },
  );

  const remaining = Math.max(0, filtered.length - visible.length);
  if (loadMoreWrap) loadMoreWrap.hidden = remaining === 0;
  if (loadMoreButton) {
    const nextCount = Math.min(TENTATIVES_PAGE_SIZE, remaining);
    loadMoreButton.setAttribute("aria-label", `Load ${nextCount} more counties`);
  }
}

function sfscDocketSearchUrl(query = "") {
  const cleanQuery = String(query || "").trim();
  return `${SFSC_BASE_URL}#/cases${cleanQuery ? `?q=${encodeURIComponent(cleanQuery)}` : ""}`;
}

function sfscDocketSearchRow(query = "") {
  const cleanQuery = String(query || "").trim();
  return {
    title: cleanQuery ? `Search SFSC dockets for “${cleanQuery}”` : "Browse SFSC court dockets",
    meta: "Live case index",
    detail: cleanQuery
      ? "Open the complete SFSC case search with this query."
      : "Search by case number, title, party, attorney, filing date, or case facet.",
    href: sfscDocketSearchUrl(cleanQuery),
    action: cleanQuery ? "Search" : "Browse",
  };
}

function sfscRulingSearchUrl(query = "") {
  const cleanQuery = String(query || "").trim();
  return `${SFSC_BASE_URL}#q=${encodeURIComponent(cleanQuery)}`;
}

function sfscRulingSearchRow(query = "") {
  const cleanQuery = String(query || "").trim();
  return {
    title: cleanQuery ? `Search SFSC tentative rulings for “${cleanQuery}”` : "Browse SFSC tentative rulings",
    meta: "Live rulings index",
    detail: cleanQuery
      ? "Open the complete SFSC tentative-rulings search with this query."
      : "Search by case number, title, ruling text, motion, judge, or department.",
    href: sfscRulingSearchUrl(cleanQuery),
    action: cleanQuery ? "Search" : "Browse",
  };
}

function renderSfscModeChrome(label) {
  const input = $('[data-sfsc-search]');
  if (input) {
    input.placeholder = `search ${label}`;
    input.setAttribute("aria-label", `Search ${label}`);
  }

  $$('[data-sfsc-mode]').forEach((button) => {
    const active = button.dataset.sfscMode === sfscSearchMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function renderSfscResultRows(container, rows, label) {
  if (!rows.length) {
    container.innerHTML = `<div class="mini-empty">No ${escapeHtml(label)} matched this search.</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <div class="mini-result">
      <div class="mini-result-main">
        <div class="mini-result-title">${escapeHtml(row.title || row.caseNumber || "Untitled")}</div>
        <div class="mini-result-meta">${escapeHtml([row.caseNumber, row.meta].filter(Boolean).join(" / "))}</div>
        <div class="mini-result-detail">${escapeHtml(row.detail || "")}</div>
      </div>
      <a class="mini-result-link" href="${escapeAttribute(row.href || SFSC_BASE_URL)}">${escapeHtml(row.action || "View")}</a>
    </div>
  `).join("");
}

function renderSfscArchiveSearch() {
  const container = $('[data-sfsc-results]');
  const input = $('[data-sfsc-search]');
  if (!container) return;

  const query = input?.value?.trim() || "";
  const label = sfscSearchMode === "dockets" ? "court dockets" : "tentative rulings";
  renderSfscModeChrome(label);
  const row = sfscSearchMode === "dockets"
    ? sfscDocketSearchRow(query)
    : sfscRulingSearchRow(query);
  renderSfscResultRows(container, [row], label);
}

function setText(selector, text) {
  const node = $(selector);
  if (node) node.textContent = text;
}

async function loadData() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${DATA_URL}`);
  return response.json();
}

function githubRawUrl({ repo, branch, path }) {
  return `https://raw.githubusercontent.com/${repo}/${branch || "HEAD"}/${path}?v=${Date.now()}`;
}

function githubStatsRawUrl(config, path) {
  return githubRawUrl({
    repo: config.statsRepo || config.repo,
    branch: config.statsBranch || config.branch,
    path,
  });
}

function parseLiveTable(markdown) {
  const metrics = new Map();
  for (const line of String(markdown || "").split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    if (!label || label === "Metric" || /^-+$/.test(label)) continue;
    metrics.set(label.toLowerCase(), value);
  }
  return metrics;
}

function parseCount(value) {
  const text = String(value || "").replace(/,/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseBytes(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(gb|mb|kb|bytes?|b)?/i);
  if (!match) return 0;
  const number = Number(match[1]);
  const unit = (match[2] || "bytes").toLowerCase();
  if (unit === "gb") return number * 1024 * 1024 * 1024;
  if (unit === "mb") return number * 1024 * 1024;
  if (unit === "kb") return number * 1024;
  return number;
}

function positiveNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function maxPositive(...values) {
  return Math.max(0, ...values.map(positiveNumber));
}

function firstPositive(...values) {
  for (const value of values) {
    const number = positiveNumber(value);
    if (number) return number;
  }
  return 0;
}

function sumBy(rows, key) {
  return Array.isArray(rows)
    ? rows.reduce((sum, row) => sum + positiveNumber(row?.[key]), 0)
    : 0;
}

function applyPublicDataManifests(key, manifests) {
  const project = projectData?.projects?.[key];
  if (!project) return;

  const metrics = project.metrics;
  const dataManifest = manifests.get("data/manifest.json") || {};
  const commonManifest = manifests.get("data/common/manifest.json") || {};
  const caseDirectoryManifest = manifests.get("archive/case-directory/manifest.json") || {};
  const archive = dataManifest.archive || {};
  const dataTables = dataManifest.tables || {};
  const commonTables = commonManifest.tables || {};
  const commonSummary = commonManifest.summary || {};
  const normalTables = dataManifest.normalization?.tables || {};
  const caseDirectoryScan = caseDirectoryManifest.scan || {};

  const cases = firstPositive(
    archive.cases,
    archive.cases_index_rows,
    normalTables.cases,
    dataTables.cases?.rows,
    commonSummary.cases,
    commonTables.cases?.rows,
    commonManifest.case_count,
    commonManifest.cases,
    caseDirectoryManifest.cases,
  );
  if (cases) metrics.cases = cases;

  const documents = firstPositive(
    commonSummary.documents,
    commonTables.documents?.rows,
    dataManifest.documents?.count,
    dataManifest.documents?.rows,
    dataTables.documents?.rows,
  );
  if (documents) metrics.documents = documents;

  const promotedFiles = sumBy(dataManifest.promoted_runs, "promoted_file_count");
  const archiveCaseFiles = firstPositive(archive.cases_index_rows, archive.cases)
    + (archive.cases_index ? 1 : 0);
  const tableFiles = Object.keys(dataTables).length;
  const caseDirectoryFiles = positiveNumber(caseDirectoryScan.result_files)
    + positiveNumber(caseDirectoryScan.document_byte_files);
  const mirroredFiles = firstPositive(
    dataManifest.mirrored_files,
    dataManifest.file_count,
    promotedFiles,
    archiveCaseFiles + tableFiles,
    caseDirectoryFiles,
  );
  if (mirroredFiles) metrics.mirroredFiles = mirroredFiles;

  const documentBytes = firstPositive(
    dataManifest.documentBytes,
    dataManifest.document_bytes,
    dataManifest.mirrored_bytes,
    dataManifest.total_bytes,
    dataManifest.archive?.size_bytes,
    dataManifest.archive?.bytes,
    commonSummary.bytes,
    sumBy(dataManifest.promoted_runs, "promoted_bytes"),
  );
  if (documentBytes) metrics.documentBytes = documentBytes;

  metrics.snapshots = Math.max(
    positiveNumber(metrics.snapshots),
    positiveNumber(dataManifest.snapshots),
    archiveCaseFiles,
    caseDirectoryFiles,
  );
}

function applySfscAggregateSources({ rulingManifest, caseTableStats, caseDirectoryManifest }) {
  const project = projectData?.projects?.sfsc;
  if (!project) return;
  const metrics = project.metrics;

  const departments = Array.isArray(rulingManifest?.departments) ? rulingManifest.departments : [];
  if (departments.length) {
    metrics.tentativeRulings = departments.reduce((sum, department) => sum + positiveNumber(department.rulings), 0)
      || metrics.tentativeRulings;
    project.charts.rulingsByDepartment = departments.map((department) => ({
      label: department.name || `Dept. ${department.department}`,
      value: positiveNumber(department.rulings),
    }));
  }

  if (caseTableStats) {
    metrics.documents = positiveNumber(caseTableStats.case_documents) || metrics.documents;
    metrics.docketEntries = positiveNumber(caseTableStats.docket_entries) || metrics.docketEntries;
  }

  const sourceCounts = caseDirectoryManifest?.source_counts || {};
  const sourceRows = Math.max(
    positiveNumber(sourceCounts.case_json_rows),
    positiveNumber(sourceCounts.case_table_rows),
    positiveNumber(sourceCounts.case_index_rows),
  );
  const directoryRows = positiveNumber(caseDirectoryManifest?.case_count)
    + positiveNumber(caseDirectoryManifest?.restricted_count)
    + positiveNumber(caseDirectoryManifest?.indexed_count);
  metrics.cases = maxPositive(metrics.cases, sourceRows, directoryRows);
}

function applyLiveMetrics(key, table) {
  const project = projectData?.projects?.[key];
  if (!project) return;
  const metrics = project.metrics;

  if (key === "sfsc") {
    metrics.tentativeRulings = parseCount(table.get("tentative rulings")) || metrics.tentativeRulings;
    metrics.cases = maxPositive(
      metrics.cases,
      parseCount(table.get("case records")),
      parseCount(table.get("dockets")),
    );
    metrics.documents = parseCount(table.get("documents indexed")) || parseCount(table.get("case documents")) || metrics.documents;
    metrics.docketEntries = parseCount(table.get("docket entries")) || metrics.docketEntries;
    const bytes = parseBytes(table.get("archive size"));
    if (bytes) metrics.documentBytes = bytes;
  }

  if (key === "tentatives") {
    metrics.tentativeRulings = parseCount(table.get("parsed rulings")) || metrics.tentativeRulings;
    metrics.parsedCounties = parseCount(table.get("parsed counties")) || metrics.parsedCounties;
    metrics.documents = parseCount(table.get("documents indexed")) || parseCount(table.get("source documents")) || metrics.documents;
    metrics.archivedFiles = parseCount(table.get("archived files")) || metrics.archivedFiles;
    const bytes = parseBytes(table.get("archive size"));
    if (bytes) metrics.documentBytes = bytes;
    metrics.coverage = table.get("hearing-date coverage") || metrics.coverage;
  }

  if (key === "civproidx") {
    metrics.jurisdictions = parseCount(table.get("jurisdictions")) || metrics.jurisdictions;
    metrics.citations = parseCount(table.get("citations")) || metrics.citations;
    metrics.documents = parseCount(table.get("documents")) || metrics.documents;
  }

  if (PUBLIC_DATA_KEYS.has(key)) {
    metrics.cases = parseCount(table.get("case records")) || parseCount(table.get("cases")) || metrics.cases;
    metrics.documents = parseCount(table.get("documents indexed")) || parseCount(table.get("documents")) || metrics.documents;
    metrics.mirroredFiles = parseCount(table.get("mirrored files"))
      || parseCount(table.get("files"))
      || metrics.mirroredFiles;
    metrics.snapshots = parseCount(table.get("snapshots")) || metrics.snapshots;
    const bytes = parseBytes(table.get("archive size"));
    if (bytes) metrics.documentBytes = bytes;
  }
}

function renderLiveMetricValues() {
  const projects = projectData.projects;
  for (const key of PROJECT_KEYS) {
    if (projects[key]) renderMetrics(key, projects[key].metrics);
  }

  setText('[data-live="sfsc-rulings"]', formatNumber(projects.sfsc.metrics.tentativeRulings));
  setText('[data-live="sfsc-cases"]', formatNumber(projects.sfsc.metrics.cases));
  setText('[data-live="sfsc-docs"]', formatNumber(projects.sfsc.metrics.documents));
  setText('[data-live="sfsc-size"]', formatArchiveSize(projects.sfsc.metrics.documentBytes));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="tentatives-docs"]', formatNumber(projects.tentatives.metrics.documents));
  setText('[data-live="tentatives-size"]', formatArchiveSize(projects.tentatives.metrics.documentBytes));
}

async function loadPublicDataManifests(key, config) {
  if (!Array.isArray(config.manifestPaths) || !config.manifestPaths.length) return;
  const entries = await Promise.all(config.manifestPaths.map(async (path) => {
    try {
      const response = await fetch(githubStatsRawUrl(config, path), { cache: "no-store" });
      if (!response.ok) {
        console.warn(`${key} manifest ${path} unavailable: ${response.status}`);
        return null;
      }
      return [path, await response.json()];
    } catch (error) {
      console.warn(`${key} manifest ${path} unavailable`, error);
      return null;
    }
  }));
  const manifests = new Map(entries.filter(Boolean));
  if (manifests.size) applyPublicDataManifests(key, manifests);
}

async function loadSfscAggregateSources() {
  const fetchJson = async (url) => {
    try {
      const response = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        console.warn(`SFSC aggregate source unavailable: ${url} ${response.status}`);
        return null;
      }
      return response.json();
    } catch (error) {
      console.warn(`SFSC aggregate source unavailable: ${url}`, error);
      return null;
    }
  };

  const [rulingManifest, caseTableStats, caseDirectoryManifest] = await Promise.all([
    fetchJson(SFSC_MANIFEST_URL),
    fetchJson(SFSC_CASE_TABLE_STATS_URL),
    fetchJson(SFSC_CASE_DIRECTORY_MANIFEST_URL),
  ]);
  applySfscAggregateSources({ rulingManifest, caseTableStats, caseDirectoryManifest });
}

async function loadLiveRepo(key, config) {
  if (config.path) {
    try {
      const liveResponse = await fetch(githubRawUrl(config), { cache: "no-store" });
      if (liveResponse.ok) {
        const markdown = await liveResponse.text();
        applyLiveMetrics(key, parseLiveTable(markdown));
      } else {
        console.warn(`${key} LIVE fetch unavailable: ${liveResponse.status}`);
      }
    } catch (error) {
      console.warn(`${key} LIVE fetch unavailable`, error);
    }
  }

  if (key === "sfsc") {
    await loadSfscAggregateSources();
  }

  await loadPublicDataManifests(key, config);
  renderLiveMetricValues();
  renderLiveAges();
}

async function refreshLiveRepos() {
  const results = await Promise.allSettled(Object.entries(LIVE_REPOS).map(([key, config]) => loadLiveRepo(key, config)));
  results.forEach((result, index) => {
    if (result.status === "rejected") console.error(`${Object.keys(LIVE_REPOS)[index]} live stats unavailable`, result.reason);
  });
  startLiveAgeTimer();
}

function render(data) {
  projectData = data;
  const { projects } = data;
  liveStatus.generatedAt = data.generatedAt;
  liveStatus.projects = Object.fromEntries(PROJECT_KEYS
    .filter((key) => projects[key])
    .map((key) => [key, { updatedAt: projects[key].updatedAt, ref: projects[key].ref }]));
  for (const key of PROJECT_KEYS) {
    if (projects[key]) renderMetrics(key, projects[key].metrics);
  }

  renderSfscArchiveSearch();
  renderTentativesSearch();

  setText('[data-live="sfsc-rulings"]', formatNumber(projects.sfsc.metrics.tentativeRulings));
  setText('[data-live="sfsc-cases"]', formatNumber(projects.sfsc.metrics.cases));
  setText('[data-live="sfsc-docs"]', formatNumber(projects.sfsc.metrics.documents));
  setText('[data-live="sfsc-size"]', formatArchiveSize(projects.sfsc.metrics.documentBytes));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="tentatives-docs"]', formatNumber(projects.tentatives.metrics.documents));
  setText('[data-live="tentatives-size"]', formatArchiveSize(projects.tentatives.metrics.documentBytes));
  setText('[data-live="sfsc-ref"]', shortHash(projects.sfsc.ref));
  setText('[data-live="tentatives-ref"]', shortHash(projects.tentatives.ref));
  setText('[data-live="themes-ref"]', shortHash(projects.themes?.ref));
  setText('[data-live="civproidx-ref"]', shortHash(projects.civproidx.ref));
  setText('[data-live="ndcs-ref"]', shortHash(projects.ndcs?.ref));
  setText('[data-live="nysc-ref"]', shortHash(projects.nysc?.ref));
  setText('[data-live="kcsc-ref"]', shortHash(projects.kcsc?.ref));
  startLiveAgeTimer();
  refreshLiveRepos().catch((error) => console.error(error));
}

let sfscInputTimer = null;

$$('[data-sfsc-mode]').forEach((button) => {
  button.addEventListener("click", () => {
    sfscSearchMode = button.dataset.sfscMode || "dockets";
    const input = $('[data-sfsc-search]');
    if (input) input.value = "";
    renderSfscArchiveSearch();
  });
});

$('[data-sfsc-search]')?.addEventListener("input", () => {
  clearTimeout(sfscInputTimer);
  sfscInputTimer = setTimeout(renderSfscArchiveSearch, 180);
});

$('[data-sfsc-search]')?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const target = sfscSearchMode === "dockets"
    ? sfscDocketSearchUrl(event.currentTarget.value)
    : sfscRulingSearchUrl(event.currentTarget.value);
  window.location.assign(target);
});

$('[data-mini-search="tentatives"]')?.addEventListener("input", renderTentativesSearch);

$('[data-mini-more="tentatives"]')?.addEventListener("click", () => {
  tentativesVisibleCount += TENTATIVES_PAGE_SIZE;
  renderTentativesSearch();
});

$('[data-mini-clear="tentatives"]')?.addEventListener("click", () => {
  const input = $('[data-mini-search="tentatives"]');
  if (input) input.value = "";
  renderTentativesSearch();
  input?.focus();
});

loadData()
  .then(render)
  .catch((error) => {
    document.body.dataset.dataState = "error";
    setText('[data-live="generated"]', "data unavailable");
    console.error(error);
  });
