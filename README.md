# JupiterEd Grade Scraper

A command-line tool that automates logging into the JupiterEd parent portal and extracts student grades. Built with Node.js and Puppeteer.

## How It Works

This scraper:
1. Logs into JupiterEd as a parent using your credentials
2. Navigates to the Report Card page
3. Extracts grades for all classes
4. Displays them in a clean table format showing Semester 1 (S1) and Year (YR) grades

## Features

- Automated login to JupiterEd parent portal
- Extraction of class names and grades
- Table-formatted output
- Support for environment variables or command-line arguments
- Debug mode with screenshots and HTML dumps

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your credentials (optional):
```bash
cp .env.example .env
```

3. Edit `.env` and add your credentials:
```
JUPITERED_STUDENT_NAME="Student Full Name"
JUPITERED_PASSWORD=your_password_here
JUPITERED_SCHOOL="School Name"
JUPITERED_CITY="City Name"
JUPITERED_REGION=us_ca
```

**Notes:**
- For parent login, use the student's full name as it appears in JupiterEd
- Use quotes around values with spaces (name, school, city)
- Region codes: `us_ca`=California, `us_ny`=New York, `us_tx`=Texas, etc. (see full list below)

## Usage

### Option 1: Using Environment Variables

```bash
npm start
```

### Option 2: Using Command Line Arguments

```bash
node scraper.js "<student name>" <password> "<school>" "<city>" <region>
```

**Example:**
```bash
node scraper.js "John Doe" mypassword "Lincoln High School" "San Francisco" us_ca
```

**Note:** Use quotes around values with spaces

### Debug Mode

To enable debug mode (saves screenshots and HTML for troubleshooting):

```bash
node scraper.js "Student Name" password "School" "City" us_ca --debug
```

To run with the browser visible (non-headless mode):

```bash
node scraper.js "Student Name" password "School" "City" us_ca --no-headless
```

Or use environment variables with debug flags:
```bash
npm start -- --debug --no-headless
```

## Output

The scraper will output a table showing grades for Semester 1 (S1) and Year (YR):

```
+-------------+----+----+
| Class Name  | S1 | YR |
+-------------+----+----+
| Math 6      | 86 | 86 |
| Science 6   | 92 | 92 |
| English 6   | 73 | 73 |
| Spanish 6   | -  | -  |
+-------------+----+----+
```

**Column Definitions:**
- **S1** - Semester 1 grade (will be final after semester ends)
- **YR** - Year grade (average of S1 and S2 after both semesters complete)
- **-** - No grade posted yet

Currently, since only Semester 1 is in progress, S1 and YR show the same values. When Semester 2 begins, S1 will show the final Semester 1 grade, and YR will eventually show the year-end average.

## How It Works Technically

1. **Launch browser** - Puppeteer opens a headless Chrome browser
2. **Navigate to login** - Goes to `https://login.jupitered.com/`
3. **Click Parent tab** - Selects the parent login form
4. **Fill credentials** - Enters school, city, region, student name, and password
5. **Submit form** - Clicks login button
6. **Navigate to Report Card** - Uses JavaScript to navigate to the report card page
7. **Extract grades** - Parses the HTML table to extract class names and grades
8. **Format output** - Displays results in an ASCII table

## Troubleshooting

If the scraper fails to extract grades:

1. Run with `--debug --no-headless` flags to see what's happening:
   ```bash
   npm start -- --debug --no-headless
   ```

2. Check the debug files generated:
   - `debug-01-initial-page.png` - Initial page load
   - `debug-02-parent-tab.png` - Parent tab selected
   - `debug-03-credentials-entered.png` - After entering credentials
   - `debug-04-after-login.png` - After login attempt
   - `debug-05-report-card.png` - Report Card page
   - `debug-grades-page.html` - HTML of the grades page

3. Common issues:
   - **Wrong credentials** - Verify your .env file has correct values
   - **Wrong school/city/region** - Must match exactly as in JupiterEd
   - **Network timeout** - Try running again
   - **JupiterEd changed their interface** - Selectors may need updating in `scraper.js`

## Region Codes

Common US state codes for the `JUPITERED_REGION` field:

- `us_al` - Alabama
- `us_ca` - California
- `us_fl` - Florida
- `us_ga` - Georgia
- `us_il` - Illinois
- `us_ny` - New York
- `us_tx` - Texas
- `us_wa` - Washington

For a complete list, use the format `us_XX` where XX is the two-letter state abbreviation in lowercase.

## Security Notes

- ⚠️ **Never commit your `.env` file** - It contains plaintext credentials
- The `.gitignore` file ensures `.env` is excluded from git
- Consider using a secrets manager for production use
- Credentials are only used for login and are never logged or stored elsewhere

## Contributing

See `claude.md` for technical documentation and architecture details.

## License

ISC

## Disclaimer

This tool is for personal use only. Use responsibly and in accordance with your school's acceptable use policies.
