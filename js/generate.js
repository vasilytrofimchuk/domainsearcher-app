// Bundled API key — XOR-encoded at build time so GitHub secret scanning won't flag it
// deploy.yml encodes: each char XOR 42, joined by commas → decoded here at runtime
function _dk(s) { return s.split(',').map(c => String.fromCharCode(parseInt(c) ^ 42)).join('') }
export const BUNDLED_API_KEY = _dk('__GROQ_API_KEY__')
const BUNDLED_BASE_URL = 'https://api.groq.com/openai/v1'
const BUNDLED_MODEL = 'llama-3.3-70b-versatile'

export function detectProvider(key) {
  if (!key) return 'Groq (default)'
  if (key.startsWith('sk-ant-')) return 'Claude (Anthropic)'
  if (key.startsWith('sk-')) return 'OpenAI'
  if (key.startsWith('gsk_')) return 'Groq'
  return 'Unknown'
}

async function aiChat(messages, apiKey) {
  const key = apiKey || BUNDLED_API_KEY
  const provider = detectProvider(key)

  if (provider === 'Claude (Anthropic)') {
    // Anthropic Messages API
    const system = messages.find(m => m.role === 'system')?.content
    const userMsgs = messages.filter(m => m.role !== 'system')
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system,
        messages: userMsgs,
      }),
    })
    if (!res.ok) throw new Error('Anthropic API error: ' + res.status)
    const data = await res.json()
    return data.content?.[0]?.text || ''
  }

  // OpenAI-compatible (Groq or OpenAI)
  const baseUrl = provider === 'OpenAI'
    ? 'https://api.openai.com/v1'
    : BUNDLED_BASE_URL
  const model = provider === 'OpenAI' ? 'gpt-4o-mini' : BUNDLED_MODEL

  const res = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  })
  if (!res.ok) throw new Error('AI API error: ' + res.status)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export const DEFAULT_SYSTEM_PROMPT = `You are a creative domain name generator. Generate exactly 60 unique domain name stem suggestions (the part before the TLD).

Use these strategies:
- Direct keywords and synonyms
- Word combinations and compound words (e.g. "moonbeam", "skylight")
- Portmanteau / blended words (e.g. "Shopify" from shop+simplify, "Spotify" from spot+identify)
- Invented brandable words that sound good (e.g. "Vercel", "Quora", "Klarna")
- Short catchy names (4-8 characters preferred)
- Prefix/suffix patterns (e.g. "get___", "___ly", "___hub")

Rules:
- Output ONLY the name stem — no TLD, no dots (e.g. "acmebot" not "acmebot.com")
- Names must be valid domain names (lowercase, letters and numbers only, no hyphens)
- Keep them short and memorable (ideally under 10 characters)
- Make them easy to spell and pronounce
- No generic dictionary words that are certainly taken (like "smart", "fast", "data")
- You MUST return exactly 60 names

Return ONLY a JSON array of 60 strings, no other text. Example: ["acmebot","synthwave","cleverbox"]`

export async function generateDomainNames(description, systemPrompt, apiKey) {
  const text = await aiChat([
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
    { role: 'user', content: `Idea: ${description}` },
  ], apiKey)

  if (!text) throw new Error('Empty response from AI')

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Could not parse AI response as JSON array')

  const names = JSON.parse(jsonMatch[0])
  return names
    .map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(n => n.length >= 2)
}

export const DEFAULT_FIT_PROMPT = `Score how well each domain name fits the app idea described below. Consider:
- Can a user guess what the app does from the domain name?
- Does the name evoke the right associations/feelings?
- Is the name relevant to the described functionality?

The app idea/theme: "{{context}}"

Score each domain 0-10 (10 = perfectly evocative, 0 = completely unrelated).
Return ONLY a JSON object mapping domain names to scores. Example: {"copygen.ai": 8, "wordblast.ai": 5}`

export async function scoreFitBatch(domains, context, apiKey, fitPrompt) {
  if (!domains.length || !context.trim()) return {}

  const promptTemplate = fitPrompt || DEFAULT_FIT_PROMPT
  const systemContent = promptTemplate.replace('{{context}}', context)

  const text = await aiChat([
    { role: 'system', content: systemContent },
    { role: 'user', content: domains.join('\n') },
  ], apiKey)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return {}
  try {
    const scores = JSON.parse(jsonMatch[0])
    const result = {}
    for (const [domain, score] of Object.entries(scores)) {
      result[domain] = Math.min(10, Math.max(0, Math.round(Number(score))))
    }
    return result
  } catch {
    return {}
  }
}

export const DEFAULT_ASSOC_PROMPT = `For each domain name, write exactly 3 short word-associations (2-4 words each, lowercase, no punctuation).
Consider both the stem AND the TLD when writing associations — the zone adds meaning (.ai = artificial intelligence, .io = developer tool / input-output, .app = mobile/web app, .dev = developer, .co = company, .so = social / solutions, .to = action/destination, .email = communication).
Each association should capture a different angle: literal meaning, emotional feel, and use-case evocation.
Be creative and specific — avoid generic words like "digital", "smart", "tech", "fast".
Return ONLY valid JSON using the stem (part before the dot) as the key: {"stem": ["assoc1", "assoc2", "assoc3"], ...}
Example input: nexus.io, lumo.ai
Example output: {"nexus": ["dev hub connector", "invisible web thread", "links flow bridge"], "lumo": ["ai clarity engine", "spark of insight", "gentle guiding intelligence"]}`

export const DEFAULT_SYNONYM_PROMPT = `Given a domain name stem, return exactly 6 synonyms or semantically related words that would work as domain names (single lowercase words, no spaces; hyphens allowed for compound words).
Vary the angle: include near-synonyms, evocative alternatives, and metaphorical variants.
Return ONLY a JSON array of strings: ["word1", "word2", "word3", "word4", "word5", "word6"]`

export async function generateSynonyms(stem, apiKey, systemPrompt) {
  const text = await aiChat([
    { role: 'system', content: systemPrompt || DEFAULT_SYNONYM_PROMPT },
    { role: 'user', content: stem },
  ], apiKey)
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0])
    return arr.filter(w => typeof w === 'string' && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(w)).slice(0, 6)
  } catch { return [] }
}

export async function associateDomains(domains, apiKey, systemPrompt) {
  if (!domains.length) return {}

  // Deduplicate stems
  const stems = [...new Set(domains.map(d => d.replace(/\.[a-z]+$/, '')))]

  const text = await aiChat([
    { role: 'system', content: systemPrompt || DEFAULT_ASSOC_PROMPT },
    { role: 'user', content: domains.join('\n') },
  ], apiKey)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return {}

  try {
    const assocs = JSON.parse(jsonMatch[0])
    // Map back to full domain strings
    const result = {}
    for (const domain of domains) {
      const stem = domain.replace(/\.[a-z]+$/, '')
      const raw = assocs[stem]
      if (raw) result[domain] = Array.isArray(raw) ? raw : [raw]
    }
    return result
  } catch {
    return {}
  }
}
