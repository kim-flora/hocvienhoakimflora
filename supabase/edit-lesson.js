export function editLesson(lesson, save, append = false) {
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
  submit.disabled=true;
  let changed=false,busy=false,previous="";
  cancel.onclick=()=>dialog.close();
  dialog.oncancel=e=>{if(busy)e.preventDefault();};
  dialog.onclose=()=>dialog.remove();
  editor.onload=()=>{
    const body=editor.contentDocument.body;
    const original=new DOMParser().parseFromString(lesson.original.map(part=>part.html).join(""),"text/html");
    previous=lesson.body ?? original.body.firstElementChild?.innerHTML ?? "";
    body.innerHTML=append ? "" : previous;
    body.contentEditable="true";
    body.oninput=()=>{changed=true;submit.disabled=false;};
  };
  submit.onclick=async()=>{
    if(!changed||busy)return;
    busy=true; submit.disabled=cancel.disabled=true;
    const body=editor.contentDocument.body;
    body.contentEditable="false";status.textContent="Đang lưu…";
    try{await save(append ? previous + "<div>" + body.innerHTML + "</div>" : body.innerHTML);dialog.close();}
    catch(error){status.textContent=error.code==="40001"?"Bài đã được sửa ở phiên khác. Hãy sao chép phần vừa sửa trước khi mở lại bài.":"Chưa lưu được. Bạn có thể thử lại.";body.contentEditable="true";submit.disabled=false;}
    finally{busy=false;cancel.disabled=false;}
  };
  editor.srcdoc='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'"><body></body>';
  dialog.append(editor,status,submit,cancel);document.body.append(dialog);dialog.showModal();
}
