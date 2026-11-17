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

    // Parse JupiterEd Report Card table dynamically
    // Structure: Class | Teacher | [various grade columns like S1MP1, S1MP2, S1, YR, etc.]
    const gradesData = await this.page.evaluate(() => {
      // Find the header row (has class "blue topline", not "topbotline")
      const headerRow = document.querySelector('tr.blue.topline');
      if (!headerRow) {
        return { headers: [], grades: [] };
      }

      const headerCells = headerRow.querySelectorAll('td');
      const headers = [];

      // Extract all header names, accounting for colspan
      for (let i = 0; i < headerCells.length; i++) {
        let headerText = headerCells[i].textContent.trim();
        // Remove nbsp and extra whitespace
        headerText = headerText.replace(/&nbsp;/g, '').trim();

        // Check if this cell has colspan
        const colspan = parseInt(headerCells[i].getAttribute('colspan')) || 1;

        // Add empty strings for colspan > 1 to maintain alignment
        if (colspan > 1) {
          for (let c = 0; c < colspan; c++) {
            headers.push('');
          }
        } else {
          headers.push(headerText);
        }
      }

      // Find all grade rows - use multiple selectors since JupiterEd uses
      // different border classes (topline, botline, topbotline) on different rows
      const allRows = document.querySelectorAll('tr.topline:not(.blue), tr.botline, tr.topbotline');
      const grades = [];

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const cells = row.querySelectorAll('td');

        if (cells.length >= 3) {
          const className = cells[0].textContent.trim();
          const teacher = cells[1].textContent.trim();

          // Skip if empty
          if (className) {
            const gradeRow = {
              className,
              teacher,
              grades: {}
            };

            // Extract all grade columns (starting from column 2)
            for (let j = 2; j < cells.length; j++) {
              let gradeValue = cells[j].textContent.trim().replace(/\s+/g, ' ');
              gradeValue = gradeValue.replace(/&nbsp;/g, '').trim() || '-';

              // Use the header name as the key
              // Header has colspan=2 for first two columns, so headers[j] maps correctly
              const columnName = headers[j] || `Col${j}`;
              gradeRow.grades[columnName] = gradeValue;
            }

            grades.push(gradeRow);
          }
        }
      }

      return { headers: headers.slice(2), grades };
    });

    return gradesData;
  }

  formatTable(gradesData) {
    if (!gradesData || !gradesData.grades || gradesData.grades.length === 0) {
      return 'No grades found';
    }

    const { headers, grades } = gradesData;

    // If we got debug output, show it
    if (grades[0] && grades[0].debug) {
      return 'DEBUG: Could not parse grades automatically. Page content:\n' + grades[0].text;
    }

    // Calculate column widths for Class Name
    const classHeader = 'Class Name';
    const maxClassLength = Math.max(
      classHeader.length,
      ...grades.map(g => g.className.length)
    );

    // Calculate column widths for each grade column
    const gradeColumnWidths = {};
    for (const header of headers) {
      const maxWidth = Math.max(
        header.length,
        ...grades.map(g => (g.grades[header] || '-').length)
      );
      gradeColumnWidths[header] = maxWidth;
    }

    // Build separator
    let separator = '+' + '-'.repeat(maxClassLength + 2) + '+';
    for (const header of headers) {
      separator += '-'.repeat(gradeColumnWidths[header] + 2) + '+';
    }

    // Build header row
    let headerRow = '| ' + classHeader.padEnd(maxClassLength) + ' |';
    for (const header of headers) {
      headerRow += ' ' + header.padEnd(gradeColumnWidths[header]) + ' |';
    }

    // Start building table
    let table = separator + '\n' + headerRow + '\n' + separator + '\n';

    // Add grade rows
    for (const grade of grades) {
      let row = '| ' + grade.className.padEnd(maxClassLength) + ' |';
      for (const header of headers) {
        const gradeValue = grade.grades[header] || '-';
        row += ' ' + gradeValue.padEnd(gradeColumnWidths[header]) + ' |';
      }
      table += row + '\n';
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
