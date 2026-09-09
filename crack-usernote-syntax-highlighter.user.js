// ==UserScript==
// @name         크랙 유저노트 문법 강조기
// @namespace    https://crack.wrtn.ai/
// @version      1.0.1
// @description  유저노트 팝업 확대 및 기본/JSON/MARKDOWN/TOML/XML 색상 강조. (version 관리방식: 크랙UI변경.기능추가및수정.핫픽스)
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/hamster4762/crack-usernote-syntax-highlighter/raw/refs/heads/main/crack-usernote-syntax-highlighter.user.js
// @downloadURL  https://github.com/hamster4762/crack-usernote-syntax-highlighter/raw/refs/heads/main/crack-usernote-syntax-highlighter.user.js
// @noframes
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23ffffff' viewBox='0 0 24 24'%3E%3Cpath d='M8 8.35h8v-1.6H8zm8 4H8v-1.6h8zm-8 4h4v-1.6H8z'/%3E%3Cpath fill-rule='evenodd' d='M3.75 3.29c0-.72.58-1.3 1.3-1.3h13.9c.72 0 1.3.58 1.3 1.3v12.6c0 .32-.12.65-.37.9l-4.55 4.8q-.38.4-.95.41H5.05a1.3 1.3 0 0 1-1.3-1.3zm1.6.3V20.4h8.44v-3.8c0-.72.58-1.3 1.3-1.3h3.56V3.6zM17.57 16.9l-2.18 2.3v-2.3z' clip-rule='evenodd'/%3E%3C/svg%3E
// ==/UserScript==

(() => {
  'use strict';

  // 확장에서 사용하는 이름, 선택자와 레이아웃 기준을 한곳에서 관리한다.
  const CLASS_PREFIX = 'crack-usernote-sh';
  const STORAGE_KEY = `${CLASS_PREFIX}:format`;
  const DIALOG_SELECTOR = '[role="dialog"]';
  const CLOSE_BUTTON_SELECTOR = 'button[aria-label="닫기"]';
  const USER_NOTE_TITLE = '유저노트';
  const FORMAT_OPTIONS = [
    ['plain', '기본'],
    ['json', 'JSON'],
    ['markdown', 'MARKDOWN'],
    ['toml', 'TOML'],
    ['xml', 'XML'],
  ];
  const DEFAULT_FORMAT = FORMAT_OPTIONS[0][0];
  const FORMAT_NAMES = new Set(FORMAT_OPTIONS.map(([name]) => name));
  const TOKEN_KINDS = [
    'key', 'table', 'string', 'comment', 'literal', 'number', 'punct', 'tag',
    'attribute', 'entity', 'heading', 'list', 'quote', 'code', 'link', 'emphasis',
  ];
  const LAYOUT = Object.freeze({
    mobileBreakpoint: 768,
    desktopWidthRatio: 0.52,
    desktopHeightRatio: 0.86,
    mobileHeightRatio: 1,
    minimumEditorRows: 4,
    fallbackButtonWidth: 80,
    optionsGap: 8,
    fallbackLineHeightRatio: 1.6,
    selectMaxWidthRatio: 0.5,
    lightTextThreshold: 155,
  });
  const LUMINANCE_WEIGHTS = Object.freeze([0.2126, 0.7152, 0.0722]);
  const COLORS = Object.freeze({
    light: {
      key: '#245dae', table: '#9a6500', string: '#287341', comment: '#69716e',
      literal: '#8543a8', number: '#a35612', punct: '#8b4150', tag: '#b23838',
      attribute: '#245dae', entity: '#8b4b9b', heading: '#9a6500', list: '#b23838',
      quote: '#287341', code: '#8543a8', link: '#245dae', emphasis: '#a35612',
    },
    dark: {
      key: '#8fc4ff', table: '#ffd166', string: '#a5d69c', comment: '#a0a8a4',
      literal: '#d8afff', number: '#edc287', punct: '#d4a0a8', tag: '#ff9696',
      attribute: '#8fc4ff', entity: '#e5a9ee', heading: '#ffd166', list: '#ff9696',
      quote: '#a5d69c', code: '#d8afff', link: '#8fc4ff', emphasis: '#edc287',
    },
  });
  const MIRROR_STYLE_PROPERTIES = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant',
    'fontKerning', 'fontFeatureSettings', 'fontVariationSettings', 'lineHeight',
    'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform',
    'tabSize', 'direction', 'whiteSpace', 'overflowWrap', 'wordBreak',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  ];

  // 각 문법은 오류가 있어도 입력을 막지 않는 느슨한 토큰 패턴을 사용한다.
  const SYNTAX_PATTERNS = Object.freeze({
    json: /("(?:\\[\s\S]|[^"\\\n])*"?)(\s*:)?|(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g,
    toml: /("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\\n])*"?|'[^'\n]*'?)([ \t]*=)?|(^[ \t]*\[\[?[^\n]*?\]\]?)|(^[ \t]*[^\s#=\[\]{}",'](?:[^\n#=]*?[^\s#=])?[ \t]*(?==))|(#[^\n]*)|\b(true|false|inf|nan)\b|([+-]?\b\d[\w.:+-]*)|([=\[\]{},])/gm,
    xml: /(<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$))|(<\/?[\p{L}_:][\p{L}\p{N}_.:\-]*|<\?[\w:-]+|<!DOCTYPE\b)|(\s+[\p{L}_:][\p{L}\p{N}_.:\-]*)(\s*=)|("[^"]*"?|'[^']*'?)|(&#?[\p{L}\p{N}#]+;)|([?/]?>|=)/gu,
    markdown: /(^[ \t]*(?:`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?(?:\n[ \t]*(?:`{3,}|~{3,})[^\n]*|$))?)|(^[ \t]*#{1,6}[^\n]*)|(^[ \t]*(?:-|[+*](?![+*])|\d+[.)]))|(^[ \t]*>+)|(`+[^`\n]*`+)|(!?\[[^\]\n]*\]\([^\n)]*\))|(\*\*[^\n]*?\*\*|__[^\n]*?__|~~[^\n]*?~~|\*[^*\n]+\*|_[^_\n]+_)/gm,
  });

  // 정규식 캡처 위치를 문법별 색상 역할로 변환한다.
  function classifyToken(mode, match) {
    if (mode === 'json') {
      if (match[1]) return match[2] ? 'key' : 'string';
      if (match[3]) return 'comment';
      if (match[4]) return 'literal';
      return match[5] ? 'number' : 'punct';
    }
    if (mode === 'toml') {
      if (match[1]) return match[2] ? 'key' : 'string';
      if (match[3]) return 'table';
      if (match[4]) return 'key';
      if (match[5]) return 'comment';
      if (match[6]) return 'literal';
      return match[7] ? 'number' : 'punct';
    }
    if (mode === 'xml') {
      if (match[1]) return 'comment';
      if (match[2]) return 'tag';
      if (match[3]) return 'attribute';
      if (match[5]) return 'string';
      return match[6] ? 'entity' : 'punct';
    }
    if (match[1]) return 'code';
    if (match[2]) return 'heading';
    if (match[3]) return 'list';
    if (match[4]) return 'quote';
    if (match[5]) return 'code';
    return match[6] ? 'link' : 'emphasis';
  }

  // 원문과 공백을 그대로 보존하면서 색칠할 토큰만 분리한다.
  function tokenize(source, mode) {
    const out = [];
    const emit = (text, kind = '') => { if (text) out.push({ text, kind }); };
    if (mode === DEFAULT_FORMAT) {
      emit(source);
      return out;
    }
    const re = SYNTAX_PATTERNS[mode];
    if (!re) {
      emit(source);
      return out;
    }
    let end = 0;
    for (const m of source.matchAll(re)) {
      emit(source.slice(end, m.index));
      emit(m[0], classifyToken(mode, m));
      end = m.index + m[0].length;
    }
    emit(source.slice(end));
    return out;
  }

  // 색상 객체를 접두사가 붙은 CSS 변수 선언으로 변환한다.
  function createColorVariables(colors) {
    return TOKEN_KINDS.map(kind => `--${CLASS_PREFIX}-${kind}:${colors[kind]};`).join('');
  }

  // localStorage가 차단되거나 값이 손상돼도 기본 형식으로 안전하게 복구한다.
  function loadFormat() {
    try {
      const savedFormat = localStorage.getItem(STORAGE_KEY);
      return FORMAT_NAMES.has(savedFormat) ? savedFormat : DEFAULT_FORMAT;
    } catch {
      return DEFAULT_FORMAT;
    }
  }

  // 선택값만 같은 사이트의 localStorage에 저장하며 실패는 기능 동작에 영향을 주지 않는다.
  function saveFormat(format) {
    try {
      localStorage.setItem(STORAGE_KEY, format);
    } catch {
      // 저장이 불가능한 환경에서는 현재 팝업에서만 선택값을 유지한다.
    }
  }

  // Node 환경에서는 DOM 초기화를 건너뛰고 토크나이저만 테스트에 노출한다.
  if (typeof module !== 'undefined' && module.exports && typeof document === 'undefined') {
    module.exports = { tokenize }; return;
  }

  // 동일 스크립트가 중복 실행됐을 때 스타일과 감시자를 추가하지 않는다.
  if (document.getElementById(`${CLASS_PREFIX}-style`)) return;

  // 유저노트 팝업에 붙인 전용 클래스에만 반응하는 스타일을 주입한다.
  const sheet = document.createElement('style');
  sheet.id = `${CLASS_PREFIX}-style`;
  sheet.textContent = `
    /* 팝업과 편집영역 크기 */
    .${CLASS_PREFIX}-dialog { width:${LAYOUT.desktopWidthRatio * 100}vw !important; max-width:none !important;
      height:var(--${CLASS_PREFIX}-height) !important; max-height:var(--${CLASS_PREFIX}-height) !important;
      top:var(--${CLASS_PREFIX}-top) !important; overflow:auto !important; }
    .${CLASS_PREFIX}-body { flex:1 0 auto !important; min-height:min-content !important; }
    .${CLASS_PREFIX}-group { position:relative !important; flex:1 0 auto !important; min-height:min-content !important; }
    .${CLASS_PREFIX}-textarea { flex:1 1 auto !important; min-height:var(--${CLASS_PREFIX}-minimum) !important;
      max-height:none !important; }
    .${CLASS_PREFIX}-body > :not(.${CLASS_PREFIX}-group), .${CLASS_PREFIX}-group > :not(.${CLASS_PREFIX}-textarea):not(.${CLASS_PREFIX}-mirror),
    .${CLASS_PREFIX}-dialog > :not(.${CLASS_PREFIX}-body) { flex-shrink:0 !important; }
    .${CLASS_PREFIX}-options { position:absolute !important; z-index:2; left:0 !important;
      top:var(--${CLASS_PREFIX}-options-top) !important; width:calc(100% - var(--${CLASS_PREFIX}-options-reserve)) !important;
      margin:0 !important; }

    /* 원래 textarea의 입력 기능을 보존하는 투명 글자 레이어 */
    textarea.${CLASS_PREFIX}-colored { color:transparent !important; -webkit-text-fill-color:transparent !important;
      caret-color:var(--${CLASS_PREFIX}-caret) !important; }
    textarea.${CLASS_PREFIX}-colored::selection { color:transparent !important; -webkit-text-fill-color:transparent !important; }
    textarea.${CLASS_PREFIX}-colored::placeholder { -webkit-text-fill-color:currentColor !important; }
    .${CLASS_PREFIX}-mirror { position:absolute !important; pointer-events:none !important; user-select:none !important;
      overflow:hidden !important; margin:0 !important; border:0 !important; box-sizing:border-box !important;
      background:transparent !important; z-index:1; text-decoration:none !important; }
    .${CLASS_PREFIX}-mirror[hidden] { display:none !important; }
    .${CLASS_PREFIX}-mirror span { font:inherit !important; letter-spacing:inherit !important;
      text-decoration:none !important; background:transparent !important; }

    /* 밝은 테마와 어두운 테마의 토큰 색 */
    .${CLASS_PREFIX}-mirror { ${createColorVariables(COLORS.light)} }
    .${CLASS_PREFIX}-mirror[data-dark="true"] { ${createColorVariables(COLORS.dark)} }
    ${TOKEN_KINDS.map(kind => `.${CLASS_PREFIX}-mirror .${CLASS_PREFIX}-${kind} {color:var(--${CLASS_PREFIX}-${kind}) !important;}`).join('\n')}
    .${CLASS_PREFIX}-mirror .${CLASS_PREFIX}-selection { color:#fff !important;
      background:rgba(59,130,246,.55) !important; }

    /* 유저노트 헤더의 문법 선택 상자 */
    .${CLASS_PREFIX}-select { font:inherit; font-size:.8em; color:inherit; background:var(--${CLASS_PREFIX}-surface);
      border:1px solid currentColor; border-radius:.35em; padding:.35em .45em;
      margin-inline-start:auto; max-width:${LAYOUT.selectMaxWidthRatio * 100}%; flex-shrink:1; cursor:pointer; }

    /* 강제 색상 모드에서는 브라우저의 기본 텍스트 대비를 우선한다. */
    @media (forced-colors:active) {
      textarea.${CLASS_PREFIX}-colored { color:CanvasText !important; -webkit-text-fill-color:CanvasText !important; }
      .${CLASS_PREFIX}-mirror { display:none !important; }
    }

    /* 모바일에서는 크랙의 바텀시트 좌표를 해제하고 보이는 화면을 채운다. */
    @media (max-width:${LAYOUT.mobileBreakpoint}px) {
      .${CLASS_PREFIX}-dialog { width:100vw !important; height:var(--${CLASS_PREFIX}-height) !important;
        max-height:var(--${CLASS_PREFIX}-height) !important; left:0 !important; right:auto !important;
        bottom:auto !important; transform:none !important; border-radius:0 !important; border-inline:0 !important; }
    }
  `;
  document.head.append(sheet);

  // 열려 있는 유저노트 팝업별 정리 함수를 추적한다.
  const states = new Map();
  const px = v => Number.parseFloat(v) || 0;

  // 확인된 크랙 유저노트 구조와 일치하는 팝업 하나에만 기능을 연결한다.
  function attach(dialog) {
    if (states.has(dialog)) return;
    const heading = [...dialog.querySelectorAll('h2')].find(h => h.textContent.trim() === USER_NOTE_TITLE);
    const editors = dialog.querySelectorAll('textarea');
    if (!heading || editors.length !== 1) return;

    // 크랙 UI 구조가 변경됐으면 다른 팝업을 건드리지 않고 적용을 중단한다.
    const ta = editors[0], group = ta.parentElement, body = group.parentElement;
    const header = heading.parentElement.parentElement;
    if (body.parentElement !== dialog || header.parentElement !== dialog || !header.querySelector(CLOSE_BUTTON_SELECTOR)) return;
    const ds = getComputedStyle(dialog), ts = getComputedStyle(ta);
    const footer = dialog.lastElementChild;
    const options = ta.nextElementSibling;
    if (!footer || footer === body || !footer.querySelector('button') || !options) return;

    // 팝업을 닫을 때 되돌릴 textarea의 원래 상태를 보관한다.
    const originalHeight = [ta.style.getPropertyValue('height'), ta.style.getPropertyPriority('height')];
    const originalSpellcheck = ta.getAttribute('spellcheck');

    // 원래 textarea 위에 겹칠 색상 레이어와 문법 선택 상자를 만든다.
    const mirror = document.createElement('pre');
    mirror.className = `${CLASS_PREFIX}-mirror`; mirror.setAttribute('aria-hidden', 'true'); mirror.hidden = true;
    const select = document.createElement('select');
    select.className = `${CLASS_PREFIX}-select`; select.setAttribute('aria-label', '유저노트 문법');
    select.title = '글자색만 강조합니다. 문법 오류는 검사하지 않습니다.';
    FORMAT_OPTIONS.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    select.value = loadFormat();
    select.style.setProperty(`--${CLASS_PREFIX}-surface`, ds.backgroundColor);

    // 기존 폰트와 커서 색을 가져오고 확장 전용 클래스만 추가한다.
    const originalColor = ts.color, originalCaret = ts.caretColor;
    const lineHeight = px(ts.lineHeight) || px(ts.fontSize) * LAYOUT.fallbackLineHeightRatio;
    ta.style.setProperty(`--${CLASS_PREFIX}-minimum`, `${lineHeight * LAYOUT.minimumEditorRows}px`);
    ta.style.setProperty(`--${CLASS_PREFIX}-caret`, originalCaret === 'auto' ? originalColor : originalCaret);
    const marks = [[dialog,'dialog'],[body,'body'],[group,'group'],[ta,'textarea'],[options,'options']];
    marks.forEach(([el,k]) => el.classList.add(`${CLASS_PREFIX}-${k}`));
    group.append(mirror);
    header.insertBefore(select, header.querySelector(CLOSE_BUTTON_SELECTOR));

    // 이벤트와 렌더링 상태는 팝업 단위로 관리한다.
    let frame = 0, lastValue, lastMode, lastSelectionStart, lastSelectionEnd,
      lastSelectionActive, disposed = false;
    const events = new AbortController();

    // 크랙의 인라인 자동 높이보다 편집영역 확장 규칙을 우선한다.
    function ensureHeight() {
      if (ta.style.getPropertyValue('height') !== '0px' || ta.style.getPropertyPriority('height') !== 'important') ta.style.setProperty('height', '0px', 'important');
    }

    // visualViewport를 기준으로 PC와 모바일 팝업 크기 및 위치를 갱신한다.
    function viewport() {
      const vv = window.visualViewport;
      const mobile = (vv?.width || innerWidth) <= LAYOUT.mobileBreakpoint;
      const heightRatio = mobile ? LAYOUT.mobileHeightRatio : LAYOUT.desktopHeightRatio;
      dialog.style.setProperty(`--${CLASS_PREFIX}-height`, `${(vv?.height || innerHeight) * heightRatio}px`);
      dialog.style.setProperty(`--${CLASS_PREFIX}-top`, `${mobile ? (vv?.offsetTop || 0) : (vv?.offsetTop || 0) + (vv?.height || innerHeight) / 2}px`);
      schedule();
    }

    // 기본 모드로 돌아왔을 때 사이트의 원래 맞춤법 검사 설정을 복원한다.
    function restoreSpellcheck() {
      if (originalSpellcheck === null) ta.removeAttribute('spellcheck'); else ta.setAttribute('spellcheck', originalSpellcheck);
    }
    // 한 프레임에 한 번만 하단 배치와 문법 강조 레이어를 갱신한다.
    function render() {
      frame = 0;
      if (disposed || !ta.isConnected) return;
      ensureHeight();
      const mode = select.value;
      select.style.setProperty(`--${CLASS_PREFIX}-surface`, getComputedStyle(dialog).backgroundColor);
      const active = mode !== DEFAULT_FORMAT && ta.value.length > 0;
      if (mode === DEFAULT_FORMAT) restoreSpellcheck(); else ta.setAttribute('spellcheck', 'false');
      const grNow = group.getBoundingClientRect(), fr = footer.getBoundingClientRect(), or = options.getBoundingClientRect();
      const footerButton = footer.querySelector('button');
      const br = footerButton?.getBoundingClientRect();
      group.style.setProperty(`--${CLASS_PREFIX}-options-top`, `${fr.top - grNow.top + (fr.height - or.height) / 2}px`);
      group.style.setProperty(`--${CLASS_PREFIX}-options-reserve`, `${(br?.width || LAYOUT.fallbackButtonWidth) + px(getComputedStyle(footer).gap) + LAYOUT.optionsGap}px`);
      if (!active) { mirror.hidden = true; ta.classList.remove(`${CLASS_PREFIX}-colored`); return; }
      ta.classList.remove(`${CLASS_PREFIX}-colored`);
      const style = getComputedStyle(ta);
      for (const key of MIRROR_STYLE_PROPERTIES) mirror.style[key] = style[key];
      mirror.style.color = style.color;
      const channels = style.color.match(/[\d.]+/g)?.map(Number);
      const textLuminance = channels?.reduce((sum, channel, index) => sum + channel * LUMINANCE_WEIGHTS[index], 0);
      mirror.dataset.dark = String(textLuminance > LAYOUT.lightTextThreshold);
      const tr = ta.getBoundingClientRect(), gr = group.getBoundingClientRect();
      mirror.style.left = `${tr.left - gr.left - group.clientLeft + group.scrollLeft + ta.clientLeft}px`;
      mirror.style.top = `${tr.top - gr.top - group.clientTop + group.scrollTop + ta.clientTop}px`;
      mirror.style.width = `${ta.clientWidth}px`; mirror.style.height = `${ta.clientHeight}px`;
      const selectionStart = ta.selectionStart;
      const selectionEnd = ta.selectionEnd;
      const selectionActive = document.activeElement === ta && selectionEnd > selectionStart;
      if (lastValue !== ta.value || lastMode !== mode || lastSelectionStart !== selectionStart ||
          lastSelectionEnd !== selectionEnd || lastSelectionActive !== selectionActive) {
        const frag = document.createDocumentFragment();
        let sourceOffset = 0;
        for (const token of tokenize(ta.value, mode)) {
          const tokenEnd = sourceOffset + token.text.length;
          const cuts = [sourceOffset, tokenEnd];
          if (selectionStart > sourceOffset && selectionStart < tokenEnd) cuts.push(selectionStart);
          if (selectionEnd > sourceOffset && selectionEnd < tokenEnd) cuts.push(selectionEnd);
          cuts.sort((a, b) => a - b);
          for (let index = 0; index < cuts.length - 1; index += 1) {
            const start = cuts[index], end = cuts[index + 1];
            const text = token.text.slice(start - sourceOffset, end - sourceOffset);
            const selected = selectionActive && start < selectionEnd && end > selectionStart;
            if (!token.kind && !selected) frag.append(document.createTextNode(text));
            else {
              const span = document.createElement('span');
              span.className = [token.kind && `${CLASS_PREFIX}-${token.kind}`,
                selected && `${CLASS_PREFIX}-selection`].filter(Boolean).join(' ');
              span.textContent = text; frag.append(span);
            }
          }
          sourceOffset = tokenEnd;
        }
        // textarea와 마지막 빈 줄 높이를 맞추기 위한 폭 없는 문자다.
        frag.append(document.createTextNode('\u200b'));
        mirror.replaceChildren(frag); lastValue = ta.value; lastMode = mode;
        lastSelectionStart = selectionStart; lastSelectionEnd = selectionEnd;
        lastSelectionActive = selectionActive;
      }
      mirror.hidden = false;
      mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft;
      ta.classList.add(`${CLASS_PREFIX}-colored`);
    }
    function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(render); }
    function syncScroll() { mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft; }

    // 입력, 스크롤과 한글 조합 상태를 원래 textarea에서 전달받는다.
    ta.addEventListener('input', schedule, { signal:events.signal });
    ta.addEventListener('change', schedule, { signal:events.signal });
    ta.addEventListener('select', schedule, { signal:events.signal });
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === ta) schedule();
    }, { signal:events.signal });
    ta.addEventListener('scroll', syncScroll, { signal:events.signal, passive:true });
    // 조합 중에도 input으로 강조를 갱신하고 원래 textarea의 IME 동작을 유지한다.
    ta.addEventListener('compositionstart', schedule, { signal:events.signal });
    ta.addEventListener('compositionend', schedule, { signal:events.signal });
    select.addEventListener('change', () => {
      saveFormat(select.value);
      schedule();
    }, { signal:events.signal });

    // 실제 크기와 사이트의 인라인 높이 변경만 관찰해 불필요한 전체 렌더링을 피한다.
    const resize = new ResizeObserver(schedule); resize.observe(ta); resize.observe(group); resize.observe(footer); resize.observe(options);
    const autosize = new MutationObserver(() => { ensureHeight(); schedule(); });
    // class 변경은 제외해 확장 자신의 렌더링이 감시자를 재호출하지 않게 한다.
    autosize.observe(ta, { attributes:true, attributeFilter:['style'], childList:true });

    // 창 크기와 모바일 가상 키보드 변화에 맞춰 팝업을 다시 배치한다.
    window.addEventListener('resize', viewport, { signal:events.signal, passive:true });
    window.visualViewport?.addEventListener('resize', viewport, { signal:events.signal, passive:true });
    window.visualViewport?.addEventListener('scroll', viewport, { signal:events.signal, passive:true });
    // 팝업이 닫히면 추가 요소·이벤트·스타일을 제거하고 원래 상태로 되돌린다.
    function dispose() {
      disposed = true; cancelAnimationFrame(frame); events.abort(); resize.disconnect(); autosize.disconnect();
      mirror.remove(); select.remove(); marks.forEach(([el,k]) => el.classList.remove(`${CLASS_PREFIX}-${k}`));
      ta.classList.remove(`${CLASS_PREFIX}-colored`); restoreSpellcheck();
      if (ta.style.getPropertyValue('height') === '0px') {
        if (originalHeight[0]) ta.style.setProperty('height', ...originalHeight); else ta.style.removeProperty('height');
      }
      for (const [el, names] of [[dialog,['height','top']],[ta,['minimum','caret']],[group,['options-top','options-reserve']]]) names.forEach(n => el.style.removeProperty(`--${CLASS_PREFIX}-${n}`));
      states.delete(dialog);
    }
    states.set(dialog, { ta, dispose, schedule });
    ensureHeight(); viewport();
  }

  // DOM 변화가 몰려도 다음 애니메이션 프레임에 한 번만 팝업을 탐색한다.
  let scanFrame = 0;
  function scan() {
    scanFrame = 0;
    for (const [dialog, state] of states) {
      // 닫힘 애니메이션 중에는 확대 스타일을 유지하고, DOM에서 실제 제거된 뒤 정리한다.
      const closing = dialog.getAttribute('data-state') === 'closed';
      if (!dialog.isConnected || (!state.ta.isConnected && !closing)) state.dispose();
    }
    document.querySelectorAll(`${DIALOG_SELECTOR}:not([data-state="closed"])`).forEach(attach);
  }

  // 팝업 생성·제거·상태 변화만 선별해 관찰한다.
  const observer = new MutationObserver(records => {
    const relevant = records.some(r => {
      if (r.target instanceof Element && r.target.closest(`.${CLASS_PREFIX}-mirror, .${CLASS_PREFIX}-select`)) return false;
      if (r.type === 'attributes') return r.target.matches?.(DIALOG_SELECTOR);
      if (r.target instanceof Element && r.target.closest(DIALOG_SELECTOR)) return true;
      return [...r.addedNodes, ...r.removedNodes].some(n => n instanceof Element && (n.matches(DIALOG_SELECTOR) || n.querySelector(DIALOG_SELECTOR)));
    });
    if (relevant && !scanFrame) scanFrame = requestAnimationFrame(scan);
  });
  observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['data-state'] });

  // 사이트 테마 속성이 바뀌면 현재 팝업의 대비 색만 다시 계산한다.
  const themeObserver = new MutationObserver(() => { for (const state of states.values()) state.schedule(); });
  for (const el of [document.documentElement, document.body]) {
    themeObserver.observe(el, { attributes:true, attributeFilter:['class','data-theme','style'] });
  }

  // 페이지가 이미 유저노트를 열어둔 상태에서도 즉시 적용한다.
  scan();
})();
