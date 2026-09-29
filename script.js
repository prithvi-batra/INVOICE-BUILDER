/* Quick Invoice is deliberately session-only: no localStorage, backend, or saved catalog. */
const $ = (id) => document.getElementById(id);
const fields = ['customer-name','customer-phone','invoice-date','shipping'];
const currency = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2});
let itemId = 0;

function invoiceNumber(){ return `INV-${String(Math.floor(Math.random()*9999)+1).padStart(4,'0')}`; }
function money(value){ return currency.format(Number(value)||0).replace(/\.00$/, ''); }
function text(id, value, fallback=''){ $(id).textContent = value || fallback; }
function addItem(name='', qty=1, price=''){
  const id = ++itemId;
  const row = document.createElement('div'); row.className='item-editor'; row.dataset.id=id;
  row.innerHTML=`<span class="serial"></span><label>Item name<input class="item-name-input" type="text" placeholder="Item name" value="${escapeHtml(name)}" aria-label="Item name" /></label><label>Qty<input class="qty-input" type="number" min="1" step="1" value="${qty}" inputmode="numeric" aria-label="Quantity" /></label><label>Sale price<input class="price-input" type="number" min="0" step="0.01" value="${price}" inputmode="decimal" aria-label="Sale price in rupees" /></label><button class="remove-item" type="button" aria-label="Remove item">×</button>`;
  $('item-editor-list').append(row);
  row.querySelectorAll('input').forEach(input=>input.addEventListener('input', normalizeAndRender));
  row.querySelector('.remove-item').addEventListener('click',()=>{ row.remove(); if(!itemRows().length) addItem(); render(); });
  render();
}
function escapeHtml(value){const box=document.createElement('div');box.textContent=value;return box.innerHTML;}
function itemRows(){ return [...document.querySelectorAll('.item-editor')]; }
function normalizeAndRender(event){
  const input=event?.target;
  if(input?.classList.contains('qty-input') && (+input.value<1 || !input.value)) input.value=1;
  if(input?.classList.contains('price-input') && +input.value<0) input.value=0;
  if(input?.id==='shipping' && +input.value<0) input.value=0;
  render();
}
function currentItems(){return itemRows().map((row,index)=>({number:index+1,name:row.querySelector('.item-name-input').value.trim()||'Item',qty:Math.max(1,Number(row.querySelector('.qty-input').value)||1),price:Math.max(0,Number(row.querySelector('.price-input').value)||0)}));}
function render(){
  const items=currentItems(); const shipping=Math.max(0,Number($('shipping').value)||0);
  itemRows().forEach((row,i)=>row.querySelector('.serial').textContent=`${i+1}.`);
  text('preview-customer-name',$('customer-name').value.trim(),'Customer name'); text('preview-customer-phone',$('customer-phone').value.trim());
  text('preview-invoice-number',$('invoice-number').value); text('preview-date',formatDate($('invoice-date').value));
  let subtotal=0, original=0, pieces=0;
  $('preview-items').innerHTML=items.map(item=>{const mrp=item.price/0.85,total=item.qty*item.price;subtotal+=total;original+=item.qty*mrp;pieces+=item.qty;return `<tr><td>${item.number}</td><td><span class="item-name">${escapeHtml(item.name)}</span></td><td>${item.qty}</td><td><span class="mrp">${money(mrp)}</span></td><td><span class="sale-price">${money(item.price)}</span></td><td>${money(total)}</td></tr>`;}).join('');
  const savings=original-subtotal; text('preview-pieces',pieces); text('preview-subtotal',money(subtotal)); text('preview-savings',money(savings)); text('preview-grand-total',money(subtotal+shipping));
  $('preview-shipping-row').hidden=shipping<=0; text('preview-shipping',money(shipping));
}
function formatDate(iso){if(!iso)return '';const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;}
function validCustomer(){const name=$('customer-name').value.trim();const error=$('customer-error');error.textContent=name?'':'Please enter the customer name before continuing.';if(!name)$('customer-name').focus();return Boolean(name);}
function setMessage(message,type=''){const el=$('action-message');el.textContent=message;el.className=`action-message ${type}`;}
async function createPdf(){
  render(); const paper=$('invoice-paper');
  if(!window.html2canvas||!window.jspdf) throw new Error('PDF tools are still loading. Please try again in a moment.');
  paper.classList.add('pdf-mode');
  try{
    const canvas=await html2canvas(paper,{scale:3,useCORS:true,backgroundColor:'#ffffff',logging:false});
    const { jsPDF }=window.jspdf; const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a5',compress:true});
    pdf.addImage(canvas.toDataURL('image/jpeg',.95),'JPEG',0,0,148,210,undefined,'FAST');
    return pdf;
  } finally { paper.classList.remove('pdf-mode'); }
}
async function downloadPdf(){if(!validCustomer())return;try{setMessage('Preparing your PDF…');const pdf=await createPdf();pdf.save(`Invoice-${$('invoice-number').value}.pdf`);setMessage('Your PDF download has started.','success');}catch(e){setMessage(e.message,'error');}}
async function shareInvoice(){if(!validCustomer())return;try{setMessage('Preparing your invoice…');const pdf=await createPdf();const file=new File([pdf.output('blob')],`Invoice-${$('invoice-number').value}.pdf`,{type:'application/pdf'});const summary=`Invoice ${$('invoice-number').value} for ${$('customer-name').value} — ${$('preview-grand-total').textContent}`;
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Quick Invoice',text:summary,files:[file]});setMessage('Invoice shared.','success');}
  else if(navigator.share){await navigator.share({title:'Quick Invoice',text:summary});setMessage('Invoice summary shared.','success');}
  else {pdf.save(`Invoice-${$('invoice-number').value}.pdf`);try{await navigator.clipboard.writeText(summary);setMessage('PDF downloaded and invoice summary copied.','success');}catch{setMessage('File sharing is unavailable here, so the PDF was downloaded.','success');}}
}catch(e){if(e.name==='AbortError')setMessage('Sharing cancelled.');else setMessage('Could not share the invoice. Please download the PDF instead.','error');}}
async function printInvoice(){
  if(!validCustomer())return;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!isIOS){render();window.print();return;}
  try{
    setMessage('Preparing a printer-ready PDF…');
    const pdf=await createPdf();
    const file=new File([pdf.output('blob')],`Invoice-${$('invoice-number').value}.pdf`,{type:'application/pdf'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({title:'Quick Invoice',files:[file]});
      setMessage('Choose Print from the iPhone share menu for a clean invoice.','success');
    }else{
      pdf.save(`Invoice-${$('invoice-number').value}.pdf`);
      setMessage('PDF downloaded. Open it in Files, then choose Share → Print.','success');
    }
  }catch(e){if(e.name!=='AbortError')setMessage('Could not prepare the printer-ready PDF. Please use Download PDF.','error');}
}
function invoiceFile(){return {version:1,invoiceNumber:$('invoice-number').value,date:$('invoice-date').value,customerName:$('customer-name').value,customerPhone:$('customer-phone').value,shipping:$('shipping').value,items:currentItems()};}
function saveInvoice(){const content=JSON.stringify(invoiceFile(),null,2);const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`Invoice-${$('invoice-number').value}.json`;link.click();URL.revokeObjectURL(url);setMessage('Invoice file saved. You can open it later to continue editing.','success');}
function openInvoice(event){const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.items))throw new Error();$('invoice-number').value=data.invoiceNumber||invoiceNumber();$('invoice-date').value=data.date||$('invoice-date').value;$('customer-name').value=data.customerName||'Customer';$('customer-phone').value=data.customerPhone||'';$('shipping').value=Math.max(0,Number(data.shipping)||0);$('item-editor-list').innerHTML='';(data.items.length?data.items:[{}]).forEach(item=>addItem(item.name||'',Math.max(1,Number(item.qty)||1),Math.max(0,Number(item.price)||0)));render();setMessage('Saved invoice opened. You can edit it now.','success');}catch{setMessage('That file is not a valid Quick Invoice file.','error');}event.target.value='';};reader.readAsText(file);}

const today=new Date(); $('invoice-date').value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-'); $('invoice-number').value=invoiceNumber();
function addNewItem(event){
  if(event) event.preventDefault();
  addItem();
  const rows=itemRows();
  const newItem=rows[rows.length-1];
  window.setTimeout(function(){
    const nameInput=newItem.querySelector('.item-name-input');
    if(nameInput) nameInput.focus();
    if(newItem) newItem.scrollIntoView(true);
  },0);
}
fields.forEach(id=>$(id).addEventListener('input',normalizeAndRender));
$('add-item').addEventListener('click',addNewItem);
$('add-item').addEventListener('touchend',addNewItem,{passive:false});
$('download-pdf').addEventListener('click',downloadPdf); $('share-invoice').addEventListener('click',shareInvoice); $('print-invoice').addEventListener('click',printInvoice);
$('save-invoice').addEventListener('click',saveInvoice); $('open-invoice').addEventListener('change',openInvoice);
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install-app').hidden=false;});
$('install-app').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('install-app').hidden=true;});
window.addEventListener('appinstalled',()=>{setMessage('Quick Invoice was installed on your device.','success');$('install-app').hidden=true;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
addItem(); render();
