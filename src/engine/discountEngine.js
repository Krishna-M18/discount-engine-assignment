
/**
 * discountEngine.js
 *
 * Pure discount calculation logic.
 * No UI and no side effects.
 *
 * Supported rule scopes:
 * - brand
 * - platform
 * - cart
 *
 * Supported discount types:
 * - percentage
 * - flat (item-level only)
 */

/**
 * Normalizes text for case-insensitive matching.
 */
function normalize(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * Checks whether a discount rule matches a cart item.
 */
export function ruleMatchesItem(item, rule) {
  if (!item || !rule || !rule.appliesTo) {
    return false
  }

  if (rule.scope === 'brand') {
    return normalize(item.brand) === normalize(rule.appliesTo)
  }

  if (rule.scope === 'platform') {
    return normalize(item.platform) === normalize(rule.appliesTo)
  }

  return false
}

/**
 * Calculates the discount amount for an item.
 *
 * Uses the current remaining price so that stacked
 * discounts are calculated sequentially.
 *
 * A discount can never exceed the remaining price.
 */
export function calculateDiscountAmount(price, rule) {
  const safePrice = Number.isFinite(price)
    ? Math.max(0, price)
    : 0

  if (
    !rule ||
    !Number.isFinite(rule.value) ||
    rule.value <= 0
  ) {
    return 0
  }

  let discount = 0

  if (rule.type === 'percentage') {
    discount = Math.round(
      safePrice * Math.min(rule.value, 100) / 100
    )
  } else if (rule.type === 'flat') {
    discount = rule.value
  }

  return Math.min(
    safePrice,
    Math.max(0, discount)
  )
}

/**
 * Creates a customer-readable explanation
 * for an applied item-level discount.
 */
function ruleToReasoning(rule) {
  const scopeLabel =
    rule.scope === 'brand' ? 'Brand' : 'Platform'

  if (rule.type === 'percentage') {
    return `${scopeLabel} offer: ${rule.value}% off`
  }

  if (rule.type === 'flat') {
    return `${scopeLabel} offer: Rs.${rule.value} off`
  }

  return `${scopeLabel} offer applied`
}

/**
 * Applies item-level discount rules to one cart item.
 *
 * Logic:
 * 1. Find all matching brand and platform rules.
 * 2. Select the non-stackable rule giving the largest saving.
 * 3. Apply that winning rule.
 * 4. Apply stackable rules sequentially.
 * 5. Never allow the final price to become negative.
 */
export function applyDiscounts(item, rules) {
  const basePrice = Number(item.basePrice)

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error(
      `Invalid base price for item ${item.itemId}`
    )
  }

  const safeBasePrice = Math.round(basePrice)

  const matchingRules = rules.filter((rule) =>
    ruleMatchesItem(item, rule) &&
    ['percentage', 'flat'].includes(rule.type) &&
    Number.isFinite(rule.value) &&
    rule.value > 0
  )

  // No matching rules.
  if (matchingRules.length === 0) {
    return {
      itemId: item.itemId,
      product: item.product,
      brand: item.brand,
      platform: item.platform,
      basePrice: safeBasePrice,
      finalPrice: safeBasePrice,
      totalDiscount: 0,
      appliedRules: [],
      skippedRules: [],
      reasoning: 'No offers available',
    }
  }

  const nonStackable = matchingRules.filter(
    (rule) => !rule.stackable
  )

  const stackable = matchingRules.filter(
    (rule) => rule.stackable
  )

  // Find the non-stackable rule with the largest saving.
  let winner = null
  let skipped = []

  if (nonStackable.length > 0) {
    const sorted = [...nonStackable].sort(
      (a, b) =>
        calculateDiscountAmount(safeBasePrice, b) -
        calculateDiscountAmount(safeBasePrice, a)
    )

    winner = sorted[0]
    skipped = sorted.slice(1)
  }

  let price = safeBasePrice

  const appliedRules = []
  const reasoningParts = []

  // Apply the winning non-stackable rule first.
  if (winner) {
    const discount = calculateDiscountAmount(price, winner)

    price = Math.max(0, price - discount)

    appliedRules.push(winner.ruleId)
    reasoningParts.push(ruleToReasoning(winner))
  }

  // Apply stackable rules one after another.
  for (const rule of stackable) {
    const discount = calculateDiscountAmount(price, rule)

    price = Math.max(0, price - discount)

    appliedRules.push(rule.ruleId)
    reasoningParts.push(ruleToReasoning(rule))
  }

  const finalPrice = Math.max(0, Math.round(price))

  return {
    itemId: item.itemId,
    product: item.product,
    brand: item.brand,
    platform: item.platform,
    basePrice: safeBasePrice,
    finalPrice,
    totalDiscount: safeBasePrice - finalPrice,
    appliedRules,
    skippedRules: skipped.map((rule) => rule.ruleId),
    reasoning: reasoningParts.length > 0
      ? reasoningParts.join(' + ')
      : 'No offers available',
  }
}

/**
 * Applies item-level discounts to every cart item.
 */
export function processCart(cartItems, rules) {
  return cartItems.map((item) =>
    applyDiscounts(item, rules)
  )
}

/**
 * Calculates the sum of final item prices.
 */
export function cartTotal(results) {
  return results.reduce(
    (sum, result) => sum + Math.max(0, result.finalPrice),
    0
  )
}

/**
 * Calculates cart-level discounts after item-level
 * discounts have already been applied.
 *
 * Cart rules:
 * - Must have scope = cart.
 * - Must use percentage discount type.
 * - Must meet the minimum cart value.
 *
 * Returns:
 * {
 *   subtotal,
 *   discount,
 *   finalTotal,
 *   applied,
 *   appliedRules,
 *   reasoning
 * }
 */
export function calculateCartDiscount(results, rules) {
  // Step 1: Calculate subtotal after item discounts.
  const subtotal = cartTotal(results)

  // Step 2: Find valid cart-level percentage rules.
  const cartRules = rules.filter(
    (rule) =>
      rule.scope === 'cart' &&
      rule.type === 'percentage' &&
      Number.isFinite(rule.value) &&
      rule.value > 0 &&
      Number.isFinite(rule.minCartValue) &&
      rule.minCartValue >= 0
  )

  // Step 3: Check minimum cart value.
  const eligibleRules = cartRules.filter(
    (rule) => subtotal >= rule.minCartValue
  )

  // No eligible cart offers.
  if (eligibleRules.length === 0 || subtotal === 0) {
    return {
      subtotal,
      discount: 0,
      finalTotal: subtotal,
      applied: false,
      appliedRules: [],
      reasoning: 'No cart offers available',
    }
  }

  // Step 4: Separate stackable and non-stackable rules.
  const nonStackable = eligibleRules.filter(
    (rule) => !rule.stackable
  )

  const stackable = eligibleRules.filter(
    (rule) => rule.stackable
  )

  // Step 5: Choose the largest non-stackable discount.
  let winner = null

  if (nonStackable.length > 0) {
    winner = nonStackable.reduce((best, current) =>
      current.value > best.value ? current : best
    )
  }

  let price = subtotal

  const appliedRules = []
  const reasoningParts = []

  // Apply a cart-level percentage rule safely.
  const applyRule = (rule) => {
    if (
      !Number.isFinite(rule.value) ||
      rule.value <= 0
    ) {
      return
    }

    const percentage = Math.min(rule.value, 100)

    const saving = Math.min(
      price,
      Math.round(price * percentage / 100)
    )

    price = Math.max(0, price - saving)

    appliedRules.push(rule.ruleId)

    reasoningParts.push(
      `Cart offer: ${rule.value}% off`
    )
  }

  // Step 6: Apply the winning non-stackable rule.
  if (winner) {
    applyRule(winner)
  }

  // Step 7: Apply stackable cart rules sequentially.
  for (const rule of stackable) {
    applyRule(rule)
  }

  // Step 8: Calculate final cart amount.
  const finalTotal = Math.max(0, Math.round(price))

  const discount = Math.min(
    subtotal,
    subtotal - finalTotal
  )

  return {
    subtotal,
    discount,
    finalTotal,
    applied: appliedRules.length > 0,
    appliedRules,
    reasoning: reasoningParts.join(' + '),
  }
}
