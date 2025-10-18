import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Helper function to wait/delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class JupiterEdScraper {
  constructor(studentName, password, school, city, region, options = {}) {
    this.studentName = studentName;
    this.password = password;
    this.school = school;
    this.city = city;
    this.region = region;
    this.headless = options.headless !== false; // default to true
    this.debug = options.debug || false;
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();

    // Set viewport to simulate a real browser
    await this.page.setViewport({ width: 1280, height: 800 });

    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    if (this.debug) {
      this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    }
  }

  async login() {
    console.log('Navigating to login page...');
    await this.page.goto('https://login.jupitered.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (this.debug) {
      await this.page.screenshot({ path: 'debug-01-initial-page.png' });
      console.log('Screenshot saved: debug-01-initial-page.png');
    }

    // Wait for the page to load
    await delay(2000);

    // Click on the "Parent" tab
    console.log('Clicking Parent tab...');
    await this.page.click('#tab_parent');
    await delay(1000);

    if (this.debug) {
      await this.page.screenshot({ path: 'debug-02-parent-tab.png' });
      console.log('Screenshot saved: debug-02-parent-tab.png');
    }

    // Fill in school name (contenteditable div)
    console.log('Entering school...');
    await this.page.click('#text_school1');
    await this.page.type('#text_school1', this.school, { delay: 50 });
    await delay(500);

    // Check if we need to fill city and region
    const cityVisible = await this.page.$eval('#showcity', el => !el.classList.contains('hide'));

    if (cityVisible) {
      console.log('Entering city...');
      await this.page.click('#text_city1');
      await this.page.type('#text_city1', this.city, { delay: 50 });
      await delay(500);

      // Select region from dropdown
      console.log('Selecting region...');
      await this.page.click('#region1_closed');
      await delay(300);

      // Find and click the region option
      const regionSelector = `[val="${this.region}"]`;
      await this.page.click(regionSelector);
      await delay(500);
    }

    // Fill in student name (contenteditable div)
    console.log('Entering student name...');
    await this.page.click('#text_studid1');
    await this.page.type('#text_studid1', this.studentName, { delay: 50 });
    await delay(500);

    // Fill in password (regular input field)
    console.log('Entering password...');
    await this.page.click('#text_password1');
    await this.page.type('#text_password1', this.password, { delay: 50 });
    await delay(500);

    if (this.debug) {
      await this.page.screenshot({ path: 'debug-03-credentials-entered.png' });
      console.log('Screenshot saved: debug-03-credentials-entered.png');
    }

    // Click the login button
    console.log('Clicking login button...');
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      this.page.click('#loginbtn')
    ]);

    // Wait for the page to settle
    await delay(3000);

    if (this.debug) {
      await this.page.screenshot({ path: 'debug-04-after-login.png' });
      console.log('Screenshot saved: debug-04-after-login.png');
    }

    console.log('Login attempt completed');
    console.log('Current URL:', this.page.url());

    // Navigate to Report Card page to see all grades
    console.log('Navigating to Report Card...');

    // Use the go() function to navigate to report card
    await this.page.evaluate(() => {
      if (typeof go === 'function') {
        go('reportcard');
      }
    });
    await delay(4000);

    if (this.debug) {
      await this.page.screenshot({ path: 'debug-05-report-card.png' });
      console.log('Screenshot saved: debug-05-report-card.png');
    }

    console.log('Report Card loaded');
  }

  async extractGrades() {
    console.log('Extracting grades...');

    if (this.debug) {
      const html = await this.page.content();
      fs.writeFileSync('debug-grades-page.html', html);
      console.log('Grades page HTML saved to debug-grades-page.html');
    }

    // Parse JupiterEd Report Card table
    // Structure: Class | Teacher | S1MP1 | S1 | YR
    const grades = await this.page.evaluate(() => {
      const results = [];

      // Find all table rows with class "topbotline" (actual grade rows)
      const rows = document.querySelectorAll('tr.topbotline');

      for (const row of rows) {
        const cells = row.querySelectorAll('td');

        // Need at least 5 cells: class, teacher, marking period, semester, year
        if (cells.length >= 5) {
          const className = cells[0].textContent.trim();
          const teacher = cells[1].textContent.trim();

          // Get grades from S1 (Semester 1) and YR (Year) columns
          let gradeS1 = cells[3].textContent.trim().replace(/\s+/g, ' ');
          let gradeYR = cells[4].textContent.trim().replace(/\s+/g, ' ');

          // Clean up grades (remove nbsp and extra spaces)
          gradeS1 = gradeS1.replace(/&nbsp;/g, '').trim() || '-';
          gradeYR = gradeYR.replace(/&nbsp;/g, '').trim() || '-';

          // Skip header rows
          if (className && !className.toLowerCase().includes('colspan')) {
            results.push({
              className,
              s1: gradeS1,
              yr: gradeYR,
              teacher
            });
          }
        }
      }

      return results;
    });

    return grades;
  }

  formatTable(grades) {
    if (!grades || grades.length === 0) {
      return 'No grades found';
    }

    // If we got debug output, show it
    if (grades[0].debug) {
      return 'DEBUG: Could not parse grades automatically. Page content:\n' + grades[0].text;
    }

    // Calculate column widths
    const classHeader = 'Class Name';
    const s1Header = 'S1';
    const yrHeader = 'YR';

    const maxClassLength = Math.max(
      classHeader.length,
      ...grades.map(g => g.className.length)
    );
    const maxS1Length = Math.max(
      s1Header.length,
      ...grades.map(g => g.s1.length)
    );
    const maxYRLength = Math.max(
      yrHeader.length,
      ...grades.map(g => g.yr.length)
    );

    // Build table
    const separator = '+' + '-'.repeat(maxClassLength + 2) + '+' + '-'.repeat(maxS1Length + 2) + '+' + '-'.repeat(maxYRLength + 2) + '+';
    const header = '| ' + classHeader.padEnd(maxClassLength) + ' | ' + s1Header.padEnd(maxS1Length) + ' | ' + yrHeader.padEnd(maxYRLength) + ' |';

    let table = separator + '\n' + header + '\n' + separator + '\n';

    for (const grade of grades) {
      table += '| ' + grade.className.padEnd(maxClassLength) + ' | ' + grade.s1.padEnd(maxS1Length) + ' | ' + grade.yr.padEnd(maxYRLength) + ' |\n';
    }

    table += separator;

    return table;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      await this.login();
      const grades = await this.extractGrades();
      const table = this.formatTable(grades);
      console.log('\n' + table + '\n');
      return grades;
    } catch (error) {
      console.error('Error:', error.message);
      if (this.debug && this.page) {
        await this.page.screenshot({ path: 'debug-error.png' });
        console.log('Error screenshot saved: debug-error.png');
      }
      throw error;
    } finally {
      await this.close();
    }
  }
}

// Main execution
async function main() {
  // Get credentials from environment variables or command line arguments
  const studentName = process.env.JUPITERED_STUDENT_NAME || process.argv[2];
  const password = process.env.JUPITERED_PASSWORD || process.argv[3];
  const school = process.env.JUPITERED_SCHOOL || process.argv[4];
  const city = process.env.JUPITERED_CITY || process.argv[5];
  const region = process.env.JUPITERED_REGION || process.argv[6];

  if (!studentName || !password || !school || !city || !region) {
    console.error('Usage:');
    console.error('  Option 1: Set environment variables in .env file:');
    console.error('    JUPITERED_STUDENT_NAME="Student Full Name"');
    console.error('    JUPITERED_PASSWORD=your_password');
    console.error('    JUPITERED_SCHOOL="School Name"');
    console.error('    JUPITERED_CITY="City Name"');
    console.error('    JUPITERED_REGION=us_xx  (e.g., us_ca for California)');
    console.error('\n  Option 2: node scraper.js "<student name>" <password> "<school>" "<city>" <region>');
    console.error('\nExample: node scraper.js "John Doe" mypassword "Lincoln High School" "San Francisco" us_ca');
    console.error('\nRegion codes: us_ca=California, us_ny=New York, us_tx=Texas, etc.');
    console.error('Note: Use quotes around values with spaces');
    process.exit(1);
  }

  // Enable debug mode with --debug flag
  const debug = process.argv.includes('--debug');
  const headless = !process.argv.includes('--no-headless');

  const scraper = new JupiterEdScraper(studentName, password, school, city, region, { debug, headless });
  await scraper.run();
}

main().catch(console.error);
