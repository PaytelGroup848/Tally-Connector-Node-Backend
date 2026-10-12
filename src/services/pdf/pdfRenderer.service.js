const puppeteer = require("puppeteer");
const ApiError = require("../../utils/ApiError");
const { ERROR_CODES } = require("../../constants/permissions");

// ---- tuning (override via .env) ----
const MAX_CONCURRENT_PAGES = Number(process.env.PDF_MAX_CONCURRENCY || 3);
const MAX_QUEUED_REQUESTS = Number(process.env.PDF_MAX_QUEUE || 30);
const RECYCLE_AFTER_RENDERS = Number(process.env.PDF_RECYCLE_AFTER || 300);

let browserPromise = null;
let rendersSinceLaunch = 0;
let activeRenders = 0;
const waiting = [];

const launchBrowser = () =>
  puppeteer.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
      : {}),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    protocolTimeout: 120000,
  });

// ONE browser is shared by every request; each request only opens/closes a page.
// (Launching a browser per PDF costs 1-3 s and hundreds of MB every single time.)
const getBrowser = () => {
  if (!browserPromise) {
    const launching = launchBrowser();
    browserPromise = launching;

    launching
      .then((browser) => {
        browser.on("disconnected", () => {
          if (browserPromise === launching) browserPromise = null; // relaunch on next request
        });
      })
      .catch(() => {
        if (browserPromise === launching) browserPromise = null;
      });
  }
  return browserPromise;
};

// Chromium slowly accumulates memory, so retire the browser every N renders.
// New requests get a fresh one; the old one closes after in-flight renders finish.
const maybeRecycleBrowser = () => {
  rendersSinceLaunch += 1;
  if (rendersSinceLaunch < RECYCLE_AFTER_RENDERS || !browserPromise) return;

  const old = browserPromise;
  browserPromise = null;
  rendersSinceLaunch = 0;
  old
    .then((browser) => setTimeout(() => browser.close().catch(() => {}), 60000))
    .catch(() => {});
};

// ---- concurrency limiter: protects the server from 50 simultaneous Chromium pages ----
const acquireSlot = () =>
  new Promise((resolve, reject) => {
    if (activeRenders < MAX_CONCURRENT_PAGES) {
      activeRenders += 1;
      resolve();
      return;
    }
    if (waiting.length >= MAX_QUEUED_REQUESTS) {
      reject(
        new ApiError(
          503,
          "PDF service is busy right now, please try again in a few seconds",
          ERROR_CODES.PDF_BUSY,
        ),
      );
      return;
    }
    waiting.push(resolve);
  });

const releaseSlot = () => {
  const next = waiting.shift();
  if (next)
    next(); // hand the slot straight to the next waiter
  else activeRenders -= 1;
};

const openPage = async () => {
  try {
    return await (await getBrowser()).newPage();
  } catch (err) {
    browserPromise = null; // browser died — relaunch once and retry
    return (await getBrowser()).newPage();
  }
};

const renderPdf = async ({ html, footerHtml }) => {
  await acquireSlot(); // may throw 503 — nothing to release in that case

  let page;
  try {
    page = await openPage();

    // The HTML only ever needs data: URIs. Block every other request so nothing
    // injected into the document can reach internal network services (SSRF).
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") req.continue();
      else req.abort();
    });

    await page.setContent(html, { waitUntil: "load", timeout: 30000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footerHtml,
      margin: { top: "10mm", bottom: "18mm", left: "12mm", right: "12mm" },
      timeout: 60000,
    });

    return Buffer.from(pdf);
  } catch (err) {
    console.error("PDF render failed:", err);
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      500,
      "Failed to generate PDF",
      ERROR_CODES.PDF_GENERATION_FAILED,
    );
  } finally {
    if (page) await page.close().catch(() => {});
    releaseSlot();
    maybeRecycleBrowser();
  }
};

// Call from your graceful-shutdown handler (SIGTERM/SIGINT) so Chromium never lingers.
const closePdfBrowser = async () => {
  if (!browserPromise) return;
  const current = browserPromise;
  browserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch (e) {
    // already closed
  }
};

module.exports = { renderPdf, closePdfBrowser };
