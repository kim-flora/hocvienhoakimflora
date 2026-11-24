const pageActions = {
  openColorKnowledge: "colorKnowledgePage",
  openVisualColorKnowledge: "visualColorKnowledgePage",
  openDisplayKnowledge: "displayKnowledgePage",
  openMediaKnowledge: "mediaKnowledgePage",
  openChatGPTKnowledge: "chatgptKnowledgePage",
  openCareKnowledge: "careKnowledgePage",
  openFlowerLibrary: "flowerLibraryPage",
  openDeliveryKnowledge: "deliveryKnowledgePage",
  openFruitTrayKnowledge: "fruitTrayKnowledgePage",
  openCompositionKnowledge: "compositionKnowledgePage"
};

function connectFrame(actions, selected, titles, editable, labels, tabs) {
  const send = (type, key) => parent.postMessage({ channel: "kf-module", type, key }, "*");
  const pending = new Set();
  function loadVisible() {
    for (const node of document.querySelectorAll("[data-kf-fragment]")) {
      const details = node.closest("details");
      if (!node.dataset.kfFragment.endsWith("/intro") && (!details?.open || !node.getClientRects().length)) continue;
      const key = node.dataset.kfFragment;
      if (!pending.has(key)) {
        pending.add(key);
        send("lesson", key);
      }
    }
  }
  window.addEventListener("message", event => {
    const message = event.data;
    if (event.source === parent && message?.channel === 'kf-module-saved') {
      const body = document.querySelector('[data-kf-loaded="' + CSS.escape(message.key) + '"]');
      if (body) body.innerHTML = message.body;
      return;
    }
    if (event.source !== parent || message?.channel !== "kf-module-result" || !pending.delete(message.key)) return;
    const node = document.querySelector('[data-kf-fragment="' + CSS.escape(message.key) + '"]');
    if (!node || message.error) return;
    const template = document.createElement("template");
    template.innerHTML = message.html;
    if (message.body !== null && template.content.firstElementChild) {
      template.content.firstElementChild.innerHTML = message.body;
    }
    if (template.content.firstElementChild) template.content.firstElementChild.dataset.kfLoaded = message.key;
    node.replaceWith(template.content);
  });
  document.addEventListener("click", event => {
    const control = event.target.closest("button[onclick]");
    const action = control?.getAttribute("onclick")?.trim().match(/^(\w+)\(\);?$/)?.[1];
    const target = actions[action] || (control?.matches(".knowledge-back") ? "root" : null);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    send("page", target);
  }, true);
  window.addEventListener("load", () => {
    const buttons = Object.entries(actions).map(([name,key])=>[document.querySelector('button[onclick^="'+name+'("]'),key]).filter(([node])=>node);
    const bar=buttons[0]?.[0].parentElement;
    if(bar && editable){
      function add(text,onclick){const b=document.createElement("button");b.type="button";b.className=buttons[0][0].className;b.textContent=text;b.onclick=onclick;bar.append(b);return b;}
      for(const [key,entry] of Object.entries(tabs).sort((a,b)=>a[1].position-b[1].position)){
        const found=buttons.find(pair=>pair[1]===key);
        if(found)found[0].textContent=entry.title;
        else if(key.startsWith("tab-"))buttons.push([add(entry.title,()=>send("page",key)),key]);
      }
      add("+ Thêm tab",()=>send("addTab","root"));
      add("Đổi tên tab",()=>{
        const select=document.createElement("select");select.add(new Option("Chọn tab cần đổi tên",""));
        for(const [node,key] of buttons)select.add(new Option(node.textContent,key));
        select.onchange=()=>{if(select.value)parent.postMessage({channel:"kf-module",type:"renameTab",key:select.value,caption:select.selectedOptions[0].textContent,revision:tabs[select.value]?.revision||0},"*");select.remove();};
        bar.append(select);select.focus();
      });
    }
    if (selected === "compositionKnowledgePage") {
      for (const node of document.querySelectorAll("[data-kf-fragment]")) {
        const title = titles[node.dataset.kfFragment.split("/")[1]];
        const label = node.closest("details")?.querySelector(":scope > summary > span.knowledge-index + span");
        if (label && typeof title === "string") label.textContent = title;
      }
    }
    if (selected !== "root") {
      const action = Object.keys(actions).find(name => actions[name] === selected);
      if (action && typeof window[action] === "function") window[action]();
    }
    const page = document.getElementById(selected);
    if (page && editable) {
      const heading=page.querySelector(".knowledge-hero h2,h2");
      if(heading && labels[selected]) heading.textContent=labels[selected].title;
      for(const [key,entry] of Object.entries(labels)){
        if(!key.startsWith(selected+"/added-"))continue;
        const folder=document.createElement("details"),summary=document.createElement("summary"),label=document.createElement("span"),body=document.createElement("div");
        folder.className="knowledge-section";label.textContent=entry.title;summary.append(label);body.dataset.kfFragment=key;
        folder.append(summary,body);(page.querySelector(".knowledge-list")||page).append(folder);
      }
      const intro = document.createElement("div");
      intro.dataset.kfFragment = selected + "/intro";
      (page.querySelector(".knowledge-shell") || page).prepend(intro);
      for (const node of page.querySelectorAll("[data-kf-fragment]")) {
        const key = node.dataset.kfFragment;
        const host = document.createElement("span");
        const controls = host.attachShadow({mode:"closed"});
        const summary = node.closest("details")?.querySelector(":scope > summary");
        const label=summary?.querySelector(".knowledge-index + span") || summary?.querySelector("span");
        if(label && labels[key]) label.textContent=labels[key].title;
        const isIntro=key===selected+"/intro";
        if (summary) summary.append(host); else (page.querySelector(".knowledge-top-actions")||node.parentElement).prepend(host);
        for (const [action,buttonText] of [["edit","Chỉnh sửa nội dung"],["append","Thêm nội dung"],["rename",isIntro?"Sửa tiêu đề lớn":"Sửa tiêu đề thư mục"],...(isIntro?[["add","+ Thêm mục mới"]]:[])]) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = buttonText;
          button.style.cssText = "font:inherit;padding:.35em .65em;margin:.2em;cursor:pointer";
          button.onclick = event => {event.preventDefault();event.stopPropagation();parent.postMessage({channel:"kf-module",type:action,key,caption:isIntro?heading?.textContent:label?.textContent},"*");};
          controls.append(button);
        }
      }
    }
    loadVisible();
  });
  document.addEventListener("toggle", loadVisible, true);
}

export function attachPageNavigation(store, renderFrame, reportError, editLesson) {
  let frame, active, sequence = 0;
  const allowed = new Set(["root", ...Object.values(pageActions)]);
  const catalog = new Set();
  const opened = new Map();
  let root, currentLabels={};
  async function open(page) {
    const id = ++sequence;
    const tabs=editLesson?await store.tabTitles():{};
    for(const key of Object.keys(tabs))allowed.add(key);
    if (!allowed.has(page)) throw new Error("Trang không tồn tại.");
    root ??= store.fragments("root").catch(error => { root = undefined; throw error; });
    const rootParts = await root;
    if (id !== sequence) return false;
    const parts = page === "root" ? [] : await store.fragments(page);
    if (id !== sequence) return false;
    catalog.clear();
    opened.clear();
    if (page !== "root" && editLesson) catalog.add(page + "/intro");
    const moduleHtml = parts.map(part => {
      if (part.html !== undefined) return part.html;
      if (!part.child.startsWith(page + "/") || !/^\d+$/.test(part.child.slice(page.length + 1))) throw new Error("Mã bài không hợp lệ.");
      catalog.add(part.child);
      return '<div class="knowledge-content" data-kf-fragment="' + part.child + '"></div>';
    }).join("");
    const html = rootParts.map(part => part.html ?? (part.child === page ? moduleHtml : "")).join("");
    const titles = page === "compositionKnowledgePage" ? await store.compositionTitles() : {};
    if (id !== sequence) return false;
    const labels = page==="root"?{}:await store.labels(page);
    if(id!==sequence)return false;
    currentLabels=labels;
    for(const key of Object.keys(labels)) if(key.startsWith(page+"/added-")) catalog.add(key);
    const bridge = "<script>(" + connectFrame.toString() + ")(" + JSON.stringify(pageActions) + "," + JSON.stringify(page) + "," + JSON.stringify(titles).replace(/</g,"\\u003c") + "," + Boolean(editLesson) + "," + JSON.stringify(labels).replace(/</g,"\\u003c") + "," + JSON.stringify(tabs).replace(/</g,"\\u003c") + ")<" + "/script>";
    active = page;
    frame = renderFrame(html.replace(/<head\b[^>]*>/i, match => match + bridge));
    return true;
  }
  const fromUrl = () => new URL(location.href).searchParams.get("page") || "root";
  window.addEventListener("popstate", () => open(fromUrl()).catch(reportError));
  window.addEventListener("message", async event => {
    const msg = event.data;
    if (!frame || event.source !== frame.contentWindow || msg?.channel !== "kf-module") return;
    try {
      if(editLesson && (msg.type==="addTab" || msg.type==="renameTab" && allowed.has(msg.key) && msg.key!=="root")){
        const adding=msg.type==="addTab", title=window.prompt(adding?"Tên tab mới":"Đổi tên tab",adding?"":msg.caption);
        if(!title?.trim())return;
        if(adding){await store.addTab(title);root=undefined;}
        else await store.setLabel(msg.key,msg.key,title,msg.revision);
        await open(active);
      } else if ((msg.type==="rename" || msg.type==="add") && editLesson && catalog.has(msg.key)){
        const page=active;
        const key=msg.type==="add"?null:msg.key===page+"/intro"?page:msg.key;
        const title=window.prompt(key?"Sửa tiêu đề":"Tiêu đề mục mới",key?String(msg.caption||""):"");
        if(!title?.trim())return;
        await store.setLabel(page,key,title,currentLabels[key]?.revision||0);
        if(active===page)await open(page);
      } else if (msg.type === "page" && allowed.has(msg.key) && msg.key !== active) {
        if (await open(msg.key)) {
          const url = new URL(location.href);
          url.searchParams.set("page", msg.key);
          history.pushState(null, "", url);
        }
      } else if ((msg.type === "edit" || msg.type === "append") && editLesson && catalog.has(msg.key)) {
        const target = frame;
        const lesson = opened.get(msg.key) ?? await store.openLesson(msg.key,"local");
        if (target !== frame) return;
        await editLesson(lesson, async html => {
          const saved = await store.saveLesson(lesson, html);
          if (frame === target) {
            opened.set(msg.key, saved);
            target.contentWindow.postMessage({channel:"kf-module-saved", key:msg.key, body:html},"*");
          }
        }, msg.type === "append");
      } else if (msg.type === "lesson" && catalog.has(msg.key)) {
        const target = frame;
        const lesson = await store.openLesson(msg.key, "local");
        if (target !== frame) return;
        opened.set(msg.key, lesson);
        target.contentWindow.postMessage({
          channel: "kf-module-result", key: msg.key,
          editable: Boolean(editLesson), html: lesson.original.map(part => part.html).join(""), body: lesson.body
        }, "*");
      }
    } catch (error) {
      if (event.source === frame?.contentWindow) frame.contentWindow.postMessage({channel:"kf-module-result",key:msg.key,error:true},"*");
      reportError(error);
    }
  });
  return open(fromUrl());
}
