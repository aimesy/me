const DATA_URL = "assets/project-data.json";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));

const shortHash = (hash) => (hash ? hash.slice(0, 7) : "unknown");
const formatLabel = (value) => String(value || "").replaceAll("-", " ");
const compactChartLabel = (value) => formatLabel(value)
  .replace(/^Dept\. /, "")
  .replace("Civil Law and Motion", "Civil L&M")
  .replace("Asbestos Law and Motion", "Asbestos L&M")
  .replace("Real Property Court", "Real Property")
  .replace("Asbestos Discovery", "Asbestos Disc.");

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

function renderBars(selector, rows, { maxItems = 8 } = {}) {
  const svg = $(selector);
  if (!svg) return;
  const data = rows.slice(0, maxItems).filter((row) => Number(row.value) >= 0);
  const width = 500;
  const rowHeight = 23;
  const height = Math.max(58, data.length * rowHeight + 14);
  const left = 128;
  const valueWidth = 102;
  const right = 8;
  const barMax = width - left - valueWidth - right;
  const valueX = left + barMax + 8;
  const max = Math.max(...data.map((row) => Number(row.value)), 1);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = data.map((row, index) => {
    const y = 8 + index * rowHeight;
    const barWidth = Math.max(Number(row.value) ? 2 : 0, Math.round((Number(row.value) / max) * barMax));
    return `
      <g>
        <text x="0" y="${y + 12}" class="bar-label">${escapeHtml(compactChartLabel(row.label))}</text>
        <rect x="${left}" y="${y}" width="${barMax}" height="16" class="bar-track"></rect>
        <rect x="${left}" y="${y}" width="${barWidth}" height="16" class="bar-fill"></rect>
        <text x="${valueX}" y="${y + 12}" class="bar-value">${formatNumber(row.value)}</text>
      </g>
    `;
  }).join("");
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

function renderMiniList(selector, rows, formatter = formatNumber) {
  const container = $(selector);
  if (!container) return;
  container.innerHTML = rows.map((row) => `
    <div class="mini-row">
      <span>${escapeHtml(formatLabel(row.label))}</span>
      <b>${formatter(row.value)}</b>
    </div>
  `).join("");
}

function rowMatches(row, query) {
  if (!query) return true;
  const haystack = [row.caseNumber, row.title, row.meta, row.detail].join(" ").toLowerCase();
  return query.toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
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

  renderBars('[data-chart="sfsc-departments"]', topRows(projects.sfsc.charts.rulingsByDepartment, 6));
  renderBars('[data-chart="tentatives-counties"]', topRows(projects.tentatives.charts.rulingsByCounty, 7));
  renderBars('[data-chart="cividx-sources"]', projects.cividx.charts.sourceMix);
  renderBars('[data-chart="cividx-jurisdictions"]', projects.cividx.charts.jurisdictionTypes || []);

  renderSfscArchiveSearch();
  renderMiniList('[data-mini-list="tentatives"]', topRows(projects.tentatives.charts.rulingsByCounty, 4));
  renderMiniList('[data-mini-list="cividx"]', topRows(projects.cividx.charts.jurisdictionTypes || [], 4));

  setText('[data-live="sfsc-rulings"]', formatNumber(projects.sfsc.metrics.tentativeRulings));
  setText('[data-live="sfsc-cases"]', formatNumber(projects.sfsc.metrics.cases));
  setText('[data-live="sfsc-docs"]', formatNumber(projects.sfsc.metrics.documents));
  setText('[data-live="tentatives-rulings"]', formatNumber(projects.tentatives.metrics.tentativeRulings));
  setText('[data-live="tentatives-counties"]', formatNumber(projects.tentatives.metrics.parsedCounties));
  setText('[data-live="cividx-jurisdictions"]', formatNumber(projects.cividx.metrics.jurisdictions));
  setText('[data-live="cividx-sources"]', formatNumber(projects.cividx.metrics.primarySources + projects.cividx.metrics.secondarySources));
  setText('[data-live="generated"]', new Date(data.generatedAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  }));
  setText('[data-live="sfsc-ref"]', shortHash(projects.sfsc.ref));
  setText('[data-live="tentatives-ref"]', shortHash(projects.tentatives.ref));
  setText('[data-live="cividx-ref"]', shortHash(projects.cividx.ref));

  const summary = $('[data-summary]');
  if (summary) {
    summary.innerHTML = [
      metric("SFSC rulings", formatNumber(projects.sfsc.metrics.tentativeRulings)),
      metric("SFSC cases", formatNumber(projects.sfsc.metrics.cases)),
      metric("Tentatives", formatNumber(projects.tentatives.metrics.tentativeRulings)),
      metric("Cividx jurisdictions", formatNumber(projects.cividx.metrics.jurisdictions)),
    ].join("");
  }
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

loadData()
  .then(render)
  .catch((error) => {
    document.body.dataset.dataState = "error";
    setText('[data-live="generated"]', "data unavailable");
    console.error(error);
  });
