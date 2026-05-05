import { Product, Promotion } from '../types';

export interface ActiveProductPromotion {
  campaignId: string;
  campaignName: string;
  promotionPrice: number;
  originalPrice: number;
}

function isActivePromotion(promo: Promotion, nowIso: string): boolean {
  return !!promo.active && promo.expiryDate > nowIso;
}

export function getActiveProductPromotion(
  productId: string,
  promotions: Promotion[],
  nowIso: string = new Date().toISOString()
): ActiveProductPromotion | null {
  for (const promo of promotions) {
    if (!isActivePromotion(promo, nowIso)) continue;
    if (promo.type !== 'campaign') continue;
    const row = promo.productPrices?.find((entry) => entry.productId === productId);
    if (!row) continue;
    return {
      campaignId: promo.id,
      campaignName: promo.name || promo.title || 'Campaign',
      promotionPrice: row.promotionPrice,
      originalPrice: row.originalPrice,
    };
  }
  return null;
}

export function getEffectiveSellingPrice(
  product: Product,
  promotions: Promotion[],
  nowIso: string = new Date().toISOString()
): number {
  const active = getActiveProductPromotion(product.id, promotions, nowIso);
  return active ? active.promotionPrice : product.sellingPrice;
}
