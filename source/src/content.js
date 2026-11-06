import sanitizeHtml from 'sanitize-html';

export const CATEGORIES = ['Government','Legislation','Business','Elections','People','Events','Organizations','Other Records'];
export const categorySlug = value => value.toLowerCase().replace(/\s+/g,'-');
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color = /^(#[\da-f]{3,8}|[a-z]{1,20}|rgba?\([\d\s.,%]+\))$/i;
const options = {
  allowedTags: ['p','br','div','span','strong','b','em','i','u','s','del','h1','h2','h3','h4','h5','h6','blockquote','pre','code','ul','ol','li','a','img','figure','figcaption','table','thead','tbody','tfoot','tr','td','th','hr','header','footer','input','sup','sub'],
  allowedAttributes: {
    '*':['style'], a:['href','title','rel'], img:['src','alt','width','height'],
    ul:['data-checklist'], div:['data-editor-header','data-editor-footer'],
    input:['type','checked','disabled'], td:['colspan','rowspan'],th:['colspan','rowspan','scope']
  },
  allowedStyles:{'*':{
    'color':[color],'background-color':[color], 'text-align':[/^(left|center|right|justify)$/],
    'font-size':[/^(?:[8-9]|[1-6]\d|7[0-2])px$/],
    'font-family':[/^["']?(Arial|Georgia|Verdana|Tahoma|Times New Roman|Courier New|serif|sans-serif|monospace)["']?$/i],
    'margin-left':[/^(0|[1-9]\d?|1\d\d|2[0-3]\d|240)px$/],
    'font-weight':[/^(bold|normal|[1-9]00)$/], 'font-style':[/^(normal|italic)$/],
    'text-decoration':[/^(underline|line-through|none)$/]
  }},
  allowedSchemes:['http','https','mailto'], allowedSchemesByTag:{img:['https']},
  allowProtocolRelative:false,
  transformTags:{
    a:(tag,a)=>({tagName:'a',attribs:{...a,rel:'noopener noreferrer nofollow'}}),
    input:(tag,a)=>({tagName:'input',attribs:{type:'checkbox',disabled:'',...(Object.hasOwn(a,'checked')?{checked:''}:{})}}),
    font:(tag,a)=>({tagName:'span',attribs:{style:[a.style||'',a.color?`color:${a.color}`:'',a.face?`font-family:${a.face}`:'',a.size?`font-size:${({1:10,2:13,3:16,4:18,5:24,6:32,7:48})[a.size]||16}px`:''].filter(Boolean).join(';')}})
  },
  exclusiveFilter: frame => frame.tag==='img' && !frame.attribs.src
};

export function stripFence(value) {
  return String(value??'').trim().replace(/^```(?:html)?\s*\n/i,'').replace(/\n```\s*$/,'');
}
export function cleanContent(value) {
  let raw=stripFence(value);
  // Repair previously entity-escaped HTML once, only when it starts with an allowed block tag.
  if (/^&lt;(p|div|h[1-6]|strong|b|ul|ol|table|span|header|footer)(?:&gt;|\s)/i.test(raw)) {
    raw=raw.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
  }
  if (!/<\/?[a-z][^>]*>/i.test(raw)) return raw.split(/\n\s*\n/).map(p=>`<p>${escapeHTML(p).replace(/\n/g,'<br>')}</p>`).join('');
  return sanitizeHtml(raw, options);
}
export function plainText(value) {
  return sanitizeHtml(cleanContent(value).replace(/<\/(?:p|div|h[1-6]|li|tr|td|th|header|footer)>|<br\s*\/?\s*>/gi,' '),{allowedTags:[],allowedAttributes:{}})
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
export function cleanSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,20).map(x=>{
    try { const u=new URL(x.url);return ['https:','http:'].includes(u.protocol)?{title:String(x.title||u.hostname).slice(0,200),url:u.href}:null; }catch{return null;}
  }).filter(Boolean);
}
export function parseSources(value) { try{return cleanSources(JSON.parse(value||'[]'));}catch{return [];} }
