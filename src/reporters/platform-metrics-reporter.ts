import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

export type TestStatus = "passed" | "failed" | "flaky" | "skipped" | "timedOut";

export type FailureClass = "assertion" | "timeout_or_network" | "locator_not_found" | "unknown";

export type TestHealthRecord = {
  id: string;
  title: string;
  file: string;
  projectName: string;
  tags: string[];
  owner: string;
  status: TestStatus;
  durationMs: number;
  retries: number;
  failureClass?: FailureClass;
  errorMessage?: string;
};

export type TestHealthTotals = {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  timedOut: number;
};

export type TestHealthReport = {
  generatedAt: string;
  totals: TestHealthTotals;
  durationMs: number;
  tests: TestHealthRecord[];
};

type Attempt = {
  test: TestCase;
  result: TestResult;
};

class PlatformMetricsReporter implements Reporter {
  private rootDir = process.cwd();
  private readonly attempts = new Map<string, Attempt[]>();

  onBegin(config: FullConfig): void {
    const configFile = config.configFile;
    this.rootDir =
      configFile !== undefined && configFile.length > 0
        ? dirname(isAbsolute(configFile) ? configFile : resolve(configFile))
        : process.cwd();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const existing = this.attempts.get(test.id);
    if (existing === undefined) {
      this.attempts.set(test.id, [{ test, result }]);
      return;
    }
    existing.push({ test, result });
  }

  async onEnd(result: FullResult): Promise<void> {
    const tests = [...this.attempts.values()]
      .map((attempts) => summarize(attempts))
      .sort(
        (left, right) =>
          left.file.localeCompare(right.file) || left.title.localeCompare(right.title),
      );
    const report: TestHealthReport = {
      generatedAt: new Date().toISOString(),
      totals: countTotals(tests),
      durationMs: result.duration,
      tests,
    };
    const reportsDir = join(this.rootDir, "reports");
    await mkdir(reportsDir, { recursive: true });
    const shard = process.env.PW_SHARD;
    const sharded = shard !== undefined && shard.length > 0;
    const healthName = sharded ? `test-health-shard-${shard}.json` : "test-health-report.json";
    const summaryName = sharded ? `ci-summary-shard-${shard}.md` : "ci-summary.md";
    await writeFile(join(reportsDir, healthName), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(join(reportsDir, summaryName), renderSummary(report), "utf8");
  }
}

function summarize(attempts: Attempt[]): TestHealthRecord {
  const last = attempts[attempts.length - 1];
  if (last === undefined) {
    throw new Error("Cannot summarize a test with no attempts");
  }
  const earlierFailed = attempts
    .slice(0, -1)
    .some((attempt) => attempt.result.status === "failed" || attempt.result.status === "timedOut");
  const status: TestStatus =
    earlierFailed && last.result.status === "passed"
      ? "flaky"
      : normalizeStatus(last.result.status);
  const record: TestHealthRecord = {
    id: last.test.id,
    title: last.test.title,
    file: last.test.location.file,
    projectName: last.test.parent.project()?.name ?? "unknown",
    tags: last.test.tags,
    owner: readOwner(last.test),
    status,
    durationMs: attempts.reduce((total, attempt) => total + attempt.result.duration, 0),
    retries: attempts.length - 1,
  };
  const lastStatus = last.result.status;
  if (lastStatus === "failed" || lastStatus === "timedOut") {
    record.failureClass = classify(errorText(last.result));
  }
  const errorMessage = latestError(attempts);
  if (errorMessage !== undefined) {
    record.errorMessage = errorMessage;
  }
  return record;
}

function normalizeStatus(status: TestResult["status"]): TestStatus {
  if (status === "interrupted") {
    return "failed";
  }
  return status;
}

function readOwner(test: TestCase): string {
  const annotation = test.annotations.find((item) => item.type === "owner");
  const description = annotation?.description;
  if (description === undefined || description.length === 0) {
    return "unassigned";
  }
  return description;
}

function latestError(attempts: readonly Attempt[]): string | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index];
    if (attempt === undefined) {
      continue;
    }
    const message = errorText(attempt.result).replace(/\s+/g, " ").trim();
    if (message.length > 0) {
      return message.slice(0, 500);
    }
  }
  return undefined;
}

function errorText(result: TestResult): string {
  const chunks: string[] = [];
  for (const error of result.errors) {
    if (error.message !== undefined && error.message.length > 0) {
      chunks.push(error.message);
    } else if (error.value !== undefined && error.value.length > 0) {
      chunks.push(error.value);
    }
  }
  return chunks.join("\n");
}

function classify(message: string): FailureClass {
  if (isLocatorFailure(message)) {
    return "locator_not_found";
  }
  if (/Timeout|net::|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(message)) {
    return "timeout_or_network";
  }
  if (/expect\(|ZodError|ApiError/.test(message)) {
    return "assertion";
  }
  return "unknown";
}

function isLocatorFailure(message: string): boolean {
  if (/locator|selector/i.test(message)) {
    return true;
  }
  return (
    /waiting for/i.test(message) &&
    /locator|selector|getByRole|getByLabel|getByTestId/i.test(message)
  );
}

function countTotals(tests: readonly TestHealthRecord[]): TestHealthTotals {
  const totals: TestHealthTotals = { passed: 0, failed: 0, flaky: 0, skipped: 0, timedOut: 0 };
  for (const test of tests) {
    totals[test.status] += 1;
  }
  return totals;
}

function renderSummary(report: TestHealthReport): string {
  const { totals } = report;
  const flaky = report.tests.filter((test) => test.status === "flaky");
  const failed = report.tests.filter(
    (test) => test.status === "failed" || test.status === "timedOut",
  );
  const lines = [
    "# Test health",
    "",
    `passed: ${totals.passed}, failed: ${totals.failed}, flaky: ${totals.flaky}, skipped: ${totals.skipped}, timedOut: ${totals.timedOut}`,
    "",
    "## Flaky",
    "",
    ...section(
      flaky.map(
        (test) => `- ${test.title} — ${test.owner} — ${test.file} — retries: ${test.retries}`,
      ),
    ),
    "",
    "## Failed",
    "",
    ...section(
      failed.map(
        (test) =>
          `- ${test.title} — ${test.owner} — ${test.failureClass ?? "unknown"} — ${test.errorMessage ?? ""}`,
      ),
    ),
    "",
  ];
  return lines.join("\n");
}

function section(lines: readonly string[]): readonly string[] {
  if (lines.length === 0) {
    return ["_None._"];
  }
  return lines;
}

export default PlatformMetricsReporter;
