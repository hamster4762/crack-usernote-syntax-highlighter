// ==UserScript==
// @name         크랙 유저노트 Syntax Highlighter
// @namespace    https://crack.wrtn.ai/
// @version      0.1.0
// @description  크랙 유저노트를 기본/JSON/MARKDOWN/TOML/XML 구문으로 해석하여 문법 강조를 지원합니다. 현재 스크롤바가 생성 또는 제거될 때 제대로 표시되지 않는 버그가 있어 0버전 적용하였습니다. (version 관리방식: 크랙UI변경.기능추가및수정.핫픽스)
// @author       gemini
// @match        https://crack.wrtn.ai/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-toml.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js
// @updateURL    https://github.com/hamster4762/crack-usernote-syntax-highlighter/raw/refs/heads/main/crack-usernote-syntax-highlighter.user.js
// @downloadURL  https://github.com/hamster4762/crack-usernote-syntax-highlighter/raw/refs/heads/main/crack-usernote-syntax-highlighter.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const PREFIX = 'cun-'; // 확장 충돌 방지용 고유 접두사

    // 1. Prism.js TOML 문법 한글 지원 패치 (기존 유지)
    if (window.Prism && Prism.languages && Prism.languages.toml) {
        const koreanTablePattern = /\[\[?(?:[\w가-힣\s.-]+|"[^"\r\n]*"|'[^'\r\n]*')\]\]?/;
        if (Prism.languages.toml.table) {
            Prism.languages.toml.table.pattern = koreanTablePattern;
        }
        const koreanKeyPattern = /(?:[\w가-힣-]+|"[^"\r\n]*"|'[^'\r\n]*')(?=\s*=)/;
        if (Prism.languages.toml.key) {
            Prism.languages.toml.key.pattern = koreanKeyPattern;
        }
        if (Prism.languages.toml.property) {
            Prism.languages.toml.property.pattern = koreanKeyPattern;
        }
    }

    // 2. CSS 주입 (다른 언어를 위한 컬러 토큰 추가 및 콤보박스 스타일 병합)
    const style = document.createElement('style');
    style.textContent = `
        /* Overlay 컨테이너 */
        .${PREFIX}container {
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
        }

        /* 텍스트에어리어 (투명화 지정) */
        .${PREFIX}textarea {
            position: absolute !important;
            inset: 0 !important;
            background: transparent !important;
            color: transparent !important;
            caret-color: var(--text_brand, var(--text_primary, #000)) !important;
            z-index: 2 !important;
            resize: none !important;
            white-space: pre-wrap !important;
            word-break: break-all !important;
        }

        .${PREFIX}textarea::selection {
            background-color: rgba(59, 130, 246, 0.4) !important;
            color: transparent !important;
        }

        .${PREFIX}textarea::placeholder {
            color: var(--text_disabled, #9ca3af) !important;
        }

        /* '기본(none)' 모드일 때 투명화 해제 */
        .${PREFIX}none .${PREFIX}textarea {
            color: var(--text_primary, inherit) !important;
            background: transparent !important;
        }
        .${PREFIX}none .${PREFIX}textarea::selection {
            color: inherit !important;
        }

        /* Syntax Highlighter 위치 레이어 */
        .${PREFIX}backdrop {
            position: absolute !important;
            height: 100% !important;
            inset: 0 !important;
            z-index: 1 !important;
            pointer-events: none !important;
            overflow: hidden !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            word-break: break-all !important;
        }

        /* '기본(none)' 모드일 때 백드롭 레이어 숨김 */
        .${PREFIX}none .${PREFIX}backdrop {
            display: none !important;
        }

        /* 레이어 폰트 싱크 - 텍스트에어리어의 요소를 철저히 복제 */
        .${PREFIX}backdrop code {
            font-family: inherit !important;
            font-size: inherit !important;
            line-height: inherit !important;
            letter-spacing: inherit !important;
            color: var(--text_primary, inherit) !important;
        }

        /* 언어 선택 콤보박스 스타일 */
        .${PREFIX}select {
            margin-left: 14px !important;
            padding: 2px 26px 2px 8px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            border: 1px solid var(--outline_secondary, #d1d5db) !important;
            background-color: transparent !important;
            color: var(--text_primary, inherit) !important;
            cursor: pointer !important;
            outline: none !important;
            appearance: none !important;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
            background-repeat: no-repeat !important;
            background-position: right 6px center !important;
            background-size: 14px !important;
            transition: border-color 0.2s;
        }
        .${PREFIX}select:hover, .${PREFIX}select:focus {
            border-color: #9ca3af !important;
        }
        .${PREFIX}select option {
            background-color: var(--surface_primary, #fff) !important;
            color: var(--text_primary, #000) !important;
        }

        /* Prism 테마 설정 (기존 TOML + JSON/MD/XML 추가 대응) */
        .${PREFIX}backdrop .token {
            text-decoration: none !important;
            font-weight: inherit !important;
            font-style: inherit !important;
        }

        .${PREFIX}backdrop .token.comment { color: #668d5d !important; }
        .${PREFIX}backdrop .token.string { color: #afa688 !important; }
        .${PREFIX}backdrop .token.number,
        .${PREFIX}backdrop .token.boolean,
        .${PREFIX}backdrop .token.tag { color: #f472b6 !important; } /* Tag(XML), Number/Bool */
        .${PREFIX}backdrop .token.key,
        .${PREFIX}backdrop .token.property,
        .${PREFIX}backdrop .token.attr-name,
        .${PREFIX}backdrop .token.url { color: #5b90cc !important; } /* Key(JSON/TOML), Attr(XML), URL(MD) */
        .${PREFIX}backdrop .token.table,
        .${PREFIX}backdrop .token.title { color: #fbbf24 !important; display:inline; font-weight: bold !important; } /* Table(TOML), Title(MD) */
        .${PREFIX}backdrop .token.punctuation,
        .${PREFIX}backdrop .token.list { color: #82ca79 !important; } /* Punc, List(MD) */
        .${PREFIX}backdrop .token.attr-value { color: #afa688 !important; } /* Attr Value(XML) */
    `;
    document.head.appendChild(style);

    // 3. UI 변경 및 Highlight 적용 함수
    function enhanceUserNote(dialog) {
        if (dialog.dataset.cunProcessed) return;

        // (1) 헤더 타이틀이 "유저노트"인지 확인
        const titleEl = dialog.querySelector('h2');
        if (!titleEl || !titleEl.textContent.includes('유저노트')) return;

        dialog.dataset.cunProcessed = 'true';

        // --- 크기 늘리기 로직 ---
        dialog.classList.remove('max-w-lg');
        dialog.style.setProperty('width', '90%', 'important');
        dialog.style.setProperty('height', '90%', 'important');

        const wFull = dialog.querySelector('.w-full');
        if (wFull) {
            wFull.classList.add('h-full');
            const innerFlex = wFull.querySelector('.flex.flex-col.gap-3');
            if (innerFlex) innerFlex.classList.add('h-full');
        }

        const textarea = dialog.querySelector('textarea');
        if (!textarea) return;

        textarea.classList.remove('max-h-[386px]');
        textarea.style.setProperty('height', '100%', 'important');

        // --- 구문 강조 오버레이 구성 ---
        const container = document.createElement('div');
        container.className = `${PREFIX}container`;

        const backdrop = document.createElement('div');
        backdrop.className = `${textarea.className} ${PREFIX}backdrop`;
        backdrop.style.border = 'none';

        const code = document.createElement('code');
        backdrop.appendChild(code);

        // 노드 구조 변경 (컨테이너로 감싸기)
        textarea.parentNode.insertBefore(container, textarea);
        container.appendChild(backdrop);
        container.appendChild(textarea);
        textarea.classList.add(`${PREFIX}textarea`);

        // --- 동기화 및 렌더링 로직 ---
        const syncUpdate = () => {
            let text = textarea.value;
            // "기본" 모드 시 렌더링 패스 (최적화)
            if (container.classList.contains(`${PREFIX}none`)) return;

            // 마지막 줄 바꿈 시 스크롤 어긋남 방지 코드
            if (text.endsWith('\n')) {
                text += ' ';
            }
            // Text 업데이트 및 Prism 처리
            code.textContent = text;
            if (window.Prism) {
                Prism.highlightElement(code);
            }
        };

        const syncScroll = () => {
            backdrop.scrollTop = textarea.scrollTop;
            backdrop.scrollLeft = textarea.scrollLeft;
        };

        textarea.addEventListener('input', syncUpdate);
        textarea.addEventListener('scroll', syncScroll, { passive: true });

        // --- 언어 선택 콤보박스(Select) 추가 로직 ---
        const headerTitleContainer = dialog.querySelector('.group\\/dialogHeader .flex.items-center');
        if (headerTitleContainer && !headerTitleContainer.querySelector(`.${PREFIX}select`)) {
            const select = document.createElement('select');
            select.className = `${PREFIX}select`;

            const options = [
                { value: 'none', text: '기본' },
                { value: 'json', text: 'JSON' },
                { value: 'markdown', text: 'MARKDOWN' },
                { value: 'toml', text: 'TOML' },
                { value: 'xml', text: 'XML' }
            ];

            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                select.appendChild(option);
            });

            // 저장된 언어 불러오기 (기본값 설정)
            const savedLang = localStorage.getItem('cun-language') || 'toml';
            select.value = savedLang;

            const updateLanguage = (lang) => {
                if (lang === 'none') {
                    container.classList.add(`${PREFIX}none`);
                    code.className = '';
                } else {
                    container.classList.remove(`${PREFIX}none`);
                    code.className = `language-${lang}`;
                    // "기본" -> "기타" 변경 시 DOM 반영을 보장하기 위함
                    requestAnimationFrame(syncUpdate);
                }
            };

            // 선택값 변경 이벤트
            select.addEventListener('change', (e) => {
                const newLang = e.target.value;
                localStorage.setItem('cun-language', newLang);
                updateLanguage(newLang);
            });

            // 헤더의 텍스트 바로 옆에 주입
            headerTitleContainer.appendChild(select);

            // 초기 언어 모드 세팅
            updateLanguage(savedLang);
        } else {
            // 방어코드: UI 조작에 실패한 경우 기본 fallback
            container.classList.remove(`${PREFIX}none`);
            code.className = 'language-toml';
            syncUpdate();
        }
    }

    // 4. 모달 감시 옵저버
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        if (node.getAttribute('role') === 'dialog') {
                            enhanceUserNote(node);
                        } else {
                            const dialogs = node.querySelectorAll('div[role="dialog"]');
                            dialogs.forEach(enhanceUserNote);
                        }
                    }
                });
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 스크립트 로드 시 이미 열려있는 다이얼로그 강제 처리
    const existingDialog = document.querySelector('div[role="dialog"]');
    if (existingDialog) {
        enhanceUserNote(existingDialog);
    }
})();
