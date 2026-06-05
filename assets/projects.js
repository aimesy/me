const DATA_URL = "assets/project-data.json";
const SFSC_BASE_URL = "https://sfsc.amyc.us/";
const SFSC_CASE_INDEX_URL = `${SFSC_BASE_URL}archive/cases-index.ndjson`;
const SFSC_MANIFEST_URL = `${SFSC_BASE_URL}data/manifest.json`;
const DUCKDB_WASM_URL = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.33.1-dev45.0/+esm";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));

const shortHash = (hash) => (hash ? hash.slice(0, 7) : "unknown");
const formatLabel = (value) => String(value || "").replaceAll("-", " ");

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
      metric("cases", formatNumber(metrics.cases)),
      metric("documents", formatNumber(metrics.documents)),
    ].join("");
  }

  if (target === "tentatives") {
    container.innerHTML = [
      metric("rulings", formatNumber(metrics.tentativeRulings)),
      metric("counties", formatNumber(metrics.parsedCounties)),
      metric("sources", formatNumber(metrics.sourcePdfs)),
    ].join("");
  }

  if (target === "cividx") {
    container.innerHTML = [
      metric("jurisdictions", formatNumber(metrics.jurisdictions)),
      metric("primary sources", formatNumber(metrics.primarySources)),
      metric("secondary sources", formatNumber(metrics.secondarySources)),
      metric("source notes", formatNumber(metrics.sourceNotes)),
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

function rowMatches(row, query) {
  if (!query) return true;
  const haystack = [
    row.caseNumber,
    row.title,
    row.meta,
    row.detail,
    row.searchText,
  ].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
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
    const haystack = [row.label, row.value, row.pdfs].join(" ").toLowerCase();
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

async function loadSfscCaseSummary(caseNumber) {
  const key = sfscSafeCaseName(caseNumber);
  const state = sfscData.dockets;
  if (!key) return null;
  if (state.caseCache.has(key)) return state.caseCache.get(key);

  const promise = (async () => {
    const response = await fetch(`${SFSC_BASE_URL}archive/cases/${key}.json`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })()
    .then((record) => ({
      caseTitle: record.case_title || "",
      cause: record.cause_of_action || "",
      detail: record.docket_entries?.find((entry) => entry?.description)?.description
        || record.cause_of_action
        || "",
    }))
    .catch(() => null);

  state.caseCache.set(key, promise);
  return promise;
}

async function hydrateSfscDocketRows(rows) {
  const summaries = await Promise.all(rows.map((row) => loadSfscCaseSummary(row.case_number)));
  return rows.map((row, index) => {
    const summary = summaries[index] || {};
    const meta = [
      row.n_entries != null ? plural(row.n_entries, "docket entry", "docket entries") : "",
      row.n_documents != null ? plural(row.n_documents, "document") : "",
    ].filter(Boolean).join(" / ");
    const captured = row.captured_at ? `captured ${formatDate(row.captured_at)}` : "";

    return {
      caseNumber: row.case_number || "",
      title: summary.caseTitle || row.case_title || row.case_number || "Untitled",
      meta,
      detail: summary.detail || summary.cause || captured,
      href: sfscCaseUrl(row.case_number),
      searchText: [row.case_number, row.case_title, row.n_entries, row.n_documents, row.captured_at].join(" "),
    };
  });
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
      const rows = await loadSfscDockets();
      if (renderId !== sfscSearchRenderId) return;
      const filtered = rows.filter((row) => rowMatches({
        caseNumber: row.case_number,
        title: row.case_title,
        meta: [row.n_entries, row.n_documents].join(" "),
        detail: row.captured_at,
      }, query)).slice(0, 5);
      const displayRows = await hydrateSfscDocketRows(filtered);
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

function render(data) {
  projectData = data;
  const { projects } = data;
  renderMetrics("sfsc", projects.sfsc.metrics);
  renderMetrics("tentatives", projects.tentatives.metrics);
  renderMetrics("cividx", projects.cividx.metrics);

  renderSfscArchiveSearch();
  renderTentativesSearch();

  setText('[data-live="sfsc-rulings"]', formatNumber(projects.sfsc.metrics.tentativeRulings));
  setText('[data-live="sfsc-cases"]', formatNumber(projects.sfsc.metrics.cases));
  setText('[data-live="sfsc-docs"]', formatNumber(projects.sfsc.metrics.documents));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="generated"]', new Date(data.generatedAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  }));
  setText('[data-live="sfsc-ref"]', shortHash(projects.sfsc.ref));
  setText('[data-live="tentatives-ref"]', shortHash(projects.tentatives.ref));
  setText('[data-live="cividx-ref"]', shortHash(projects.cividx.ref));
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
