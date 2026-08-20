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

    // Build the list of dates to check, most recent first.
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
      if (total === 0) continue; // skip days with no traffic, keep response small

      const dayBreakdown = {};
      for (const category of CATEGORIES) {
        const count = (await kv.get(`stats:daily:${date}:${category}`)) || 0;
        if (count > 0) {
          dayBreakdown[category] = count;
          categoryTotals[category] += count;
        }
      }

      // Unique visitors that day: size of the Redis SET for that date.
      const uniqueVisitorsThatDay = await kv.scard(`stats:daily:${date}:unique_visitors`);

      byDate[date] = { total, uniqueVisitors: uniqueVisitorsThatDay || 0, byCategory: dayBreakdown };
      grandTotal += total;
    }

    // Total distinct visitors ever seen, across all time (not just this window).
    const uniqueVisitorsAllTime = await kv.scard("stats:unique_visitors:all_time");

    // Drop zero-count categories from the summary for readability.
    const nonZeroCategoryTotals = Object.fromEntries(
      Object.entries(categoryTotals).filter(([, v]) => v > 0)
    );

    return res.status(200).json({
      range: `last ${numDays} days`,
      total_conversations: grandTotal,
      unique_visitors_all_time: uniqueVisitorsAllTime || 0,
      by_category: nonZeroCategoryTotals,
      by_date: byDate,
      note:
        "Counts are anonymous — no message text or identifying info is ever " +
        "stored. 'total_conversations' counts new chat sessions. " +
        "'unique_visitors' counts distinct browsers via a random, non-identifying " +
        "ID stored locally in each visitor's browser — clearing browser data or " +
        "using a different device will be counted as a new visitor.",
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ error: "Failed to load stats" });
  }
}
