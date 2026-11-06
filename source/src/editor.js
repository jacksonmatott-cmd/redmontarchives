import DOMPurify from 'dompurify';

export const safeHTML=value=>DOMPurify.sanitize(value||'',{ADD_ATTR:['data-checklist','data-editor-header','data-editor-footer'],FORBID_TAGS:['style','script','iframe','object','embed','form','button','select','textarea'],FORBID_ATTR:['id','name']});
export function mountEditor(host,initial,onChange){
 host.className='editor';
 host.innerHTML=`<div class="editor-toolbar" role="toolbar" aria-label="Document formatting">
  <div class="tool-group"><button type="button" data-cmd="undo" title="Undo (Ctrl+Z)">↶<span class="sr-only">Undo</span></button><button type="button" data-cmd="redo" title="Redo (Ctrl+Y)">↷<span class="sr-only">Redo</span></button></div>
  <div class="tool-group"><label class="sr-only" for="block-style">Paragraph style</label><select id="block-style" data-select="formatBlock"><option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option><option value="pre">Code block</option></select><label class="sr-only" for="font-face">Font</label><select id="font-face" data-select="fontName"><option>Georgia</option><option>Arial</option><option>Verdana</option><option>Times New Roman</option><option>Courier New</option></select><label class="sr-only" for="font-size">Font size</label><select id="font-size" data-size><option>16</option><option>10</option><option>12</option><option>14</option><option>18</option><option>20</option><option>24</option><option>32</option><option>48</option><option>72</option></select></div>
  <div class="tool-group"><button type="button" data-cmd="bold" aria-label="Bold" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button><button type="button" data-cmd="underline" aria-label="Underline"><u>U</u></button><button type="button" data-cmd="strikeThrough" aria-label="Strikethrough"><s>S</s></button><label class="color-tool" title="Text color">A<input type="color" value="#202c3d" data-color="foreColor" aria-label="Text color"></label><label class="color-tool" title="Highlight color">▰<input type="color" value="#fff0b3" data-color="hiliteColor" aria-label="Highlight color"></label></div>
  <div class="tool-group"><button type="button" data-cmd="justifyLeft" aria-label="Align left">Left</button><button type="button" data-cmd="justifyCenter" aria-label="Align center">Center</button><button type="button" data-cmd="justifyRight" aria-label="Align right">Right</button><button type="button" data-cmd="justifyFull" aria-label="Justify text">Justify</button></div>
  <div class="tool-group"><button type="button" data-cmd="insertUnorderedList" aria-label="Bullet list">• List</button><button type="button" data-cmd="insertOrderedList" aria-label="Numbered list">1. List</button><button type="button" data-action="checklist">☑ Checklist</button><button type="button" data-cmd="outdent" aria-label="Decrease indent">← Indent</button><button type="button" data-cmd="indent" aria-label="Increase indent">Indent →</button></div>
  <div class="tool-group"><button type="button" data-action="link">Link</button><button type="button" data-cmd="unlink">Unlink</button><button type="button" data-action="image">Image</button><button type="button" data-action="table">Table</button><button type="button" data-action="header">Header</button><button type="button" data-action="footer">Footer</button><button type="button" data-cmd="insertHorizontalRule">Rule</button><button type="button" data-cmd="removeFormat">Clear formatting</button></div>
 </div><div class="editor-surface richtext" contenteditable="true" role="textbox" aria-label="Document content" aria-multiline="true" spellcheck="true"></div><div class="editor-status"><span data-word-count>0 words</span><span>Ctrl+B bold · Ctrl+I italic · Ctrl+Z undo</span></div>`;
 const surface=host.querySelector('.editor-surface');let saved=null;
 function capture(){const s=window.getSelection();if(s?.rangeCount&&surface.contains(s.anchorNode)&&surface.contains(s.focusNode))saved=s.getRangeAt(0).cloneRange();}
 function restore(){surface.focus();const s=window.getSelection();s.removeAllRanges();if(saved&&surface.contains(saved.commonAncestorContainer))s.addRange(saved);else{const range=document.createRange();range.selectNodeContents(surface);range.collapse(false);s.addRange(range);}}
 function change(){capture();host.querySelector('[data-word-count]').textContent=`${surface.innerText.trim().split(/\s+/).filter(Boolean).length} words`;onChange?.();}
 function command(cmd,value=null){restore();document.execCommand('styleWithCSS',false,true);document.execCommand(cmd,false,value);change();}
 function insert(html){command('insertHTML',html);}
 surface.addEventListener('input',change);surface.addEventListener('keyup',capture);surface.addEventListener('mouseup',capture);
 surface.addEventListener('change',event=>{if(event.target.type==='checkbox'){event.target.toggleAttribute('checked',event.target.checked);change();}});
 surface.addEventListener('paste',event=>{
  const clipboard=event.clipboardData;if(!clipboard)return;event.preventDefault();capture();
  const html=clipboard.getData('text/html');
  if(html)insert(safeHTML(html));else command('insertText',clipboard.getData('text/plain'));
 });
 host.querySelectorAll('button').forEach(button=>{
  button.addEventListener('mousedown',e=>e.preventDefault());
  button.addEventListener('click',()=>{if(button.dataset.cmd)command(button.dataset.cmd);else openDialog(button.dataset.action);});
 });
 host.querySelectorAll('select,input[type=color]').forEach(control=>{
  control.addEventListener('pointerdown',capture);
  control.addEventListener('change',()=>{
   if(control.dataset.select)command(control.dataset.select,control.value);
   else if(control.dataset.color)command(control.dataset.color,control.value);
   else{
    restore();document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');
    surface.querySelectorAll('font[size="7"]').forEach(el=>{const span=document.createElement('span');span.style.fontSize=control.value+'px';while(el.firstChild)span.append(el.firstChild);el.replaceWith(span);});
    document.execCommand('styleWithCSS',false,true);change();
   }
  });
 });
 function openDialog(action){
  if(action==='checklist'){insert('<ul data-checklist="true"><li><input type="checkbox"> Checklist item</li><li><input type="checkbox"> Checklist item</li></ul><p><br></p>');return;}
  if(action==='header'||action==='footer'){insert(`<div data-editor-${action}="true"><p>${action==='header'?'Header text':'Footer text'}</p></div><p><br></p>`);return;}
  const dialog=document.createElement('dialog');dialog.className='insert-dialog';
  const fields=action==='table'?'<label>Rows<input name="rows" type="number" min="1" max="20" value="3" required></label><label>Columns<input name="columns" type="number" min="1" max="10" value="3" required></label><label class="check-label"><input name="headers" type="checkbox" checked> First row contains headings</label>':`<label>${action==='image'?'Image URL (HTTPS)':'Link URL'}<input name="url" type="url" placeholder="https://" required></label><label>${action==='image'?'Image description (alt text)':'Link text (optional)'}<input name="text" maxlength="300"></label>`;
  dialog.innerHTML=`<form><h2>Insert ${action}</h2>${fields}<p class="form-error" role="alert"></p><div class="actions"><button type="button" class="secondary" data-cancel>Cancel</button><button class="primary">Insert</button></div></form>`;
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=event=>{
   event.preventDefault();const data=new FormData(event.currentTarget);let html='';
   const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   if(action==='table'){
    const rows=+data.get('rows'),cols=+data.get('columns');if(rows<1||rows>20||cols<1||cols>10)return;
    html='<table><tbody>'+Array.from({length:rows},(_,i)=>'<tr>'+Array.from({length:cols},()=>i===0&&data.get('headers')?'<th>Heading</th>':'<td><br></td>').join('')+'</tr>').join('')+'</tbody></table><p><br></p>';
   }else{
    const url=new URL(data.get('url'));
    if(!(action==='image'?['https:']:['https:','http:','mailto:']).includes(url.protocol)){dialog.querySelector('.form-error').textContent='Use a valid '+(action==='image'?'HTTPS image':'HTTP, HTTPS or email')+' URL.';return;}
    if(action==='image')html=`<figure><img src="${esc(url.href)}" alt="${esc(data.get('text'))}"><figcaption>${esc(data.get('text'))}</figcaption></figure><p><br></p>`;
    else if(data.get('text')||!saved||saved.collapsed)html=`<a href="${esc(url.href)}">${esc(data.get('text')||url.href)}</a>`;
    else {dialog.close();command('createLink',url.href);return;}
   }
   dialog.close();insert(html);
  };
  dialog.showModal();
 }
 const observer=new MutationObserver(()=>surface.querySelectorAll('input[type=checkbox][disabled]').forEach(x=>x.disabled=false));observer.observe(surface,{subtree:true,childList:true});
 function setHTML(value){surface.innerHTML=safeHTML(value);surface.querySelectorAll('input[type=checkbox]').forEach(x=>x.disabled=false);saved=null;}
 setHTML(initial);
 return {getHTML:()=>surface.innerHTML,setHTML,focus:()=>surface.focus(),surface,destroy:()=>observer.disconnect()};
}
