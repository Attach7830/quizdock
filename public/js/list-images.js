import {imageURL,escapeHTML} from './list-model.js';
export function imageMarkup(question,small=false){let url;try{url=imageURL(question.image);}catch{return '';}
 if(!url)return '';return `<figure class="question-image ${small?'small-image':''}"><img src="${escapeHTML(url)}" alt="${escapeHTML(question.imageAlt||'Question image')}" referrerpolicy="no-referrer" decoding="async" ${small?'loading="lazy"':''}><figcaption hidden>Image unavailable. Check the link or ask your teacher before answering.</figcaption></figure>`;
}
export function installImageFallback(){document.addEventListener('error',e=>{if(e.target?.matches?.('.question-image img')){e.target.hidden=true;e.target.parentElement.querySelector('figcaption').hidden=false;}},true);}
