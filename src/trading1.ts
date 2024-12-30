import { chromium } from 'playwright';
import * as fs from 'fs';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Step 1: Login and navigate to the chart
  await page.goto("https://www.tradingview.com/");
  await page.click("button[aria-label='Open user menu']");
  await page.waitForTimeout(2000);

  await page.getByRole('button', { name: 'Email' }).click();
  await page.fill("#id_username", "youremail@gmail.com");
  await page.fill("#id_password", "yourPassword");
  await page.waitForTimeout(10000);

  // Navigate to the chart and wait for a new page (tab) to open
  await page.click("span:text('ETHUSD')");
  await page.waitForTimeout(10000);

  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    //update the right symbol to clcik , here I am clicking etherem with kraken data for example
    page.click("//a[@href='/chart/?symbol=KRAKEN%3AETHUSD']")
  ]);


  const CHECK_INTERVAL = 2000;
  const jsonFilePath = './test.json';
  const timeLogPath = './time.txt';

  await newPage.waitForLoadState('domcontentloaded');
  console.log("Monitoring started on the new page");

  async function updateJsonFile(action: any, price: any) {
    let data = { action, price };
    try {
      // Check if the JSON file exists and read its content
      if (fs.existsSync(jsonFilePath)) {
        const existingData = fs.readFileSync(jsonFilePath, 'utf8');
        const parsedData = JSON.parse(existingData);
        
        // Preserve the existing "price" if it's not being overwritten
        if (parsedData.price && action === parsedData.action) {
          price = parsedData.price;
        }
      }
  
      // Write the updated data to the file
      data = { action, price };
      fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
      console.log(`Updated ${jsonFilePath} with action: ${action} and price: ${price}`);
    } catch (error) {
      console.error("Error reading or updating JSON file:", error);
    }
  }
  
    async function logTimeAndScreenshot(action:any) {
      const time = new Date().toLocaleTimeString();
      const logEntry = `${action} detected at ${time}\n`;
      fs.appendFileSync(timeLogPath, logEntry);
      console.log(logEntry);
  
      const screenshotName = `./${action}-${time.replace(/:/g, '-')}.png`;
      await newPage.screenshot({ path: screenshotName });
      console.log(`Screenshot saved: ${screenshotName}`);
    }
  
    while (true) {
      const sellTextElement = await newPage.$(`text="UT BOT Sell"`);
      const buyTextElement = await newPage.$(`text="UT BOT Buy"`);
  
      if (sellTextElement) {
        console.log("Detected action: sell");
        try {
          // Locate the element and handle multiple matches using .first()
          const rawPriceText = await newPage.locator("//span[@class='priceWrapper-qWcO4bp9']").first().textContent();
          if (!rawPriceText) {
            throw new Error("Price text could not be found or is null.");
          }
          console.log("Extracted price text:", rawPriceText);
          const processedPrice = parseFloat(rawPriceText.slice(0, -4).replace(/,/g, '')).toString();
        
          // Update the JSON file with action and price
          await updateJsonFile("sell", processedPrice);
        } catch (error) {
          console.error("Error extracting text or updating JSON:", error);
        }
        await logTimeAndScreenshot("sell");
        
        
        await page.locator('.closeButton-ZZzgDlel').click();
        await page.reload();
      } else if (buyTextElement) {
        console.log("Detected action: buy");
        try {
          // Locate the element and handle multiple matches using .first()
          const rawPriceText = await newPage.locator("//span[@class='priceWrapper-qWcO4bp9']").first().textContent();
          if (!rawPriceText) {
            throw new Error("Price text could not be found or is null.");
          }
          console.log("Extracted price text:", rawPriceText);
          const processedPrice = parseFloat(rawPriceText.slice(0, -4).replace(/,/g, '')).toString();
        
          // Update the JSON file with action and price
          await updateJsonFile("buy", processedPrice);
        } catch (error) {
          console.error("Error extracting text or updating JSON:", error);
        }
        await logTimeAndScreenshot("buy");
        
        await page.locator('.closeButton-ZZzgDlel').click();
      } else {
        console.log("No matching text element found. Checking again...");
      }
  
      await newPage.waitForTimeout(CHECK_INTERVAL);
    }
  }
  
  run().catch(console.error);
  
