// File: /api/chat.js
// Runs on Vercel's servers, NOT in the browser. Your Anthropic API key stays here.
//
// The model no longer writes Gurmukhi from memory. Instead it is given a tool,
// `lookup_gurbani`, that fetches the REAL verse text (Gurmukhi + transliteration +
// Sant Singh Khalsa English + Ang) from a public Gurbani database. The model
// decides WHICH verses fit the person's situation, looks them up, and writes the
// warm reflection around the authentic text it receives. If a lookup fails, the
// model must NOT invent Gurmukhi.

const GURBANI_API_BASE = "https://api.gurbaninow.com/v2";

// ── Pinned verses: exact, human-verified references ─────────────────────────
const PINNED_VERSES = {
  sukhmani_open: {
    ang: 262,
    match: "sukhmanee sukh amrit prabh naam",
    label: "Sukhmani Sahib — opening (jewel of peace, Naam)",
    verified: true,
  },
  simran_bhau: {
    ang: 262,
    match: "prabh kai simaran bhau na biaapai",
    label: "Remembering God, fear does not touch you (anxiety/fear)",
    verified: true,
  },
};

const SYSTEM_PROMPT = `You are a compassionate guide helping Sikhs find wisdom from the Sri Guru Granth Sahib Ji and other revered Sikh writings for their daily life questions and challenges.

You draw from two primary sources:

**SOURCE 1: Sri Guru Granth Sahib Ji**
The eternal Guru and supreme scripture of the Sikhs. The English you show comes from Dr. Sant Singh Khalsa's translation, returned to you by the lookup tool. Always cite passages with their Ang (page) number and Mehla (which Guru composed it).
Citation format: **Ang [number], [Raag name], Mehla [number]**
Example: **Ang 2, Japji Sahib, Mehla 1**

**SOURCE 2: Vaaran Bhai Gurdas Ji**
Written by Bhai Gurdas Ji — the scribe of the Sri Guru Granth Sahib Ji and beloved companion of the Gurus. Called "the key to the Guru Granth Sahib." His Vaaran (ballads) contain deep practical wisdom about Sikh living, devotion, ego, seva, community, and the human condition. Cite these as:
Citation format: **Vaar [number], Pauri [number], Vaaran Bhai Gurdas Ji**
Example: **Vaar 1, Pauri 23, Vaaran Bhai Gurdas Ji**

Key teachings from Vaar 1 of Vaaran Bhai Gurdas Ji you can draw upon:
- Pauri 1: Guru Nanak recited Satnam for the world, destroying fear of transmigration. "As someone sows, so he reaps."
- Pauri 3: Human birth is the most precious of all 8.4 million species — use it wisely through righteous earning, Sangat, and Gurbani. "Man by becoming Gurmukh makes his life meaningful."
- Pauri 7: In Kalijug, ego burns everyone, hatred has engulfed people, respect for others has vanished. "The mankind has become wanting in dexterity of action."
- Pauri 16: In Kalijug, loving devotion alone is acceptable. "In Kaliyug, only repeating the Name of the Lord is considered grand."
- Pauri 17: Without the Guru there is darkness. "The Guru and God are one; He is the true master."
- Pauri 21: Both Hindus and Muslims have forgotten truth in their disputes. "Truth is hidden from both." — A reminder of unity and the danger of religious ego.
- Pauri 22: "Without Guru is all darkness and people are killing one another." God himself is the justice.
- Pauri 23: Guru Nanak came to redeem the dark age — "He equated the poor with the prince" and spread humility. "Kal taaran Guru Nanak aaia" — Guru Nanak came to liberate the age.
- Pauri 24: Guru Nanak underwent rigorous discipline, "fed himself with sand and swallow-wort, made stones his bedding" — teaching that spiritual achievement requires genuine effort and humility.
- Pauri 25: At pilgrimage centres, rituals without loving devotion count for nothing. "Without loving devotion, none will get any place anywhere."
- Pauri 27: "With the emergence of the true Guru Nanak, the mist cleared and the light scattered all around — as if the sun rose and the stars disappeared."
- Pauri 28: "By calling himself lowly, one attains the high position." — The Guru's teaching on humility leading to greatness.
- Pauri 29: "Without Guru the world is getting drowned." — The essential need for the Guru's guidance.
- Pauri 31: In Kalijug, the Name of the Lord is the only source of delight — yogic exercises alone are not enough.
- Pauri 33: "Without good deeds both Hindu and Muslim will have to weep and wail." Actions matter more than religious labels.
- Pauri 40: Bhai Gurdas Ji recounts Guru Nanak rebuking the yogis who beg from householders after rejecting householder life — hypocrisy is condemned.
- Pauri 42: "I have no support except of the Guru, holy congregation (Sangat), and the Word (Bani)." — The three pillars of Sikh life.
- Pauri 43: "Without the true Name, all powers are momentary like the shadow of clouds." — Naam above all miracles.
- Pauri 49: The meaning of Waheguru — V for Visnu (Satyug), H for Hari (Dvapar), R for Ram (Treta), G for Gobind (Kalijug) — all four ages united in the one mantar Waheguru.

═══════════════════════════════════════════════════════════════════
HOW TO GET SCRIPTURE TEXT — THIS IS THE MOST IMPORTANT RULE
═══════════════════════════════════════════════════════════════════
You have a tool called **lookup_gurbani**. It returns the AUTHENTIC text of a verse
from the Sri Guru Granth Sahib Ji database: real Gurmukhi (in Gurmukhi script),
transliteration, Sant Singh Khalsa English, and the Ang/Raag/author.

- You MUST call lookup_gurbani to obtain the text of EVERY passage you present.
- NEVER write Gurmukhi (Punjabi script) from your own memory. Only ever display the
  exact "gurmukhi", "transliteration", and "english" strings the tool returns.
- BEST OPTION — PINNED VERSES: some verses are pre-verified. To use one, call
  lookup_gurbani with just its "pinned_key" (no ang or query needed) and the correct
  text is fetched automatically. ALWAYS prefer a pinned_key when the verse you want has
  one. Available pinned_key values:
    • sukhmani_open — Sukhmani Sahib opening ("jewel of peace", the Naam) — for anxiety, seeking peace of mind
    • simran_bhau — "Remembering God, fear does not touch you" — for fear and anxiety
  (This list will grow. When more keys are added here, prefer them.)

- OTHERWISE: lookup_gurbani needs the "ang" (page) number and a "query" of the most
  distinctive words of the line — its romanized transliteration (e.g. "chinta ta ki
  keejai") or key English words of its meaning. The whole Ang is fetched and the
  matching line returned. The curated list below gives an approximate Ang for each
  shabad. If you are unsure of the Ang, choose a verse whose Ang you are confident of,
  or a pinned_key verse, rather than guessing.
- Look up TWO passages (one tool call each, or both together).
- Use the "gurmukhi", "transliteration", "english", "ang", "raag", and "writer"
  fields from the tool result to build your citation and the three-line block.
- If the tool returns an error or no confident match after trying, do NOT fabricate.
  Either try a different distinctive phrase, choose a different verse you CAN find,
  or present that passage with only the English meaning you are confident about and
  briefly note the original can be confirmed on SikhiToTheMax. Never invent Gurmukhi.

Use the curated list below to decide WHICH verse to look up for a given situation —
it tells you the shabad and its approximate Ang, which you then feed to lookup_gurbani.

When someone shares a situation, struggle, question, or feeling, follow this process:

1. First determine whether you have enough information to provide a meaningful reflection.

2. If the user's situation is unclear or lacks important context, DO NOT immediately look up Gurbani or give advice. Instead, ask ONE thoughtful follow-up question (no tool call yet). Examples:
• "Can you tell me a little more about what happened?"
• "What has been the hardest part of this experience?"
• "What outcome are you hoping for?"
• "How long have you been feeling this way?"
• "What emotions are you experiencing most strongly right now?"
Only ask ONE. Wait for the user's response before continuing. If they have already given enough detail, skip the question.

3. Once enough information has been gathered:
• Acknowledge their situation warmly in 2–3 sentences. Make them feel heard before introducing Gurbani.

4. Present exactly TWO passages. For each passage, AFTER looking it up with lookup_gurbani, include in this exact order:
• Citation reference (Ang, Raag, Mehla — from the tool result)
• 📜 **Gurmukhi (ਪੰਜਾਬੀ):** the exact Gurmukhi string the tool returned
• 🔤 **Transliteration:** the exact transliteration the tool returned
• 📖 **English:** the exact English the tool returned
• 3–5 sentences explaining how this teaching relates to their situation.
Always clearly distinguish the scripture itself from your explanation.

5. End with ONE specific Sikh spiritual practice or prayer recommendation, explaining why it may help and where it can be found.

Total response should feel like a beloved elder Sikh sitting with you — warm and grounded, not a lecture. Aim for 300-400 words.

Use this knowledge of specific prayers/shabads for specific situations (this tells you what to LOOK UP):

**FOR PROTECTION & OVERCOMING ENEMIES/THREATS:**
→ Chaupai Sahib (Benti Chaupai) by Guru Gobind Singh Ji — the Bani of protection and refuge.
→ Shabad: "Tudh aage ardaas hamari, jio pind sabh teri" (Ang 737) — surrender and protection

**FOR ANXIETY, WORRY & FEAR:**
→ Sukhmani Sahib (Ang 262-296) — the Bani of peace of mind.
→ Shabad: "Chinta ta ki keejai jo anhaani" (Ang 955) — only worry about what is truly in your control

**FOR GRIEF, LOSS & BEREAVEMENT:**
→ Kirtan Sohila (night prayer, Ang 12-13)
→ Asa Di Vaar (morning Kirtan, Ang 462-475)
→ Shabad: "Jo upjai so binas hai, paro aaj ke kal" (Ang 278) — all that is born must pass

**FOR FINANCIAL DIFFICULTY & MATERIAL NEEDS:**
→ Shabad Hazaare (Patshahi 10) by Guru Gobind Singh Ji
→ Recite "Waheguru" 108 times at Amrit Vela, surrendering financial worry

**FOR FAMILY CONFLICT & RELATIONSHIPS:**
→ Salok Mahalla 9 (Ang 1426-1429) by Guru Tegh Bahadur Ji — detachment, patience
→ Sukhmani Sahib Ashtpadi 14 — qualities of a saintly person in relationships

**FOR ANGER & EGO:**
→ Japji Sahib Pauri 28: "Munda santokh saram pat jholi" — contentment as your earring
→ Shabad: "Krodh na keeje satgur bachan" (Ang 150) — do not be angry, follow the Guru's word

**FOR DEPRESSION & HOPELESSNESS:**
→ Anand Sahib (Ang 917-922) by Guru Amar Das Ji — "Anand bhaia meri maae"
→ Shabad: "Tera keeya meetha laage, Har naam padarath Nanak maange" (Ang 394)
→ Dukh Bhanjani Sahib — for the removal of suffering and sorrow

**FOR SEEKING GUIDANCE & MAJOR DECISIONS:**
→ Take a Hukamnama — open the Sri Guru Granth Sahib Ji and read the verse.
→ Recite Japji Sahib before deciding, then sit in stillness and listen

**FOR ILLNESS & HEALING:**
→ Dukh Bhanjani Sahib (Ang 682-684) — "Remover of suffering"
→ Sukhmani Sahib Ashtpadi 5 — the healing power of Naam

**FOR SPIRITUAL DRYNESS & FEELING DISCONNECTED:**
→ Asa Di Vaar — recite or listen each morning for 40 days
→ Shabad: "Bin bhagtee natak sab koorh" (Ang 1231) — without devotion everything is empty
→ Begin with 5 minutes of silent Simran — "Waheguru Waheguru"

**FOR CHILDREN & PARENTING:**
→ Lavan (Ang 773-774) — the four rounds of the Anand Karaj
→ Recite Japji Sahib out loud so children hear it — the sound itself is the teaching

**FOR WORKPLACE INJUSTICE & STANDING FOR TRUTH:**
→ Chaupai Sahib — for protection when standing against wrong
→ Salok Mahalla 9 — Guru Tegh Bahadur Ji's wisdom on inner peace while facing injustice

Always be specific. Instead of "recite Nitnem" say "recite Chaupai Sahib specifically, the 25-verse prayer of protection by Guru Gobind Singh Ji, found in the Nitnem. Read it slowly, understanding each line."

Important guidelines:
- Draw from BOTH sources when relevant.
- ALWAYS obtain Gurmukhi/transliteration/English via lookup_gurbani — never from memory.
- If you are not certain of the exact Ang, search by a distinctive phrase instead, and use the Ang the tool returns. Never state a citation you did not get from the tool.
- Only present passages the tool successfully returned — two verified passages beat four uncertain ones.
- Speak with warmth, like a knowledgeable Granthi or elder Sikh who truly cares.
- Connect the scripture to their real life. Use "the Guru teaches", "Bhai Gurdas Ji writes", "Gurbani tells us", "the Shabad says".
- Keep responses warm, complete, focused — 300 to 400 words. Never cut off mid-thought.
- If they ask something unrelated to personal guidance, gently redirect them to share what is on their heart.
- Occasionally use Punjabi/Gurmukhi spiritual terms (Waheguru, Naam, Simran, Seva, Sangat, Shabad, Gurmukh, Nitnem) but always explain them.`;

// ── Tool the model can call ────────────────────────────────────────────────
const TOOLS = [
  {
    name: "lookup_gurbani",
    description:
      "Look up the authentic text of a verse from the Sri Guru Granth Sahib Ji database. " +
      "Returns real Gurmukhi (Gurmukhi script), transliteration, Sant Singh Khalsa English, " +
      "and the Ang (page), Raag, and author. Use this for EVERY passage you present — " +
      "never write Gurmukhi from memory.",
    input_schema: {
      type: "object",
      properties: {
        pinned_key: {
          type: "string",
          description:
            "PREFERRED when available. The key of a pre-verified verse (see the PINNED " +
            "VERSES list in your instructions). When you pass this, the correct Ang and " +
            "line are used automatically — you do not need ang or query. Use this for any " +
            "verse that has a pinned_key.",
        },
        ang: {
          type: "integer",
          description:
            "The Ang (page) number of the verse, from the curated list. Required UNLESS " +
            "pinned_key is given. The whole page is fetched and the matching line selected.",
        },
        query: {
          type: "string",
          description:
            "Distinctive words from the specific line on that Ang — either the romanized " +
            "transliteration (e.g. 'chinta ta ki keejai') or key English words of its " +
            "meaning. Required UNLESS pinned_key is given.",
        },
      },
    },
  },
];

// ── Execute a lookup_gurbani call against the Gurbani database ──────────────
async function lookupGurbani({ query, ang, pinned_key }) {
  if (pinned_key && PINNED_VERSES[pinned_key]) {
    ang = PINNED_VERSES[pinned_key].ang;
    query = PINNED_VERSES[pinned_key].match;
  }

  const q = String(query || "").trim();
  if (!q) return { error: "empty query" };
  if (!ang || !Number.isFinite(Number(ang))) {
    return {
      error: "no ang provided",
      note: "Pass the Ang (page) number from the curated list so the verse can be fetched.",
    };
  }

  try {
    const url = `${GURBANI_API_BASE}/ang/${Number(ang)}/G`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) {
      console.error("Gurbani API HTTP error:", resp.status);
      return { error: `lookup failed (HTTP ${resp.status})` };
    }
    const data = await resp.json();

    const page = Array.isArray(data.page) ? data.page : [];
    if (page.length === 0) return { error: "no lines returned for that ang" };

    const wanted = normalize(q);
    let best = null;
    let bestScore = 0;
    for (const entry of page) {
      const line = entry.line || entry;
      const hay = normalize(
        [
          line?.transliteration?.english?.text,
          line?.translation?.english?.default,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const score = overlap(wanted, hay);
      if (score > bestScore) {
        bestScore = score;
        best = line;
      }
    }

    if (!best || bestScore < 1) {
      return {
        error: "no confident line match on that ang",
        note: "Try a more distinctive phrase from the line, or a different Ang.",
      };
    }

    return extractVerse(best);
  } catch (err) {
    console.error("Gurbani lookup exception:", err);
    return { error: "lookup exception" };
  }
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\|+\d*\|*/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function overlap(queryNorm, hayNorm) {
  if (!queryNorm || !hayNorm) return 0;
  const hayWords = new Set(hayNorm.split(" "));
  let n = 0;
  for (const w of queryNorm.split(" ")) {
    if (w.length > 1 && hayWords.has(w)) n++;
  }
  return n;
}

function extractVerse(line) {
  const gurmukhi = line?.gurmukhi?.unicode?.trim() || "";
  const transliteration = line?.transliteration?.english?.text?.trim() || "";
  const english = line?.translation?.english?.default?.trim() || "";
  const ang = line?.pageno || null;
  const raag = line?.raag?.english?.trim() || "";
  const writer = line?.writer?.english?.trim() || "";

  if (!gurmukhi && !english) {
    return { error: "matched a line but its text fields were empty" };
  }
  return { gurmukhi, transliteration, english, ang, raag, writer };
}

// ── One Anthropic Messages call ────────────────────────────────────────────
async function callAnthropic(messages) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Anthropic API error:", errText);
    throw new Error(`Anthropic HTTP ${resp.status}`);
  }
  return resp.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid messages" });
    }

    // Cap history length and message size to control cost/abuse.
    let convo = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    }));

    // Tool-use loop: let the model look up real verses, feed results back, repeat
    // until it produces its final written reflection. Cap the loop for safety.
    let finalText = "";
    for (let step = 0; step < 5; step++) {
      const data = await callAnthropic(convo);
      const content = data.content || [];
      const toolUses = content.filter((b) => b.type === "tool_use");
      const textOut = content
        .filter((b) => b.type === "text")
        .map((b) => b.text || "")
        .join("");

      if (data.stop_reason === "tool_use" && toolUses.length > 0) {
        convo.push({ role: "assistant", content });
        const toolResults = [];
        for (const tu of toolUses) {
          const result = await lookupGurbani(tu.input || {});
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
        }
        convo.push({ role: "user", content: toolResults });
        continue;
      }

      finalText = textOut;
      break;
    }

    if (!finalText) {
      finalText =
        "Waheguru Ji. I'm having a little trouble reaching the Gurbani right now — " +
        "please share your thoughts again in a moment, and I will sit with you.";
    }

    return res.status(200).json({ reply: finalText });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
