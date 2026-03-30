require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const hasApiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here';
let anthropic = null;

if (hasApiKey) {
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else {
  console.warn('\n⚠  ANTHROPIC_API_KEY not set — Stockfish will work, but Claude commentary/hints/analysis will be disabled.');
  console.warn('   Add your key to .env to enable AI commentary.\n');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));


// ── Commentary endpoint ───────────────────────────────────────────────────────
// Called after Stockfish plays a move. Returns a 1-2 sentence explanation.
app.post('/api/commentary', async (req, res) => {
  if (!anthropic) return res.json({ commentary: '' });
  const { fen, move, moveSAN, moveNumber, pgn } = req.body;
  if (!fen || !move) return res.status(400).json({ error: 'Missing fen or move' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `You are a chess grandmaster commentator. When given a chess position and the move just played, write 1-2 sentences of insightful commentary explaining WHY the move was played — the strategic or tactical idea behind it. Be specific and educational. Never just describe what happened — explain the idea. Keep it under 30 words. No filler phrases like "This move..." or "Stockfish plays...". Start directly with the insight.`,
      messages: [{
        role: 'user',
        content: `Position (FEN): ${fen}\nMove played: ${moveSAN} (${move})\nMove number: ${moveNumber}\n\nExplain this move in 1-2 sentences.`
      }]
    });

    res.json({ commentary: message.content[0].text.trim() });
  } catch (err) {
    console.error('Commentary error:', err.message);
    res.status(500).json({ error: 'Commentary failed' });
  }
});

// ── Hint endpoint ─────────────────────────────────────────────────────────────
// Stockfish already found the best move — Claude explains WHY it's good.
app.post('/api/hint', async (req, res) => {
  if (!anthropic) return res.json({ explanation: '', move: req.body.bestMove, san: req.body.bestMoveSAN });
  const { fen, bestMove, bestMoveSAN } = req.body;
  if (!fen || !bestMove) return res.status(400).json({ error: 'Missing fields' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You are a chess coach. Explain why a specific move is the best in the current position. Be clear and educational — explain the idea, threat, or positional concept. Keep it under 40 words. Speak directly to the player ("This move..." or "Playing here...").`,
      messages: [{
        role: 'user',
        content: `Position (FEN): ${fen}\nBest move: ${bestMoveSAN} (${bestMove})\n\nWhy is this the best move here?`
      }]
    });

    res.json({ explanation: message.content[0].text.trim(), move: bestMove, san: bestMoveSAN });
  } catch (err) {
    console.error('Hint error:', err.message);
    res.status(500).json({ error: 'Hint failed' });
  }
});

// ── Post-game analysis endpoint ───────────────────────────────────────────────
app.post('/api/analysis', async (req, res) => {
  if (!anthropic) return res.json({ analysis: 'API key not configured. Add ANTHROPIC_API_KEY to .env for post-game analysis.' });
  const { pgn, result, playerColor, moveCount } = req.body;
  if (!pgn) return res.status(400).json({ error: 'Missing pgn' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      system: `You are a grandmaster-level chess coach providing post-game analysis. Be concise, specific, and actionable. Structure your response with these exact sections:
**Key Moments** — 2-3 critical turning points in the game
**What Went Well** — genuine strengths shown
**Areas to Improve** — specific weaknesses to work on
**Lesson** — one concrete takeaway to practice

Keep total response under 150 words. Be direct and honest.`,
      messages: [{
        role: 'user',
        content: `Game PGN:\n${pgn}\n\nResult: ${result}\nPlayer was: ${playerColor}\nTotal moves: ${moveCount}\n\nProvide post-game analysis.`
      }]
    });

    res.json({ analysis: message.content[0].text.trim() });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n♟  Claude Chess GM running at http://localhost:${PORT}`);
  console.log(`   Stockfish: runs in browser (free, no API calls)`);
  console.log(`   Claude:    commentary, hints, post-game analysis\n`);
});
