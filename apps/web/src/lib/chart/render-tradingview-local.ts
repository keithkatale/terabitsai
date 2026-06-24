import { existsSync } from "fs";
import { type ChartSpec, specToQueryParams } from "./tradingview-spec";

const HEADLESS_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

async function resolveChromiumLaunchOptions(): Promise<{
  executablePath?: string;
  args?: string[];
  channel?: "chrome";
}> {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (envPath) {
    return { executablePath: envPath, args: HEADLESS_ARGS };
  }

  if (process.platform === "darwin") {
    const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (existsSync(macChrome)) {
      return { executablePath: macChrome, args: HEADLESS_ARGS };
    }
    return { channel: "chrome" };
  }

  if (process.platform === "linux") {
    for (const p of ["/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
      if (existsSync(p)) {
        return { executablePath: p, args: HEADLESS_ARGS };
      }
    }
  }

  return { channel: "chrome" };
}

/** Local-only headless render — prefer CHART_RENDER_SERVICE_URL in production */
export async function renderHeadlessLocal(spec: ChartSpec): Promise<Buffer> {
  const baseUrl = getAppBaseUrl();
  const params = specToQueryParams(spec);
  const url = `${baseUrl}/chart-frame?${params.toString()}&capture=1`;

  const playwright = await import("playwright-core");
  const launchOptions = await resolveChromiumLaunchOptions();

  const browser = await playwright.chromium.launch({
    headless: true,
    ...launchOptions,
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await page.waitForFunction(
      () => (window as unknown as { __chartReady?: boolean }).__chartReady === true,
      { timeout: 90_000 },
    );

    await page.waitForTimeout(3000);

    const root = page.locator("#tv-chart-container");
    await root.waitFor({ state: "visible", timeout: 30_000 });
    const screenshot = await root.screenshot({ type: "png", timeout: 60_000 });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}
