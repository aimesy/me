import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

function firstExistingRepo(...candidates) {
  return candidates.find((repo) => existsSync(path.join(repo, ".git"))) || candidates[0];
}

const config = {
  sfsc: {
    repo: process.env.SFSC_REPO || firstExistingRepo(
      path.resolve(repoRoot, "..", "..", "projects", "sfsc"),
      path.resolve(repoRoot, "..", "..", "projects", "sfsc-tentatives"),
    ),
    ref: process.env.SFSC_REF || "",
  },
  tentatives: {
    repo: process.env.TENTATIVES_REPO || path.resolve(repoRoot, "..", "..", "projects", "tentatives"),
    ref: process.env.TENTATIVES_REF || "",
  },
  cividx: {
    repo: process.env.CIVIDX_REPO || path.resolve(repoRoot, "..", "..", "projects", "cividx"),
    ref: process.env.CIVIDX_REF || "",
  },
  ndcs: {
    repo: process.env.NDCS_REPO || path.resolve(repoRoot, "..", "..", "projects", "ndcs-data"),
    ref: process.env.NDCS_REF || "",
  },
  nysc: {
    repo: process.env.NYSC_REPO || path.resolve(repoRoot, "..", "..", "projects", "nysc-data"),
    ref: process.env.NYSC_REF || "",
  },
  kcsc: {
    repo: process.env.KCSC_REPO || path.resolve(repoRoot, "..", "..", "projects", "kcsc-data"),
    ref: process.env.KCSC_REF || "",
  },
};

const SEARCH_SAMPLE_LIMIT = 80;

function runGit(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: GIT_MAX_BUFFER,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function repoAvailable(repo) {
  return existsSync(repo) && existsSync(path.join(repo, ".git"));
}

function readRepoFile({ repo, ref }, filePath) {
  if (!repoAvailable(repo)) return "";
  try {
    const fullPath = path.join(repo, filePath);
    if (!ref && existsSync(fullPath)) return readFileSync(fullPath, "utf8");
    return runGit(repo, ["show", `${ref || "HEAD"}:${filePath}`]);
  } catch {
    return "";
  }
}

function listRepoFiles({ repo, ref }, prefix = "", options = {}) {
  if (!repoAvailable(repo)) return [];
  try {
    if (ref || options.tree) {
      return runGit(repo, ["ls-tree", "-r", "--name-only", ref || "HEAD", prefix])
        .split(/\r?\n/)
        .filter(Boolean);
    }
    const root = path.join(repo, prefix);
    if (!existsSync(root)) {
      return runGit(repo, ["ls-tree", "-r", "--name-only", "HEAD", prefix])
        .split(/\r?\n/)
        .filter(Boolean);
    }
    const files = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        if (entry.isFile()) files.push(path.relative(repo, full).replaceAll(path.sep, "/"));
      }
    };
    walk(root);
    return files;
  } catch {
    try {
      return runGit(repo, ["ls-tree", "-r", "--name-only", "HEAD", prefix])
        .split(/\r?\n/)
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}

function repoFileSize({ repo, ref }, filePath) {
  if (!repoAvailable(repo)) return 0;
  try {
    const fullPath = path.join(repo, filePath);
    if (!ref && existsSync(fullPath)) return statSync(fullPath).size;
    return Number(runGit(repo, ["cat-file", "-s", `${ref || "HEAD"}:${filePath}`]).trim()) || 0;
  } catch {
    return 0;
  }
}

function sumRepoFileSizes(repoConfig, files) {
  return files.reduce((sum, file) => sum + repoFileSize(repoConfig, file), 0);
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function repoHead({ repo, ref }) {
  if (!repoAvailable(repo)) return null;
  try {
    return runGit(repo, ["rev-parse", ref || "HEAD"]).trim();
  } catch {
    return null;
  }
}

function repoUpdatedAt({ repo, ref }) {
  if (!repoAvailable(repo)) return null;
  try {
    return runGit(repo, ["show", "-s", "--format=%cI", ref || "HEAD"]).trim();
  } catch {
    return null;
  }
}

function numberText(value) {
  const match = String(value || "").replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseBytes(value) {
  const text = String(value || "").replaceAll(",", "").trim();
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(tb|gb|mb|kb|bytes?|b)?/i);
  if (!match) return 0;
  const number = Number(match[1]);
  const unit = (match[2] || "bytes").toLowerCase();
  if (unit === "tb") return number * 1024 * 1024 * 1024 * 1024;
  if (unit === "gb") return number * 1024 * 1024 * 1024;
  if (unit === "mb") return number * 1024 * 1024;
  if (unit === "kb") return number * 1024;
  return number;
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

function liveCount(table, ...labels) {
  for (const label of labels) {
    const count = numberText(table.get(label));
    if (count) return count;
  }
  return 0;
}

function liveBytes(table, label) {
  return parseBytes(table.get(label));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (ch === "\"") {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === "\"") {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows.shift();
  return rows
    .filter((items) => items.some((item) => item.trim()))
    .map((items) => Object.fromEntries(header.map((name, index) => [name, items[index] ?? ""])));
}

function parseNdjson(text) {
  const rows = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      // Preserve generation if one append-only record is malformed.
    }
  }
  return rows;
}

function caseKeyFromRecord(record) {
  const direct = [
    record.case_number,
    record.caseNumber,
    record.index_number,
    record.index_display,
    record.case_id,
    record.caseId,
  ].filter(Boolean).join("|");
  if (direct) return direct;

  const ref = Array.isArray(record.source_refs) ? record.source_refs[0] : null;
  if (!ref) return "";
  return [
    ref.court,
    ref.year_filed,
    ref.index_number,
    ref.index_display,
  ].filter(Boolean).join("|");
}

function documentArchiveStats(repoConfig) {
  const rows = parseNdjson(readRepoFile(repoConfig, "archive/document-index.ndjson"));
  const cases = new Set();
  let documentBytes = 0;
  for (const row of rows) {
    const key = caseKeyFromRecord(row);
    if (key) cases.add(key);
    documentBytes += Number(row.bytes_len || row.content_length || 0);
  }

  return {
    cases: cases.size,
    documents: rows.length,
    documentBytes,
  };
}

function dataManifestStats(repoConfig) {
  const manifest = parseJson(readRepoFile(repoConfig, "data/manifest.json"));
  const commonManifest = parseJson(readRepoFile(repoConfig, "data/common/manifest.json"));
  const caseDirectoryManifest = parseJson(readRepoFile(repoConfig, "archive/case-directory/manifest.json"));
  const runs = Array.isArray(manifest?.promoted_runs) ? manifest.promoted_runs : [];
  const promotedStats = runs.reduce((stats, run) => ({
    mirroredFiles: stats.mirroredFiles + Number(run.promoted_file_count || 0),
    mirroredBytes: stats.mirroredBytes + Number(run.promoted_bytes || 0),
  }), { mirroredFiles: 0, mirroredBytes: 0 });
  const tables = Object.values(manifest?.tables || {});
  const tableFiles = tables.filter((table) => table?.path).length;
  const tableBytes = tables.reduce((sum, table) => sum + Number(table?.size_bytes || 0), 0);
  const commonTables = commonManifest?.tables || {};
  const commonCaseRows = Number(commonTables?.cases?.rows || commonManifest?.case_count || commonManifest?.cases || 0);
  const commonDocumentRows = Number(commonTables?.documents?.rows || commonManifest?.documents || 0);
  const caseDirectoryCases = Number(caseDirectoryManifest?.cases || 0);
  const caseDirectoryFiles = Number(caseDirectoryManifest?.scan?.result_files || 0);
  const caseDirectoryDocumentFiles = Number(caseDirectoryManifest?.scan?.document_byte_files || 0);
  const caseDirectoryDocumentRows = Number(caseDirectoryManifest?.scan?.document_byte_rows || 0);
  const archiveCases = Number(
    manifest?.archive?.cases
      || manifest?.archive?.cases_index_rows
      || manifest?.normalization?.tables?.cases
      || 0,
  );
  const archiveIndexFiles = manifest?.archive?.cases_index ? 1 : 0;
  const archiveFiles = Number(manifest?.archive?.cases_index_rows || manifest?.archive?.cases || 0) + archiveIndexFiles;
  return {
    cases: archiveCases || commonCaseRows || caseDirectoryCases,
    documents: commonDocumentRows || caseDirectoryDocumentRows,
    mirroredFiles: promotedStats.mirroredFiles || archiveFiles + tableFiles || caseDirectoryFiles + caseDirectoryDocumentFiles,
    mirroredBytes: promotedStats.mirroredBytes || tableBytes,
    snapshots: archiveFiles || caseDirectoryFiles,
  };
}

function publicDataDefault(repo) {
  return {
    repo,
    ref: null,
    updatedAt: null,
    metrics: { cases: 0, documents: 0, mirroredFiles: 0, documentBytes: 0, snapshots: 0 },
    charts: {},
  };
}

function groupCount(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const label = (row[key] || "Unclassified").replaceAll("-", " ");
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function parseSfsc(readme) {
  const departments = [];
  const re = /<summary><strong>([^<]+)<\/strong>\s+\|\s+([\d,]+)\s+rulings/g;
  for (const match of readme.matchAll(re)) {
    departments.push({ label: match[1].replace(/^Department\s+/, "Dept. "), value: numberText(match[2]) });
  }
  const tentativeRulings = departments.reduce((sum, item) => sum + item.value, 0);
  return { departments, tentativeRulings };
}

function summarizeText(value, max = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function sfscViewerUrl(hash = "") {
  return `https://sfsc.amyc.us/${hash}`;
}

function buildDocketSamples(casesIndex, limit = SEARCH_SAMPLE_LIMIT) {
  const rows = [];
  for (const line of casesIndex.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const indexRow = JSON.parse(line);
      const caseNumber = indexRow.case_number;
      if (!caseNumber) continue;
      const caseJson = readRepoFile(config.sfsc, `archive/cases/${caseNumber}.json`);
      if (!caseJson) continue;
      const record = JSON.parse(caseJson);
      const entries = Array.isArray(record.docket_entries) ? record.docket_entries : [];
      const latest = entries
        .filter((entry) => entry && (entry.date_filed || entry.description))
        .sort((a, b) => String(b.date_filed || "").localeCompare(String(a.date_filed || "")))[0];
      rows.push({
        caseNumber,
        title: summarizeText(record.case_title || record.cause_of_action || caseNumber, 74),
        meta: `${entries.length || Number(indexRow.n_entries || 0)} ROA / ${Number(indexRow.n_documents || 0)} docs`,
        detail: summarizeText(latest?.description || record.cause_of_action || "", 112),
        href: sfscViewerUrl(`#/case/${encodeURIComponent(caseNumber)}`),
      });
    } catch {
      // Skip malformed or missing case records; the tracker should still build.
    }
    if (rows.length >= limit) break;
  }
  return rows;
}

function buildRulingSamples(limit = SEARCH_SAMPLE_LIMIT) {
  const rawFiles = listRepoFiles(config.sfsc, "raw")
    .filter((file) => /^raw\/dept\d+\/.+\.json$/.test(file));
  const step = Math.max(1, Math.floor(rawFiles.length / Math.ceil(limit / 2)));
  const sampleFiles = rawFiles.filter((_, index) => index % step === 0);
  const rows = [];
  for (const file of sampleFiles) {
    const text = readRepoFile(config.sfsc, file);
    if (!text) continue;
    try {
      const page = JSON.parse(text);
      const department = page.department ? `Dept. ${page.department}` : "SFSC";
      for (const ruling of (page.rulings || []).slice(0, 2)) {
        const caseNumber = ruling["Case Number"] || "";
        const title = ruling["Case Title"] || caseNumber || "Tentative ruling";
        rows.push({
          caseNumber,
          title: summarizeText(title, 74),
          meta: `${department} / ${summarizeText(ruling["Court Date"] || "", 28)}`,
          detail: summarizeText(ruling["Calendar Matter"] || ruling.Rulings || "", 112),
          href: sfscViewerUrl(caseNumber ? `#case_number=${encodeURIComponent(caseNumber)}` : ""),
        });
        if (rows.length >= limit) return rows;
      }
    } catch {
      // Ignore malformed sample pages and keep looking.
    }
  }
  return rows;
}

function parseTentatives(readme) {
  const counties = [];
  const re = /<summary>([^<]+)\s+-\s+([\d,]+)\s+rulings\s+across\s+([\d,]+)\s+(?:PDFs?|source hashes)<\/summary>/g;
  for (const match of readme.matchAll(re)) {
    counties.push({ label: match[1], value: numberText(match[2]), documents: numberText(match[3]) });
  }
  return {
    counties,
    tentativeRulings: counties.reduce((sum, item) => sum + item.value, 0),
    documents: counties.reduce((sum, item) => sum + item.documents, 0),
  };
}

function sfscCaseIndexStats(casesIndex) {
  const uniqueCases = new Set();
  let docketDocumentRefs = 0;
  let docketEntries = 0;
  for (const line of casesIndex.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.case_number) uniqueCases.add(record.case_number);
      docketDocumentRefs += Number(record.n_documents || 0);
      docketEntries += Number(record.n_entries || 0);
    } catch {
      // Preserve generation even if one append-only index row is malformed.
    }
  }
  return { cases: uniqueCases.size, docketDocumentRefs, docketEntries };
}

function sfscDocumentIndexStats(documentIndex) {
  let documents = 0;
  let documentBytes = 0;
  for (const line of documentIndex.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      documents += 1;
      documentBytes += Number(record.bytes_len || 0);
    } catch {
      // Ignore malformed document-index rows and keep the page building.
    }
  }
  return { documents, documentBytes };
}

function tentativesCaptureStats() {
  const captureFiles = [];
  const archiveRoot = path.join(config.tentatives.repo, "archive");
  if (!config.tentatives.ref && existsSync(archiveRoot)) {
    for (const entry of readdirSync(archiveRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join("archive", entry.name, "captures.ndjson").replaceAll(path.sep, "/");
      if (existsSync(path.join(config.tentatives.repo, candidate))) captureFiles.push(candidate);
    }
  } else {
    captureFiles.push(
      ...listRepoFiles(config.tentatives, "archive", { tree: true })
        .filter((file) => /\/captures\.ndjson$/.test(file)),
    );
  }

  const seen = new Set();
  let documentBytes = 0;
  for (const file of captureFiles) {
    const text = readRepoFile(config.tentatives, file);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        const key = row.source_sha256 || `${file}:${row.source_url || row.discovered_filename || line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        documentBytes += Number(row.content_length || row.bytes_len || 0);
      } catch {
        // Capture files are append-only; skip malformed rows without losing the build.
      }
    }
  }

  return { documents: seen.size, documentBytes };
}

function buildSfsc() {
  const readme = readRepoFile(config.sfsc, "README.md");
  const liveTable = parseLiveTable(readRepoFile(config.sfsc, "LIVE.md"));
  const parsed = parseSfsc(readme);
  const caseFiles = listRepoFiles(config.sfsc, "archive/cases").filter((file) => file.endsWith(".json")).length;
  const casesIndex = readRepoFile(config.sfsc, "archive/cases-index.ndjson");
  const caseStats = sfscCaseIndexStats(casesIndex);
  const documentIndex = readRepoFile(config.sfsc, "archive/document-index.ndjson");
  const documentStats = sfscDocumentIndexStats(documentIndex);
  const indexedDocuments = documentStats.documents || caseStats.docketDocumentRefs;
  const liveDocumentBytes = liveBytes(liveTable, "archive size");
  return {
    repo: "aimesy/sfsc",
    ref: repoHead(config.sfsc),
    updatedAt: repoUpdatedAt(config.sfsc),
    metrics: {
      tentativeRulings: liveCount(liveTable, "tentative rulings") || parsed.tentativeRulings,
      cases: liveCount(liveTable, "case records", "dockets") || caseStats.cases || caseFiles,
      documents: liveCount(liveTable, "documents indexed", "case documents") || indexedDocuments,
      documentsArchived: liveCount(liveTable, "documents archived") || documentStats.documents,
      docketEntries: liveCount(liveTable, "docket entries") || caseStats.docketEntries,
      documentBytes: liveDocumentBytes || documentStats.documentBytes || repoFileSize(config.sfsc, "data/documents.parquet"),
    },
    charts: {
      rulingsByDepartment: parsed.departments,
    },
    searchSamples: {
      dockets: buildDocketSamples(casesIndex),
      rulings: buildRulingSamples(),
    },
  };
}

function buildTentatives() {
  const readme = readRepoFile(config.tentatives, "README.md");
  const liveTable = parseLiveTable(readRepoFile(config.tentatives, "LIVE.md"));
  const parsed = parseTentatives(readme);
  const captureStats = tentativesCaptureStats();
  const parquetFiles = listRepoFiles(config.tentatives, "data", { tree: true })
    .filter((file) => /\/rulings\.parquet$/.test(file));
  const liveDocumentBytes = liveBytes(liveTable, "archive size");
  return {
    repo: "aimesy/tentatives",
    ref: repoHead(config.tentatives),
    updatedAt: repoUpdatedAt(config.tentatives),
    metrics: {
      tentativeRulings: liveCount(liveTable, "parsed rulings") || parsed.tentativeRulings,
      parsedCounties: liveCount(liveTable, "parsed counties") || parsed.counties.length,
      documents: liveCount(liveTable, "documents indexed", "source documents") || parsed.documents || captureStats.documents,
      archivedFiles: liveCount(liveTable, "archived files"),
      documentBytes: liveDocumentBytes || captureStats.documentBytes || sumRepoFileSizes(config.tentatives, parquetFiles),
    },
    charts: {
      rulingsByCounty: parsed.counties,
    },
  };
}

function countCividxCitationsFromManifests() {
  const citations = new Set();
  const manifestFiles = listRepoFiles(config.cividx, "data/parquet/manifests", { tree: true })
    .filter((file) => file.endsWith(".csv"));
  for (const file of manifestFiles) {
    for (const row of parseCsv(readRepoFile(config.cividx, file))) {
      const citation = String(row.citation || "").trim();
      if (citation) citations.add(citation);
    }
  }
  return citations.size;
}

function buildCividx(previous) {
  if (!repoAvailable(config.cividx.repo)) {
    return previous?.projects?.cividx || {
      repo: "aimesy/cividx",
      ref: null,
      updatedAt: null,
      metrics: { jurisdictions: 0, citations: 0 },
      charts: { jurisdictionTypes: [] },
    };
  }

  const jurisdictions = parseCsv(readRepoFile(config.cividx, "data/jurisdictions-table.csv"));
  const citationStats = parseJson(readRepoFile(config.cividx, "data/citation-stats.json"));
  const citations = Number(citationStats?.citations || 0) || countCividxCitationsFromManifests();
  return {
    repo: "aimesy/cividx",
    ref: repoHead(config.cividx),
    updatedAt: repoUpdatedAt(config.cividx),
    metrics: {
      jurisdictions: jurisdictions.length,
      citations,
    },
    charts: {
      jurisdictionTypes: groupCount(jurisdictions, "type"),
    },
  };
}

function buildPublicDataProject(previous, key, repoName, repoConfig) {
  if (!repoAvailable(repoConfig.repo)) {
    return previous?.projects?.[key] || publicDataDefault(repoName);
  }

  const documentStats = documentArchiveStats(repoConfig);
  const manifestStats = dataManifestStats(repoConfig);
  const caseIndexRows = parseNdjson(readRepoFile(repoConfig, "archive/cases-index.ndjson"));
  const caseKeys = new Set(caseIndexRows.map(caseKeyFromRecord).filter(Boolean));
  const archiveFiles = listRepoFiles(repoConfig, "archive", { tree: true });
  const snapshotFiles = archiveFiles.filter((file) => /\.(?:json|jsonl|ndjson|csv)$/i.test(file));
  const snapshotBytes = snapshotFiles.length <= 5000 ? sumRepoFileSizes(repoConfig, snapshotFiles) : 0;

  return {
    repo: repoName,
    ref: repoHead(repoConfig),
    updatedAt: repoUpdatedAt(repoConfig),
    metrics: {
      cases: caseKeys.size || manifestStats.cases || documentStats.cases,
      documents: documentStats.documents || manifestStats.documents || 0,
      mirroredFiles: manifestStats.mirroredFiles || documentStats.documents || snapshotFiles.length,
      documentBytes: documentStats.documentBytes || ((snapshotBytes || 0) + (manifestStats.mirroredBytes || 0)) || manifestStats.mirroredBytes,
      snapshots: Math.max(snapshotFiles.length, manifestStats.snapshots || 0),
    },
    charts: {},
  };
}

const dataPath = path.join(repoRoot, "assets", "project-data.json");
let previous = null;
if (existsSync(dataPath)) {
  try {
    previous = JSON.parse(readFileSync(dataPath, "utf8"));
  } catch {
    previous = null;
  }
}

const projects = {
  sfsc: buildSfsc(),
  tentatives: buildTentatives(),
  ndcs: buildPublicDataProject(previous, "ndcs", "aimesy/ndcs-data", config.ndcs),
  nysc: buildPublicDataProject(previous, "nysc", "aimesy/nysc-data", config.nysc),
  kcsc: buildPublicDataProject(previous, "kcsc", "aimesy/kcsc", config.kcsc),
  cividx: buildCividx(previous),
};
const projectDates = Object.values(projects)
  .map((project) => project.updatedAt)
  .filter(Boolean)
  .map((value) => new Date(value))
  .filter((date) => !Number.isNaN(date.getTime()));

const output = {
  generatedAt: projectDates.length
    ? new Date(Math.max(...projectDates.map((date) => date.getTime()))).toISOString()
    : new Date().toISOString(),
  generator: "scripts/build-project-data.mjs",
  projects,
};

mkdirSync(path.dirname(dataPath), { recursive: true });
writeFileSync(dataPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, dataPath)}`);
