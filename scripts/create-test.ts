import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { input, select } from "@inquirer/prompts";
import type { RiskTag, Team } from "../src/config/tags.js";

const layers = ["api", "ui", "hybrid"] as const;
const risks = ["smoke", "critical", "regression"] as const;
const flagNames = ["domain", "layer", "risk", "name"] as const;

type Layer = (typeof layers)[number];
type FlagName = (typeof flagNames)[number];
type Flags = Partial<Record<FlagName, string>>;

type SpecRequest = {
  domain: string;
  layer: Layer;
  risk: RiskTag;
  name: string;
};

async function main(): Promise<void> {
  const request = await resolveRequest(readFlags(process.argv.slice(2)));
  const filePath = specPath(request);
  if (await exists(filePath)) {
    fail(`Refusing to overwrite ${filePath}`);
  }
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, renderSpec(request), "utf8");
  console.log(`Created ${filePath}`);
}

function readFlags(argv: readonly string[]): Flags {
  const flags: Flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (!token.startsWith("--")) {
      fail(`Unexpected argument ${token}`);
    }
    const body = token.slice(2);
    const equalsAt = body.indexOf("=");
    let key: string;
    let value: string | undefined;
    if (equalsAt >= 0) {
      key = body.slice(0, equalsAt);
      value = body.slice(equalsAt + 1);
    } else {
      key = body;
      index += 1;
      value = argv[index];
    }
    if (value === undefined || value.startsWith("--")) {
      fail(`Missing value for --${key}`);
    }
    if (!isFlagName(key)) {
      fail(`Unknown flag --${key}`);
    }
    flags[key] = value;
  }
  return flags;
}

async function resolveRequest(flags: Flags): Promise<SpecRequest> {
  const domain = flags.domain ?? (await promptSlug("Feature domain"));
  const layer = flags.layer ?? (await promptLayer());
  const risk = flags.risk ?? (await promptRisk());
  const name = flags.name ?? (await promptSlug("Test name"));
  return {
    domain: requireSlug(domain, "domain"),
    layer: requireLayer(layer),
    risk: requireRisk(risk),
    name: requireSlug(name, "name"),
  };
}

async function promptLayer(): Promise<Layer> {
  return select<Layer>({
    message: "Test layer",
    choices: layers.map((layer) => ({ name: layer, value: layer })),
  });
}

async function promptRisk(): Promise<RiskTag> {
  return select<RiskTag>({
    message: "Risk tag",
    choices: risks.map((risk) => ({ name: risk, value: risk })),
  });
}

async function promptSlug(message: string): Promise<string> {
  return input({
    message,
    validate: (value) => isSlug(value) || "Use lowercase letters, numbers, and hyphens",
  });
}

function specPath(request: SpecRequest): string {
  if (request.layer === "api") {
    return join("tests", "api", `${request.domain}-${request.name}.api.spec.ts`);
  }
  const suffix = request.layer === "ui" ? "ui" : "hybrid";
  return join("tests", "ui", `${request.domain}-${request.name}.${suffix}.spec.ts`);
}

function renderSpec(request: SpecRequest): string {
  const owner = ownerFor(request.domain);
  const layerTag = request.layer === "api" ? "Tags.api" : "Tags.ui";
  const fixtures =
    request.layer === "api" ? "apiClient" : request.layer === "ui" ? "page" : "testUser, pages";
  const arranged =
    request.layer === "hybrid" ? "void testUser;\n  void pages;" : `void ${fixtures};`;
  const title = request.name.replaceAll("-", " ");
  return `// See docs/CONTRIBUTING_TESTS.md
import { test, expect } from "../../src/fixtures/index.js";
import { Tags, meta } from "../../src/config/tags.js";

test.skip("${title}", {
  tag: [${layerTag}, Tags.${request.risk}],
  ...meta("${owner}"),
}, async ({ ${fixtures} }) => {
  // generated scaffold — replace this assertion and remove skip before review
  // Arrange
  ${arranged}
  // Act
  // Assert
  expect(true).toBe(true);
});
`;
}

function ownerFor(domain: string): Team {
  if (domain === "catalog") {
    return "catalog";
  }
  if (domain === "auth") {
    return "identity";
  }
  if (domain === "checkout") {
    return "checkout";
  }
  return "platform";
}

function requireSlug(value: string, label: string): string {
  if (!isSlug(value)) {
    fail(`Invalid --${label}. Use lowercase letters, numbers, and hyphens.`);
  }
  return value;
}

function requireLayer(value: string): Layer {
  if (!isLayer(value)) {
    fail("Invalid --layer. Expected api, ui, or hybrid.");
  }
  return value;
}

function requireRisk(value: string): RiskTag {
  if (!isRisk(value)) {
    fail("Invalid --risk. Expected smoke, critical, or regression.");
  }
  return value;
}

function isSlug(value: string): boolean {
  return /^[a-z0-9-]+$/u.test(value);
}

function isLayer(value: string): value is Layer {
  return layers.some((layer) => layer === value);
}

function isRisk(value: string): value is RiskTag {
  return risks.some((risk) => risk === value);
}

function isFlagName(value: string): value is FlagName {
  return flagNames.some((flag) => flag === value);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

await main();
