/**
 * Kim Flora: explicit two-way snapshot sync between GitHub Pages browser storage
 * and the Supabase tables protected by Row Level Security (RLS).
 * NOT auto-enabled on the live site; migration must be reviewed and tested.
 * Requires a Supabase JS v2 client instance from kim-flora-client.js.
 *
 * Safety: no automatic destructive overwrite; download preview and backup first.
 * Only known Kim Flora content keys; NEVER sync PINs, sessions or credentials.
 */
const DB_NAME = "kimflora_durable_v1";
const STORE = "records";
const IGNORE = new Set(["kimflora_auth","kimflora_owner_pin_v2","kimflora_role_v2"]);
const PREFIX = "snapshot/";
const matches = key => /^(kimflora_|kf_)/i.test(key) && !IGNORE.has(key) && !/auth|password|secret|token|session|pin/i.test(key);

function openLocalDB() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function dbAll() {
  const db=await openLocalDB();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readonly");
      const obj=tx.objectStore(STORE), keys=obj.getAllKeys(), values=obj.getAll();
      tx.oncomplete=()=>resolve(Object.fromEntries(keys.result.map((k,i)=>[k,values.result[i]]).filter(([k])=>matches(String(k)))));
      tx.onerror=()=>reject(tx.error);
    });
  } finally { db.close(); }
}
async function dbWrite(entries) {
  if (!entries.length) return;
  const db=await openLocalDB();
  try {
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite"), obj=tx.objectStore(STORE);
      entries.forEach(([key,value])=>obj.put(value,key));
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } finally { db.close(); }
}
export async function captureLocalSnapshot() {
  const local={};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(matches(k)) local[k]=localStorage.getItem(k);
  }
  const indexed=await dbAll();
  return { format:1, capturedAt:new Date().toISOString(),local,indexed };
}
export function downloadSnapshotFile(snapshot) {
  const blob=new Blob([JSON.stringify(snapshot)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="kimflora-backup-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
  a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function validateSnapshot(s) {
  if(!s || s.format!==1 || !s.local || !s.indexed || typeof s.local!=="object" || typeof s.indexed!=="object" || Array.isArray(s.local) || Array.isArray(s.indexed)) throw new Error("Định dạng sao lưu không hợp lệ.");
  for(const k of [...Object.keys(s.local),...Object.keys(s.indexed)]) if(!matches(k)) throw new Error("Khóa dữ liệu không được phép: "+k);
}
export async function uploadLocalSnapshot(client) {
  const {data:check,error:checkError}=await client.rpc("kf_is_admin");
  if(checkError||check!==true) throw new Error("Chỉ quản trị viên mới được đồng bộ dữ liệu lên máy chủ.");
  const {data:userInfo,error:userError}=await client.auth.getUser();
  if(userError||!userInfo?.user?.id) throw new Error("Phiên đăng nhập không hợp lệ.");
  const snapshot=await captureLocalSnapshot();
  validateSnapshot(snapshot);
  const {error}=await client.from("kf_content").upsert({
    content_key:PREFIX+"current",
    content_value:snapshot,
    updated_at:new Date().toISOString(),
    updated_by:userInfo.user.id
  },{onConflict:"content_key"});
  if(error) throw error;
  return { localKeys:Object.keys(snapshot.local).length, indexedKeys:Object.keys(snapshot.indexed).length };
}
export async function downloadServerSnapshot(client) {
  const {data,error}=await client.from("kf_content").select("content_value,updated_at").eq("content_key",PREFIX+"current").maybeSingle();
  if(error) throw error;
  if(!data) return null;
  validateSnapshot(data.content_value);
  return {snapshot:data.content_value,updatedAt:data.updated_at};
}
export async function restoreSnapshotAfterBackup(snapshot,{confirmed=false}={}){
  validateSnapshot(snapshot);
  if(!confirmed) throw new Error("Phải xác nhận đã tải bản sao lưu và chấp thuận thay thế dữ liệu cục bộ.");
  // Intentional non-destructive merge: keys absent on server remain on this device.
  // Avoid partial IDB writes before localStorage capacity check by writing IDB first.
  await dbWrite(Object.entries(snapshot.indexed));
  for(const [key,value] of Object.entries(snapshot.local)){
    if(typeof value!=="string") throw new Error("Dữ liệu localStorage không hợp lệ: "+key);
    localStorage.setItem(key,value);
  }
  return true; // Caller should reload site to rebuild in-memory state.
}
