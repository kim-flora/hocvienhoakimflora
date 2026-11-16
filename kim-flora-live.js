import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {createKimFloraClient,changeAdminPassword,isCurrentAdmin} from "./supabase/kim-flora-client.js";
import {captureLocalSnapshot,downloadSnapshotFile,uploadLocalSnapshot,downloadServerSnapshot,restoreSnapshotAfterBackup} from "./supabase/kim-flora-sync.js";
const client=createKimFloraClient(createClient);
let admin=false, loggedIn=false;
const gate=document.createElement("style");gate.textContent="body:not(.kf-logged-in) > :not(#kfAccountPanel):not(script):not(style){display:none!important}";document.head.append(gate);
const el=document.createElement("div");el.id="kfAccountPanel";
const css=document.createElement("style");
css.textContent='#lockScreen{display:none!important}#kfAccountPanel{position:sticky;top:0;z-index:9999;background:#fff;border:1px solid #dbe3ef;border-radius:10px;margin:0 auto 10px;max-width:1440px;padding:9px 12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font:12px system-ui;color:#334155}#kfAccountPanel button{border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:7px;padding:7px 10px;font-weight:700;cursor:pointer}#kfAccountPanel input{border:1px solid #cbd5e1;border-radius:7px;padding:8px;max-width:220px}#kfAccountPanel .kf-hidden{display:none!important}body:not(.kf-is-admin) .knowledge-edit-btn,body:not(.kf-is-admin) .knowledge-add-section-btn,body:not(.kf-is-admin) .knowledge-edit-bar{display:none!important}';
document.head.append(css);
el.innerHTML='<strong>Kim Flora</strong> <span id="kfRoleStatus">Cần đăng nhập</span> <button id="kfLoginShow">Đăng nhập</button><form id="kfLoginForm" class="kf-hidden"><input id="kfEmail" type="email" autocomplete="username" required placeholder="Email quản trị"><input id="kfPassword" type="password" autocomplete="current-password" required placeholder="Mật khẩu"><button type="submit">Đăng nhập</button><button type="button" id="kfLoginCancel">Hủy</button></form><div id="kfAdminActions" class="kf-hidden"><button id="kfInviteGuest">Mời khách bằng email</button><button id="kfBackup">Sao lưu dữ liệu máy này</button><button id="kfUpload">Đồng bộ lên Supabase</button><button id="kfDownload">Tải từ Supabase về máy này</button><button id="kfChangePassword">Đổi mật khẩu</button><button id="kfLogout">Đăng xuất</button></div><button id="kfGuestLogout" class="kf-hidden">Đăng xuất</button><span id="kfSyncStatus" role="status"></span>';
document.body.insertBefore(el,document.body.firstChild);
const $=id=>document.getElementById(id);
const status=t=>$("kfSyncStatus").textContent=t;
function role(value){
 admin=!!value;
 document.body.classList.toggle("kf-logged-in",loggedIn);
 document.body.classList.toggle("kf-is-admin",admin);
 $("kfRoleStatus").textContent=!loggedIn?"Chưa đăng nhập":admin?"Quản trị viên":"Khách · chỉ xem và tìm kiếm";
 $("kfAdminActions").classList.toggle("kf-hidden",!admin);
 $("kfGuestLogout").classList.toggle("kf-hidden",!loggedIn||admin);
 $("kfLoginShow").classList.toggle("kf-hidden",loggedIn);
 $("kfLoginForm").classList.add("kf-hidden");
 if(!admin)document.querySelectorAll("[contenteditable]").forEach(e=>e.removeAttribute("contenteditable"));
}
role(false);
const blocked=/^\s*[✏️✎＋+💾🗑️]*\s*(?:thêm|sửa|chỉnh sửa|xóa|xoá|lưu|đổi tên|đặt lại|tạo mới|nhập ảnh|tải ảnh|ghi đè|khôi phục)/i;
document.addEventListener("click",e=>{
 if(admin)return;
 const b=e.target.closest("button,[role=button],input[type=submit],a");
 if(!b||el.contains(b))return;
 if(b.classList.contains("knowledge-edit-btn")||b.classList.contains("knowledge-add-section-btn")||blocked.test((b.textContent||b.value||"").trim())){
   e.preventDefault();e.stopImmediatePropagation();status("Chế độ khách không được chỉnh sửa.");
 }
},true);
document.addEventListener("beforeinput",e=>{if(!admin&&e.target.closest("[contenteditable]"))e.preventDefault();},true);
$("kfLoginShow").onclick=()=>{$("kfLoginForm").classList.remove("kf-hidden");$("kfEmail").focus();};
$("kfLoginCancel").onclick=()=>$("kfLoginForm").classList.add("kf-hidden");
$("kfLoginForm").onsubmit=async e=>{
 e.preventDefault();status("Đang đăng nhập...");
 try{const {error}=await client.auth.signInWithPassword({email:$("kfEmail").value,password:$("kfPassword").value});if(error)throw error;loggedIn=true;const isAdmin=await isCurrentAdmin(client);$("kfPassword").value="";role(isAdmin);status(isAdmin?"Đã đăng nhập quản trị.":"Đã đăng nhập khách, chỉ có quyền xem.");}
 catch(err){status("Không đăng nhập được: "+err.message);}
};
$("kfGuestLogout").onclick=async()=>{await client.auth.signOut();loggedIn=false;role(false);location.reload();};
$("kfLogout").onclick=async()=>{await client.auth.signOut();loggedIn=false;role(false);location.reload();};
$("kfChangePassword").onclick=async()=>{
 const p=prompt("Mật khẩu mới (ít nhất 12 ký tự):");if(p===null)return;
 if(p.length<12){status("Mật khẩu quá ngắn.");return;}
 try{await changeAdminPassword(client,p);status("Đã đổi mật khẩu.");}catch(err){status(err.message);}
};
$("kfInviteGuest").onclick=async()=>{
 if(!admin)return;
 const email=prompt("Nhập email của khách để gửi lời mời đăng nhập:");
 if(!email)return;
 if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())){status("Email không hợp lệ.");return;}
 status("Đang gửi lời mời...");
 try{
  const {data:{session}}=await client.auth.getSession();
  if(!session)throw new Error("Bạn cần đăng nhập lại.");
  const response=await fetch("https://kqoyujqlkanwpdedqljr.supabase.co/functions/v1/invite-kf-guest",{
   method:"POST",
   headers:{"apikey":"sb_publishable_jgSqB-1vyxcnojsbKJ3Tmg_8PsoZrvX","Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},
   body:JSON.stringify({email:email.trim()})
  });
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||"Không thể gửi lời mời.");
  status("Đã gửi lời mời tới "+email.trim()+".");
 }catch(err){status("Lỗi mời khách: "+err.message+" (cần triển khai Edge Function trước).");}
};
$("kfBackup").onclick=async()=>{
 try{downloadSnapshotFile(await captureLocalSnapshot());status("Đã sao lưu dữ liệu.");}catch(err){status("Lỗi sao lưu: "+err.message);}
};
$("kfUpload").onclick=async()=>{
 if(!admin||!confirm("Hãy sao lưu trước! Thao tác này THAY THẾ bản snapshot trên Supabase. Tiếp tục?"))return;
 status("Đang đồng bộ...");
 try{const data=await uploadLocalSnapshot(client);status("Đã đồng bộ "+data.localKeys+" mục localStorage và "+data.indexedKeys+" mục IndexedDB.");}
 catch(err){status("Không đồng bộ được: "+err.message);}
};
$("kfDownload").onclick=async()=>{
 if(!admin)return;
 try{
  const r=await downloadServerSnapshot(client);if(!r){status("Chưa có bản đồng bộ Supabase.");return;}
  downloadSnapshotFile(await captureLocalSnapshot());
  if(!confirm("Đã sao lưu máy này. Tải bản Supabase sẽ thay thế các khóa trùng trên máy này. Tiếp tục?"))return;
  await restoreSnapshotAfterBackup(r.snapshot,{confirmed:true});location.reload();
 }catch(err){status("Không tải được: "+err.message);}
};
try{const {data:{session}}=await client.auth.getSession();loggedIn=!!session;role(loggedIn?await isCurrentAdmin(client):false);}catch(err){status("Kiểm tra phiên thất bại: "+err.message);}
client.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT"){loggedIn=false;role(false);}});
