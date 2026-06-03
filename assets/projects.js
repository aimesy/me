const DATA_URL = "assets/project-data.json";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Number(value || 0));
const formatBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

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
      metric("PDFs", formatNumber(metrics.sourcePdfs)),
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

  if (target === "ocilentra") {
    container.innerHTML = [
      metric("PDF", formatBytes(metrics.pdfBytes)),
      metric("book", "1"),
    ].join("");
  }
}

function renderBars(selector, rows, { maxItems = 8 } = {}) {
  const svg = $(selector);
  if (!svg) return;
  const data = rows.slice(0, maxItems).filter((row) => Number(row.value) >= 0);
  const width = 560;
  const rowHeight = 30;
  const height = Math.max(70, data.length * rowHeight + 20);
  const left = 176;
  const right = 18;
  const barMax = width - left - right;
  const max = Math.max(...data.map((row) => Number(row.value)), 1);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = data.map((row, index) => {
    const y = 14 + index * rowHeight;
    const barWidth = Math.max(2, Math.round((Number(row.value) / max) * barMax));
    return `
      <g>
        <text x="0" y="${y + 13}" class="bar-label">${escapeHtml(formatLabel(row.label))}</text>
        <rect x="${left}" y="${y}" width="${barMax}" height="18" class="bar-track"></rect>
        <rect x="${left}" y="${y}" width="${barWidth}" height="18" class="bar-fill"></rect>
        <text x="${left + barWidth + 6}" y="${y + 13}" class="bar-value">${formatNumber(row.value)}</text>
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
  const { projects } = data;
  renderMetrics("sfsc", projects.sfsc.metrics);
  renderMetrics("tentatives", projects.tentatives.metrics);
  renderMetrics("cividx", projects.cividx.metrics);
  renderMetrics("ocilentra", projects.ocilentra.metrics);

  renderBars('[data-chart="sfsc-departments"]', topRows(projects.sfsc.charts.rulingsByDepartment, 6));
  renderBars('[data-chart="tentatives-counties"]', topRows(projects.tentatives.charts.rulingsByCounty, 7));
  renderBars('[data-chart="cividx-sources"]', projects.cividx.charts.sourceMix);
  renderBars('[data-chart="cividx-jurisdictions"]', projects.cividx.charts.jurisdictionTypes || []);

  renderMiniList('[data-mini-list="sfsc"]', topRows(projects.sfsc.charts.rulingsByDepartment, 4));
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

loadData()
  .then(render)
  .catch((error) => {
    document.body.dataset.dataState = "error";
    setText('[data-live="generated"]', "data unavailable");
    console.error(error);
  });
