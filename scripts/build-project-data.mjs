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
  sfscData: {
    repo: process.env.SFSC_DATA_REPO || path.resolve(repoRoot, "..", "..", "projects", "sfsc-data"),
    ref: process.env.SFSC_DATA_REF || "",
  },
  tentatives: {
    repo: process.env.TENTATIVES_REPO || path.resolve(repoRoot, "..", "..", "projects", "tentatives"),
    ref: process.env.TENTATIVES_REF || "",
  },
  themes: {
    repo: process.env.THEMES_REPO || path.resolve(repoRoot, "..", "..", "projects", "themes"),
    ref: process.env.THEMES_REF || "",
  },
  civproidx: {
    repo: process.env.CIVPROIDX_REPO || path.resolve(repoRoot, "..", "..", "projects", "cividx"),
    ref: process.env.CIVPROIDX_REF || "",
  },
  ndcs: {
    repo: process.env.NDCS_REPO || path.resolve(repoRoot, "..", "..", "projects", "ndcs-data"),
    ref: process.env.NDCS_REF || "",
  },
  nysc: {
    repo: process.env.NYSC_REPO || path.resolve(repoRoot, "..", "..", "projects", "nysc-data"),
    ref: process.env.NYSC_REF || "",
    releaseRepo: "aimesy/nysc-data",
    releaseAssetPrefix: "docs-",
  },
  kcsc: {
    repo: process.env.KCSC_REPO || path.resolve(repoRoot, "..", "..", "projects", "kcsc-data"),
    ref: process.env.KCSC_REF || "",
  },
  mfa: {
    repo: process.env.MFA_DATA_REPO || path.resolve(repoRoot, "..", "..", "projects", "mfa-data"),
    ref: process.env.MFA_DATA_REF || "",
  },
  cfhe: {
    repo: process.env.CFHE_DATA_REPO || path.resolve(repoRoot, "..", "..", "projects", "cfhe-data"),
    ref: process.env.CFHE_DATA_REF || "",
  },
};

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
  const indexedDocumentRows = Number(manifest?.features?.documents?.rows || 0);
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
    documents: commonDocumentRows || indexedDocumentRows || caseDirectoryDocumentRows,
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

function mergeReleaseAssetStats(project, stats) {
  if (!project || !stats) return project;
  const metrics = project.metrics || {};
  metrics.mirroredFiles = Math.max(Number(metrics.mirroredFiles || 0), Number(stats.assets || 0));
  metrics.documentBytes = Math.max(Number(metrics.documentBytes || 0), Number(stats.bytes || 0));
  project.metrics = metrics;
  return project;
}

async function githubReleaseAssetStats(repoName, prefix) {
  if (!repoName || !prefix || typeof fetch !== "function") return {};
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "amyc-project-data",
  };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  let assets = 0;
  let bytes = 0;
  for (let page = 1; page <= 10; page += 1) {
    try {
      const url = `https://api.github.com/repos/${repoName}/releases?per_page=100&page=${page}`;
      const response = await fetch(url, { headers });
      if (!response.ok) break;
      const releases = await response.json();
      if (!Array.isArray(releases) || !releases.length) break;
      for (const release of releases) {
        const tag = String(release.tag_name || release.name || "");
        if (!tag.startsWith(prefix)) continue;
        for (const asset of release.assets || []) {
          assets += 1;
          bytes += Number(asset.size || 0);
        }
      }
      if (releases.length < 100) break;
    } catch {
      break;
    }
  }
  return { assets, bytes };
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

// The home page's SFSC panel leads with the newest tentative rulings. They
// come from sfsc-data's raw department captures (one JSON file per posted
// hearing date), read through git so the sparse checkout stays small. The page
// itself never fetches rulings; the viewer owns search and the Parquet files.
const SFSC_FEED_DAYS = 5;
const SFSC_FEED_RULINGS_PER_DAY = 8;
const SFSC_FEED_TEXT_LENGTH = 260;
const SFSC_FEED_CAPTURE = /^raw\/dept(\d{3})(?:\/([a-z-]+))?\/(\d{4}-\d{2}-\d{2})-\d+\.json$/;
// Probate rulings are counted but not quoted: conservatorship calendars
// describe incapacity and deaths, and most entries are procedural.
const SFSC_FEED_COUNT_ONLY = new Set(["204"]);
const SFSC_FEED_DEPARTMENT_ORDER = ["302", "304", "301", "501", "204"];
const SFSC_FEED_OUTCOMES = [
  ["partial", "Granted in part", /\bgranted in part\b|\bgrant(?:ed)? in part\b/],
  ["sustained-no-leave", "Sustained without leave", /\bsustained without leave\b/],
  ["sustained-leave", "Sustained with leave", /\bsustained with(?: \d+ days')? leave\b/],
  ["sustained", "Sustained", /\bsustained\b/],
  ["overruled", "Overruled", /\boverruled\b/],
  ["denied", "Denied", /\bdenied\b|\bdeny\b/],
  ["granted", "Granted", /\bgranted\b|\bgrant\b|\bapproved\b/],
  ["continued", "Continued", /\bcontinued\b/],
  ["off-calendar", "Off calendar", /\boff calendar\b|\bdropped\b|\bvacated\b/],
  ["moot", "Moot", /\bmoot\b/],
  ["hearing", "Hearing", /\bappearance required\b|\bhearing required\b|\bparties (?:are )?to appear\b/],
];
const SFSC_FEED_DECIDED = new Set(["partial", "sustained-no-leave", "sustained-leave", "sustained", "overruled", "denied", "granted"]);

function sfscFeedCalendar(department, kind) {
  if (department === "304") return kind === "discovery" ? "Asbestos Discovery" : "Asbestos Law and Motion";
  return {
    204: "Probate",
    301: "Discovery",
    302: "Civil Law and Motion",
    501: "Real Property Court",
  }[department] || `Dept. ${department}`;
}

const SFSC_FEED_DATED = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[ -]\d{1,2}(?:,\s*|-)\d{4}\b/i;
const SFSC_FEED_EMAILED = /\(?\**\s*(?:the court'?s )?(?:complete )?tentative ruling (?:in its entirety )?(?:has been )?e-?mailed to the parties\.?\s*\**\)?\.?/gi;

function sfscFeedText(ruling, matter) {
  let text = String(ruling || "")
    .replace(/\s+/g, " ")
    .replace(SFSC_FEED_EMAILED, " ")
    .replace(/\(part (?:one|1) of [^)]+\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop the calendar preamble ("Set for Law and Motion ... 2026, Line 1."),
  // a leading line number, and a repeated matter title so the snippet opens
  // on the court's reasoning.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = text;
    text = text.replace(/^\d{1,3}\s*-\s*(?=[A-Z(])/, "").replace(/^\(\s*\)\.?\s*/, "");
    const sentence = text.match(/^(.{0,220}?\.)\s+/)?.[1] || "";
    const preamble = /^line \d+\.$/i.test(sentence)
      || (SFSC_FEED_DATED.test(sentence) && /^(?:set for|matter on|on the)\b|\bcalendar (?:on|for)\b|\bline \d+\.$/i.test(sentence));
    if (preamble) text = text.slice(sentence.length).trim();
    if (text === before) break;
  }
  const cleanMatter = String(matter || "").replace(/\s+/g, " ").trim();
  if (cleanMatter && text.toLowerCase().startsWith(cleanMatter.toLowerCase())) {
    text = text.slice(cleanMatter.length).replace(/^[\s.:;-]+/, "");
  }
  // Many rulings open by echoing the caption ("PLAINTIFF X's MOTION TO
  // DISMISS."); skip that sentence when it decides nothing.
  const opening = text.match(/^(.{0,320}?\.)\s+(?=\S)/)?.[1] || "";
  const letters = opening.replace(/[^A-Za-z]/g, "");
  const shouting = letters.length > 0 && letters.replace(/[^A-Z]/g, "").length / letters.length >= 0.6;
  const coreMatter = cleanMatter.replace(/^notice of (?:unopposed )?motion(?:,| and| &)\s*/i, "").toLowerCase();
  const echoesMatter = coreMatter.length > 0 && opening.slice(0, -1).toLowerCase().endsWith(coreMatter);
  if (opening && (shouting || echoesMatter) && !sfscFeedOutcome(opening)) text = text.slice(opening.length).trim();
  const boilerplate = text.search(/\b(?:For the \d{1,2}:\d{2}|All attorneys and parties may appear|Remote hearings will be conducted|Zoom ID)\b/i);
  if (boilerplate > 40) text = text.slice(0, boilerplate).trim();
  if (text.length <= SFSC_FEED_TEXT_LENGTH) return text;
  const cut = text.slice(0, SFSC_FEED_TEXT_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SFSC_FEED_TEXT_LENGTH - 40)).replace(/[\s,;:.]+$/, "")}…`;
}

function sfscFeedOutcome(text) {
  const haystack = String(text || "").slice(0, 420).toLowerCase();
  let best = null;
  for (const [key, label, pattern] of SFSC_FEED_OUTCOMES) {
    const index = haystack.search(pattern);
    if (index >= 0 && (!best || index < best.index)) best = { key, label, index };
  }
  return best ? { key: best.key, label: best.label } : null;
}

function sfscFeedRank(row) {
  const outcome = row.outcome?.key;
  const outcomeRank = SFSC_FEED_DECIDED.has(outcome) ? 0 : outcome === "hearing" ? 1 : outcome === "off-calendar" ? 3 : 2;
  const departmentRank = SFSC_FEED_DEPARTMENT_ORDER.indexOf(row.department);
  return [outcomeRank, departmentRank < 0 ? 9 : departmentRank, row.time || "", row.caseNumber];
}

function compareSfscFeedRows(a, b) {
  const left = sfscFeedRank(a);
  const right = sfscFeedRank(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function pickSfscFeedRulings(rows, limit) {
  // Round-robin across departments so one busy calendar cannot fill the feed.
  const queues = new Map();
  for (const row of [...rows].sort(compareSfscFeedRows)) {
    if (!queues.has(row.department)) queues.set(row.department, []);
    queues.get(row.department).push(row);
  }
  const ordered = [...queues.values()].sort((a, b) => compareSfscFeedRows(a[0], b[0]));
  const picked = [];
  while (picked.length < limit && ordered.some((queue) => queue.length)) {
    for (const queue of ordered) {
      if (queue.length && picked.length < limit) picked.push(queue.shift());
    }
  }
  return picked;
}

function buildSfscFeed(previousData = null) {
  const captures = listRepoFiles(config.sfscData, "raw/", { tree: true })
    .map((file) => {
      const match = file.match(SFSC_FEED_CAPTURE);
      return match ? { file, department: match[1], kind: match[2] || "", date: match[3] } : null;
    })
    .filter(Boolean);
  const days = [...new Set(captures.map((capture) => capture.date))].sort().reverse().slice(0, SFSC_FEED_DAYS);
  const wanted = new Set(days);
  const calendars = new Map();
  let latestScrapedAt = "";

  for (const capture of captures.filter((item) => wanted.has(item.date))) {
    const page = parseJson(readRepoFile(config.sfscData, capture.file));
    if (!page || !Array.isArray(page.rulings)) continue;
    const scrapedAt = String(page.scraped_at || "");
    if (scrapedAt > latestScrapedAt) latestScrapedAt = scrapedAt;
    const key = `${capture.date}|${capture.department}|${capture.kind}`;
    if (!calendars.has(key)) calendars.set(key, { ...capture, entries: new Map() });
    const calendar = calendars.get(key);
    // A hearing date can be captured more than once; the later capture wins.
    for (const ruling of page.rulings) {
      const caseNumber = String(ruling?.["Case Number"] || "").trim();
      if (!caseNumber) continue;
      const courtDate = String(ruling["Court Date"] || "");
      const matter = String(ruling["Calendar Matter"] || "").replace(/\s+/g, " ").trim();
      const entryKey = `${caseNumber}|${matter}|${courtDate}`;
      const existing = calendar.entries.get(entryKey);
      if (existing && existing.scrapedAt > scrapedAt) continue;
      calendar.entries.set(entryKey, { scrapedAt, ruling, caseNumber, courtDate, matter });
    }
  }

  const dayRows = new Map(days.map((date) => [date, { date, total: 0, departments: new Map(), rulings: [] }]));
  for (const calendar of calendars.values()) {
    const day = dayRows.get(calendar.date);
    for (const entry of calendar.entries.values()) {
      day.total += 1;
      day.departments.set(calendar.department, (day.departments.get(calendar.department) || 0) + 1);
      if (SFSC_FEED_COUNT_ONLY.has(calendar.department)) continue;
      // Long rulings are split across entries; later parts are fragments.
      if (/\(part (?:[2-9]|two|three|four|five) of [^)]+\)/i.test(entry.ruling.Rulings || "")) continue;
      const text = sfscFeedText(entry.ruling.Rulings, entry.matter);
      if (!text) continue;
      const time = (entry.courtDate.match(/\b(\d{1,2}:\d{2}\s*[AP]M)\b/i) || [])[1] || "";
      day.rulings.push({
        date: calendar.date,
        time: time.toUpperCase(),
        department: calendar.department,
        calendar: sfscFeedCalendar(calendar.department, calendar.kind),
        caseNumber: entry.caseNumber,
        caseTitle: String(entry.ruling["Case Title"] || "").replace(/\s+/g, " ").trim(),
        matter: entry.matter,
        judge: String(entry.ruling.Judge || "").trim(),
        outcome: sfscFeedOutcome(text),
        text,
      });
    }
  }

  const feedDays = [...dayRows.values()].filter((day) => day.total > 0);
  if (!feedDays.length) return previousData?.projects?.sfsc?.feed || null;
  return {
    source: "aimesy/sfsc-data raw tentative captures",
    latestScrapedAt: latestScrapedAt || null,
    days: feedDays.map((day) => ({
      date: day.date,
      total: day.total,
      departments: [...day.departments.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([department, count]) => ({ department, count })),
    })),
    rulings: feedDays.flatMap((day) => pickSfscFeedRulings(day.rulings, SFSC_FEED_RULINGS_PER_DAY)),
  };
}

function buildSfsc(previousData = null) {
  const readme = readRepoFile(config.sfsc, "README.md");
  // sfsc-data's LIVE.md is rewritten by each daily tentative publication.
  // aimesy/sfsc's committed LIVE.md, then its README, are fallbacks.
  const liveTables = [
    parseLiveTable(readRepoFile(config.sfscData, "LIVE.md")),
    parseLiveTable(readRepoFile(config.sfsc, "LIVE.md")),
  ];
  const live = (...labels) => liveTables.reduce((found, table) => found || liveCount(table, ...labels), 0);
  const parsed = parseSfsc(readme);
  const caseTableStats = parseJson(readRepoFile(config.sfscData, "data/case-table-stats.json"));
  const caseDirectoryManifest = parseJson(readRepoFile(config.sfscData, "archive/case-directory/manifest.json"));
  const sourceCounts = caseDirectoryManifest?.source_counts || {};
  const sourceRows = Math.max(
    Number(sourceCounts.case_json_rows || 0),
    Number(sourceCounts.case_table_rows || 0),
    Number(sourceCounts.case_index_rows || 0),
  );
  const liveDocumentBytes = liveTables.reduce((found, table) => found || liveBytes(table, "archive size"), 0);
  const latestRuling = liveTables.map((table) => table.get("latest tentative ruling")).find(Boolean) || null;
  return {
    repo: "aimesy/sfsc",
    ref: repoHead(config.sfsc),
    updatedAt: repoUpdatedAt(config.sfsc),
    latestRuling,
    metrics: {
      tentativeRulings: live("tentative rulings") || parsed.tentativeRulings,
      cases: Number(caseDirectoryManifest?.case_count || 0)
        || live("case records", "dockets")
        || sourceRows
        || Number(previousData?.projects?.sfsc?.metrics?.cases || 0),
      documents: live("documents indexed", "case documents")
        || Number(caseTableStats?.case_documents || 0),
      documentsArchived: live("documents archived"),
      docketEntries: live("docket entries") || Number(caseTableStats?.docket_entries || 0),
      documentBytes: liveDocumentBytes || repoFileSize(config.sfsc, "data/documents.parquet"),
    },
    charts: {
      rulingsByDepartment: parsed.departments,
      casesByPrefix: (Array.isArray(caseDirectoryManifest?.prefixes) ? caseDirectoryManifest.prefixes : [])
        .map((row) => ({ label: String(row.prefix || ""), value: Number(row.case_count || 0) }))
        .filter((row) => row.label && row.value > 0),
    },
  };
}

function buildTentatives(previousData = null) {
  const readme = readRepoFile(config.tentatives, "README.md");
  const liveTable = parseLiveTable(readRepoFile(config.tentatives, "LIVE.md"));
  const parsed = parseTentatives(readme);
  const previousMetrics = previousData?.projects?.tentatives?.metrics || {};
  const liveDocumentBytes = liveBytes(liveTable, "archive size");
  return {
    repo: "aimesy/tentatives",
    ref: repoHead(config.tentatives),
    updatedAt: repoUpdatedAt(config.tentatives),
    metrics: {
      tentativeRulings: liveCount(liveTable, "parsed rulings")
        || parsed.tentativeRulings
        || Number(previousMetrics.tentativeRulings || 0),
      parsedCounties: liveCount(liveTable, "parsed counties")
        || parsed.counties.length
        || Number(previousMetrics.parsedCounties || 0),
      documents: liveCount(liveTable, "documents indexed", "source documents")
        || parsed.documents
        || Number(previousMetrics.documents || 0),
      archivedFiles: liveCount(liveTable, "archived files")
        || Number(previousMetrics.archivedFiles || 0),
      documentBytes: liveDocumentBytes || Number(previousMetrics.documentBytes || 0),
    },
    charts: {
      rulingsByCounty: parsed.counties,
    },
  };
}

function buildThemes(previous) {
  if (!repoAvailable(config.themes.repo)) {
    return previous?.projects?.themes || {
      repo: "aimesy/themes",
      ref: null,
      updatedAt: null,
      metrics: {},
      charts: {},
    };
  }

  return {
    repo: "aimesy/themes",
    ref: repoHead(config.themes),
    updatedAt: repoUpdatedAt(config.themes),
    metrics: {},
    charts: {},
  };
}

function countCivProIdxCitationsFromManifests() {
  const citations = new Set();
  const manifestFiles = listRepoFiles(config.civproidx, "data/parquet/manifests", { tree: true })
    .filter((file) => file.endsWith(".csv"));
  for (const file of manifestFiles) {
    for (const row of parseCsv(readRepoFile(config.civproidx, file))) {
      const citation = String(row.citation || "").trim();
      if (citation) citations.add(citation);
    }
  }
  return citations.size;
}

function buildCivProIdx(previous) {
  if (!repoAvailable(config.civproidx.repo)) {
    return previous?.projects?.civproidx || previous?.projects?.cividx || {
      repo: "aimesy/civproidx",
      ref: null,
      updatedAt: null,
      metrics: { jurisdictions: 0, citations: 0 },
      charts: { jurisdictionTypes: [] },
    };
  }

  const jurisdictions = parseCsv(readRepoFile(config.civproidx, "data/jurisdictions-table.csv"));
  const citationStats = parseJson(readRepoFile(config.civproidx, "data/citation-stats.json"));
  const citations = Number(citationStats?.citations || 0) || countCivProIdxCitationsFromManifests();
  return {
    repo: "aimesy/civproidx",
    ref: repoHead(config.civproidx),
    updatedAt: repoUpdatedAt(config.civproidx),
    metrics: {
      jurisdictions: jurisdictions.length,
      citations,
    },
    charts: {
      jurisdictionTypes: groupCount(jurisdictions, "type"),
    },
  };
}

function buildPublicDataProject(previous, key, repoName, repoConfig, releaseStats = {}) {
  if (!repoAvailable(repoConfig.repo)) {
    return mergeReleaseAssetStats(previous?.projects?.[key] || publicDataDefault(repoName), releaseStats);
  }

  const documentStats = documentArchiveStats(repoConfig);
  const manifestStats = dataManifestStats(repoConfig);
  const caseIndexRows = parseNdjson(readRepoFile(repoConfig, "archive/cases-index.ndjson"));
  const caseKeys = new Set(caseIndexRows.map(caseKeyFromRecord).filter(Boolean));
  const archiveFiles = listRepoFiles(repoConfig, "archive", { tree: true });
  const snapshotFiles = archiveFiles.filter((file) => /\.(?:json|jsonl|ndjson|csv)$/i.test(file));
  const snapshotBytes = snapshotFiles.length <= 5000 ? sumRepoFileSizes(repoConfig, snapshotFiles) : 0;

  return mergeReleaseAssetStats({
    repo: repoName,
    ref: repoHead(repoConfig),
    updatedAt: repoUpdatedAt(repoConfig),
    metrics: {
      cases: caseKeys.size || manifestStats.cases || documentStats.cases,
      documents: Math.max(documentStats.documents, manifestStats.documents),
      mirroredFiles: manifestStats.mirroredFiles || documentStats.documents || snapshotFiles.length,
      documentBytes: documentStats.documentBytes || ((snapshotBytes || 0) + (manifestStats.mirroredBytes || 0)) || manifestStats.mirroredBytes,
      snapshots: Math.max(snapshotFiles.length, manifestStats.snapshots || 0),
    },
    charts: {},
  }, releaseStats);
}

// Release counts from aimesy/mfa-data's manifest.json, which its release
// pipeline writes with every release.
function buildMfa(previous) {
  const manifest = parseJson(readRepoFile(config.mfa, "manifest.json"));
  if (!manifest) {
    return previous?.projects?.mfa || {
      repo: "aimesy/mfa-data",
      ref: null,
      updatedAt: null,
      metrics: {},
      charts: {},
    };
  }

  return {
    repo: "aimesy/mfa-data",
    ref: repoHead(config.mfa),
    updatedAt: repoUpdatedAt(config.mfa),
    metrics: {
      jurisdictions: Number(manifest.receiving_entities || 0),
      reports: Number(manifest.source_reports || 0),
      feePrograms: Number(manifest.fee_programs || 0),
      figures: Number(manifest.distinct_printed_figures || 0),
    },
    charts: {},
  };
}

// Permit counts from aimesy/cfhe-data's audit summary. projects.js reads the
// same file live from raw.githubusercontent.com (cfheMetrics in both places).
function cfheMetrics(metadata) {
  const units = Number(metadata.selected_units || 0);
  const duplicateUnits = Number(metadata.removed_units || 0);
  return {
    jurisdictions: Number(metadata.jurisdiction_count || 0),
    units: Math.max(units - duplicateUnits, 0),
    duplicateUnits,
    throughYear: Number(metadata.cutoff_year || 0),
  };
}

function buildCfhe(previous) {
  const audit = parseJson(readRepoFile(config.cfhe, "data/processed/audit_summary.json"));
  if (!audit?.metadata) {
    return previous?.projects?.cfhe || {
      repo: "aimesy/cfhe-data",
      ref: null,
      updatedAt: null,
      metrics: {},
      charts: {},
    };
  }

  return {
    repo: "aimesy/cfhe-data",
    ref: repoHead(config.cfhe),
    updatedAt: repoUpdatedAt(config.cfhe),
    metrics: cfheMetrics(audit.metadata),
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

const publicReleaseStats = {
  nysc: await githubReleaseAssetStats(config.nysc.releaseRepo, config.nysc.releaseAssetPrefix),
};

const projects = {
  sfsc: {
    ...buildSfsc(previous),
    feed: buildSfscFeed(previous),
  },
  tentatives: buildTentatives(previous),
  themes: buildThemes(previous),
  kcsc: buildPublicDataProject(previous, "kcsc", "aimesy/kcsc-data", config.kcsc),
  nysc: buildPublicDataProject(previous, "nysc", "aimesy/nysc-data", config.nysc, publicReleaseStats.nysc),
  ndcs: buildPublicDataProject(previous, "ndcs", "aimesy/ndcs-data", config.ndcs),
  civproidx: buildCivProIdx(previous),
  mfa: buildMfa(previous),
  cfhe: buildCfhe(previous),
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
