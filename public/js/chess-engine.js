// ── Piece maps ────────────────────────────────────────────────────────────────
const PIECES = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};
const PIECE_FEN = {
  wK:'K',wQ:'Q',wR:'R',wB:'B',wN:'N',wP:'P',
  bK:'k',bQ:'q',bR:'r',bB:'b',bN:'n',bP:'p'
};
const FEN_PIECE = {};
Object.entries(PIECE_FEN).forEach(([k,v]) => FEN_PIECE[v] = k);

const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR']
];

const deepCopy = b => b.map(r => r.map(c => c));
const inBounds  = (r,c) => r>=0 && r<8 && c>=0 && c<8;
const pieceCol  = p => p ? p[0] : null;
const toAlg     = (r,c) => String.fromCharCode(97+c) + (8-r);
const fromAlg   = s => [8 - parseInt(s[1]), s.charCodeAt(0) - 97];

function rawMoves(b, r, c, ep, cas) {
  const p = b[r][c]; if (!p) return [];
  const col = p[0], type = p[1], moves = [];
  const push = (tr, tc, extra) => { if (inBounds(tr,tc)) moves.push({tr,tc,...(extra||{})}); };

  if (type === 'P') {
    const dir = col==='w' ? -1 : 1, startRow = col==='w' ? 6 : 1;
    if (inBounds(r+dir,c) && !b[r+dir][c]) {
      push(r+dir, c);
      if (r===startRow && !b[r+2*dir][c]) push(r+2*dir, c);
    }
    for (const dc of [-1,1]) {
      if (!inBounds(r+dir, c+dc)) continue;
      if (b[r+dir][c+dc] && pieceCol(b[r+dir][c+dc]) !== col) push(r+dir, c+dc);
      else if (ep && r+dir===ep[0] && c+dc===ep[1]) push(r+dir, c+dc, {ep:true});
    }
  } else if (type === 'N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const tr=r+dr, tc=c+dc;
      if (inBounds(tr,tc) && pieceCol(b[tr][tc]) !== col) push(tr,tc);
    }
  } else if (type === 'K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const tr=r+dr, tc=c+dc;
      if (inBounds(tr,tc) && pieceCol(b[tr][tc]) !== col) push(tr,tc);
    }
    if (cas) {
      const row = col==='w' ? 7 : 0;
      if (r===row && c===4) {
        if (cas[col+'K'] && !b[row][5] && !b[row][6] && b[row][7]===col+'R') push(row,6,{castle:'K'});
        if (cas[col+'Q'] && !b[row][3] && !b[row][2] && !b[row][1] && b[row][0]===col+'R') push(row,2,{castle:'Q'});
      }
    }
  } else {
    const dirs = {
      B:[[-1,-1],[-1,1],[1,-1],[1,1]],
      R:[[-1,0],[1,0],[0,-1],[0,1]],
      Q:[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
    };
    for (const [dr,dc] of dirs[type]) {
      let tr=r+dr, tc=c+dc;
      while (inBounds(tr,tc)) {
        if (b[tr][tc]) { if (pieceCol(b[tr][tc]) !== col) push(tr,tc); break; }
        push(tr,tc); tr+=dr; tc+=dc;
      }
    }
  }
  return moves;
}

function applyMove(b, move, ep, cas) {
  const nb = deepCopy(b);
  const {fr,fc,tr,tc} = move;
  const p = nb[fr][fc];
  nb[fr][fc] = null;
  let newEp = null, newCas = {...cas};
  if (move.castle) {
    const row = fr;
    if (move.castle==='K') { nb[row][5]=nb[row][7]; nb[row][7]=null; }
    else                   { nb[row][3]=nb[row][0]; nb[row][0]=null; }
  }
  if (move.ep) nb[fr][tc] = null;
  if (p && p[1]==='P' && Math.abs(tr-fr)===2) newEp = [(fr+tr)/2, tc];
  if (p==='wK') { newCas.wK=false; newCas.wQ=false; }
  if (p==='bK') { newCas.bK=false; newCas.bQ=false; }
  if (p==='wR' && fr===7 && fc===0) newCas.wQ=false;
  if (p==='wR' && fr===7 && fc===7) newCas.wK=false;
  if (p==='bR' && fr===0 && fc===0) newCas.bQ=false;
  if (p==='bR' && fr===0 && fc===7) newCas.bK=false;
  let placed = p;
  if (p && p[1]==='P' && (tr===0||tr===7)) placed = p[0]+'Q';
  nb[tr][tc] = placed;
  return {board:nb, ep:newEp, castling:newCas};
}

function kingPos(b, col) {
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) if (b[r][c]===col+'K') return [r,c];
  return null;
}
function isAttacked(b, r, c, byCol) {
  for (let br=0; br<8; br++) for (let bc=0; bc<8; bc++) {
    if (pieceCol(b[br][bc])===byCol)
      if (rawMoves(b,br,bc,null,null).some(m=>m.tr===r&&m.tc===c)) return true;
  }
  return false;
}
function inCheck(b, col) {
  const kp = kingPos(b, col);
  return kp && isAttacked(b, kp[0], kp[1], col==='w'?'b':'w');
}

function legalMovesFor(b, r, c, ep, cas) {
  const p = b[r][c]; if (!p) return [];
  const col = p[0];
  return rawMoves(b,r,c,ep,cas).filter(m => {
    if (m.castle) {
      const row=r, opp=col==='w'?'b':'w';
      if (isAttacked(b,row,4,opp)) return false;
      if (isAttacked(b,row,m.castle==='K'?5:3,opp)) return false;
    }
    const res = applyMove(b, {fr:r,fc:c,...m}, ep, cas);
    return !inCheck(res.board, col);
  });
}

function allLegalMoves(b, col, ep, cas) {
  const moves = [];
  for (let r=0; r<8; r++) for (let c=0; c<8; c++) {
    if (pieceCol(b[r][c])===col)
      legalMovesFor(b,r,c,ep,cas).forEach(m => moves.push({fr:r,fc:c,...m}));
  }
  return moves;
}

function boardToFEN(b, turn, cas, ep, hm, fm) {
  let fen = '';
  for (let r=0; r<8; r++) {
    let empty = 0;
    for (let c=0; c<8; c++) {
      const p = b[r][c];
      if (!p) { empty++; }
      else { if (empty) { fen+=empty; empty=0; } fen+=PIECE_FEN[p]; }
    }
    if (empty) fen+=empty;
    if (r<7) fen+='/';
  }
  let c='';
  if (cas.wK) c+='K'; if (cas.wQ) c+='Q';
  if (cas.bK) c+='k'; if (cas.bQ) c+='q';
  if (!c) c='-';
  return `${fen} ${turn==='w'?'w':'b'} ${c} ${ep?toAlg(ep[0],ep[1]):'-'} ${hm} ${fm}`;
}

function moveToSAN(b, move) {
  const p = b[move.fr][move.fc]; if (!p) return '';
  const type = p[1];
  if (move.castle) return move.castle==='K' ? 'O-O' : 'O-O-O';
  let san = type!=='P' ? type : '';
  const capture = b[move.tr][move.tc] || move.ep;
  if (type==='P' && capture) san += String.fromCharCode(97+move.fc);
  if (capture) san += 'x';
  san += toAlg(move.tr, move.tc);
  if (p[1]==='P' && (move.tr===0||move.tr===7)) san += '=Q';
  return san;
}

// Build PGN string from move history
function buildPGN(history) {
  let pgn = '';
  history.forEach((entry, i) => {
    if (i % 2 === 0) pgn += `${Math.floor(i/2)+1}. `;
    pgn += entry.san + ' ';
  });
  return pgn.trim();
}
