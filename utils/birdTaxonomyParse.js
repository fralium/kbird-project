import {
  familyTranslation,
  getFamilyChineseName,
  getFamilyLatinName as resolveFamilyLatinName,
  getOrderChineseName,
  getOrderLatinName,
  orderChineseAliases,
  orderTranslation,
} from '../data/taxonomyTranslation.js';

export const EMPTY_TAXONOMY_SELECTION = {
  order: '',
  family: '',
  genus: '',
  species: '',
};

/** Extra Chinese family aliases → Latin (名录异名/旧称) */
const FAMILY_CN_ALIASES = {
  画眉科: 'Timaliidae',
  噪鹛科: 'Leiothrichidae',
};

export function getFamilyLatinName(chineseOrLatin) {
  const resolved = resolveFamilyLatinName(chineseOrLatin);
  if (resolved) return resolved;
  const raw = String(chineseOrLatin || '').trim();
  return FAMILY_CN_ALIASES[raw] || '';
}

function splitTaxonomyParts(text) {
  return String(text || '')
    .replace(/[（(].*?[）)]/g, ' ')
    .split(/[/／|>＞→,，、;；\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveOrderToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return { latin: '', chinese: '' };
  if (orderTranslation[raw]) {
    return { latin: raw, chinese: orderTranslation[raw] };
  }
  if (orderChineseAliases[raw]) {
    const latin = orderChineseAliases[raw];
    return { latin, chinese: orderTranslation[latin] || raw };
  }
  const latin = getOrderLatinName(raw);
  if (latin) {
    return { latin, chinese: orderTranslation[latin] || getOrderChineseName(latin) || raw };
  }
  if (/目$/.test(raw)) {
    return { latin: '', chinese: raw };
  }
  return { latin: '', chinese: '' };
}

function resolveFamilyToken(token) {
  const raw = String(token || '').trim();
  if (!raw) return { latin: '', chinese: '' };
  if (familyTranslation[raw]) {
    return { latin: raw, chinese: familyTranslation[raw] };
  }
  const latin = getFamilyLatinName(raw);
  if (latin) {
    return { latin, chinese: familyTranslation[latin] || raw };
  }
  if (/科$/.test(raw)) {
    return { latin: '', chinese: raw };
  }
  return { latin: '', chinese: '' };
}

/**
 * Parse free-text taxonomy from smart-fill / category strings.
 * Returns Chinese keys for TaxonomySelector + Latin for API save.
 */
export function parseTaxonomyInput(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const orderCn = getOrderChineseName(input.order) || String(input.order || '').trim();
    const familyCn = getFamilyChineseName(input.family) || String(input.family || '').trim();
    const orderLatin = getOrderLatinName(input.order) || getOrderLatinName(orderCn);
    const familyLatin = getFamilyLatinName(input.family) || getFamilyLatinName(familyCn);
    return {
      selection: {
        order: orderCn,
        family: familyCn,
        genus: String(input.genus || '').trim(),
        species: String(input.species || '').trim(),
      },
      order: orderLatin,
      family: familyLatin,
      genus: String(input.genus || '').trim(),
      species: String(input.species || '').trim(),
      category: formatCategoryLabel(orderCn, familyCn, orderLatin, familyLatin),
    };
  }

  const parts = splitTaxonomyParts(input);
  let order = { latin: '', chinese: '' };
  let family = { latin: '', chinese: '' };
  let genus = '';
  let species = '';

  for (const part of parts) {
    const asOrder = resolveOrderToken(part);
    if (asOrder.latin || asOrder.chinese) {
      if (!order.latin && !order.chinese) order = asOrder;
      continue;
    }
    const asFamily = resolveFamilyToken(part);
    if (asFamily.latin || asFamily.chinese) {
      if (!family.latin && !family.chinese) family = asFamily;
      continue;
    }
    if (/属$/.test(part) && !genus) {
      genus = part;
      continue;
    }
    if (!species && (/^[A-Z][a-z]+(\s+[a-z]+)?$/.test(part) || /种$/.test(part))) {
      species = part;
    }
  }

  return {
    selection: {
      order: order.chinese || getOrderChineseName(order.latin) || '',
      family: family.chinese || getFamilyChineseName(family.latin) || '',
      genus,
      species,
    },
    order: order.latin,
    family: family.latin,
    genus,
    species,
    category: formatCategoryLabel(
      order.chinese,
      family.chinese,
      order.latin,
      family.latin
    ),
  };
}

function formatCategoryLabel(orderCn, familyCn, orderLatin, familyLatin) {
  const orderLabel = orderCn || getOrderChineseName(orderLatin) || orderLatin;
  const familyLabel = familyCn || getFamilyChineseName(familyLatin) || familyLatin;
  if (orderLabel && familyLabel) return `${orderLabel} > ${familyLabel}`;
  return orderLabel || familyLabel || '';
}

/** Build TaxonomySelector value from a bird document. */
export function taxonomySelectionFromBird(bird = {}) {
  const parsed = parseTaxonomyInput({
    order: bird.order || '',
    family: bird.family || '',
    genus: bird.genus || '',
    species: bird.species || '',
  });
  if (parsed.selection.order || parsed.selection.family) {
    return parsed.selection;
  }
  // Fallback: category-only records (e.g. smart-fill saved path string)
  return parseTaxonomyInput(bird.category || '').selection;
}

/** Expand form taxonomy into writable API fields (Latin order/family). */
export function taxonomyPayloadForApi(taxonomy) {
  const parsed = parseTaxonomyInput(taxonomy);
  return {
    order: parsed.order || '',
    family: parsed.family || '',
    genus: parsed.genus || '',
    species: parsed.species || '',
    category: parsed.category || '未分类',
  };
}

/**
 * Merge taxonomy onto writable bird fields when order/family missing
 * but category / taxonomy payload is present.
 */
export function buildTaxonomyWritableFields(body = {}) {
  const hasOrder = Boolean(String(body.order || '').trim());
  const hasFamily = Boolean(String(body.family || '').trim());
  if (hasOrder && hasFamily) {
    const parsed = parseTaxonomyInput({
      order: body.order,
      family: body.family,
      genus: body.genus,
      species: body.species,
    });
    return {
      order: parsed.order || String(body.order || '').trim(),
      family: parsed.family || String(body.family || '').trim(),
      genus: parsed.genus || String(body.genus || '').trim(),
      species: parsed.species || String(body.species || '').trim(),
      category:
        parsed.category ||
        (typeof body.category === 'string' && body.category.trim()) ||
        '未分类',
    };
  }

  const source =
    body.taxonomy ??
    (typeof body.category === 'object' ? body.category : null) ??
    body.category ??
    '';
  const parsed = parseTaxonomyInput(source);
  if (!parsed.order && !parsed.family && !parsed.selection.order) {
    return {};
  }
  return {
    order: parsed.order || String(body.order || '').trim(),
    family: parsed.family || String(body.family || '').trim(),
    genus: parsed.genus || String(body.genus || '').trim(),
    species: parsed.species || String(body.species || '').trim(),
    category: parsed.category || (typeof body.category === 'string' ? body.category : '') || '未分类',
  };
}
