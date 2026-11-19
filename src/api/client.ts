import type { APIRequestContext, APIResponse, TestInfo } from "@playwright/test";
import type { ZodType } from "zod";
import {
  apiMessageSchema,
  productsListSchema,
  type ApiMessage,
  type CreateAccountInput,
  type ProductsList,
} from "./schemas.js";

type HttpMethod = "GET" | "POST" | "DELETE";

type ApiCallLog = {
  method: HttpMethod;
  path: string;
  durationMs: number;
  httpStatus: number;
  responseCode?: number;
};

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly bodySnippet: string;

  constructor(status: number, path: string, body: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.bodySnippet = body.slice(0, 300);
  }
}

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly info: TestInfo,
  ) {}

  async getProducts(): Promise<ProductsList> {
    return this.send("GET", "/api/productsList", productsListSchema);
  }

  async createAccount(input: CreateAccountInput): Promise<ApiMessage> {
    return this.send("POST", "/api/createAccount", apiMessageSchema, toForm(input));
  }

  async verifyLogin(email: string, password: string): Promise<ApiMessage> {
    return this.postVerifyLogin({ email, password });
  }

  async postVerifyLogin(form: { email?: string; password?: string }): Promise<ApiMessage> {
    const body: Record<string, string> = {};
    if (form.email !== undefined) {
      body.email = form.email;
    }
    if (form.password !== undefined) {
      body.password = form.password;
    }
    return this.send("POST", "/api/verifyLogin", apiMessageSchema, body);
  }

  async deleteAccount(email: string, password: string): Promise<ApiMessage> {
    return this.send("DELETE", "/api/deleteAccount", apiMessageSchema, { email, password });
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    schema: ZodType<T>,
    form?: Record<string, string>,
  ): Promise<T> {
    const started = performance.now();
    const response = await this.dispatch(method, path, form);
    const httpStatus = response.status();
    const text = await response.text();
    const durationMs = Math.round(performance.now() - started);
    const json = parseJsonBody(text);

    if (json === undefined) {
      await this.attach(method, path, durationMs, httpStatus, undefined);
      throw new ApiError(
        httpStatus,
        path,
        text,
        `Response from ${method} ${path} was not a JSON object`,
      );
    }

    const responseCode = readResponseCode(json);
    await this.attach(method, path, durationMs, httpStatus, responseCode);

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        httpStatus,
        path,
        text,
        `Response from ${method} ${path} failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }

  private async dispatch(
    method: HttpMethod,
    path: string,
    form: Record<string, string> | undefined,
  ): Promise<APIResponse> {
    if (method === "GET") {
      return this.request.get(path);
    }
    if (method === "POST") {
      return form === undefined ? this.request.post(path) : this.request.post(path, { form });
    }
    return form === undefined ? this.request.delete(path) : this.request.delete(path, { form });
  }

  private async attach(
    method: HttpMethod,
    path: string,
    durationMs: number,
    httpStatus: number,
    responseCode: number | undefined,
  ): Promise<void> {
    const log: ApiCallLog = { method, path, durationMs, httpStatus };
    if (responseCode !== undefined) {
      log.responseCode = responseCode;
    }
    await this.info.attach(`api ${method} ${path}`, {
      body: JSON.stringify(log),
      contentType: "application/json",
    });
  }
}

function toForm(input: CreateAccountInput): Record<string, string> {
  return {
    name: input.name,
    email: input.email,
    password: input.password,
    title: input.title,
    birth_date: input.birth_date,
    birth_month: input.birth_month,
    birth_year: input.birth_year,
    firstname: input.firstname,
    lastname: input.lastname,
    company: input.company,
    address1: input.address1,
    address2: input.address2,
    country: input.country,
    zipcode: input.zipcode,
    state: input.state,
    city: input.city,
    mobile_number: input.mobile_number,
  };
}

function parseJsonBody(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function readResponseCode(value: Record<string, unknown>): number | undefined {
  const code = value.responseCode;
  return typeof code === "number" ? code : undefined;
}
