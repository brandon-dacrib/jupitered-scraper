# JupiterEd Grade Scraper - Claude Documentation

## Project Overview

This is a Node.js web scraper built with Puppeteer that automates the process of logging into the JupiterEd parent portal and extracting student grades. It was developed to provide a convenient command-line interface for checking student grades without manually logging into the web portal.

## Architecture

### Technology Stack
- **Node.js** - JavaScript runtime
- **Puppeteer** - Headless browser automation for navigating JavaScript-heavy pages
- **dotenv** - Environment variable management for credentials

### Project Structure

```
jupitered-scraper/
├── scraper.js           # Main scraper implementation
├── package.json         # Node.js dependencies and scripts
├── .env                 # Credentials (NOT committed to git)
├── .env.example         # Template for credentials
├── .gitignore          # Git ignore rules (includes .env)
├── README.md           # User-facing documentation
└── claude.md           # Technical documentation
```

## How It Works

### 1. Authentication Flow

JupiterEd uses a complex multi-step authentication process:

1. **Navigate to login page** (`https://login.jupitered.com/`)
2. **Click "Parent" tab** - The page has different login forms for Student/Parent/Staff
3. **Fill in school information**:
   - School name (contenteditable div, not regular input)
   - City name (contenteditable div)
   - Region/State (dropdown menu with values like `us_ny`, `us_ca`)
4. **Fill in credentials**:
   - Student's full name (contenteditable div `#text_studid1`)
   - Parent password (regular input `#text_password1`)
5. **Submit form** - Click login button `#loginbtn`

### 2. Navigation to Report Card

After successful login, the scraper:
1. Uses JavaScript `go('reportcard')` function to navigate (not a regular link click)
2. Waits for the Report Card page to load (4 second delay)

### 3. Grade Extraction

The Report Card page structure:
```html
<tr class="topbotline">
  <td>Class Name</td>
  <td>Teacher Name</td>
  <td>S1MP1 (current marking period)</td>
  <td>S1 (Semester 1)</td>
  <td>YR (Year)</td>
</tr>
```

The scraper:
1. Finds all rows with class `topbotline`
2. Extracts the class name, S1 grade, and YR grade
3. Returns structured data: `{ className, s1, yr, teacher }`

### 4. Output Formatting

The grades are formatted into an ASCII table:
```
+-------------+----+----+
| Class Name  | S1 | YR |
+-------------+----+----+
| Math 6      | 86 | 86 |
| Science 6   | 92 | 92 |
+-------------+----+----+
```

## Key Implementation Details

### Why Puppeteer?

JupiterEd uses:
- Custom JavaScript form handling (not standard form submission)
- Contenteditable divs instead of input fields
- Dynamic content loading
- JavaScript-based navigation

This makes simple HTTP requests insufficient - a full browser environment is needed.

### Contenteditable Divs

JupiterEd uses `contenteditable` divs for text input, which require:
```javascript
await this.page.click('#text_studid1');
await this.page.type('#text_studid1', this.studentName, { delay: 50 });
```

Regular input field selectors won't work.

### JavaScript-based Navigation

The Report Card link uses a custom `go()` function:
```javascript
await this.page.evaluate(() => {
  if (typeof go === 'function') {
    go('reportcard');
  }
});
```

Direct link clicking fails because the element isn't traditionally clickable.

## Configuration

### Environment Variables

Required in `.env` file:
- `JUPITERED_STUDENT_NAME` - Student's full name
- `JUPITERED_PASSWORD` - Parent portal password
- `JUPITERED_SCHOOL` - School name
- `JUPITERED_CITY` - City where school is located
- `JUPITERED_REGION` - State code (e.g., `us_ny` for New York)

### Command Line Arguments

Alternative to environment variables:
```bash
node scraper.js "<student name>" <password> "<school>" "<city>" <region>
```

### Debug Mode

Flags:
- `--debug` - Saves HTML and screenshots at each step
- `--no-headless` - Shows the browser window

Debug outputs:
- `debug-01-initial-page.png` - Login page
- `debug-02-parent-tab.png` - After clicking Parent tab
- `debug-03-credentials-entered.png` - After entering credentials
- `debug-04-after-login.png` - After login
- `debug-05-report-card.png` - Report Card page
- `debug-grades-page.html` - Report Card HTML

## Security Considerations

### Secrets Management

1. **Never commit `.env`** - Contains plaintext credentials
2. **Use `.gitignore`** - Ensures `.env` is excluded from git
3. **Provide `.env.example`** - Template without real credentials

### Credential Handling

- Credentials are passed directly to Puppeteer, never logged
- No credential validation before use (fails at login if incorrect)
- No credential storage beyond the .env file

## Future Enhancements

### Potential Features

1. **Email notifications** - Send grade updates when changes detected
2. **Grade tracking** - Store historical grades and detect changes
3. **Multiple students** - Support multiple children in one run
4. **Semester 2 support** - Add S2 column when available
5. **Assignment details** - Click into each class for detailed grades
6. **Export formats** - JSON, CSV output options

### Known Limitations

1. **Single student only** - Must run separately for multiple children
2. **No grade history** - Only shows current grades
3. **No assignment breakdown** - Only shows overall class grades
4. **Hardcoded delays** - Uses fixed delays instead of smart waiting
5. **English only** - Assumes English language interface

## Troubleshooting

### Common Issues

1. **"Could not locate login form fields"**
   - JupiterEd changed their HTML structure
   - Run with `--debug` and inspect `debug-page.html`
   - Update selectors in `scraper.js`

2. **"Still on login page"**
   - Incorrect credentials
   - Wrong school/city/region
   - Network timeout

3. **Empty grades / "No grade yet"**
   - Grades not posted yet for that class
   - Report Card page structure changed

### Debug Process

1. Run with `--debug --no-headless`
2. Watch the browser to see where it fails
3. Check screenshot files to see page state
4. Inspect HTML files to find correct selectors

## Development Notes

### Code Style

- ES6 modules (`import`/`export`)
- Async/await for all Puppeteer operations
- Class-based architecture (`JupiterEdScraper`)
- Functional helper functions (`delay()`)

### Error Handling

- Try-catch in main `run()` method
- Screenshot on error when debug enabled
- Graceful browser cleanup in `finally` block

### Testing

Manual testing approach:
1. Run scraper with valid credentials
2. Verify output matches web portal
3. Test with `--debug` mode
4. Verify no secrets in git

## Maintenance

### Updating for JupiterEd Changes

If JupiterEd changes their interface:

1. **Run with debug mode** to capture current state
2. **Inspect HTML** to find new selectors
3. **Update selectors** in `scraper.js`:
   - Login form fields
   - Navigation elements
   - Grade table structure
4. **Test thoroughly** before committing

### Dependencies

Keep dependencies updated:
```bash
npm outdated
npm update
```

Note: Puppeteer versions may have breaking changes, test after updates.

## License

ISC License - See package.json
