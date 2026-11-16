import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const pepper=Deno.env.get("KF_GUEST_PEPPER");
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const enc=new TextEncoder();
const cors={"Access-Control-Allow-Origin":"https://kim-flora.github.io","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(code:number,value:unknown)=>new Response(JSON.stringify(value),{status:code,headers:cors});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const bytes=(input:string)=>new Uint8Array((input.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
function random(n:number){const b=new Uint8Array(n);crypto.getRandomValues(b);return hex(b);}
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(value))));}
async function hmac(value:string){
 const k=await crypto.subtle.importKey("raw",enc.encode(pepper!),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(new Uint8Array(await crypto.subtle.sign("HMAC",k,enc.encode(value))));
}
async function hashPassword(password:string,salt:string){
 const k=await crypto.subtle.importKey("raw",enc.encode(password+pepper),"PBKDF2",false,["deriveBits"]);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:bytes(salt),iterations:310000,hash:"SHA-256"},k,256)));
}
function equal(a:string,b:string){const x=enc.encode(a),y=enc.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
async function rpc(action:string,p:Record<string,unknown>){
 const {data,error}=await service.rpc("kf_server_guest",{action,p});
 if(error)throw new Error("Server data unavailable");
 return data;
}
async function isAdmin(req:Request){
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return false;
 const userClient=createClient(url,anonKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await userClient.auth.getUser(token);
 if(error||!data?.user?.id)return false;
 const {data:allowed,error:allowError}=await userClient.rpc("kf_is_admin");
 return !allowError&&allowed===true;
}
async function validGuest(session:string){
 if(!/^[a-f0-9]{64}$/.test(session))return false;
 const result=await rpc("session-valid",{token_digest:await digest(session)});
 return result.valid===true;
}
async function login(password:string,req:Request){
 if(password.length<16||password.length>256)return out(401,{error:"Mật khẩu không hợp lệ."});
 // Use edge-provided IP if trustworthy; fall back to common client bucket rather than trust arbitrary forwarded headers.
 const clientTag=req.headers.get("cf-connecting-ip")||"unidentified";
 const limit=await rpc("attempt",{client_digest:await hmac("attempt:"+clientTag)});
 if(limit.limited)return out(429,{error:"Thử quá nhiều lần. Vui lòng thử lại sau."});
 const match=await rpc("credential",{lookup_digest:await hmac("password:"+password)});
 const calculated=await hashPassword(password,match.password_salt||"00000000000000000000000000000000");
 if(!match.id||match.revoked||!equal(calculated,match.password_hash||""))return out(401,{error:"Mật khẩu không đúng hoặc đã bị thu hồi."});
 const session=random(32);
 await rpc("create-session",{token_digest:await digest(session),guest_id:match.id});
 return out(200,{session,expiresIn:28800});
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return out(405,{error:"Method not allowed"});
 if(!pepper||pepper.length<32)return out(503,{error:"Máy chủ chưa cấu hình bảo mật."});
 try{
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=="object")return out(400,{error:"Yêu cầu không hợp lệ."});
  const action=b.action;
  if(action==="login")return await login(String(b.password||""),req);
  if(action==="guest-read"){
   if(!await validGuest(String(b.session||"")))return out(401,{error:"Phiên khách hết hạn hoặc đã bị thu hồi."});
   const key=String(b.key||"");
   if(!/^published\/[A-Za-z0-9_-]{1,100}$/.test(key))return out(400,{error:"Khóa nội dung không hợp lệ."});
   const {data,error}=await service.from("kf_content").select("content_value").eq("content_key",key).maybeSingle();
   if(error)throw error;
   return out(200,{value:data?.content_value??null});
  }
  if(action==="guest-logout"){
   const session=String(b.session||"");
   if(/^[a-f0-9]{64}$/.test(session))await rpc("logout",{token_digest:await digest(session)});
   return out(200,{ok:true});
  }
  if(!await isAdmin(req))return out(403,{error:"Chỉ quản trị viên có quyền thực hiện."});
  if(action==="create-guest"){
   const label=String(b.label||"").trim();
   if(label.length<1||label.length>120)return out(400,{error:"Tên khách không hợp lệ."});
   const password=random(24), salt=random(16);
   await rpc("create-guest",{label,lookup_digest:await hmac("password:"+password),password_hash:await hashPassword(password,salt),password_salt:salt});
   return out(200,{password});
  }
  if(action==="list-guests"){
   const guests=await rpc("list-guests",{});
   return out(200,{guests});
  }
  if(action==="revoke-guest"){
   const id=String(b.id||"");
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return out(400,{error:"ID không hợp lệ."});
   await rpc("revoke-guest",{id});
   return out(200,{ok:true});
  }
  if(action==="admin-read"){
   const key=String(b.key||"");
   if(!/^published\/[A-Za-z0-9_-]{1,100}$/.test(key))return out(400,{error:"Khóa nội dung không hợp lệ."});
   const {data,error}=await service.from("kf_content").select("content_value").eq("content_key",key).maybeSingle();
   if(error)throw error;
   return out(200,{value:data?.content_value??null});
  }
  return out(400,{error:"Hành động không hợp lệ."});
 }catch(e){console.error("kf-guest-access error",e instanceof Error?e.message:"unknown");return out(503,{error:"Lỗi hệ thống. Vui lòng thử lại."});}
});
