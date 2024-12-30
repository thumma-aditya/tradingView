import { test, expect } from '@playwright/test';
import fs from 'fs';

// const CHECK_INTERVAL = 2000;
const jsonFilePath = './test.json';
const timeLogPath = './time.txt';

const logFilePath = './console.log';

// Override console.log to write to a file
const originalConsoleLog = console.log;
console.log = (message, ...optionalParams) => {
  const formattedMessage = `${message} ${optionalParams.join(' ')}\n`;
  fs.appendFileSync(logFilePath, formattedMessage); // Append logs to the file
  originalConsoleLog(message, ...optionalParams); // Still display in the console
};

async function updateJsonFile(action, price) {
  let data = { action, price };
  try {
    if (fs.existsSync(jsonFilePath)) {
      const existingData = fs.readFileSync(jsonFilePath, 'utf8');
      const parsedData = JSON.parse(existingData);

      if (parsedData.price && action === parsedData.action) {
        price = parsedData.price;
      }
    }
    data = { action, price };
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
    console.log(`Updated ${jsonFilePath} with action: ${action} and price: ${price}`);
  } catch (error) {
    console.error("Error reading or updating JSON file:", error);
  }
}

async function logTimeAndScreenshot(page, action) {
  const time = new Date().toLocaleTimeString();
  const logEntry = `${action} detected at ${time}\n`;
  fs.appendFileSync(timeLogPath, logEntry);
  console.log(logEntry);

  const screenshotName = `./${action}-${time.replace(/:/g, '-')}.png`;
  await page.screenshot({ path: screenshotName });
  console.log(`Screenshot saved: ${screenshotName}`);
}

test('Monitor trading actions and log results', async ({ page }) => {
  // Step 1: Login and navigate to the chart
  test.setTimeout(0);
  await page.goto('https://www.tradingview.com/');
  await page.click("button[aria-label='Open user menu']");
  await page.waitForTimeout(2000);
  await page.getByText('Sign in', { exact: true }).click();



  await page.getByRole('button', { name: 'Email' }).click();
  await page.fill('#id_username', 'abcgmail.com');
  await page.fill('#id_password', '123a');
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(10000);
  console.log(`Home page visible `);

  // Navigate to the chart
  await page.click("span:text('ETHUSD')");
  await page.waitForTimeout(10000);

  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.click("//a[@href='/chart/?symbol=KRAKEN%3AETHUSD']"),
    console.log(`KRAKEN element visible `)
  ]);

  await newPage.waitForLoadState('domcontentloaded');
  console.log("Monitoring started on the new page");
  console.log(`KRAKEN page is  visible `)

  while (true) {
      console.log(`KRAKEN element visible `)
    const sellTextElement = await newPage.$(`text="UT BOT Sell"`);
    const buyTextElement = await newPage.$(`text="UT BOT Buy"`);

    if (sellTextElement) {
      console.log("Detected action: sell");
      try {
        const rawPriceText = await newPage.locator("//span[@class='priceWrapper-qWcO4bp9']").first().textContent();
        if (!rawPriceText) throw new Error("Price text could not be found or is null.");

        const processedPrice = parseFloat(rawPriceText.slice(0, -4).replace(/,/g, '')).toString();
        await updateJsonFile('sell', processedPrice);
      } catch (error) {
        console.error("Error extracting text or updating JSON:", error);
      }
      await logTimeAndScreenshot(newPage, 'sell');
      await newPage.reload();
    } else if (buyTextElement) {
      console.log("Detected action: buy");
      try {
        const rawPriceText = await newPage.locator("//span[@class='priceWrapper-qWcO4bp9']").first().textContent();
        if (!rawPriceText) throw new Error("Price text could not be found or is null.");

        const processedPrice = parseFloat(rawPriceText.slice(0, -4).replace(/,/g, '')).toString();
        await updateJsonFile('buy', processedPrice);
      } catch (error) {
        console.error("Error extracting text or updating JSON:", error);
      }
      await logTimeAndScreenshot(newPage, 'buy');
      await newPage.reload();
    } else {
      console.log("No matching text element found. Checking again...");
    }

    await newPage.waitForTimeout(10000);
  }
});
