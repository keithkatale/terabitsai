import { Type } from "@google/genai";

export const webScrapeDeclaration = {
  name: "web_scrape",
  description:
    "Fetch a web page URL and return its text content. Use when you need to read a specific page for research, data extraction, or content analysis. More reliable than browser automation for simple page reads.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full URL to fetch (e.g. https://example.com/page)",
      },
    },
    required: ["url"],
  },
};

export const httpRequestDeclaration = {
  name: "http_request",
  description:
    "Make an HTTP request to any REST API endpoint. Use for calling third-party APIs, fetching JSON data, or interacting with web services. Supports GET, POST, PUT, DELETE methods.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: {
        type: Type.STRING,
        description: "The full API endpoint URL",
      },
      method: {
        type: Type.STRING,
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        description: "HTTP method (default GET)",
      },
      headers: {
        type: Type.OBJECT,
        description: "Optional headers object (e.g. { Authorization: 'Bearer ...' })",
      },
      body: {
        type: Type.STRING,
        description: "Request body for POST/PUT/PATCH (JSON string)",
      },
    },
    required: ["url"],
  },
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; TerabitsAI/1.0; +https://terabits.ai)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const WEB_SCRAPE_TIMEOUT = Number(process.env.WEB_SCRAPE_TIMEOUT_MS) || 15_000;
const HTTP_REQUEST_TIMEOUT = Number(process.env.HTTP_REQUEST_TIMEOUT_MS) || 30_000;
const MAX_RESPONSE_LENGTH = 24_000;

export async function executeWebScrape(url: string): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(WEB_SCRAPE_TIMEOUT),
      headers: BROWSER_HEADERS,
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    const truncated =
      text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + "\n...[truncated]"
        : text;

    return { success: true, content: truncated };
  } catch (err) {
    return {
      success: false,
      error: `Scrape failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

export async function executeHttpRequest(
  url: string,
  method = "GET",
  headers?: Record<string, string>,
  body?: string,
): Promise<{
  success: boolean;
  status?: number;
  content?: string;
  error?: string;
}> {
  try {
    const init: RequestInit = {
      method,
      signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT),
      headers: {
        "User-Agent": BROWSER_HEADERS["User-Agent"],
        ...headers,
      },
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      init.body = body;
      if (!headers?.["Content-Type"]) {
        (init.headers as Record<string, string>)["Content-Type"] = "application/json";
      }
    }

    const res = await fetch(url, init);
    const text = await res.text();

    const truncated =
      text.length > MAX_RESPONSE_LENGTH
        ? text.slice(0, MAX_RESPONSE_LENGTH) + "\n...[truncated]"
        : text;

    return {
      success: res.ok,
      status: res.status,
      content: truncated,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `Request failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
