import { CATEGORIES, SELLABLE_CATEGORIES, CATEGORY_NAMES } from '../constants';

export type CategoryNames = { fr: Record<string, string>; ar: Record<string, string> };

export type ItemCategoryConfig = {
  product: string[];
  rawMaterial: string[];
  consumable: string[];
  sellable: string[];
  categoryNames: CategoryNames;
};

export const RAW_MATERIAL_DEFAULT_CATEGORIES = ['kitchen'];
export const CONSUMABLE_DEFAULT_CATEGORIES = ['maintenance', 'cleaning', 'others'];
export const RAW_MATERIAL_ONLY_CATEGORIES = ['raw_material', 'cooking', 'kitchen'];
export const LEGACY_CONSUMABLE_CATEGORIES = ['maintenance', 'cleaning', 'others'];
export const isConsumableCategory = (category: string) => LEGACY_CONSUMABLE_CATEGORIES.includes(category);

const normalizeCategoryName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const toUnique = (values: string[]) => Array.from(new Set(values));

const sanitizeCategoryList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return toUnique(
    values
      .map((v) => (typeof v === 'string' ? normalizeCategoryName(v) : ''))
      .filter(Boolean)
  );
};

const sanitizeCategoryNames = (value: unknown): CategoryNames => {
  const defaults = { fr: { ...CATEGORY_NAMES.fr }, ar: { ...CATEGORY_NAMES.ar } };
  if (!value || typeof value !== 'object') return defaults;
  const v = value as any;
  return {
    fr: (v.fr && typeof v.fr === 'object') ? { ...defaults.fr, ...v.fr } : defaults.fr,
    ar: (v.ar && typeof v.ar === 'object') ? { ...defaults.ar, ...v.ar } : defaults.ar,
  };
};

export const getDefaultItemCategoryConfig = (): ItemCategoryConfig => {
  const productDefaults = CATEGORIES.filter((cat) => !RAW_MATERIAL_ONLY_CATEGORIES.includes(cat) && !LEGACY_CONSUMABLE_CATEGORIES.includes(cat));
  return {
    product: toUnique(productDefaults),
    rawMaterial: toUnique(RAW_MATERIAL_DEFAULT_CATEGORIES),
    consumable: toUnique(CONSUMABLE_DEFAULT_CATEGORIES),
    sellable: toUnique([...SELLABLE_CATEGORIES]),
    categoryNames: { fr: { ...CATEGORY_NAMES.fr }, ar: { ...CATEGORY_NAMES.ar } },
  };
};

export const buildItemCategoryConfigFromLegacy = (legacyList: unknown): ItemCategoryConfig => {
  const defaults = getDefaultItemCategoryConfig();
  const parsedLegacy = sanitizeCategoryList(legacyList);

  if (parsedLegacy.length === 0) return defaults;

  const rawFromLegacy = parsedLegacy.filter((cat) => RAW_MATERIAL_ONLY_CATEGORIES.includes(cat));
  const consumableFromLegacy = parsedLegacy.filter((cat) => LEGACY_CONSUMABLE_CATEGORIES.includes(cat));
  const productFromLegacy = parsedLegacy.filter((cat) => !RAW_MATERIAL_ONLY_CATEGORIES.includes(cat) && !LEGACY_CONSUMABLE_CATEGORIES.includes(cat));

  return {
    product: toUnique(productFromLegacy.length ? productFromLegacy : defaults.product),
    rawMaterial: toUnique([...defaults.rawMaterial, ...rawFromLegacy].filter((cat) => cat === 'kitchen')),
    consumable: toUnique([...defaults.consumable, ...consumableFromLegacy]),
    sellable: toUnique(defaults.sellable),
    categoryNames: defaults.categoryNames,
  };
};

export const sanitizeItemCategoryConfig = (value: unknown): ItemCategoryConfig => {
  const defaults = getDefaultItemCategoryConfig();
  if (!value || typeof value !== 'object') return defaults;

  const data = value as Partial<ItemCategoryConfig>;
  const product = sanitizeCategoryList(data.product);
  const rawMaterial = sanitizeCategoryList(data.rawMaterial);
  const consumable = sanitizeCategoryList(data.consumable);
  const sellable = sanitizeCategoryList(data.sellable);

  return {
    product: toUnique(product.length ? product : defaults.product),
    rawMaterial: toUnique((rawMaterial.length ? rawMaterial : defaults.rawMaterial).filter((cat) => cat === 'kitchen')),
    consumable: toUnique(consumable.length ? consumable : defaults.consumable),
    sellable: toUnique(sellable.length ? sellable : defaults.sellable),
    categoryNames: sanitizeCategoryNames(data.categoryNames),
  };
};
