/* ============================================================
   공통 헬퍼 라이브러리 — 모든 챕터 페이지가 <script src> 로 로드.
   전역 네임스페이스 VZ 에 함수 제공.
   ============================================================ */
(function (global) {
  'use strict';

  // ---- 숫자 포맷 ----
  const fmt = (n, d = 2) => {
    if (!isFinite(n)) return '∞';
    const r = Number(n).toFixed(d);
    return Object.is(parseFloat(r), -0) ? (0).toFixed(d) : r;
  };

  // ---- 벡터/행렬 연산 ----
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  // 행벡터 v(1×n) × 행렬 W(n×m) → out(1×m).  out_j = Σ_i v_i·W[i][j]
  const vecMat = (v, W) => W[0].map((_, j) => +v.reduce((s, x, i) => s + x * W[i][j], 0).toFixed(4));
  // 행렬 A(p×n) × 행렬 B(n×m) → (p×m)
  const matMul = (A, B) =>
    A.map(row => B[0].map((_, j) => +row.reduce((s, x, k) => s + x * B[k][j], 0).toFixed(4)));
  const transpose = M => M[0].map((_, j) => M.map(r => r[j]));

  // ---- softmax (수치 안정 버전) ----
  const softmax = (arr) => {
    const m = Math.max(...arr);
    const ex = arr.map(x => Math.exp(x - m));
    const s = ex.reduce((a, b) => a + b, 0) || 1;
    return ex.map(e => e / s);
  };

  // ---- 색상 팔레트 (단어/시리즈용) ----
  const PALETTE = ['#60a5fa', '#fbbf24', '#94a3b8', '#34d399', '#f472b6', '#c084fc', '#fb7185', '#37bdf8'];

  /* ============================================================
     mxMatrix: 행렬을 대괄호+라벨+shape 로 그리는 HTML 문자열 생성
     data    : 2차원 배열
     opts:
       rowLabs : 좌측 행 라벨 배열 (string, HTML 허용)
       colLabs : 상단 열 라벨 배열
       acc     : 대괄호 색 (CSS color / var)
       title   : 상단 제목
       shape   : 하단 shape 텍스트 (예 '[4×3]')
       hlRow   : 강조할 행 인덱스 (-1=없음)
       hlCol   : 강조할 열 인덱스
       pct     : true면 값을 ×100 정수%로 표시
       fmtCell : (v,r,c)=>string  커스텀 셀 포맷
       zeroDim : true면 0을 흐리게(zero 클래스)
     ============================================================ */
  function mxMatrix(data, opts = {}) {
    const {
      rowLabs = [], colLabs = [], acc = 'var(--line)', title = '', shape = '',
      hlRow = -1, hlCol = -1, pct = false, fmtCell = null, zeroDim = false
    } = opts;
    const cols = data[0].length;
    const tmpl = `grid-template-columns:repeat(${cols},50px)`;
    const head = colLabs.length
      ? `<div class="mx-colhead" style="${tmpl}">${colLabs.map(c => `<div class="h">${c}</div>`).join('')}</div>`
      : '';
    const grid = `<div class="mx-grid" style="${tmpl}">` +
      data.map((row, r) => row.map((v, c) => {
        const cls = [
          'mx-cell',
          (r === hlRow || c === hlCol) ? 'hl' : '',
          (zeroDim && v === 0) ? 'zero' : ''
        ].filter(Boolean).join(' ');
        const txt = fmtCell ? fmtCell(v, r, c) : (pct ? Math.round(v * 100) : fmt(v));
        return `<div class="${cls}">${txt}</div>`;
      }).join('')).join('') + `</div>`;
    const rl = rowLabs.length
      ? `<div class="mx-rowlabs ${colLabs.length ? 'head-pad' : ''}">${rowLabs.map(l => `<div class="mx-rowlab">${l}</div>`).join('')}</div>`
      : '';
    return `<div class="mx" style="--acc:${acc}">${title ? `<div class="mx-title">${title}</div>` : ''}
      <div class="mx-body">${rl}<div class="mx-colwrap">${head}<div class="mx-bracket">${grid}</div></div></div>
      ${shape ? `<div class="mx-shape">${shape}</div>` : ''}</div>`;
  }

  // op 연결 (A × B = C 형태)
  function opRow(parts, ops) {
    // parts: HTML 배열, ops: 사이에 들어갈 기호 배열(parts.length-1)
    let html = '<div class="mx-op-row">';
    parts.forEach((p, i) => {
      html += p;
      if (i < ops.length) html += `<div class="mx-bigop">${ops[i]}</div>`;
    });
    return html + '</div>';
  }

  /* ============================================================
     스텝퍼: 버튼들로 패널 전환
     containerSel: 스텝 버튼 컨테이너, panelSel: 패널 셀렉터
     버튼 data-s 와 패널 data-panel 매칭
     ============================================================ */
  function setupStepper(stepperSel = '#stepper', panelSel = '[data-panel]') {
    const stepper = document.querySelector(stepperSel);
    if (!stepper) return;
    const panels = [...document.querySelectorAll(panelSel)];
    stepper.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = b.dataset.s;
      stepper.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      panels.forEach(p => p.classList.toggle('show', p.dataset.panel === s));
      const top = stepper.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }

  /* ============================================================
     뷰 토글: 두 컨테이너 사이를 전환 (single ⇄ tensor 등)
     toggleSel 안의 button[data-v] 클릭 → views[data-v] 만 표시
     onShow(v) 콜백으로 지연 렌더 가능
     ============================================================ */
  function setupViewToggle(toggleSel, views, onShow) {
    const toggle = document.querySelector(toggleSel);
    if (!toggle) return;
    const shown = {};
    toggle.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.v;
      toggle.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (onShow && !shown[v]) { onShow(v); shown[v] = true; }
      Object.keys(views).forEach(key => {
        const el = document.querySelector(views[key]);
        if (el) el.style.display = (key === v) ? '' : 'none';
      });
    });
  }

  /* ============================================================
     상단 네비 마운트: 허브 링크 + 챕터 배지
     el: 컨테이너, badge: 'CH 02 · Tensor' 등
     ============================================================ */
  function mountTopnav(sel, badge) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML =
      `<a class="home" href="index.html">← 목차로</a><span class="chapbadge">${badge}</span>`;
  }

  // 가로 막대 행 (barrow) HTML
  function barRow(label, frac, { win = false, color = null, pctText = null } = {}) {
    const c = color || (win ? 'var(--hot)' : 'var(--q)');
    return `<div class="barrow ${win ? 'win' : ''}">
      <div class="bw">${label}${win ? ' 🏆' : ''}</div>
      <div class="track"><div class="fill" style="width:${(frac * 100).toFixed(1)}%;background:${c}"></div></div>
      <div class="pct">${pctText != null ? pctText : (frac * 100).toFixed(1) + '%'}</div>
    </div>`;
  }

  global.VZ = {
    fmt, dot, vecMat, matMul, transpose, softmax, PALETTE,
    mxMatrix, opRow, setupStepper, setupViewToggle, mountTopnav, barRow
  };
})(window);
