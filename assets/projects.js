const DATA_URL = "assets/project-data.json";
const SFSC_BASE_URL = "https://sfsc.amyc.us/";
const SFSC_CASE_INDEX_URL = `${SFSC_BASE_URL}archive/cases-index.ndjson`;
const SFSC_MANIFEST_URL = `${SFSC_BASE_URL}data/manifest.json`;
const DUCKDB_WASM_URL = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev45.0/+esm";
const SFSC_DOCKET_RESULT_LIMIT = 5;
const SFSC_DOCKET_SEARCH_CONCURRENCY = 6;
const PROJECT_KEYS = ["sfsc", "tentatives", "ndcs", "nysc", "cividx"];
const LIVE_REPOS = {
  sfsc: { repo: "aimesy/sfsc", branch: "master", path: "LIVE.md" },
  tentatives: { repo: "aimesy/tentatives", branch: "master", path: "LIVE.md" },
  cividx: { repo: "aimesy/cividx" },
  ndcs: { repo: "aimesy/ndcs-data" },
  nysc: { repo: "aimesy/nysc-data" },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatMegabytes = (bytes) => {
  const value = Number(bytes || 0) / (1024 * 1024);
  const options = value >= 10
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  return new Intl.NumberFormat("en-US", options).format(value);
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
let sfscSearchRenderId = 0;
let projectData = null;

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

const sfscData = {
  dockets: {
    status: "idle",
    rows: [],
    error: "",
    promise: null,
    caseCache: new Map(),
  },
  rulings: {
    status: "idle",
    error: "",
    promise: null,
    manifest: null,
    duckdb: null,
    db: null,
    conn: null,
  },
};

function renderMetrics(target, metrics) {
  const container = $(`[data-metrics="${target}"]`);
  if (!container) return;

  if (target === "sfsc") {
    container.innerHTML = [
      metric("rulings", formatNumber(metrics.tentativeRulings)),
      metric("dockets", formatNumber(metrics.cases)),
      metric("documents", formatNumber(metrics.documents)),
      metric("MB", formatMegabytes(metrics.documentBytes)),
    ].join("");
  }

  if (target === "tentatives") {
    container.innerHTML = [
      metric("rulings", formatNumber(metrics.tentativeRulings)),
      metric("counties", formatNumber(metrics.parsedCounties)),
      metric("documents", formatNumber(metrics.documents)),
      metric("MB", formatMegabytes(metrics.documentBytes)),
    ].join("");
  }

  if (target === "cividx") {
    container.innerHTML = [
      metric("jurisdictions", formatNumber(metrics.jurisdictions)),
      metric("citations", formatNumber(metrics.citations)),
    ].join("");
  }

  if (target === "ndcs" || target === "nysc") {
    container.innerHTML = [
      metric("cases", formatNumber(metrics.cases)),
      metric("files", formatNumber(metrics.mirroredFiles || metrics.documents)),
      metric("MB", formatMegabytes(metrics.documentBytes)),
    ].join("");
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

function escapeSql(value) {
  return String(value ?? "").replaceAll("'", "''");
}

function searchTermToIlike(raw) {
  let query = String(raw || "").replace(/[%_]/g, " ");
  const hasWildcard = /[*?]/.test(query);
  query = query.replace(/\*/g, "%").replace(/\?/g, "_");
  return hasWildcard ? query : `%${query}%`;
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
  const query = input?.value?.trim() || "";
  const rows = projectData?.projects?.tentatives?.charts?.rulingsByCounty || [];
  const filtered = topRows(rows.filter((row) => {
    const haystack = [row.label, row.value, row.documents].join(" ").toLowerCase();
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  }), rows.length);

  if (openLink) openLink.href = tentativesViewerUrl(null, query);

  renderMiniList(
    '[data-mini-list="tentatives"]',
    filtered,
    (value) => `${formatNumber(value)} rulings`,
    {
      empty: "No counties matched this search.",
      hrefFor: (row) => tentativesViewerUrl(row, query),
    },
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function plural(value, singular, pluralForm = `${singular}s`) {
  return `${formatNumber(value)} ${Number(value) === 1 ? singular : pluralForm}`;
}

function sfscSafeCaseName(caseNumber) {
  return String(caseNumber || "").replace(/\.+/g, "_").replace(/[^A-Za-z0-9_-]/g, "_");
}

function sfscCaseUrl(caseNumber) {
  return `${SFSC_BASE_URL}#/case/${encodeURIComponent(caseNumber || "")}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sfscRecordCaseNumber(record, indexRow = {}) {
  return cleanText(record?.case_number || record?.docket?.case_number || indexRow.case_number);
}

function sfscDocketEntries(record) {
  return asArray(record?.docket_entries);
}

function sfscDocumentRows(record) {
  return asArray(record?.documents);
}

function sfscCaseTitle(record, indexRow = {}) {
  return cleanText(record?.case_title || indexRow.case_title || sfscRecordCaseNumber(record, indexRow));
}

function latestSfscDocketEntry(entries) {
  return [...entries]
    .filter((entry) => entry && (entry.date_filed || entry.description))
    .sort((a, b) => String(b.date_filed || "").localeCompare(String(a.date_filed || "")))[0] || null;
}

function sfscDocketSearchText(record, indexRow = {}) {
  const parts = [
    indexRow.case_number,
    indexRow.case_title,
    record?.case_number,
    record?.docket?.case_number,
    record?.case_title,
    record?.cause_of_action,
    record?.case_type,
    record?.category,
    record?.court,
  ];
  for (const entry of sfscDocketEntries(record)) {
    parts.push(entry.date_filed, entry.description, entry.doc_id, entry.fee);
  }
  for (const doc of sfscDocumentRows(record)) {
    parts.push(doc.description, doc.title, doc.doc_id, doc.filed, doc.date_filed, doc.sha256, doc.source_url);
  }
  for (const party of asArray(record?.parties)) {
    parts.push(party.name, party.party, party.party_type, party.type, party.roles, party.aliases, party.attorneys);
  }
  for (const attorney of asArray(record?.attorneys)) {
    parts.push(
      attorney.name,
      attorney.display_name,
      attorney.bar_number,
      attorney.bar,
      attorney.address,
      attorney.contact_block,
      attorney.parties_represented,
    );
  }
  for (const calendar of asArray(record?.calendar)) {
    parts.push(calendar.judge, calendar.judicial_officer, calendar.officer, calendar.department, calendar.location, calendar.matters);
  }
  return cleanText(parts.flat(Infinity).filter(Boolean).join(" ")).toLowerCase();
}

function sfscQueryMatches(text, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => text.includes(term));
}

function sfscRulingUrl(row, query) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (row.department) params.set("dept", row.department);
  if (row.row_hash) params.set("sel", row.row_hash);
  params.set("view", "dossier");
  return `${SFSC_BASE_URL}#${params.toString()}`;
}

function renderSfscModeChrome(label) {
  const input = $('[data-sfsc-search]');
  if (input) input.placeholder = `search ${label}`;

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
      <a class="mini-result-link" href="${escapeAttribute(row.href || SFSC_BASE_URL)}">View</a>
    </div>
  `).join("");
}

function parseNdjson(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // Ignore malformed lines, matching the SFSC viewer.
    }
  }
  return rows;
}

function applySfscDocketIndexMetrics(rows) {
  const metrics = projectData?.projects?.sfsc?.metrics;
  if (!metrics || !Array.isArray(rows) || !rows.length) return;
  metrics.cases = rows.length;
  metrics.documents = rows.reduce((sum, row) => sum + Number(row?.n_documents || 0), 0);
  metrics.docketEntries = rows.reduce((sum, row) => sum + Number(row?.n_entries || 0), 0);
  renderLiveMetricValues();
}

async function loadSfscDockets() {
  const state = sfscData.dockets;
  if (state.status === "loaded") return state.rows;
  if (state.promise) return state.promise;

  state.status = "loading";
  state.promise = (async () => {
    try {
      const response = await fetch(SFSC_CASE_INDEX_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseNdjson(await response.text())
        .sort((a, b) => String(b.captured_at || "").localeCompare(String(a.captured_at || "")));
      state.rows = rows;
      applySfscDocketIndexMetrics(rows);
      state.status = "loaded";
      state.error = "";
      return rows;
    } catch (error) {
      state.status = "error";
      state.error = error?.message || String(error);
      throw error;
    } finally {
      state.promise = null;
    }
  })();
  return state.promise;
}

async function loadSfscCaseRecord(caseNumber) {
  const key = sfscSafeCaseName(caseNumber);
  const state = sfscData.dockets;
  if (!key) return null;
  if (state.caseCache.has(key)) return state.caseCache.get(key);

  const promise = (async () => {
    const response = await fetch(`${SFSC_BASE_URL}archive/cases/${key}.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })().catch(() => null);

  state.caseCache.set(key, promise);
  return promise;
}

async function hydrateSfscDocketRows(rows) {
  const records = await Promise.all(rows.map((row) => loadSfscCaseRecord(row.case_number)));
  return rows.map((row, index) => sfscDocketDisplayRow(row, records[index]));
}

function sfscDocketDisplayRow(row, record = null) {
  const entries = record ? sfscDocketEntries(record) : [];
  const docs = record ? sfscDocumentRows(record) : [];
  const latest = latestSfscDocketEntry(entries);
  const caseNumber = sfscRecordCaseNumber(record, row);
  const entryCount = entries.length || Number(row.n_entries || 0);
  const documentCount = docs.length || Number(row.n_documents || 0);
  const captured = row.captured_at ? `captured ${formatDate(row.captured_at)}` : "";
  const meta = [
    plural(entryCount, "docket entry", "docket entries"),
    plural(documentCount, "document"),
  ].join(" / ");

  return {
    caseNumber,
    title: sfscCaseTitle(record, row) || caseNumber || "Untitled",
    meta,
    detail: cleanText(latest?.description || record?.cause_of_action || captured),
    href: sfscCaseUrl(caseNumber),
    searchText: sfscDocketSearchText(record || {}, row),
  };
}

async function searchSfscDockets(query, progress = () => {}) {
  const rows = await loadSfscDockets();
  if (!query) return hydrateSfscDocketRows(rows.slice(0, SFSC_DOCKET_RESULT_LIMIT));

  progress("Searching court dockets...");
  const queue = [...rows];
  const matches = [];
  const worker = async () => {
    while (queue.length && matches.length < SFSC_DOCKET_RESULT_LIMIT) {
      const row = queue.shift();
      if (!row?.case_number) continue;
      const record = await loadSfscCaseRecord(row.case_number);
      if (!record) continue;
      const displayRow = sfscDocketDisplayRow(row, record);
      if (sfscQueryMatches(displayRow.searchText, query)) matches.push(displayRow);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(SFSC_DOCKET_SEARCH_CONCURRENCY, queue.length) },
    worker,
  ));
  return matches.sort((a, b) => String(b.caseNumber || "").localeCompare(String(a.caseNumber || "")));
}

function tableNameForSfscDept(department) {
  return `dept${String(department || "").replace(/[^A-Za-z0-9_]/g, "_")}`;
}

async function initSfscRulingBackend(progress = () => {}) {
  const state = sfscData.rulings;
  if (state.status === "ready") return state;
  if (state.promise) return state.promise;

  state.status = "loading";
  state.promise = (async () => {
    try {
      progress("Loading ruling index...");
      const duckdb = await import(DUCKDB_WASM_URL);
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = bundles.mvp;
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }),
      );
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl));
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      const conn = await db.connect();

      const manifestResponse = await fetch(SFSC_MANIFEST_URL, { cache: "no-cache" });
      if (!manifestResponse.ok) throw new Error(`HTTP ${manifestResponse.status}`);
      const manifest = await manifestResponse.json();
      const departments = Array.isArray(manifest.departments) ? manifest.departments : [];

      await conn.query(`CREATE OR REPLACE VIEW data AS
        SELECT NULL::VARCHAR AS department,
               NULL::VARCHAR AS case_number,
               NULL::VARCHAR AS case_title,
               NULL::VARCHAR AS court_date,
               NULL::VARCHAR AS hearing_time,
               NULL::VARCHAR AS calendar_matter,
               NULL::VARCHAR AS judge,
               NULL::VARCHAR AS ruling,
               NULL::VARCHAR AS row_hash
        WHERE FALSE`);

      for (const department of departments) {
        const dept = String(department.department || "");
        if (!dept) continue;
        progress(`Loading Dept ${dept}...`);
        const dataResponse = await fetch(`${SFSC_BASE_URL}data/tentatives-${dept}.parquet`, { cache: "force-cache" });
        if (!dataResponse.ok) throw new Error(`HTTP ${dataResponse.status} loading Dept ${dept}`);
        const buffer = new Uint8Array(await dataResponse.arrayBuffer());
        const fileName = `sfsc-dept-${dept}.parquet`;
        const tableName = tableNameForSfscDept(dept);
        await db.registerFileBuffer(fileName, buffer);
        await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM '${fileName}'`);
      }

      const tableNames = departments
        .map((department) => String(department.department || ""))
        .filter(Boolean)
        .map((dept) => tableNameForSfscDept(dept));

      if (tableNames.length) {
        const union = tableNames.map((tableName) => `
          SELECT department, case_number, case_title, court_date, hearing_time,
                 calendar_matter, judge, ruling, row_hash
          FROM ${tableName}
        `).join(" UNION ALL ");
        await conn.query(`CREATE OR REPLACE VIEW data AS ${union}`);
      }

      state.status = "ready";
      state.error = "";
      state.manifest = manifest;
      state.duckdb = duckdb;
      state.db = db;
      state.conn = conn;
      progress("Searching...");
      return state;
    } catch (error) {
      state.status = "error";
      state.error = error?.message || String(error);
      throw error;
    } finally {
      state.promise = null;
    }
  })();

  return state.promise;
}

async function searchSfscRulings(query, progress) {
  if (!query) return [];
  const state = await initSfscRulingBackend(progress);
  const pattern = escapeSql(searchTermToIlike(query));
  const result = await state.conn.query(`
    SELECT department, case_number, case_title, court_date, hearing_time,
           calendar_matter, judge, row_hash
    FROM data
    WHERE case_number ILIKE '${pattern}'
       OR case_title ILIKE '${pattern}'
       OR ruling ILIKE '${pattern}'
       OR calendar_matter ILIKE '${pattern}'
    ORDER BY court_date DESC, hearing_time DESC, case_number
    LIMIT 5
  `);

  return result.toArray().map((row) => ({
    caseNumber: row.case_number || "",
    title: row.case_title || row.case_number || "Untitled",
    meta: [
      row.department ? `Dept ${row.department}` : "",
      formatDate(row.court_date),
      row.hearing_time || "",
    ].filter(Boolean).join(" / "),
    detail: [row.calendar_matter || "", row.judge || ""].filter(Boolean).join(" / "),
    href: sfscRulingUrl(row, query),
    searchText: [row.case_number, row.case_title, row.calendar_matter, row.judge].join(" "),
  }));
}

async function renderSfscArchiveSearch() {
  const container = $('[data-sfsc-results]');
  const input = $('[data-sfsc-search]');
  if (!container) return;

  const renderId = ++sfscSearchRenderId;
  const query = input?.value?.trim() || "";
  const label = sfscSearchMode === "dockets" ? "court dockets" : "tentative rulings";
  renderSfscModeChrome(label);

  if (sfscSearchMode === "dockets") {
    container.innerHTML = `<div class="mini-empty">Loading court dockets...</div>`;
    try {
      const displayRows = await searchSfscDockets(query, (message) => {
        if (renderId === sfscSearchRenderId) {
          container.innerHTML = `<div class="mini-empty">${escapeHtml(message)}</div>`;
        }
      });
      if (renderId !== sfscSearchRenderId) return;
      renderSfscResultRows(container, displayRows, label);
    } catch (error) {
      if (renderId !== sfscSearchRenderId) return;
      console.error(error);
      container.innerHTML = '<div class="mini-empty">SFSC docket search is unavailable.</div>';
    }
    return;
  }

  if (!query) {
    container.innerHTML = '<div class="mini-empty">Enter a search term.</div>';
    return;
  }

  const progress = (message) => {
    if (renderId === sfscSearchRenderId) {
      container.innerHTML = `<div class="mini-empty">${escapeHtml(message)}</div>`;
    }
  };

  progress("Loading tentative rulings...");
  try {
    const rows = await searchSfscRulings(query, progress);
    if (renderId !== sfscSearchRenderId) return;
    renderSfscResultRows(container, rows, label);
  } catch (error) {
    if (renderId !== sfscSearchRenderId) return;
    console.error(error);
    container.innerHTML = '<div class="mini-empty">SFSC tentative ruling search is unavailable.</div>';
  }
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

function githubCommitsUrl({ repo, branch, path }) {
  const params = new URLSearchParams({ per_page: "1" });
  if (branch) params.set("sha", branch);
  if (path) params.set("path", path);
  return `https://api.github.com/repos/${repo}/commits?${params.toString()}`;
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

function applyLiveMetrics(key, table) {
  const project = projectData?.projects?.[key];
  if (!project) return;
  const metrics = project.metrics;

  if (key === "sfsc") {
    metrics.tentativeRulings = parseCount(table.get("tentative rulings")) || metrics.tentativeRulings;
    metrics.cases = parseCount(table.get("dockets")) || metrics.cases;
    metrics.documents = parseCount(table.get("case documents")) || metrics.documents;
    metrics.docketEntries = parseCount(table.get("docket entries")) || metrics.docketEntries;
    const bytes = parseBytes(table.get("archive size"));
    if (bytes) metrics.documentBytes = bytes;
  }

  if (key === "tentatives") {
    metrics.tentativeRulings = parseCount(table.get("parsed rulings")) || metrics.tentativeRulings;
    metrics.parsedCounties = parseCount(table.get("parsed counties")) || metrics.parsedCounties;
    metrics.documents = parseCount(table.get("source documents")) || metrics.documents;
    metrics.archivedFiles = parseCount(table.get("archived files")) || metrics.archivedFiles;
    const bytes = parseBytes(table.get("archive size"));
    if (bytes) metrics.documentBytes = bytes;
    metrics.coverage = table.get("hearing-date coverage") || metrics.coverage;
  }

  if (key === "cividx") {
    metrics.jurisdictions = parseCount(table.get("jurisdictions")) || metrics.jurisdictions;
    metrics.citations = parseCount(table.get("citations")) || metrics.citations;
    metrics.documents = parseCount(table.get("documents")) || metrics.documents;
  }

  if (key === "ndcs" || key === "nysc") {
    metrics.cases = parseCount(table.get("cases")) || metrics.cases;
    metrics.documents = parseCount(table.get("documents")) || metrics.documents;
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
  setText('[data-live="sfsc-mb"]', formatMegabytes(projects.sfsc.metrics.documentBytes));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="tentatives-docs"]', formatNumber(projects.tentatives.metrics.documents));
  setText('[data-live="tentatives-mb"]', formatMegabytes(projects.tentatives.metrics.documentBytes));
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

  let updatedAt = projectData?.projects?.[key]?.updatedAt || null;
  let ref = projectData?.projects?.[key]?.ref || "";
  try {
    const commitResponse = await fetch(githubCommitsUrl(config), { cache: "no-store" });
    if (commitResponse.ok) {
      const commits = await commitResponse.json();
      const commit = Array.isArray(commits) ? commits[0] : null;
      updatedAt = commit?.commit?.committer?.date || commit?.commit?.author?.date || updatedAt;
      ref = commit?.sha || ref;
    } else {
      console.warn(`${key} commit metadata unavailable: ${commitResponse.status}`);
    }
  } catch (error) {
    console.warn(`${key} commit metadata unavailable`, error);
  }

  projectData.projects[key].ref = ref;
  projectData.projects[key].updatedAt = updatedAt;
  liveStatus.projects[key] = { updatedAt, ref };
  setLiveText(`${key}-ref`, shortHash(ref));
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
  setText('[data-live="sfsc-mb"]', formatMegabytes(projects.sfsc.metrics.documentBytes));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="tentatives-docs"]', formatNumber(projects.tentatives.metrics.documents));
  setText('[data-live="tentatives-mb"]', formatMegabytes(projects.tentatives.metrics.documentBytes));
  setText('[data-live="sfsc-ref"]', shortHash(projects.sfsc.ref));
  setText('[data-live="tentatives-ref"]', shortHash(projects.tentatives.ref));
  setText('[data-live="cividx-ref"]', shortHash(projects.cividx.ref));
  setText('[data-live="ndcs-ref"]', shortHash(projects.ndcs?.ref));
  setText('[data-live="nysc-ref"]', shortHash(projects.nysc?.ref));
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

$('[data-mini-search="tentatives"]')?.addEventListener("input", renderTentativesSearch);

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
