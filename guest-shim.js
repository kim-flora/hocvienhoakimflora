// This script runs only inside a sandboxed, opaque-origin guest iframe.
// It creates an ephemeral view of published data, never grants write access to Supabase.
(function(){
  "use strict";
  const snapshot=window.__kfSnapshot||{local:{},indexed:{}};
  const local=new Map(Object.entries(snapshot.local||{}));
  local.set("kimflora_auth","unlocked");
  const indexed=new Map(Object.entries(snapshot.indexed||{}));
  const editable=window.__kfReadOnly===false;
  const signal=()=>{if(editable) window.parent.postMessage({type:"kf-dirty"},"*");};
  const storage={
    getItem:k=>local.has(String(k))?String(local.get(String(k))):null,
    setItem:(k,v)=>{local.set(String(k),String(v));signal();},
    removeItem:k=>{local.delete(String(k));signal();},
    clear:()=>{local.clear();signal();},
    key:i=>Array.from(local.keys())[i]??null,
    get length(){return local.size;}
  };
  try{Object.defineProperty(window,"localStorage",{configurable:true,value:storage});}catch(e){console.warn("Guest storage unavailable",e);}
  const db={
    objectStoreNames:{contains:()=>true},
    createObjectStore:()=>{},
    transaction:()=>{
      const tx={oncomplete:null,onerror:null,onabort:null};
      const completed=()=>setTimeout(()=>tx.oncomplete?.(),0);
      tx.objectStore=()=>({
        get:key=>{const r={result:null,onsuccess:null,onerror:null};setTimeout(()=>{r.result=indexed.get(String(key))??null;r.onsuccess?.({target:r});},0);return r;},
        put:(value,key)=>{indexed.set(String(key),value);signal();completed();return {};},
        delete:key=>{indexed.delete(String(key));signal();completed();return {};}
      });
      return tx;
    }
  };
  const idb={
    open:()=>{const r={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};setTimeout(()=>{r.onupgradeneeded?.({target:r});r.onsuccess?.({target:r});},0);return r;}
  };
  try{Object.defineProperty(window,"indexedDB",{configurable:true,value:idb});}catch(e){console.warn("Guest indexed storage unavailable",e);}
  document.addEventListener("click",e=>{
    const b=e.target.closest("button,[role=button],input[type=submit]");
    if(!b||editable)return;
    const txt=(b.textContent||b.value||"").trim();
    if(/^[✏️✎＋+💾🗑️\s]*(?:thêm|sửa|chỉnh sửa|xóa|xoá|lưu|đổi tên|tạo mới)/i.test(txt)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener("message",e=>{
    if(e.data?.type==="kf-export"&&editable){
      const exported={format:1,capturedAt:new Date().toISOString(),local:Object.fromEntries([...local].filter(([k])=>/^(kimflora_|kf_)/i.test(k)&&!/auth|password|secret|token|session|pin/i.test(k))),indexed:Object.fromEntries([...indexed].filter(([k])=>/^(kimflora_|kf_)/i.test(k)&&!/auth|password|secret|token|session|pin/i.test(k)))};
      window.parent.postMessage({type:"kf-snapshot",snapshot:exported},"*");return;
    }
    if(e.data?.type!=="kimflora-search")return;
    const term=String(e.data.term||"").trim().toLowerCase();
    if(!term)return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest("script,style,noscript"))continue;
      const at=(node.nodeValue||"").toLowerCase().indexOf(term);
      if(at<0)continue;
      const details=node.parentElement?.closest("details");
      if(details)details.open=true;
      const range=document.createRange();
      range.setStart(node,at);range.setEnd(node,at+term.length);
      try{const mark=document.createElement("mark");range.surroundContents(mark);mark.scrollIntoView({block:"center"});}catch(_){}
      break;
    }
  });
})();
