// File: /api/stats.js
// Read-only dashboard for the anonymous usage counters written by /api/chat.js.
// Shows how many conversations started, broken down by topic category, per day.
// No message text or identifiers are stored anywhere, so there's nothing sensitive
// to protect here beyond keeping the number itself from being public — hence the
// simple secret-key check below.
//
// Set an env var STATS_SECRET to any random string you choose, then view stats at:
//   https://yourapp.vercel.app/api/stats?key=YOUR_SECRET
//
// Optional: &days=30 to control how many past days to include (default 14).

import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CATEGORIES = [
  "protection",
  "anxiety",
  "grief",
  "financial",
  "family",
  "anger",
  "depression",
  "guidance",
  "illness",
  "spiritual_dryness",
  "children",
  "workplace",
  "other",
];

export default async function handler(req, res) {
  const { key, days } = req.query;

  if (!process.env.STATS_SECRET || key !== process.env.STATS_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const numDays = Math.min(Math.max(parseInt(days) || 14, 1), 90);

    const dates = [];
    for (let i = 0; i < numDays; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const byDate = {};
    let grandTotal = 0;
    const categoryTotals = {};
    for (const c of CATEGORIES) categoryTotals[c] = 0;

    for (const date of dates) {
      const total = (await kv.get(`stats:daily:${date}:total`)) || 0;
      if (total === 0) continue;

      const dayBreakdown = {};
      for (const category of CATEGORIES) {
        const count = (await kv.get(`stats:daily:${date}:${category}`)) || 0;
        if (count > 0) {
          dayBreakdown[category] = count;
          categoryTotals[category] += count;
        }
      }

      byDate[date] = { total, byCategory: dayBreakdown };
      grandTotal += total;
    }

    const nonZeroCategoryTotals = Object.fromEntries(
      Object.entries(categoryTotals).filter(([, v]) => v > 0)
    );

    return res.status(200).json({
      range: `last ${numDays} days`,
      total_conversations: grandTotal,
      by_category: nonZeroCategoryTotals,
      by_date: byDate,
      note:
        "Counts are anonymous — no message text, session IDs, or identifiers are " +
        "ever stored. Each count is one new conversation, classified by simple " +
        "keyword matching on the opening message only.",
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Failed to load stats" });
  }
}
