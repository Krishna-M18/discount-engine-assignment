
import express from 'express'
import Groq from 'groq-sdk'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json({ limit: '10kb' }))

// CORS configuration for local and deployed frontend
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Discount Engine API is running',
  })
})

// Check API key
if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is missing. Check your .env file.')
  process.exit(1)
}

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Natural language discount rule endpoint
app.post('/api/parse-rule', async (req, res) => {
  try {
    const { text } = req.body ?? {}

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'Please enter a discount rule.',
      })
    }

    if (text.length > 500) {
      return res.status(400).json({
        error: 'Please keep the rule description under 500 characters.',
      })
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: `
You convert plain-English discount instructions into structured discount rules.

Supported rule types:
1. Brand: applies to a named brand.
2. Platform: applies to a named platform.
3. Cart: applies to the entire cart and requires a minimum cart value.

Rules:
- Percentage discounts must be between 1 and 100.
- Flat discounts must be positive.
- Brand and platform rules require appliesTo.
- Cart rules must be percentage discounts and require minCartValue.
- Cart rules must have an empty appliesTo.
- Non-cart rules must have minCartValue set to null.
- If the instruction is vague or missing required information, set isResolvable to false.
- Never invent missing values.
- Explain missing information in clarification.
- Do not interpret unrelated text as a discount rule.
          `,
        },
        {
          role: 'user',
          content: text.trim(),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'discount_rule',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              isResolvable: { type: 'boolean' },
              scope: {
                type: 'string',
                enum: ['brand', 'platform', 'cart', 'unknown'],
              },
              appliesTo: { type: 'string' },
              type: {
                type: 'string',
                enum: ['percentage', 'flat', 'unknown'],
              },
              value: { type: 'number' },
              stackable: { type: 'boolean' },
              minCartValue: {
                type: ['number', 'null'],
              },
              clarification: { type: 'string' },
            },
            required: [
              'isResolvable',
              'scope',
              'appliesTo',
              'type',
              'value',
              'stackable',
              'minCartValue',
              'clarification',
            ],
            additionalProperties: false,
          },
        },
      },
    })

    const content = completion.choices?.[0]?.message?.content

    if (!content) {
      return res.status(502).json({
        error: 'Groq returned an empty response.',
      })
    }

    const rule = JSON.parse(content)

    // Validate the generated rule before returning it.
    if (rule.isResolvable) {
      const validScope = ['brand', 'platform', 'cart'].includes(rule.scope)
      const validType = ['percentage', 'flat'].includes(rule.type)
      const validValue =
        Number.isFinite(rule.value) && rule.value > 0

      if (!validScope || !validType || !validValue) {
        return res.status(422).json({
          error: 'The generated discount rule is invalid.',
        })
      }

      if (rule.type === 'percentage' && rule.value > 100) {
        return res.status(422).json({
          error: 'Percentage discount cannot exceed 100%.',
        })
      }

      if (
        (rule.scope === 'brand' || rule.scope === 'platform') &&
        (
          typeof rule.appliesTo !== 'string' ||
          !rule.appliesTo.trim() ||
          rule.minCartValue !== null
        )
      ) {
        return res.status(422).json({
          error: 'Brand and platform rules require a target and cannot have a cart minimum.',
        })
      }

      if (
        rule.scope === 'cart' &&
        (
          rule.type !== 'percentage' ||
          rule.appliesTo !== '' ||
          !Number.isFinite(rule.minCartValue) ||
          rule.minCartValue <= 0
        )
      ) {
        return res.status(422).json({
          error: 'Cart rules require a percentage, an empty target, and a positive minimum cart value.',
        })
      }
    }

    return res.status(200).json(rule)
  } catch (error) {
    console.error('Rule parsing error:', error.message)

    return res.status(500).json({
      error: 'Unable to parse the discount rule. Please try again.',
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Groq backend running on port ${PORT}`)
})
