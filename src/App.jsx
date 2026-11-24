
import { useState } from 'react'
import PdfUploader from './components/PdfUploader.jsx'
import { parseCartPDF } from './engine/pdfParser.js'
import CsvUploader from './components/CsvUploader.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import {
  processCart,
  calculateCartDiscount,
} from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────
// Production backend URL is configured through Vercel.
// Locally, the Vite proxy will continue to work.
const API_BASE_URL = import.meta.env.PROD
  ? 'https://discount-engine-assignment-dk1r.onrender.com'
  : ''

const RULES_COLUMNS = [
  { key: 'ruleId', label: 'Rule ID' },
  {
    key: 'scope',
    label: 'Scope',
    render: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: 'appliesTo',
    label: 'Applies To',
    render: (v) => v || 'Entire cart',
  },
  {
    key: 'type',
    label: 'Type',
    render: (v) => v.charAt(0).toUpperCase() + v.slice(1),
  },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) =>
      row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`,
  },
  {
    key: 'minCartValue',
    label: 'Minimum Cart',
    render: (v) => v ? `Rs.${v.toLocaleString('en-IN')}` : '—',
  },
  {
    key: 'stackable',
    label: 'Stackable',
    render: (v) => (v ? 'Yes' : 'No'),
  },
]

const CART_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  { key: 'brand', label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  {
    key: 'basePrice',
    label: 'Base Price',
    render: (v) => `Rs.${v.toLocaleString('en-IN')}`,
  },
]

const RESULTS_COLUMNS = [
  { key: 'itemId', label: 'Item' },
  { key: 'product', label: 'Product' },
  {
    key: 'basePrice',
    label: 'Base Price',
    render: (v) => `Rs.${v.toLocaleString('en-IN')}`,
  },
  {
    key: 'finalPrice',
    label: 'Final Price',
    render: (v, row) => (
      <span
        style={{
          fontWeight: 700,
          color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48',
        }}
      >
        Rs.{v.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'totalDiscount',
    label: 'You Save',
    render: (v) =>
      v > 0 ? (
        <span style={{ color: '#1e5c2c', fontWeight: 600 }}>
          Rs.{v.toLocaleString('en-IN')}
        </span>
      ) : (
        <span style={{ color: '#888' }}>—</span>
      ),
  },
  {
    key: 'reasoning',
    label: 'Offer Applied',
    render: (v) => (
      <span
        style={{
          color: v === 'No offers available' ? '#888' : '#131A48',
          fontStyle: v === 'No offers available' ? 'italic' : 'normal',
        }}
      >
        {v}
      </span>
    ),
  },
]

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#f7f7f9',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    background: '#131A48',
    padding: '0.85rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoTxt: {
    fontFamily: 'Georgia, serif',
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  logoSpan: { color: '#FF5800' },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
  },
  main: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '1.8rem 1.5rem',
  },
  section: {
    background: '#fff',
    border: '1px solid #CECECE',
    borderRadius: 6,
    padding: '1.2rem 1.4rem',
    marginBottom: '1.2rem',
  },
  sectionTitle: {
    fontFamily: 'Georgia, serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#131A48',
    marginBottom: '0.7rem',
    paddingBottom: 6,
    borderBottom: '2px solid #FF5800',
    display: 'inline-block',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  btn: {
    background: '#FF5800',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.65rem 1.2rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnDisabled: {
    background: '#CECECE',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '0.65rem 1.2rem',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'not-allowed',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem',
    border: '1px solid #CECECE',
    borderRadius: 4,
    fontSize: 14,
    marginBottom: '0.7rem',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '1rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  totalLabel: {
    fontWeight: 700,
    fontSize: 14,
    color: '#131A48',
  },
  totalValue: {
    fontWeight: 700,
    fontSize: 16,
    color: '#131A48',
  },
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules] = useState([])
  const [rulesErrors, setRulesErr] = useState([])
  const [rulesFileName, setRulesFileName] = useState('')
  
  const [cartItems, setCartItems] = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName] = useState('')
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  

  const [results, setResults] = useState(null)
  const [cartDiscountResult, setCartDiscountResult] = useState(null)

  // AI rule creator state
  const [ruleDescription, setRuleDescription] = useState('')
  const [aiRule, setAiRule] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // ── CSV handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null)
    setCartDiscountResult(null)
  }

  
  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
  
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setPdfFileName('')
  
    setResults(null)
    setCartDiscountResult(null)
  }
  
  
async function handlePDFLoad(file) {
  setPdfLoading(true)
  setCartErrors([])

  try {
    const { data, errors } = await parseCartPDF(file)

    if (data.length === 0) {
      setCartErrors(errors)
      return
    }

    setCartItems(data)
    setCartErrors(errors)
    setPdfFileName(file.name)
    setCartFileName('')

    const newResults = processCart(data, rules)
    setResults(newResults)

    const newCartDiscount = calculateCartDiscount(newResults, rules)
    setCartDiscountResult(newCartDiscount)

  } catch (error) {
    console.error('PDF upload error:', error)
    setCartErrors(['Something went wrong while reading the PDF. Please try again.'])
  } finally {
    setPdfLoading(false)
  }
}

  // ── Calculate discounts ──

  function handleCalculate() {
    const res = processCart(cartItems, rules)
    const cartDiscount = calculateCartDiscount(res, rules)

    setResults(res)
    setCartDiscountResult(cartDiscount)
  }

  // ── Ask AI to understand the rule ──

  async function handleGenerateRule() {
    if (!ruleDescription.trim()) {
      setAiError('Please describe the discount rule first.')
      return
    }

    setAiLoading(true)
    setAiError('')
    setAiRule(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/parse-rule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: ruleDescription,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to understand the rule.')
      }

      setAiRule(data)
    } catch (error) {
      setAiError(
        error.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setAiLoading(false)
    }
  }

  // ── Confirm the AI-generated rule ──

  function handleConfirmAIRule() {
    if (!aiRule || !aiRule.isResolvable) {
      return
    }

    const newRule = {
      ruleId: `AI-${Date.now()}`,
      scope: aiRule.scope,
      appliesTo: aiRule.appliesTo,
      type: aiRule.type,
      value: aiRule.value,
      stackable: aiRule.stackable,
      minCartValue: aiRule.minCartValue,
    }

    const updatedRules = [...rules, newRule]

    setRules(updatedRules)

    // Recalculate automatically if cart items are already loaded.
    if (cartItems.length > 0) {
      const newResults = processCart(cartItems, updatedRules)
      const newCartDiscount = calculateCartDiscount(
        newResults,
        updatedRules
      )

      setResults(newResults)
      setCartDiscountResult(newCartDiscount)
    } else {
      setResults(null)
      setCartDiscountResult(null)
    }

    // Clear the AI preview after confirmation.
    setRuleDescription('')
    setAiRule(null)
    setAiError('')
  }

  function handleDiscardAIRule() {
    setAiRule(null)
    setAiError('')
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>
          O<span style={S.logoSpan}>pp</span>tra
        </div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>
        {/* CSV upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>

            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />

            <ErrorBanner errors={rulesErrors} />

            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>

            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0}
              fileName={cartFileName}
            />

<div style={{ marginTop: '0.75rem' }}>
  <PdfUploader
    onLoad={handlePDFLoad}
    hasData={Boolean(pdfFileName)}
    fileName={pdfLoading ? 'Reading PDF...' : pdfFileName}
  />
</div>


            <ErrorBanner errors={cartErrors} />

            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={CART_COLUMNS} rows={cartItems} />
              </div>
            )}
          </div>
        </div>

        {/* Natural language rule creator */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Create a Discount Rule with AI</div>

          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
            Describe a discount in plain English. AI will convert it into
            a structured rule for you to review.
          </p>

          <textarea
            style={{
              ...S.input,
              minHeight: 90,
              resize: 'vertical',
              fontFamily: 'Arial, sans-serif',
            }}
            value={ruleDescription}
            onChange={(e) => setRuleDescription(e.target.value)}
            placeholder="Example: Give 20% off on Natura Casa products, stackable with other offers."
            maxLength={500}
          />

          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
            {ruleDescription.length}/500 characters
          </div>

          <button
            style={aiLoading ? S.btnDisabled : S.btn}
            onClick={handleGenerateRule}
            disabled={aiLoading}
          >
            {aiLoading ? 'Understanding Rule...' : 'Generate Rule'}
          </button>

          {aiError && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                background: '#fff0f0',
                color: '#a00000',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              {aiError}
            </div>
          )}

          {/* AI rule preview */}
          {aiRule && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: '1px solid #CECECE',
                borderRadius: 5,
                background: '#fafafa',
              }}
            >
              <h3 style={{ color: '#131A48', fontSize: 14, marginTop: 0 }}>
                AI Rule Preview
              </h3>

              {aiRule.isResolvable ? (
                <>
                  <p style={{ fontSize: 13, lineHeight: 1.8 }}>
                    <strong>Scope:</strong> {aiRule.scope}
                    <br />
                    <strong>Applies to:</strong>{' '}
                    {aiRule.appliesTo || 'Entire cart'}
                    <br />
                    <strong>Discount:</strong> {aiRule.value}
                    {aiRule.type === 'percentage' ? '%' : ' Rs.'}
                    {aiRule.type === 'flat' ? ' off' : ' off'}
                    <br />
                    <strong>Stackable:</strong>{' '}
                    {aiRule.stackable ? 'Yes' : 'No'}
                    <br />
                    {aiRule.scope === 'cart' && (
                      <>
                        <strong>Minimum cart value:</strong>{' '}
                        Rs.{Number(aiRule.minCartValue).toLocaleString('en-IN')}
                        <br />
                      </>
                    )}
                  </p>

                  <p style={{ fontSize: 12, color: '#555' }}>
                    Review the details above. This rule will only be added
                    after you confirm.
                  </p>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      style={S.btn}
                      onClick={handleConfirmAIRule}
                    >
                      Confirm and Add Rule
                    </button>

                    <button
                      style={{
                        ...S.btn,
                        background: '#777',
                      }}
                      onClick={handleDiscardAIRule}
                    >
                      Discard
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: '#a06000', fontSize: 13 }}>
                    The instruction needs clarification before it can
                    become a discount rule.
                  </p>

                  <p style={{ fontSize: 13 }}>
                    <strong>AI clarification:</strong>{' '}
                    {aiRule.clarification || 'Please provide more details.'}
                  </p>

                  <button
                    style={{ ...S.btn, background: '#777' }}
                    onClick={handleDiscardAIRule}
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>

          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Upload both files to calculate
            </div>
          )}
        </div>

        {/* Results */}
        {results && cartDiscountResult && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>

            <DataTable columns={RESULTS_COLUMNS} rows={results} />

            <div style={S.totalRow}>
              <span style={S.totalLabel}>Cart Total Before Offer</span>
              <span style={S.totalValue}>
                Rs.{cartDiscountResult.subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            {cartDiscountResult.applied && (
              <div
                style={{
                  ...S.totalRow,
                  borderTop: 'none',
                  marginTop: '0.3rem',
                  paddingTop: '0.3rem',
                }}
              >
                <span style={{ ...S.totalLabel, color: '#1e5c2c' }}>
                  {cartDiscountResult.reasoning}
                </span>

                <span style={{ ...S.totalValue, color: '#1e5c2c' }}>
                  -Rs.{cartDiscountResult.discount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div
              style={{
                ...S.totalRow,
                borderTop: '2px solid #131A48',
              }}
            >
              <span style={S.totalLabel}>Final Cart Total</span>
              <span style={S.totalValue}>
                Rs.{cartDiscountResult.finalTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
