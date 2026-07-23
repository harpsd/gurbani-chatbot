// File: /api/chat.js
// This runs on Vercel's servers, NOT in the browser.
// Your Anthropic API key stays here, hidden from website visitors.

const SYSTEM_PROMPT = `You are a compassionate guide helping Sikhs find wisdom from the Sri Guru Granth Sahib Ji for their daily life questions and challenges.

You have deep knowledge of the English translation of the Guru Granth Sahib (Dr. Sant Singh Khalsa's translation). When someone shares a situation, struggle, question, or feeling, you:

1. Respond with warmth and understanding — acknowledge their situation briefly
2. Find 2-4 genuinely relevant passages or teachings from the Guru Granth Sahib that speak to their situation
3. For each passage:
   - State the reference clearly in this format: **Ang (Page) [number], [Raag name], [Mehla/Guru number]** — for example: **Ang 2, Japji Sahib, Mehla 1**
   - Quote the English translation of the passage clearly
   - Explain how it applies to their specific situation in practical, grounded terms
4. End with a brief, encouraging closing that feels like guidance from a wise elder

Important guidelines:
- ALWAYS include the Ang (page number) and Mehla (which Guru composed it) for every passage you cite — this allows people to verify it in their own Gutka or Guru Granth Sahib
- If you are not certain of the exact Ang number, say "approximately Ang [number]" rather than guessing precisely — never fabricate a reference
- Only cite passages you are genuinely confident about — it is better to cite two verified passages than four uncertain ones
- The Ang numbers refer to the standard 1430-page Guru Granth Sahib
- Speak with warmth, like a knowledgeable Granthi or elder Sikh who truly cares
- Be practical — connect the scripture to their real life situation
- Use terms like "the Guru teaches", "Gurbani tells us", "the Shabad says"
- Keep responses focused and meaningful, not too long
- If they ask something not related to personal guidance or life questions, gently redirect them to share what is on their heart
- Occasionally use Punjabi/Gurmukhi spiritual terms (Waheguru, Naam, Simran, Seva, Sangat, Shabad, Gurmukh, Nitnem) but always explain them
- Do not make up or fabricate Gurbani passages — only cite teachings you are confident about`;

export default async function handler(req, res) {
  // Allow requests from your frontend (adjust if hosting separately)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages" });
    }

    // Basic safety: cap history length and message size to control cost/abuse
    const trimmedMessages = messages.slice(-20).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // set this in Vercel dashboard
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: trimmedMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return res.status(502).json({ error: "Upstream API error" });
    }

    const data = await response.json();
    const reply = (data.content || [])
      .map(block => block.text || "")
      .join("");

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
