// This script runs only inside a sandboxed, opaque-origin guest iframe.
// It creates an ephemeral view of published data, never grants write access to Supabase.
(function(){
  "use strict";
  const snapshot=window.__kfSnapshot||{local:{},indexed:{}};
  const editable=window.__kfReadOnly===false;
  const local=new Map(Object.entries(snapshot.local||{}));
  if(editable)local.set("kimflora_auth","unlocked");
  else local.delete("kimflora_auth");
  const indexed=new Map(Object.entries(snapshot.indexed||{}));
  // Legacy app checks sessionStorage to decide which controls to render.
  // The guest iframe must never inherit an owner role.
  const ephemeralSession=new Map([["kimflora_role_v2",editable?"owner":"guest"]]);
  const sessionApi={
    getItem:k=>ephemeralSession.has(String(k))?ephemeralSession.get(String(k)):null,
    setItem:(k,v)=>ephemeralSession.set(String(k),String(v)),
    removeItem:k=>ephemeralSession.delete(String(k)),
    clear:()=>ephemeralSession.clear(),
    key:i=>Array.from(ephemeralSession.keys())[i]??null,
    get length(){return ephemeralSession.size;}
  };
  try{Object.defineProperty(window,"sessionStorage",{configurable:true,value:sessionApi});}catch(e){}
  if(!editable){
    const guestCss=document.createElement("style");
    guestCss.textContent=[
      ".kf-guest .knowledge-title-btn,.kf-guest .knowledge-edit-btn,.kf-guest .knowledge-add-section-btn,.kf-guest .knowledge-edit-bar",
      ",.kf-guest .kf-owner-only,.kf-guest .kf-custom-editor,.kf-guest .kf-nav-control",
      ",.kf-guest .age-custom-toolbar,.kf-guest .age-custom-editor",
      ",.kf-guest .palette-save-row,.kf-guest .saved-palette-actions,.kf-guest .preset-palette-actions",
      ",.kf-guest .flower-library-edit-btn,.kf-guest .flower-library-editor",
      ",.kf-guest .visual-color-editor,.kf-guest input[type=file]",
      ",.kf-guest .knowledge-title-btn,.kf-guest [contenteditable=true]{display:none!important}"
    ].join("");
    document.head.appendChild(guestCss);
    const guardedButtons=/^(?:(?:✏️|✎|🖊️|🗑️|💾|\+|＋)\s*)*(?:chỉnh sửa|sửa(?:\s+[^\s]+)?|đổi tiêu đề|đổi tên|thêm(?:\s+|$)|tạo(?:\s+|$)|lưu(?:\s+|$)|xóa(?:\s+|$)|xoá(?:\s+|$)|khôi phục(?:\s+bản|\s+nội dung)|nhập(?:\s+tệp|\s+dữ liệu)|tải(?:\s+lên|\s+tệp)|đặt lại|cập nhật(?:\s+nội dung|\s+dữ liệu))/i;
    const editorialClasses=["knowledge-title-btn","knowledge-edit-btn","knowledge-add-section-btn","knowledge-edit-bar","kf-owner-only","kf-custom-editor","kf-nav-control","age-custom-toolbar","age-custom-editor","palette-save-row","saved-palette-actions","preset-palette-actions","flower-library-edit-btn","flower-library-editor","visual-color-editor"];
    const guardEditors=()=>{
      document.body?.classList.add("kf-guest");
      document.querySelectorAll('[contenteditable], [designmode="on"]').forEach(el=>{
        el.removeAttribute("contenteditable");el.removeAttribute("designmode");
      });
      for(const name of editorialClasses)document.querySelectorAll("."+name).forEach(el=>{el.hidden=true;el.style.setProperty("display","none","important");});
      document.querySelectorAll('button,input[type="submit"],[role="button"]').forEach(el=>{
        if(el.closest(".header-actions")||el.classList.contains("knowledge-back"))return;
        const label=(el.textContent||el.value||el.getAttribute("aria-label")||"").replace(/\\s+/g," ").trim();
        if(guardedButtons.test(label)){
          el.hidden=true;el.style.setProperty("display","none","important");
        }
      });
      document.querySelectorAll('input[type="file"]').forEach(el=>{el.disabled=true;el.hidden=true;});
    };
    // Guest-facing interactions are only for browsing and trying color combinations;
    // no changes are ever persisted or sent to the server.
    document.addEventListener("click",e=>{
      const btn=e.target.closest('button,[role="button"],input[type="submit"]');
      if(!btn||btn.closest(".header-actions"))return;
      const label=(btn.textContent||btn.value||"").replace(/\\s+/g," ").trim();
      if(guardedButtons.test(label)||editorialClasses.some(c=>btn.classList.contains(c))){
        e.preventDefault();e.stopImmediatePropagation();
      }
    },true);
    document.addEventListener("DOMContentLoaded",()=>{
      guardEditors();
      const watch=new MutationObserver(records=>{
        let mustCheck=false;
        for(const rec of records){
          if(rec.type==="attributes"&&rec.target.matches?.('[contenteditable="true"]')){
            rec.target.removeAttribute("contenteditable");
          }
          if(rec.type==="childList"&&rec.addedNodes.length)mustCheck=true;
        }
        if(mustCheck)guardEditors();
      });
      watch.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["contenteditable","designmode"]});
    },{once:true});
  }
  const syncKey=k=>/^(kimflora_|kf_)/i.test(String(k))&&!/auth|password|secret|token|session|pin/i.test(String(k));
  const signal=(area,key,value,removed=false)=>{
    if(!editable||!syncKey(key))return;
    window.parent.postMessage({type:"kf-sync-change",area,key:String(key),value,removed},"*");
  };
  const storage={
    getItem:k=>local.has(String(k))?String(local.get(String(k))):null,
    setItem:(k,v)=>{const key=String(k),value=String(v);local.set(key,value);signal("local",key,value);},
    removeItem:k=>{const key=String(k);local.delete(key);signal("local",key,null,true);},
    clear:()=>{const keys=[...local.keys()];local.clear();for(const key of keys)signal("local",key,null,true);},
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
        put:(value,key)=>{const k=String(key);indexed.set(k,value);completed();signal("indexed",k,value);return {};},
        delete:key=>{const k=String(key);indexed.delete(k);completed();signal("indexed",k,null,true);return {};}
      });
      return tx;
    }
  };
  const idb={
    open:()=>{const r={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};setTimeout(()=>{r.onupgradeneeded?.({target:r});r.onsuccess?.({target:r});},0);return r;}
  };
  try{Object.defineProperty(window,"indexedDB",{configurable:true,value:idb});}catch(e){console.warn("Guest indexed storage unavailable",e);}
  document.addEventListener("click",e=>{
    if(!editable)return;
    const title=e.target.closest("h1, .header h2, [class*=studio-title], [class*=brand]");
    if(title && /^Kim\s*Flora\s*Studio$/i.test((title.textContent||"").trim())){
      e.preventDefault();e.stopImmediatePropagation();
      window.parent.postMessage({type:"kf-open-account-settings"},"*");
    }
  },true);
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

  // Minimal custom navigation: unchanged built-in tabs remain controlled by the original application.
  const NAV_KEY="kimflora_custom_nav_v1";
  let navState={names:{},tabs:[]};
  let customActive=null;
  let renameNext=false;
  function loadNav(){
    try{
      const saved=JSON.parse(storage.getItem(NAV_KEY)||"{}");
      if(saved && typeof saved==="object"){
        navState.names=saved.names&&typeof saved.names==="object"?saved.names:{};
        navState.tabs=Array.isArray(saved.tabs)?saved.tabs.filter(x=>x && typeof x.id==="string" && typeof x.name==="string"): [];
      }
    }catch(_){}
  }
  function saveNav(){if(editable)storage.setItem(NAV_KEY,JSON.stringify(navState));}
  function initialNav(){
    const bar=document.querySelector(".header-actions");
    const header=document.querySelector(".header");
    if(!bar||!header)return;
    loadNav();
    const original=[...bar.querySelectorAll(":scope > button")].filter(b=>!b.classList.contains("btn-relock"));
    original.forEach((button,index)=>{
      const id="base-"+index;
      button.dataset.kfNavId=id;
      if(typeof navState.names[id]==="string" && navState.names[id])button.textContent=navState.names[id];
    });
    const host=document.createElement("section");
    host.id="kfCustomPage";
    host.hidden=true;
    host.innerHTML='<div class="kf-custom-card"><h2 id="kfCustomTitle"></h2><div id="kfCustomEditor" class="kf-custom-editor"></div></div>';
    header.after(host);
    const title=host.querySelector("#kfCustomTitle");
    const editor=host.querySelector("#kfCustomEditor");
    editor.contentEditable=String(editable);
    function hideCustom(){
      if(customActive!==null)persistCustom();
      customActive=null;
      host.hidden=true;
      document.body.classList.remove("kf-custom-open");
    }
    function persistCustom(){
      if(!editable||customActive===null)return;
      const item=navState.tabs.find(x=>x.id===customActive);
      if(item){item.html=editor.innerHTML;saveNav();}
    }
    let saveTimer=0;
    editor.addEventListener("input",()=>{
      if(!editable)return;
      clearTimeout(saveTimer);
      saveTimer=setTimeout(persistCustom,350);
    });
    editor.addEventListener("blur",persistCustom,true);
    function showCustom(item){
      if(customActive!==null)persistCustom();
      customActive=item.id;
      title.textContent=item.name.toLocaleUpperCase("vi-VN");
      editor.innerHTML=typeof item.html==="string"?item.html:"";
      editor.contentEditable=String(editable);
      document.body.classList.add("kf-custom-open");
      document.body.classList.remove("knowledge-mode");
      document.querySelectorAll(".knowledge-page.active").forEach(p=>{p.classList.remove("active");p.setAttribute("aria-hidden","true");});
      host.hidden=false;
      window.scrollTo({top:0,behavior:"instant"});
    }
    function rename(button){
      if(!editable)return;
      const id=button.dataset.kfNavId;
      if(!id)return;
      const previous=button.textContent.trim();
      const entered=prompt("Tên tab",previous);
      if(entered===null)return;
      const next=entered.trim().slice(0,100);
      if(!next || next===previous)return;
      if(id.startsWith("base-"))navState.names[id]=next;
      else{
        const item=navState.tabs.find(x=>x.id===id);
        if(item){item.name=next;if(customActive===id)title.textContent=next.toLocaleUpperCase("vi-VN");}
      }
      button.textContent=next;
      saveNav();
    }
    function addCustomButton(item){
      const button=document.createElement("button");
      button.type="button";
      button.className="btn-knowledge kf-custom-tab";
      button.dataset.kfNavId=item.id;
      button.textContent=item.name;
      button.addEventListener("click",()=>showCustom(item));
      bar.insertBefore(button,bar.querySelector(".btn-relock"));
      return button;
    }
    navState.tabs.forEach(addCustomButton);
    bar.addEventListener("click",e=>{
      const btn=e.target.closest("button[data-kf-nav-id]");
      if(!btn)return;
      if(renameNext){
        e.preventDefault();
        e.stopImmediatePropagation();
        renameNext=false;
        rename(btn);
        return;
      }
      if(btn.dataset.kfNavId.startsWith("base-"))hideCustom();
    },true);
    if(editable){
      const add=document.createElement("button");
      add.type="button";add.className="kf-nav-control";
      add.textContent="+ Tab";add.title="Thêm tab";
      add.onclick=()=>{
        const name=prompt("Tên tab mới");
        if(name===null||!name.trim())return;
        const item={id:"added-"+crypto.randomUUID(),name:name.trim().slice(0,100),html:""};
        navState.tabs.push(item);saveNav();
        const button=addCustomButton(item);
        showCustom(item);
        button.scrollIntoView({inline:"nearest",block:"nearest"});
      };
      const renameButton=document.createElement("button");
      renameButton.type="button";renameButton.className="kf-nav-control";
      renameButton.textContent="Đổi tên";renameButton.title="Bấm Đổi tên rồi chọn tab cần sửa";
      renameButton.onclick=()=>{renameNext=!renameNext;renameButton.classList.toggle("active",renameNext);};
      // Keep original tabs and lock button in place.
      bar.append(add,renameButton);
    }
  }
  function formatPastedImage(img){
    if(!img||img.nodeName!=="IMG")return;
    img.setAttribute("width","189");
    img.setAttribute("height","265");
    img.style.width="5cm";img.style.height="7cm";
    img.style.objectFit="contain";
    img.style.maxWidth="100%";
    img.dataset.kfPasted="1";
  }
  function pasteImage(e){
    if(!editable||!e.target.closest("[contenteditable=true]"))return;
    const items=[...(e.clipboardData?.items||[])];
    const item=items.find(x=>x.type.startsWith("image/"));
    if(!item)return;
    const file=item.getAsFile();
    if(!file)return;
    e.preventDefault();
    const selection=window.getSelection();
    const range=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;
    const reader=new FileReader();
    reader.onload=()=>{
      const img=document.createElement("img");
      img.src=String(reader.result);formatPastedImage(img);
      const target=e.target.closest("[contenteditable=true]");
      if(range&&target?.contains(range.commonAncestorContainer)){
        range.deleteContents();range.insertNode(img);
        range.setStartAfter(img);range.collapse(true);
        selection.removeAllRanges();selection.addRange(range);
      }else target?.append(img);
      target?.dispatchEvent(new Event("input",{bubbles:true}));
    };
    reader.readAsDataURL(file);
  }
  document.addEventListener("paste",pasteImage,true);
  // For pasted rich HTML (e.g. an image within a copied article), only affect newly added images.
  document.addEventListener("paste",e=>{
    if(!editable||!e.target.closest("[contenteditable=true]"))return;
    if([...(e.clipboardData?.items||[])].some(x=>x.type.startsWith("image/")))return;
    const target=e.target.closest("[contenteditable=true]");
    const before=new Set(target.querySelectorAll("img"));
    setTimeout(()=>target.querySelectorAll("img").forEach(img=>{if(!before.has(img))formatPastedImage(img);}),0);
  },true);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialNav,{once:true});
  else initialNav();
})();
