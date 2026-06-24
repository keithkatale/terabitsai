import { chromium, type Browser } from "playwright-core";

const VIEWPORT = { width: 1280, height: 800 };
const HEADLESS_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: HEADLESS_ARGS,
      ...(process.env.PUPPETEER_EXECUTABLE_PATH
        ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
        : {}),
    });
  }
  return browserPromise;
}

export async function renderChartPng(frameUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: VIEWPORT });

  try {
    await page.goto(frameUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await page.waitForFunction(
      () => (window as unknown as { __chartReady?: boolean }).__chartReady === true,
      { timeout: 90_000 },
    );

    const err = await page.evaluate(() => (window as unknown as { __chartError?: string }).__chartError);
    if (err) {
      console.warn("[chart-renderer] frame warning:", err);
    }

    await page.waitForTimeout(1500);

    const root = page.locator("#chart-root");
    await root.waitFor({ state: "visible", timeout: 15_000 });

    const png = await root.screenshot({ type: "png", timeout: 60_000 });
    return Buffer.from(png);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
