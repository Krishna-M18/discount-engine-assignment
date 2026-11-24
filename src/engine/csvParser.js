
/**
 * csvParser.js
 *
 * Converts CSV text into validated DiscountRule and CartItem objects.
 *
 * Supported rule scopes:
 * - brand
 * - platform
 * - cart
 *
 * Supported discount types:
 * - percentage
 * - flat (brand/platform only)
 */

import Papa from 'papaparse'

// Required CSV columns.
const RULE_HEADERS = [
  'rule_id',
  'scope',
  'applies_to',
  'type',
  'value',
  'stackable',
]

const CART_HEADERS = [
  'item_id',
  'product',
  'brand',
  'platform',
  'base_price',
]

/**
 * Normalizes CSV headers.
 * Handles spaces, capitalization and UTF-8 BOM.
 */
function normalizeHeader(header) {
  return String(header ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * Parses CSV text and validates its headers.
 */
function parseCSV(csvText, requiredHeaders) {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return {
      rows: [],
      errors: ['The uploaded CSV file is empty.'],
    }
  }

  const result = Papa.parse(csvText.replace(/^\uFEFF/, '').trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  })

  // Papa Parse returns meta.fields as an array of header names.
  const availableHeaders = result.meta.fields || []

  const missingHeaders = requiredHeaders.filter(
    (header) => !availableHeaders.includes(header)
  )

  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [
        `Missing required CSV columns: ${missingHeaders.join(', ')}`,
      ],
    }
  }

  // Reject malformed CSV structures.
  if (result.errors.length > 0) {
    return {
      rows: [],
      errors: result.errors.map(
        (error) =>
          `CSV parsing error: ${error.message}`
      ),
    }
  }

  return {
    rows: result.data,
    errors: [],
  }
}

/**
 * Parses a positive numeric value.
 *
 * Supported examples:
 * 1500
 * 1,500
 * 1500.50
 * Rs.1,500
 * ₹1,500
 */
function parsePositiveNumber(value) {
  if (value === undefined || value === null) {
    return null
  }

  const cleaned = String(value)
    .trim()
    .replace(/^rs\.?\s*/i, '')
    .replace(/₹/g, '')
    .replace(/\s/g, '')

  // Reject malformed comma grouping and invalid characters.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(cleaned)) {
    return null
  }

  const number = Number(cleaned.replace(/,/g, ''))

  return Number.isFinite(number) && number > 0
    ? number
    : null
}

/**
 * Parses a non-negative numeric value.
 * Used for minimum cart value, where zero is allowed.
 */
function parseNonNegativeNumber(value) {
  if (value === undefined || value === null) {
    return null
  }

  const cleaned = String(value)
    .trim()
    .replace(/^rs\.?\s*/i, '')
    .replace(/₹/g, '')
    .replace(/\s/g, '')

  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(cleaned)) {
    return null
  }

  const number = Number(cleaned.replace(/,/g, ''))

  return Number.isFinite(number) && number >= 0
    ? number
    : null
}

/**
 * Parses stackable values explicitly.
 */
function parseStackable(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (['true', 'yes', '1'].includes(normalized)) {
    return true
  }

  if (['false', 'no', '0'].includes(normalized)) {
    return false
  }

  return null
}

/**
 * Parses rules.csv into DiscountRule objects.
 *
 * Returns:
 * {
 *   data: DiscountRule[],
 *   errors: string[]
 * }
 */
export function parseRulesCSV(csvText) {
  const { rows, errors: parseErrors } = parseCSV(
    csvText,
    RULE_HEADERS
  )

  if (parseErrors.length > 0) {
    return {
      data: [],
      errors: parseErrors,
    }
  }

  const data = []
  const errors = []
  const seenRuleIds = new Set()

  rows.forEach((row, index) => {
    const rowNum = index + 2

    const ruleId = String(row.rule_id ?? '').trim()
    const scope = String(row.scope ?? '').trim().toLowerCase()
    const appliesTo = String(row.applies_to ?? '').trim()
    const type = String(row.type ?? '').trim().toLowerCase()

    // Validate required fields.
    const missing = []

    if (!ruleId) missing.push('rule_id')
    if (!scope) missing.push('scope')
    if (!type) missing.push('type')

    if (
      row.value === undefined ||
      String(row.value).trim() === ''
    ) {
      missing.push('value')
    }

    if (
      row.stackable === undefined ||
      String(row.stackable).trim() === ''
    ) {
      missing.push('stackable')
    }

    if (missing.length > 0) {
      errors.push(
        `Row ${rowNum}: missing fields — ${missing.join(', ')}`
      )
      return
    }

    // Validate unique rule ID.
    if (seenRuleIds.has(ruleId.toLowerCase())) {
      errors.push(
        `Row ${rowNum}: duplicate rule_id "${ruleId}".`
      )
      return
    }

    // Validate scope.
    if (!['brand', 'platform', 'cart'].includes(scope)) {
      errors.push(
        `Row ${rowNum}: invalid scope "${scope}". Use brand, platform or cart.`
      )
      return
    }

    // Validate discount type.
    if (!['percentage', 'flat'].includes(type)) {
      errors.push(
        `Row ${rowNum}: invalid type "${type}". Use percentage or flat.`
      )
      return
    }

    // Validate discount value.
    const value = parsePositiveNumber(row.value)

    if (value === null) {
      errors.push(
        `Row ${rowNum}: value must be a positive number.`
      )
      return
    }

    // Percentage discounts cannot exceed 100%.
    if (type === 'percentage' && value > 100) {
      errors.push(
        `Row ${rowNum}: percentage discount cannot exceed 100%.`
      )
      return
    }

    // Cart discounts must be percentage-based.
    if (scope === 'cart' && type !== 'percentage') {
      errors.push(
        `Row ${rowNum}: cart discounts must be percentage-based.`
      )
      return
    }

    // Brand and platform rules require applies_to.
    if (
      (scope === 'brand' || scope === 'platform') &&
      !appliesTo
    ) {
      errors.push(
        `Row ${rowNum}: applies_to is required for ${scope} rules.`
      )
      return
    }

    // Cart rules must have an empty applies_to.
    if (scope === 'cart' && appliesTo) {
      errors.push(
        `Row ${rowNum}: applies_to must be empty for cart rules.`
      )
      return
    }

    // Validate stackable.
    const stackable = parseStackable(row.stackable)

    if (stackable === null) {
      errors.push(
        `Row ${rowNum}: stackable must be true/false, yes/no or 1/0.`
      )
      return
    }

    // Validate minimum cart value.
    let minCartValue = null

    if (scope === 'cart') {
      const rawMinimum = row.min_cart_value

      if (
        rawMinimum === undefined ||
        String(rawMinimum).trim() === ''
      ) {
        errors.push(
          `Row ${rowNum}: min_cart_value is required for cart rules.`
        )
        return
      }

      minCartValue = parseNonNegativeNumber(rawMinimum)

      if (minCartValue === null) {
        errors.push(
          `Row ${rowNum}: min_cart_value must be a non-negative number.`
        )
        return
      }
    }

    // Add the validated rule.
    data.push({
      ruleId,
      scope,
      appliesTo: scope === 'cart' ? '' : appliesTo,
      type,
      value,
      stackable,
      minCartValue,
    })

    seenRuleIds.add(ruleId.toLowerCase())
  })

  return {
    data,
    errors,
  }
}

/**
 * Parses cart.csv into CartItem objects.
 *
 * Returns:
 * {
 *   data: CartItem[],
 *   errors: string[]
 * }
 */
export function parseCartCSV(csvText) {
  const { rows, errors: parseErrors } = parseCSV(
    csvText,
    CART_HEADERS
  )

  if (parseErrors.length > 0) {
    return {
      data: [],
      errors: parseErrors,
    }
  }

  const data = []
  const errors = []
  const seenItemIds = new Set()

  rows.forEach((row, index) => {
    const rowNum = index + 2

    const itemId = String(row.item_id ?? '').trim()
    const product = String(row.product ?? '').trim()
    const brand = String(row.brand ?? '').trim()
    const platform = String(row.platform ?? '').trim()

    // Validate required fields.
    const missing = []

    if (!itemId) missing.push('item_id')
    if (!product) missing.push('product')
    if (!brand) missing.push('brand')
    if (!platform) missing.push('platform')

    if (
      row.base_price === undefined ||
      String(row.base_price).trim() === ''
    ) {
      missing.push('base_price')
    }

    if (missing.length > 0) {
      errors.push(
        `Row ${rowNum}: missing fields — ${missing.join(', ')}`
      )
      return
    }

    // Validate unique item ID.
    if (seenItemIds.has(itemId.toLowerCase())) {
      errors.push(
        `Row ${rowNum}: duplicate item_id "${itemId}".`
      )
      return
    }

    // Validate base price.
    const basePrice = parsePositiveNumber(row.base_price)

    if (basePrice === null) {
      errors.push(
        `Row ${rowNum}: base_price must be a positive number.`
      )
      return
    }

    // Add the validated cart item.
    data.push({
      itemId,
      product,
      brand,
      platform,
      basePrice: Math.round(basePrice),
    })

    seenItemIds.add(itemId.toLowerCase())
  })

  return {
    data,
    errors,
  }
}
