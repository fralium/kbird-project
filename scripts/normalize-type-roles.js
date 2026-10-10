/**
 * One-shot: map common hardcoded page/section title sizes to type-role tokens.
 * Run: node scripts/normalize-type-roles.js
 */
const fs = require('fs');
const path = require('path');

const stylesDir = path.join(__dirname, '..', 'styles');
const files = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css'));

function replaceInBlock(css, selectorRe, sizeFrom, sizeTo) {
  const re = new RegExp(
    `(${selectorRe}\\s*\\{[\\s\\S]*?font-size:\\s*)${sizeFrom}(\\s*;)`,
    'g'
  );
  return css.replace(re, `$1${sizeTo}$2`);
}

let touched = 0;

for (const file of files) {
  const full = path.join(stylesDir, file);
  let css = fs.readFileSync(full, 'utf8');
  const before = css;

  // Page H1 / intro titles
  const titleSelectors = [
    '\\.title',
    '\\.header\\s+h1',
    '\\.registerForm\\s+h1',
    '\\.recordTitle',
    '\\.locationName',
    '\\.pageTitle',
  ];
  for (const sel of titleSelectors) {
    for (const from of ['2\\.5rem', '2\\.2rem', '2rem', '1\\.8rem', '1\\.7rem']) {
      css = replaceInBlock(css, sel, from, 'var(--page-title-size)');
    }
  }

  // Mobile overrides that shrink titles too aggressively (inside @media keep xl via token)
  css = replaceInBlock(css, '\\.header\\s+h1', '1\\.6rem', 'var(--type-scale-xl)');
  css = replaceInBlock(css, '\\.header\\s+h1', '1\\.5rem', 'var(--type-scale-xl)');
  css = replaceInBlock(css, '\\.title', '1\\.8rem', 'var(--type-scale-xl)');

  // Section titles
  const sectionSelectors = ['\\.sectionTitle', '\\.editFormHeader\\s+h2', '\\.calendarTitle'];
  for (const sel of sectionSelectors) {
    for (const from of ['1\\.5rem', '1\\.35rem', '1\\.3rem', '24px', '1\\.2rem']) {
      css = replaceInBlock(css, sel, from, 'var(--type-section)');
    }
  }

  css = replaceInBlock(css, '\\.formSection\\s+h3', '18px', 'var(--type-subsection)');
  css = replaceInBlock(css, '\\.formSection\\s+h3', '1\\.1rem', 'var(--type-subsection)');

  // Page lede / subtitle under headers
  const ledeSelectors = [
    '\\.subtitle',
    '\\.header\\s+p',
    '\\.description(?!Section)',
    '\\.pageSubtitle',
  ];
  for (const sel of ledeSelectors) {
    css = replaceInBlock(css, sel, '1\\.1rem', 'var(--page-subtitle-size)');
  }

  // Personal checklist oversize page title
  css = replaceInBlock(css, '\\.title', 'var\\(--type-scale-3xl\\)', 'var(--page-title-size)');

  if (css !== before) {
    fs.writeFileSync(full, css);
    touched += 1;
    console.log('updated', file);
  }
}

console.log('done, files touched:', touched);
