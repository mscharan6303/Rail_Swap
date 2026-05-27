import puppeteer from 'puppeteer';
const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log("Taking Dashboard screenshot...");
    await page.goto('http://localhost:5175/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: 'screenshots/dashboard_v2.png' });

    console.log("Taking Ticket Upload screenshot...");
    await page.goto('http://localhost:5175/create', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: 'screenshots/upload_verification_v2.png' });

    console.log("Taking Swap Details screenshot...");
    await page.goto('http://localhost:5175/requests', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: 'screenshots/swap_details_v2.png' });

    console.log("Taking Live Chat screenshot...");
    await page.goto('http://localhost:5175/chat/1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: 'screenshots/realtime_chat_v2.png' });
  } catch (err) {
    console.error("Error during screenshot:", err);
  } finally {
    console.log("Done taking screenshots.");
    await browser.close();
  }
})();
