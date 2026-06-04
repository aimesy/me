const DATA_URL = "assets/project-data.json";

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
let projectData = null;

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
      return `<a class="mini-row mini-row-link" href="${escapeHtml(hrefFor(row))}">${content}</a>`;
    }

    return `<div class="mini-row">${content}</div>`;
  }).join("");
}

function rowMatches(row, query) {
  if (!query) return true;
  const haystack = [row.caseNumber, row.title, row.meta, row.detail].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
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
    return query.toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
  }), 5);

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

function renderSfscArchiveSearch() {
  const container = $('[data-sfsc-results]');
  const input = $('[data-sfsc-search]');
  if (!container || !projectData) return;

  const samples = projectData.projects.sfsc.searchSamples || {};
  const rows = samples[sfscSearchMode] || [];
  const query = input?.value?.trim() || "";
  const filtered = rows.filter((row) => rowMatches(row, query)).slice(0, 5);
  const label = sfscSearchMode === "dockets" ? "court dockets" : "tentative rulings";

  if (input) input.placeholder = `search ${label}`;

  $$('[data-sfsc-mode]').forEach((button) => {
    const active = button.dataset.sfscMode === sfscSearchMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="mini-empty">No ${label} matched this search.</div>`;
    return;
  }

  container.innerHTML = filtered.map((row) => `
    <div class="mini-result">
      <div class="mini-result-main">
        <div class="mini-result-title">${escapeHtml(row.title || row.caseNumber || "Untitled")}</div>
        <div class="mini-result-meta">${escapeHtml([row.caseNumber, row.meta].filter(Boolean).join(" / "))}</div>
        <div class="mini-result-detail">${escapeHtml(row.detail || "")}</div>
      </div>
      <a class="mini-result-link" href="${escapeHtml(row.href || "https://sfsc.amyc.us/")}">View</a>
    </div>
  `).join("");
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

$$('[data-sfsc-mode]').forEach((button) => {
  button.addEventListener("click", () => {
    sfscSearchMode = button.dataset.sfscMode || "dockets";
    const input = $('[data-sfsc-search]');
    if (input) input.value = "";
    renderSfscArchiveSearch();
  });
});

$('[data-sfsc-search]')?.addEventListener("input", renderSfscArchiveSearch);

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
