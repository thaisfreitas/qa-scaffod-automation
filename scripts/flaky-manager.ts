import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  FailureClass,
  TestHealthRecord,
  TestHealthReport,
} from "../src/reporters/platform-metrics-reporter.js";

const reportsDir = join(process.cwd(), "reports");
const registryPath = join(reportsDir, "flaky-registry.json");

type FlakyEntry = {
  id: string;
  title: string;
  file: string;
  owner: string;
  lastSeen: string;
  retries: number;
  seenCount: number;
  failureClass?: FailureClass;
  errorMessage?: string;
};

type FlakyRegistry = {
  updatedAt: string;
  entries: FlakyEntry[];
};

const failureClasses = ["assertion", "timeout_or_network", "locator_not_found", "unknown"] as const;
const statuses = ["passed", "failed", "flaky", "skipped", "timedOut"] as const;

async function main(): Promise<void> {
  const reportPaths = await listHealthReports();
  if (reportPaths.length === 0) {
    console.log("No health reports found");
    return;
  }

  const reports: TestHealthReport[] = [];
  for (const reportPath of reportPaths) {
    reports.push(parseHealthReport(await readFile(reportPath, "utf8"), reportPath));
  }

  const registry = (await readRegistry()) ?? { updatedAt: new Date().toISOString(), entries: [] };
  const updatedIds = new Set<string>();
  const seenAt = new Date().toISOString();

  for (const report of reports) {
    for (const test of report.tests) {
      if (test.status !== "flaky") {
        continue;
      }
      upsert(registry, test, seenAt);
      updatedIds.add(test.id);
    }
  }

  registry.updatedAt = seenAt;
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  console.log(
    `Flaky registry: ${registry.entries.length} entries (${updatedIds.size} updated this run)`,
  );
}

async function listHealthReports(): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(reportsDir);
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
  return names
    .filter(
      (name) => name === "test-health-report.json" || /^test-health-shard-.+\.json$/u.test(name),
    )
    .map((name) => join(reportsDir, name))
    .sort((left, right) => left.localeCompare(right));
}

async function readRegistry(): Promise<FlakyRegistry | undefined> {
  try {
    await access(registryPath);
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
  return parseRegistry(await readFile(registryPath, "utf8"));
}

function upsert(registry: FlakyRegistry, test: TestHealthRecord, seenAt: string): void {
  const existing = registry.entries.find((entry) => entry.id === test.id);
  if (existing === undefined) {
    const created: FlakyEntry = {
      id: test.id,
      title: test.title,
      file: test.file,
      owner: test.owner,
      lastSeen: seenAt,
      retries: test.retries,
      seenCount: 1,
    };
    assignDiagnostics(created, test);
    registry.entries.push(created);
    return;
  }
  existing.title = test.title;
  existing.file = test.file;
  existing.owner = test.owner;
  existing.lastSeen = seenAt;
  existing.retries = test.retries;
  existing.seenCount += 1;
  assignDiagnostics(existing, test);
}

function assignDiagnostics(entry: FlakyEntry, test: TestHealthRecord): void {
  if (test.failureClass !== undefined) {
    entry.failureClass = test.failureClass;
  }
  if (test.errorMessage !== undefined) {
    entry.errorMessage = test.errorMessage;
  }
}

function parseHealthReport(text: string, filePath: string): TestHealthReport {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !Array.isArray(value.tests) || !isRecord(value.totals)) {
    throw new Error(`Invalid health report: ${filePath}`);
  }
  const tests: TestHealthRecord[] = [];
  for (const item of value.tests) {
    tests.push(parseTest(item, filePath));
  }
  const durationMs = value.durationMs;
  const generatedAt = value.generatedAt;
  if (typeof durationMs !== "number" || typeof generatedAt !== "string") {
    throw new Error(`Invalid health report: ${filePath}`);
  }
  return {
    generatedAt,
    durationMs,
    totals: parseTotals(value.totals, filePath),
    tests,
  };
}

function parseTest(value: unknown, filePath: string): TestHealthRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid health report test: ${filePath}`);
  }
  const { id, title, file, projectName, owner, status, durationMs, retries, tags } = value;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof file !== "string" ||
    typeof projectName !== "string" ||
    typeof owner !== "string" ||
    typeof status !== "string" ||
    !isStatus(status) ||
    typeof durationMs !== "number" ||
    typeof retries !== "number" ||
    !Array.isArray(tags) ||
    !tags.every((tag) => typeof tag === "string")
  ) {
    throw new Error(`Invalid health report test: ${filePath}`);
  }
  const record: TestHealthRecord = {
    id,
    title,
    file,
    projectName,
    owner,
    status,
    durationMs,
    retries,
    tags,
  };
  if (value.failureClass !== undefined) {
    if (typeof value.failureClass !== "string" || !isFailureClass(value.failureClass)) {
      throw new Error(`Invalid failureClass in ${filePath}`);
    }
    record.failureClass = value.failureClass;
  }
  if (value.errorMessage !== undefined) {
    if (typeof value.errorMessage !== "string") {
      throw new Error(`Invalid errorMessage in ${filePath}`);
    }
    record.errorMessage = value.errorMessage;
  }
  return record;
}

function parseTotals(value: Record<string, unknown>, filePath: string): TestHealthReport["totals"] {
  const passed = value.passed;
  const failed = value.failed;
  const flaky = value.flaky;
  const skipped = value.skipped;
  const timedOut = value.timedOut;
  if (
    typeof passed !== "number" ||
    typeof failed !== "number" ||
    typeof flaky !== "number" ||
    typeof skipped !== "number" ||
    typeof timedOut !== "number"
  ) {
    throw new Error(`Invalid health report totals: ${filePath}`);
  }
  return { passed, failed, flaky, skipped, timedOut };
}

function parseRegistry(text: string): FlakyRegistry {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error("Invalid flaky registry");
  }
  const entries: FlakyEntry[] = [];
  for (const item of value.entries) {
    if (!isRecord(item)) {
      throw new Error("Invalid flaky registry entry");
    }
    const { id, title, file, owner, lastSeen, retries, seenCount } = item;
    if (
      typeof id !== "string" ||
      typeof title !== "string" ||
      typeof file !== "string" ||
      typeof owner !== "string" ||
      typeof lastSeen !== "string" ||
      typeof retries !== "number" ||
      typeof seenCount !== "number"
    ) {
      throw new Error("Invalid flaky registry entry");
    }
    const entry: FlakyEntry = { id, title, file, owner, lastSeen, retries, seenCount };
    if (item.failureClass !== undefined) {
      if (typeof item.failureClass !== "string" || !isFailureClass(item.failureClass)) {
        throw new Error("Invalid flaky registry failureClass");
      }
      entry.failureClass = item.failureClass;
    }
    if (item.errorMessage !== undefined) {
      if (typeof item.errorMessage !== "string") {
        throw new Error("Invalid flaky registry errorMessage");
      }
      entry.errorMessage = item.errorMessage;
    }
    entries.push(entry);
  }
  const updatedAt =
    typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString();
  return { updatedAt, entries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: string): value is TestHealthRecord["status"] {
  return statuses.some((status) => status === value);
}

function isFailureClass(value: string): value is FailureClass {
  return failureClasses.some((failureClass) => failureClass === value);
}

function isNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}

await main();
