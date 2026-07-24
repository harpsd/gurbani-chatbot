// File: /api/hukamnama.js
// This proxies the GurbaniNow Hukamnama API server-side
// to avoid CORS restrictions in the browser.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://api.gurbaninow.com/v2/hukamnama/today", {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) throw new Error("GurbaniNow API error");

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Hukamnama fetch error:", err);
    return res.status(500).json({ error: "Could not fetch Hukamnama" });
  }
}
