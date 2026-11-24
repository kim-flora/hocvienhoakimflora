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

function connectFrame(actions, selected) {
  const send = (type, key) => parent.postMessage({ channel: "kf-module", type, key }, "*");
  const pending = new Set();
  function loadVisible() {
    for (const node of document.querySelectorAll("[data-kf-fragment]")) {
      const details = node.closest("details");
      if (!details || !details.open || !node.getClientRects().length) continue;
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
    const detailsForLesson = node.parentElement;
    node.replaceWith(template.content);
    if (message.editable) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Chỉnh sửa bài";
      button.onclick = () => send("edit", message.key);
      const section = detailsForLesson;
      section.append(button);
    }
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
    if (selected !== "root") {
      const action = Object.keys(actions).find(name => actions[name] === selected);
      if (action && typeof window[action] === "function") window[action]();
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
  let root;
  async function open(page) {
    const id = ++sequence;
    if (!allowed.has(page)) throw new Error("Trang không tồn tại.");
    root ??= store.fragments("root").catch(error => { root = undefined; throw error; });
    const rootParts = await root;
    if (id !== sequence) return false;
    const parts = page === "root" ? [] : await store.fragments(page);
    if (id !== sequence) return false;
    catalog.clear();
    opened.clear();
    const moduleHtml = parts.map(part => {
      if (part.html !== undefined) return part.html;
      if (!part.child.startsWith(page + "/") || !/^\d+$/.test(part.child.slice(page.length + 1))) throw new Error("Mã bài không hợp lệ.");
      catalog.add(part.child);
      return '<div class="knowledge-content" data-kf-fragment="' + part.child + '"></div>';
    }).join("");
    const html = rootParts.map(part => part.html ?? (part.child === page ? moduleHtml : "")).join("");
    const bridge = "<script>(" + connectFrame.toString() + ")(" + JSON.stringify(pageActions) + "," + JSON.stringify(page) + ")<" + "/script>";
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
      if (msg.type === "page" && allowed.has(msg.key) && msg.key !== active) {
        if (await open(msg.key)) {
          const url = new URL(location.href);
          url.searchParams.set("page", msg.key);
          history.pushState(null, "", url);
        }
      } else if (msg.type === "edit" && editLesson && opened.has(msg.key)) {
        const target = frame;
        const lesson = opened.get(msg.key);
        await editLesson(lesson, async html => {
          const saved = await store.saveLesson(lesson, html);
          if (frame === target) {
            opened.set(msg.key, saved);
            target.contentWindow.postMessage({channel:"kf-module-saved", key:msg.key, body:html},"*");
          }
        });
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
