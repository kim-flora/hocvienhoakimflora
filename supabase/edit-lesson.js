function addFormattingToolbar(editor, toolbar, status, onChange) {
  function button(label, action) {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = label;
    control.addEventListener("mousedown", event => event.preventDefault());
    control.onclick = action;
    toolbar.append(control);
    return control;
  }

  function apply(command, value = null) {
    editor.contentWindow.focus();
    if (editor.contentDocument.execCommand(command, false, value)) onChange();
  }

  for (const [label, command, value] of [
    ["Đoạn văn", "formatBlock", "p"],
    ["Tiêu đề 2", "formatBlock", "h2"],
    ["Tiêu đề 3", "formatBlock", "h3"],
    ["Đậm", "bold"],
    ["Nghiêng", "italic"],
    ["Gạch chân", "underline"],
    ["Danh sách", "insertUnorderedList"],
    ["Đánh số", "insertOrderedList"]
  ]) button(label, () => apply(command, value));

  for (const [label, command] of [["Màu chữ", "foreColor"], ["Màu nền", "hiliteColor"]]) {
    button(label, () => {
      const hex = window.prompt("Nhập mã HEX có 6 ký tự", "#");
      if (hex === null) return;
      if (/^#[0-9a-f]{6}$/i.test(hex.trim())) apply(command, hex.trim());
      else status.textContent = "Mã HEX cần có dạng #336699.";
    });
  }

  for (const [label, command] of [["Liên kết", "createLink"], ["Chèn ảnh từ URL", "insertImage"]]) {
    button(label, () => {
      const input = window.prompt("Nhập địa chỉ HTTPS");
      if (input === null) return;
      try {
        const url = new URL(input.trim());
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
        apply(command, url.href);
      } catch {
        status.textContent = "Hãy nhập địa chỉ HTTPS hợp lệ.";
      }
    });
  }

  button("Chèn bảng", () => {
    apply("insertHTML", '<table style="border-collapse:collapse" border="1"><tbody><tr><th>Tiêu đề</th><th>Tiêu đề</th></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>');
  });
}

export function editLesson(lesson, save, append = false, { drafts } = {}) {
  if(document.querySelector("dialog[data-lesson-editor]")) return;
  const dialog=document.createElement("dialog");
  dialog.dataset.lessonEditor="";
  dialog.setAttribute("aria-label",append ? "Thêm nội dung" : "Chỉnh sửa bài");
  dialog.style.cssText="width:min(54rem,90vw);padding:1rem";
  const editor=document.createElement("iframe");
  editor.title="Nội dung bài học";
  editor.setAttribute("sandbox","allow-same-origin");
  editor.style.cssText="width:100%;height:55vh;border:1px solid #ddd";
  const status=document.createElement("p");
  status.setAttribute("role","status");
  const submit=document.createElement("button"),cancel=document.createElement("button");
  submit.textContent="Lưu thay đổi"; cancel.textContent="Hủy";
  submit.type=cancel.type="button";
  submit.disabled=true;
  const toolbar=document.createElement("div");
  toolbar.setAttribute("role","group");
  toolbar.setAttribute("aria-label","Định dạng nội dung");
  toolbar.style.cssText="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.5rem";
  const preview=document.createElement("button");
  preview.type="button";
  preview.textContent="Xem trước";
  preview.disabled=true;
  toolbar.inert=true;
  let changed=false,busy=false,previewing=false,previous="",draft=null;
  const draftKey=JSON.stringify([lesson.key,lesson.area,lesson.revision,append]);
  let draftWrites=Promise.resolve(),draftSaved=false,draftVersion=0;
  const markChanged=()=>{
    changed=true;
    submit.disabled=false;
    if(!drafts)return;
    draftSaved=false;
    const version=++draftVersion;
    const html=editor.contentDocument.body.innerHTML;
    draftWrites=draftWrites.then(()=>drafts("put",html,draftKey)).then(()=>{
      if(version===draftVersion)draftSaved=true;
    }).catch(()=>{
      if(version!==draftVersion)return;
      draftSaved=false;
      if(!busy)status.textContent="Chưa lưu được bản nháp trên thiết bị này.";
    });
  };
  addFormattingToolbar(editor,toolbar,status,markChanged);
  preview.onclick=()=>{
    const body=editor.contentDocument.body;
    if(!previewing){
      draft=body.innerHTML;
      if(append)body.innerHTML=previous+"<div>"+draft+"</div>";
    }else if(append){
      body.innerHTML=draft;
    }
    previewing=!previewing;
    body.contentEditable=String(!previewing);
    toolbar.inert=previewing;
    preview.textContent=previewing?"Quay lại chỉnh sửa":"Xem trước";
    submit.disabled=previewing||!changed;
  };
  const canClose=()=>!busy&&(!changed||(draftSaved?window.confirm("Đóng và giữ bản nháp trên thiết bị này?"):window.confirm("Đóng khi bản nháp chưa được lưu?")));
  cancel.onclick=()=>{if(canClose())dialog.close();};
  dialog.oncancel=e=>{if(!canClose())e.preventDefault();};
  dialog.onclose=()=>dialog.remove();
  editor.onload=async()=>{
    const body=editor.contentDocument.body;
    const original=new DOMParser().parseFromString(lesson.original.map(part=>part.html).join(""),"text/html");
    previous=lesson.body ?? original.body.firstElementChild?.innerHTML ?? "";
    body.innerHTML=append ? "" : previous;
    if(drafts){
      try{
        const stored=await drafts("get",undefined,draftKey);
        if(!dialog.open)return;
        if(typeof stored==="string"){
          body.innerHTML=stored;
          changed=draftSaved=true;
          submit.disabled=false;
          status.textContent="Đã mở lại bản nháp trên thiết bị này.";
        }
      }catch{
        status.textContent="Chưa đọc được bản nháp trên thiết bị này.";
      }
    }
    body.contentEditable="true";
    body.oninput=markChanged;
    body.addEventListener("click",event=>{
      if(event.target.closest("a"))event.preventDefault();
    });
    toolbar.inert=false;
    preview.disabled=false;
  };
  submit.onclick=async()=>{
    if(!changed||busy||previewing)return;
    busy=true; submit.disabled=cancel.disabled=preview.disabled=toolbar.inert=true;
    const body=editor.contentDocument.body;
    body.contentEditable="false";status.textContent="Đang lưu…";
    try{await save(append ? previous + "<div>" + body.innerHTML + "</div>" : body.innerHTML);
      await draftWrites;
      if(drafts)await drafts("delete",undefined,draftKey).catch(()=>{});
      dialog.close();
    }
    catch(error){status.textContent=error.code==="40001"?"Bài đã được sửa ở phiên khác. Hãy sao chép phần vừa sửa trước khi mở lại bài.":"Chưa lưu được. Bạn có thể thử lại.";body.contentEditable="true";submit.disabled=false;}
    finally{busy=false;cancel.disabled=preview.disabled=toolbar.inert=false;}
  };
  editor.srcdoc='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'"><body></body>';
  dialog.append(toolbar,editor,status,preview,submit,cancel);document.body.append(dialog);dialog.showModal();
}
