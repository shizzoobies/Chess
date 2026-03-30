// Stockfish UCI bridge
// Loads Stockfish WASM locally (no CDN), communicates via postMessage

class StockfishEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.resolvers = [];
    this.bestMoveResolver = null;
    this.skillLevel = 20; // 0-20, 20 = maximum strength
    this.onReady = null;
  }

  load() {
    return new Promise((resolve, reject) => {
      try {
        // Use locally served Stockfish — prefer WASM (faster), fallback to pure JS
        const wasmSupported = typeof WebAssembly === 'object' && WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
        this.worker = new Worker(wasmSupported ? '/stockfish/stockfish.wasm.js' : '/stockfish/stockfish.js');

        this.worker.onmessage = (e) => {
          const line = e.data;
          if (typeof line !== 'string') return;

          // Wait for uciok before sending isready
          if (line === 'uciok') {
            this.worker.postMessage('isready');
          }

          // Engine ready
          if (line === 'readyok') {
            this.ready = true;
            if (this.resolvers.length) {
              this.resolvers.forEach(r => r());
              this.resolvers = [];
            }
            resolve();
            if (this.onReady) this.onReady();
          }

          // Best move response
          if (line.startsWith('bestmove') && this.bestMoveResolver) {
            const parts = line.split(' ');
            const move = parts[1];
            const resolver = this.bestMoveResolver;
            this.bestMoveResolver = null;
            resolver(move && move !== '(none)' ? move : null);
          }
        };

        this.worker.onerror = (err) => {
          console.error('Stockfish worker error:', err);
          reject(err);
        };

        // Init UCI — wait for 'uciok' before sending options
        this.worker.postMessage('uci');

      } catch (err) {
        reject(err);
      }
    });
  }

  setSkillLevel(level) {
    // level 0-20
    this.skillLevel = Math.max(0, Math.min(20, level));
    if (!this.worker) return;
    this.worker.postMessage(`setoption name Skill Level value ${this.skillLevel}`);
  }

  getBestMove(fen, moveTimeMs = 1500) {
    return new Promise((resolve) => {
      if (!this.worker || !this.ready) { resolve(null); return; }
      this.bestMoveResolver = resolve;
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${moveTimeMs}`);
    });
  }

  // Get best move at full strength for hints (regardless of difficulty setting)
  getBestMoveFullStrength(fen, moveTimeMs = 2000) {
    return new Promise((resolve) => {
      if (!this.worker || !this.ready) { resolve(null); return; }
      // Temporarily remove skill limit
      this.worker.postMessage('setoption name UCI_LimitStrength value false');
      this.worker.postMessage('setoption name Skill Level value 20');
      this.bestMoveResolver = (move) => {
        // Restore skill level after
        this.setSkillLevel(this.skillLevel);
        resolve(move);
      };
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go movetime ${moveTimeMs}`);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

// Convert Stockfish UCI move (e.g. "e2e4", "e1g1") to our internal format
function uciToMove(uciStr, board, ep, cas) {
  if (!uciStr || uciStr.length < 4) return null;
  const [fr, fc] = fromAlg(uciStr.slice(0, 2));
  const [tr, tc] = fromAlg(uciStr.slice(2, 4));
  const promo = uciStr[4] || null;

  // Find matching legal move
  const moves = allLegalMoves(board, pieceCol(board[fr][fc]), ep, cas);
  const match = moves.find(m => m.fr===fr && m.fc===fc && m.tr===tr && m.tc===tc);
  if (!match) return null;
  if (promo) match.promo = promo.toUpperCase();
  return match;
}
