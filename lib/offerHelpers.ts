export interface ProductOfferInfo {
  has_offer?: boolean;
  offer_title?: string | null;
  offer_type?: 'unlimited' | 'date_limited' | 'stock_limited';
  offer_end_date?: string | null;
  offer_max_quantity?: number | null;
  offer_used_quantity?: number;
}

export const isOfferActive = (product: ProductOfferInfo): boolean => {
  if (!product.has_offer || !product.offer_title || !product.offer_title.trim()) {
    return false;
  }
  
  if (product.offer_type === 'date_limited') {
    if (!product.offer_end_date) return false;
    const endDate = new Date(product.offer_end_date).getTime();
    if (isNaN(endDate) || Date.now() > endDate) return false;
  }

  if (product.offer_type === 'stock_limited') {
    if (product.offer_max_quantity === null || product.offer_max_quantity === undefined) return false;
    const used = product.offer_used_quantity || 0;
    if (used >= product.offer_max_quantity) return false;
  }

  return true;
};

/**
 * Parses free bonus quantity based on offer title and purchased quantity
 * Example 1: "اشتري 5 واحصل على 1 مجانا" + itemQty 5 => 1 bonus
 * Example 2: "اشتري 1 واحصل على الثاني مجانا" + itemQty 1 => 1 bonus
 * Example 3: "10+1 مجانا" + itemQty 10 => 1 bonus
 */
export function getOfferBonusQuantity(offerTitle: string | null | undefined, itemQty: number): number {
  if (!offerTitle || itemQty <= 0) return 0;
  const title = offerTitle.trim();

  // Pattern 1: "اشتر 1 واحصل على الثاني مجانا" / "اشتري 1 واحصل على 1 مجانا" / "الثاني مجانا"
  if (/ثاني|الثاني/.test(title)) {
    const matchBuy = title.match(/(?:اشتر|اشتري)\s*(\d+)/);
    const buyQty = matchBuy ? parseInt(matchBuy[1], 10) : 1;
    return Math.floor(itemQty / buyQty) * 1;
  }

  // Pattern 2: "اشتر 5 واحصل على 1 مجانا" / "اشتري 10 واحصل على 2 مجانا" / "10+1 مجانا"
  const matchExplicit = title.match(/(?:اشتر|اشتري)?\s*(\d+)\s*(?:\+|واحصل على)\s*(\d+)\s*مجانا/i);
  if (matchExplicit) {
    const buyQty = parseInt(matchExplicit[1], 10);
    const freeQty = parseInt(matchExplicit[2], 10);
    if (buyQty > 0 && freeQty > 0) {
      return Math.floor(itemQty / buyQty) * freeQty;
    }
  }

  // Pattern 3: "10+1" or "5+1"
  const matchPlus = title.match(/(\d+)\+(\d+)/);
  if (matchPlus) {
    const buyQty = parseInt(matchPlus[1], 10);
    const freeQty = parseInt(matchPlus[2], 10);
    if (buyQty > 0 && freeQty > 0) {
      return Math.floor(itemQty / buyQty) * freeQty;
    }
  }

  return 0;
}

export interface BoxSummary {
  paidBoxes: number;
  bonusBoxes: number;
  totalBoxes: number;
}

export function getOrderBoxSummary(
  orderItems: Array<{ quantity: number; applied_offer?: string | null; product_id?: string | null }>,
  allProductsMap?: Record<string, ProductOfferInfo>
): BoxSummary {
  let paidBoxes = 0;
  let bonusBoxes = 0;

  (orderItems || []).forEach((item) => {
    paidBoxes += item.quantity || 0;
    let offer = item.applied_offer;
    if (!offer && item.product_id && allProductsMap && allProductsMap[item.product_id]) {
      const p = allProductsMap[item.product_id];
      if (isOfferActive(p)) {
        offer = p.offer_title;
      }
    }
    if (offer) {
      bonusBoxes += getOfferBonusQuantity(offer, item.quantity || 0);
    }
  });

  return {
    paidBoxes,
    bonusBoxes,
    totalBoxes: paidBoxes + bonusBoxes
  };
}
