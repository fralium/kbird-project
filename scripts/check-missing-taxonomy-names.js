const fs = require('fs');
const path = require('path');

function extractTranslationKeys(fileContent, exportName) {
  const regex = new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\n\\};`);
  const match = fileContent.match(regex);
  if (!match) return new Set();
  const keys = [...match[1].matchAll(/'([^']+)'\s*:/g)].map((item) => item[1]);
  return new Set(keys);
}

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ''));
}

async function fetchAllBirds(baseUrl) {
  let page = 1;
  let totalPages = 1;
  const birds = [];

  while (page <= totalPages && page <= 500) {
    const response = await fetch(`${baseUrl}/api/birds?page=${page}&limit=100&hasRecordsOnly=true`);
    if (!response.ok) {
      throw new Error(`Bird API request failed: ${response.status}`);
    }

    const payload = await response.json();
    const list = Array.isArray(payload.data) ? payload.data : [];
    birds.push(...list);

    totalPages = Number(payload.pages || 1);
    if (list.length === 0) break;
    page += 1;
  }

  return birds;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const taxonomyFilePath = path.join(rootDir, 'data', 'taxonomyTranslation.js');
  const taxonomyContent = fs.readFileSync(taxonomyFilePath, 'utf8');

  const orderKeys = extractTranslationKeys(taxonomyContent, 'orderTranslation');
  const familyKeys = extractTranslationKeys(taxonomyContent, 'familyTranslation');

  const birds = await fetchAllBirds('http://localhost:13082');

  const missingSpeciesChineseName = birds.filter((bird) => !hasChinese(bird.name));
  const missingOrderTranslations = [...new Set(birds.map((bird) => bird.order).filter(Boolean))]
    .filter((name) => !orderKeys.has(name))
    .sort();
  const missingFamilyTranslations = [...new Set(birds.map((bird) => bird.family).filter(Boolean))]
    .filter((name) => !familyKeys.has(name))
    .sort();

  console.log(`Total birds checked: ${birds.length}`);
  console.log(`Species missing Chinese name: ${missingSpeciesChineseName.length}`);
  console.log(`Orders missing translation: ${missingOrderTranslations.length}`);
  if (missingOrderTranslations.length) {
    console.log(missingOrderTranslations.join('\n'));
  }
  console.log(`Families missing translation: ${missingFamilyTranslations.length}`);
  if (missingFamilyTranslations.length) {
    console.log(missingFamilyTranslations.join('\n'));
  }

  if (missingSpeciesChineseName.length) {
    console.log('\nSample species missing Chinese name (up to 50):');
    missingSpeciesChineseName.slice(0, 50).forEach((bird) => {
      console.log(`${bird._id || ''}\t${bird.name || ''}\t${bird.scientificName || ''}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
