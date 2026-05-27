import puppeteer from 'puppeteer';

(async () => {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log("Taking Dashboard screenshot...");
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/dashboard.png' });

    console.log("Taking Ticket Upload screenshot...");
    await page.goto('http://localhost:5173/create', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/upload_verification.png' });

    console.log("Taking Swap Details screenshot...");
    await page.goto('http://localhost:5173/requests', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/swap_details.png' });

    console.log("Taking Live Chat screenshot...");
    await page.goto('http://localhost:5173/chat/1', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.screenshot({ path: 'screenshots/realtime_chat.png' });
  } catch (err) {
    console.error("Error during screenshot:", err);
  } finally {
    console.log("Done taking screenshots.");
    await browser.close();
  }
})();
