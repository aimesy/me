import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const config = {
  sfsc: {
    repo: process.env.SFSC_REPO || path.resolve(repoRoot, "..", "..", "projects", "sfsc-tentatives"),
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
};

function runGit(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function repoAvailable(repo) {
  return existsSync(repo) && existsSync(path.join(repo, ".git"));
}

function readRepoFile({ repo, ref }, filePath) {
  if (!repoAvailable(repo)) return "";
  try {
    if (ref) return runGit(repo, ["show", `${ref}:${filePath}`]);
    const fullPath = path.join(repo, filePath);
    return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
  } catch {
    return "";
  }
}

function listRepoFiles({ repo, ref }, prefix = "") {
  if (!repoAvailable(repo)) return [];
  try {
    if (ref) {
      return runGit(repo, ["ls-tree", "-r", "--name-only", ref, prefix])
        .split(/\r?\n/)
        .filter(Boolean);
    }
    const root = path.join(repo, prefix);
    if (!existsSync(root)) return [];
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
    return [];
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

function numberText(value) {
  return Number(String(value).replaceAll(",", "")) || 0;
}

function countLines(text) {
  if (!text.trim()) return 0;
  return text.trimEnd().split(/\r?\n/).length;
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
  const re = /<summary>([^<]+)\s+-\s+([\d,]+)\s+rulings\s+across\s+([\d,]+)\s+PDFs<\/summary>/g;
  for (const match of readme.matchAll(re)) {
    counties.push({ label: match[1], value: numberText(match[2]), pdfs: numberText(match[3]) });
  }
  return {
    counties,
    tentativeRulings: counties.reduce((sum, item) => sum + item.value, 0),
    pdfs: counties.reduce((sum, item) => sum + item.pdfs, 0),
  };
}

function buildSfsc() {
  const readme = readRepoFile(config.sfsc, "README.md");
  const parsed = parseSfsc(readme);
  const caseFiles = listRepoFiles(config.sfsc, "archive/cases").filter((file) => file.endsWith(".json")).length;
  const casesIndex = readRepoFile(config.sfsc, "archive/cases-index.ndjson");
  const uniqueCases = new Set();
  let documentsFromCases = 0;
  for (const line of casesIndex.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.case_number) uniqueCases.add(record.case_number);
      documentsFromCases += Number(record.n_documents || 0);
    } catch {
      // Preserve generation even if one append-only index row is malformed.
    }
  }
  const documentIndex = readRepoFile(config.sfsc, "archive/document-index.ndjson");
  const indexedDocuments = countLines(documentIndex) || documentsFromCases;
  return {
    repo: "aimesy/sfsc",
    ref: repoHead(config.sfsc),
    updatedAt: new Date().toISOString(),
    metrics: {
      tentativeRulings: parsed.tentativeRulings,
      cases: uniqueCases.size || caseFiles,
      documents: indexedDocuments,
    },
    charts: {
      rulingsByDepartment: parsed.departments,
    },
  };
}

function buildTentatives() {
  const readme = readRepoFile(config.tentatives, "README.md");
  const parsed = parseTentatives(readme);
  return {
    repo: "aimesy/tentatives",
    ref: repoHead(config.tentatives),
    updatedAt: new Date().toISOString(),
    metrics: {
      tentativeRulings: parsed.tentativeRulings,
      parsedCounties: parsed.counties.length,
      sourcePdfs: parsed.pdfs,
    },
    charts: {
      rulingsByCounty: parsed.counties,
    },
  };
}

function buildCividx(previous) {
  if (!repoAvailable(config.cividx.repo)) {
    return previous?.projects?.cividx || {
      repo: "aimesy/cividx",
      ref: null,
      updatedAt: null,
      metrics: { jurisdictions: 0, primarySources: 0, secondarySources: 0, sourceNotes: 0 },
      charts: { sourceMix: [], jurisdictionTypes: [] },
    };
  }

  const jurisdictions = parseCsv(readRepoFile(config.cividx, "data/jurisdictions-table.csv"));
  const primarySources = parseCsv(readRepoFile(config.cividx, "source/ORIGINALS-MANIFEST.csv"));
  const secondarySources = parseCsv(readRepoFile(config.cividx, "data/bibliography/BIBLIOGRAPHY.csv"));
  const sourceNotes = listRepoFiles(config.cividx, "source-notes").filter((file) => file.endsWith(".md")).length;
  const capturedPrimary = primarySources.filter((row) => !row.status || row.status === "captured");
  return {
    repo: "aimesy/cividx",
    ref: repoHead(config.cividx),
    updatedAt: new Date().toISOString(),
    metrics: {
      jurisdictions: jurisdictions.length,
      primarySources: capturedPrimary.length,
      secondarySources: secondarySources.length,
      sourceNotes,
    },
    charts: {
      sourceMix: [
        { label: "Primary", value: capturedPrimary.length },
        { label: "Secondary", value: secondarySources.length },
        { label: "Source notes", value: sourceNotes },
      ],
      jurisdictionTypes: groupCount(jurisdictions, "type"),
      primaryCategories: groupCount(capturedPrimary, "category").slice(0, 8),
    },
  };
}

function buildOcilentra() {
  const pdf = path.join(repoRoot, "assets", "ocilentra.pdf");
  return {
    metrics: {
      pdfBytes: existsSync(pdf) ? statSync(pdf).size : 0,
    },
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

const output = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/build-project-data.mjs",
  projects: {
    sfsc: buildSfsc(),
    tentatives: buildTentatives(),
    cividx: buildCividx(previous),
    ocilentra: buildOcilentra(),
  },
};

mkdirSync(path.dirname(dataPath), { recursive: true });
writeFileSync(dataPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, dataPath)}`);
