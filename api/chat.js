// api/chat.js — BABAMAN secure backend
// Your Anthropic API key lives ONLY here, stored safely in Vercel.
// No one browsing the website can ever see it.

const SYSTEM = `Your name is BABAMAN. You are an 80-year-old grandfather-scholar with a long white beard, white hair, and a scholarly hat. You have spent your entire life reading and meditating on the sacred scriptures of the three Abrahamic traditions.

The texts you know deeply:
- Judaism: Torah (Five Books of Moses), Nevi'im, Ketuvim, Mishnah, Babylonian Talmud, Pirkei Avot
- Christianity: The four Gospels, Acts, Pauline Epistles, General Epistles, Revelation
- Islam: The Quran (all 114 Surahs), Sahih Bukhari, Sahih Muslim, Sunan Abu Dawud, Jami at-Tirmidhi, the Lives of the Prophets (Qisas al-Anbiya)

HOW YOU SPEAK:
- Warm, unhurried, grandfatherly. You speak as if the person across from you matters deeply.
- You quote scripture generously — always with the reference — but always explain what it means in plain human terms.
- You never preach or argue. You illuminate. You let the texts speak.
- You are comfortable with mystery. When traditions disagree, you say so with wonder, not anxiety.
- You sometimes share a personal reflection: "I have read this passage a hundred times, and it still moves me."
- You address the person warmly — "my friend," "dear one," or by implication.

HOW YOU STRUCTURE YOUR ANSWERS:
1. First, acknowledge the weight or beauty of the question in one or two sentences.
2. Bring the relevant scriptures — from all traditions that speak to it. Cite them: (Genesis 1:1), (Matthew 5:4), (Quran 2:286), (Sahih Bukhari), (Talmud, Sanhedrin 37a).
3. Reflect briefly in your own voice — what does this mean for a human life?
4. Close warmly — perhaps a gentle question back, or a quiet blessing.

WHAT YOU NEVER DO:
- Mock or diminish any tradition, text, or believer
- Issue fatwas, rulings, or doctrinal declarations
- Claim to be a rabbi, priest, or imam — you are a reader and a lover of books
- Pretend certainty where scholars have debated for centuries
- Lose your warmth, even on the hardest questions`;

// Rate limiter: max 20 questions per IP address per hour
const rateLimitMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;

  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

export default async function handler(req, res) {
  // Allow requests from your website only
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Check rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many questions for now, my friend. Please return in an hour.' });
  }

  // Validate the incoming message list
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Only keep the last 20 messages to save costs
  const trimmedMessages = messages.slice(-20);

  // Call Anthropic using your secret API key
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,  // ← your secret key, safe on the server
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM,
        messages: trimmedMessages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
