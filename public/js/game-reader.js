import {esc} from './ui.js';

// Optional reading pages keep long, teacher-authored text available without
// squeezing the answer buttons or introducing a nested vertical scroll area.
let active = null;
export function closeGameReader() { active?.close(); }
export function openGameReader(title, content) {
 closeGameReader();
 const previous = document.activeElement, dialog = document.createElement('dialog');
 dialog.className = 'game-reader';
 dialog.setAttribute('aria-labelledby', 'game-reader-title');
 dialog.innerHTML = `<header><h2 id="game-reader-title">${esc(title)}</h2><button type="button" class="icon-btn" data-reader-close aria-label="Close reading view">×</button></header><div class="reader-viewport" tabindex="0" aria-label="Reading page"><div class="reader-pages">${content}</div></div><footer><button type="button" class="btn ghost" data-reader-back>← Back</button><span data-reader-count role="status"></span><button type="button" class="btn primary" data-reader-next>Next →</button></footer>`;
 document.body.append(dialog); active = dialog;
 const viewport = dialog.querySelector('.reader-viewport'), pages = dialog.querySelector('.reader-pages');
 const back = dialog.querySelector('[data-reader-back]'), next = dialog.querySelector('[data-reader-next]');
 let page = 0, count = 1, frame = 0;
 function show() {
  const step = viewport.clientWidth + 32;
  count = Math.max(1, Math.ceil((pages.scrollWidth + 32 - 2) / step));
  page = Math.max(0, Math.min(page, count - 1));
  viewport.scrollLeft = page * step;
  back.disabled = page === 0; next.disabled = page === count - 1;
  dialog.querySelector('[data-reader-count]').textContent = `Page ${page + 1} of ${count}`;
 }
 const resize = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(show); });
 dialog.querySelector('[data-reader-close]').onclick = () => dialog.close();
 back.onclick = () => { page--; show(); }; next.onclick = () => { page++; show(); };
 dialog.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  page = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : page + (event.key === 'ArrowLeft' ? -1 : 1); show();
 });
 dialog.addEventListener('load', show, true);
 dialog.addEventListener('error', show, true);
 dialog.addEventListener('close', () => {
  resize.disconnect(); cancelAnimationFrame(frame); dialog.remove();
  if (active === dialog) active = null;
  if (previous?.isConnected) previous.focus({preventScroll:true});else document.querySelector('[data-act=read-question]:not([hidden]),.phase-heading')?.focus({preventScroll:true});
 }, {once:true});
 dialog.showModal(); resize.observe(viewport); show();
}

export function readableGameDetails(markup) {
 const source = document.createElement('div'); source.innerHTML = markup;
 const choices=[...source.querySelectorAll('.gameplay-choice')].map(el=>`<h3>${esc(el.querySelector('strong')?.textContent)}</h3><p>${esc([...el.querySelectorAll('span,small')].map(x=>x.textContent).join(' '))}</p>`).join('');
 const collection=[...source.querySelectorAll('.collection-fish')].map(el=>el.getAttribute('aria-label')).join(', ');
 const words=el=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),text=[];while(walker.nextNode())text.push(walker.currentNode.textContent);return text.join(' ');};
 // A field guide is read-only. Choices remain on the actual game screen.
 source.querySelectorAll('.gameplay-choices,button,svg,.fish-collection').forEach(el => el.remove());
 return [...source.querySelectorAll('.adventure-heading,p,.adventure-row,.haul-split,.factory-capital,.production-chain,.factory-order,.wind-forecast,.keep-wave,.keep-health,.catch-reveal,.forge-progress')]
  .filter(el => !el.parentElement?.closest('.adventure-row,.haul-split,.factory-capital,.production-chain,.factory-order,.wind-forecast,.keep-wave,.keep-health,.catch-reveal,.forge-progress,.adventure-heading'))
  .map(el => `<p>${esc(words(el))}</p>`).join('')+choices+(collection?`<h3>Species collection</h3><p>${esc(collection)}</p>`:'');
}

export function fitQuestionText(root) {
 const feedback=root.querySelector('[data-act=read-feedback]');if(feedback){feedback.hidden=![...root.querySelectorAll('.result-reward,.correct-answer strong')].some(el=>el.scrollHeight>el.clientHeight+1);}
 const screen = root.querySelector('.question-screen,.word-screen');
 if (!screen) return;
 const heading = screen.querySelector('.phase-heading');
 const clipped = heading && heading.scrollHeight > heading.clientHeight + 1;
 const answers = [...screen.querySelectorAll('.answer-tile span')];
 const overflow = answers.some(el => el.scrollHeight > el.clientHeight + 1);
 const read = screen.querySelector('[data-act="read-question"]');
 if (read) { read.hidden = !clipped && !overflow && !screen.querySelector('.question-image'); read.textContent = clipped || overflow ? 'Read full question & answers ↗' : 'View question image ↗'; }
}
