
import * as pdfjsLib from 'pdfjs-dist'
import Papa from 'papaparse'

// Configure PDF.js worker for Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/**
 * Normalizes extracted text for heading comparisons.
 */
function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Groups PDF text items into visual lines.
 * Retains each item's width so that columns can be identified.
 */
function groupItemsIntoLines(items, pageNumber) {
  const lines = []

  for (const item of items) {
    const text = item.str?.trim()
    if (!text) continue

    const x = item.transform?.[4] ?? 0
    const y = item.transform?.[5] ?? 0

    let line = lines.find(
      (entry) => Math.abs(entry.y - y) < 3
    )

    if (!line) {
      line = {
        y,
        pageNumber,
        items: [],
      }
      lines.push(line)
    }

    line.items.push({
      text,
      x,
      width: item.width || 0,
    })
  }

  return lines
    .map((line) => ({
      ...line,
      items: line.items.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => b.y - a.y)
}

/**
 * Groups nearby PDF text fragments into individual cells.
 *
 * Small gaps are treated as spaces within a cell.
 * Large gaps indicate separate table columns.
 */
function getCellsFromLine(line) {
  const cells = []

  for (const item of line.items) {
    const previous = cells[cells.length - 1]

    if (!previous) {
      cells.push({
        text: item.text,
        startX: item.x,
        endX: item.x + item.width,
      })
      continue
    }

    const gap = item.x - previous.endX

    // Column gaps are normally much larger than word gaps.
    if (gap > 14) {
      cells.push({
        text: item.text,
        startX: item.x,
        endX: item.x + item.width,
      })
    } else {
      previous.text += ` ${item.text}`
      previous.endX = item.x + item.width
    }
  }

  return cells.map((cell) => cell.text.trim())
}

/**
 * Finds the position of a column heading.
 */
function findHeaderPosition(items, keyword) {
  const item = items.find((entry) => {
    const value = normalizeText(entry.text)

    if (keyword === 'platform') {
      return value.includes('platform')
    }

    return value.includes(keyword)
  })

  return item?.x
}

/**
 * Detects table headings.
 *
 * Supports:
 * Product | Brand | Platform | Base Price
 *
 * And:
 * Item ID | Product | Brand | Platform | Base Price
 */
function findHeaders(lines) {
  const headers = []

  for (const line of lines) {
    const combined = line.items
      .map((item) => normalizeText(item.text))
      .join('')

    const hasProduct = combined.includes('product')
    const hasBrand = combined.includes('brand')
    const hasPlatform = combined.includes('platform')
    const hasPrice = combined.includes('baseprice')

    if (!hasProduct || !hasBrand || !hasPlatform || !hasPrice) {
      continue
    }

    const itemIdX = findHeaderPosition(line.items, 'itemid')
    const productX = findHeaderPosition(line.items, 'product')
    const brandX = findHeaderPosition(line.items, 'brand')
    const platformX = findHeaderPosition(line.items, 'platform')
    const priceX = findHeaderPosition(line.items, 'base')

    const hasItemId = itemIdX !== undefined

    const positions = hasItemId
      ? [itemIdX, productX, brandX, platformX, priceX]
      : [productX, brandX, platformX, priceX]

    if (positions.some((position) => position === undefined)) {
      continue
    }

    headers.push({
      positions,
      hasItemId,
      headerY: line.y,
      pageNumber: line.pageNumber,
    })
  }

  return headers
}

/**
 * Splits a visual table row using column positions.
 */
function splitIntoColumns(items, positions) {
  const columns = Array(positions.length).fill('')

  for (const item of items) {
    let columnIndex = 0

    for (let i = 1; i < positions.length; i++) {
      if (item.x >= positions[i] - 2) {
        columnIndex = i
      }
    }

    columns[columnIndex] +=
      (columns[columnIndex] ? ' ' : '') + item.text
  }

  return columns.map((value) => value.trim())
}

/**
 * Cleans and validates a price.
 *
 * Examples:
 * 1299
 * 1,299
 * Rs.1,299
 * ₹1,299
 */
function cleanPrice(value) {
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

  const price = Number(cleaned.replace(/,/g, ''))

  return Number.isFinite(price) && price > 0
    ? Math.round(price)
    : null
}

/**
 * Generates an item ID when the PDF does not provide one.
 */
function generateItemId(number) {
  return `Item-${String(number).padStart(2, '0')}`
}

/**
 * Converts extracted columns into a cart item.
 */
function createCartItem(fields, itemNumber, hasItemId) {
  let itemId
  let product
  let brand
  let platform
  let priceText

  if (hasItemId) {
    ;[itemId, product, brand, platform, priceText] = fields
  } else {
    ;[product, brand, platform, priceText] = fields
    itemId = generateItemId(itemNumber)
  }

  const basePrice = cleanPrice(priceText)

  if (!product || !brand || !platform || !basePrice) {
    return null
  }

  return {
    itemId: itemId || generateItemId(itemNumber),
    product,
    brand,
    platform,
    basePrice,
  }
}

/**
 * Parses table-format PDFs with headings.
 * Supports four and five columns.
 */
function parseTable(lines, headers) {
  const data = []
  const errors = []
  let itemNumber = 1

  for (const line of lines) {
    const header = headers
      .filter((entry) => entry.pageNumber === line.pageNumber)
      .sort((a, b) => b.headerY - a.headerY)
      .find((entry) => line.y < entry.headerY)

    if (!header) continue

    const columns = splitIntoColumns(
      line.items,
      header.positions
    )

    // Ignore empty lines and unrelated footer content.
    if (!columns.some(Boolean)) continue

    const item = createCartItem(
      columns,
      itemNumber,
      header.hasItemId
    )

    if (!item) {
      // Ignore lines that do not look like product rows.
      continue
    }

    data.push(item)
    itemNumber++
  }

  return { data, errors }
}

/**
 * Parses delimited plain-text rows.
 *
 * Supported separators:
 * |, tabs, semicolons and commas.
 *
 * Four columns:
 * Product, Brand, Platform, Base Price
 *
 * Five columns:
 * Item ID, Product, Brand, Platform, Base Price
 */
function parsePlainTextRow(line, itemNumber) {
  let fields = null

  if (line.includes('|')) {
    fields = line.split('|').map((value) => value.trim())
  } else if (line.includes('\t')) {
    fields = line.split('\t').map((value) => value.trim())
  } else if (line.includes(';')) {
    fields = line.split(';').map((value) => value.trim())
  } else if (line.includes(',')) {
    const result = Papa.parse(line, {
      header: false,
      skipEmptyLines: true,
    })

    if (result.errors.length > 0) return null

    fields = result.data[0]?.map(
      (value) => String(value).trim()
    )
  } else {
    // Also support rows with columns separated by
    // multiple spaces in extracted PDF text.
    fields = line
      .trim()
      .split(/\s{2,}/)
      .map((value) => value.trim())
  }

  if (!fields || (fields.length !== 4 && fields.length !== 5)) {
    return null
  }

  const hasItemId = fields.length === 5

  return createCartItem(fields, itemNumber, hasItemId)
}

/**
 * Parses structured plain-text PDF content.
 */
function parsePlainText(lines) {
  const data = []

  let itemNumber = 1

  for (const line of lines) {
    const cells = getCellsFromLine(line)

    let text = cells.join(' | ')

    // If PDF.js provides only one text item for a complete
    // row, use that text directly.
    if (line.items.length === 1) {
      text = line.items[0].text
    }

    if (!text.trim()) continue

    const normalized = normalizeText(text)

    // Ignore column headings.
    if (
      normalized.includes('product') &&
      normalized.includes('brand') &&
      normalized.includes('platform') &&
      normalized.includes('baseprice')
    ) {
      continue
    }

    const parsedRow = parsePlainTextRow(text, itemNumber)

    if (parsedRow) {
      data.push(parsedRow)
      itemNumber++
    }
  }

  return { data, errors: [] }
}

/**
 * Parses headerless table rows using PDF column positions.
 *
 * Supports four-column and five-column layouts
 * even when no headings are present.
 */
function parseHeaderlessTable(lines) {
  const data = []
  const errors = []

  let itemNumber = 1

  for (const line of lines) {
    const cells = getCellsFromLine(line)

    if (cells.length !== 4 && cells.length !== 5) {
      continue
    }

    const hasItemId = cells.length === 5

    const item = createCartItem(
      cells,
      itemNumber,
      hasItemId
    )

    if (!item) continue

    data.push(item)
    itemNumber++
  }

  return { data, errors }
}

/**
 * Main PDF cart parser.
 *
 * Returns:
 * {
 *   data: CartItem[],
 *   errors: string[]
 * }
 */
export async function parseCartPDF(file) {
  try {
    if (!file) {
      return {
        data: [],
        errors: ['Please select a PDF file.'],
      }
    }

    // Check file extension or MIME type.
    const isPdf =
      file.type === 'application/pdf' ||
      /\.pdf$/i.test(file.name || '')

    if (!isPdf) {
      return {
        data: [],
        errors: ['Please upload a valid PDF file.'],
      }
    }

    const arrayBuffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise

    if (!pdf.numPages) {
      return {
        data: [],
        errors: ['The uploaded PDF contains no pages.'],
      }
    }

    const allLines = []

    // Extract text from every page.
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()

      const lines = groupItemsIntoLines(
        textContent.items,
        pageNumber
      )

      allLines.push(...lines)
    }

    if (allLines.length === 0) {
      return {
        data: [],
        errors: [
          'No readable text was found. This may be a scanned PDF and may require OCR.',
        ],
      }
    }

    // Method 1: Tables with column headings.
    const headers = findHeaders(allLines)

    if (headers.length > 0) {
      const tableResult = parseTable(allLines, headers)

      if (tableResult.data.length > 0) {
        return tableResult
      }
    }

    // Method 2: Structured plain-text rows.
    const textResult = parsePlainText(allLines)

    if (textResult.data.length > 0) {
      return textResult
    }

    // Method 3: Headerless tables.
    const headerlessResult = parseHeaderlessTable(allLines)

    if (headerlessResult.data.length > 0) {
      return headerlessResult
    }

    return {
      data: [],
      errors: [
        'No cart items could be read. Please use a four-column or five-column table, or structured text rows separated by |, tabs, semicolons, commas or multiple spaces.',
      ],
    }

  } catch (error) {
    console.error('PDF parsing error:', error)

    return {
      data: [],
      errors: [
        'Unable to read this PDF. Please upload a valid text-based PDF.',
      ],
    }
  }
}
