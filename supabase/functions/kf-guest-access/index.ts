// Supabase Edge Function: kf-guest-access
// Deploy with JWT verification handled by this function for guest requests.
// Configure KF_GUEST_PEPPER as a long random secret in Supabase Function Secrets.
// Do not use a shared guest password or embed passwords in frontend source.
import { createClient } from "npm:@supabase/supabase-js@2";

const url=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const pepper=Deno.env.get("KF_GUEST_PEPPER");
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const encoder=new TextEncoder();
const cors={
 "Access-Control-Allow-Origin":"https://kim-flora.github.io",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
 "Content-Type":"application/json",
 "Cache-Control":"no-store"
};
const response=(code:number,value:unknown)=>new Response(JSON.stringify(value),{status:code,headers:cors});
function hex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")}
function unhex(input:string){return new Uint8Array((input.match(/.{2}/g)||[]).map(x=>parseInt(x,16)))}
function random(n:number){const a=new Uint8Array(n);crypto.getRandomValues(a);return a}
async function sha256(s:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))))}
async function hmac(value:string){
 const k=await crypto.subtle.importKey("raw",encoder.encode(pepper!),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(new Uint8Array(await crypto.subtle.sign("HMAC",k,encoder.encode(value))));
}
async function hashPassword(password:string,salt:string){
 const key=await crypto.subtle.importKey("raw",encoder.encode(password+pepper),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:unhex(salt),iterations:310000,hash:"SHA-256"},key,256);
 return hex(new Uint8Array(bits));
}
function equal(a:string,b:string){const x=encoder.encode(a),y=encoder.encode(b);let diff=x.length^y.length;const n=Math.max(x.length,y.length);for(let i=0;i<n;i++)diff|=(x[i]||0)^(y[i]||0);return diff===0}
async function checkAdmin(req:Request){
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return false;
 const client=createClient(url,anonKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:user,error:authError}=await client.auth.getUser(token);
 if(authError||!user?.user?.id)return false;
 const {data:allowed,error:rpcError}=await client.rpc("kf_is_admin");
 return !rpcError&&allowed===true;
}
async function guestFromToken(token:string){
 if(!/^[A-Za-z0-9_-]{40,160}$/.test(token))return null;
 const digest=await sha256(token);
 const {data,error}=await service.schema("private").from("kf_guest_sessions")
  .select("guest_id,expires_at,kf_guest_credentials!inner(revoked_at)")
  .eq("token_digest",digest).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error||!data)return null;
 const credential=data.kf_guest_credentials as unknown as {revoked_at:string|null};
 if(credential?.revoked_at)return null;
 return data.guest_id as string;
}
async function login(password:string,req:Request){
 if(typeof password!=="string"||password.length<16||password.length>256)return response(401,{error:"Mật khẩu không hợp lệ."});
 const clientTag=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
 const clientDigest=await hmac("ip:"+clientTag);
 const windowStart=new Date(Date.now()-15*60*1000).toISOString();
 const {count,error:countError}=await service.schema("private").from("kf_guest_login_attempts")
  .select("*",{head:true,count:"exact"}).eq("client_digest",clientDigest).gte("created_at",windowStart);
 if(countError)return response(503,{error:"Không thể xác minh giới hạn đăng nhập."});
 if((count||0)>=20)return response(429,{error:"Thử quá nhiều lần. Vui lòng thử lại sau."});
 const {error:insertError}=await service.schema("private").from("kf_guest_login_attempts").insert({client_digest:clientDigest});
 if(insertError)return response(503,{error:"Không thể xác minh giới hạn đăng nhập."});
 const lookup=await hmac("password:"+password);
 const {data:entry,error}=await service.schema("private").from("kf_guest_credentials")
  .select("id,password_hash,password_salt,revoked_at").eq("lookup_digest",lookup).maybeSingle();
 // Always execute password KDF to reduce timing difference.
 const calculated=await hashPassword(password,entry?.password_salt||hex(new Uint8Array(16)));
 if(error||!entry||entry.revoked_at||!equal(calculated,entry.password_hash))return response(401,{error:"Mật khẩu không đúng hoặc đã bị thu hồi."});
 const session=hex(random(32));
 const {error:sessionError}=await service.schema("private").from("kf_guest_sessions").insert({
  token_digest:await sha256(session),guest_id:entry.id,expires_at:new Date(Date.now()+8*60*60*1000).toISOString()
 });
 if(sessionError)return response(503,{error:"Không thể tạo phiên truy cập."});
 return response(200,{session,expiresIn:28800});
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return response(405,{error:"Method not allowed"});
 if(!pepper||pepper.length<32)return response(503,{error:"Máy chủ chưa cấu hình bảo mật."});
 let b:Record<string,unknown>;
 try{b=await req.json()}catch{return response(400,{error:"Dữ liệu không hợp lệ."})}
 const action=b.action;
 if(action==="login")return login(String(b.password||""),req);
 if(action==="guest-read"){
  const token=String(b.session||"");
  const id=await guestFromToken(token);
  if(!id)return response(401,{error:"Phiên khách đã hết hạn hoặc bị thu hồi."});
  const key=String(b.key||"");
  if(!/^published\/[a-zA-Z0-9_-]{1,100}$/.test(key))return response(400,{error:"Đường dẫn nội dung không hợp lệ."});
  const {data,error}=await service.from("kf_content").select("content_value").eq("content_key",key).maybeSingle();
  if(error)return response(503,{error:"Không đọc được nội dung."});
  return response(200,{value:data?.content_value??null});
 }
 if(action==="guest-logout"){
  const token=String(b.session||"");
  if(/^[a-f0-9]{64}$/.test(token))await service.schema("private").from("kf_guest_sessions").delete().eq("token_digest",await sha256(token));
  return response(200,{ok:true});
 }
 if(!await checkAdmin(req))return response(403,{error:"Chỉ quản trị viên được thực hiện thao tác này."});
 if(action==="create-guest"){
  const label=String(b.label||"").trim();
  if(label.length<1||label.length>120)return response(400,{error:"Tên khách không hợp lệ."});
  const password=hex(random(24));const salt=hex(random(16));
  const {error}=await service.schema("private").from("kf_guest_credentials").insert({
   label,lookup_digest:await hmac("password:"+password),
   password_hash:await hashPassword(password,salt),password_salt:salt
  });
  if(error)return response(503,{error:"Không tạo được mật khẩu khách."});
  // Shown only once to the administrator. Never store/recover plaintext.
  return response(200,{password});
 }
 if(action==="list-guests"){
  const {data,error}=await service.schema("private").from("kf_guest_credentials").select("id,label,created_at,revoked_at").order("created_at",{ascending:false});
  if(error)return response(503,{error:"Không đọc được danh sách khách."});
  return response(200,{guests:data});
 }
 if(action==="revoke-guest"){
  const id=String(b.id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return response(400,{error:"ID không hợp lệ."});
  const {error}=await service.schema("private").from("kf_guest_credentials").update({revoked_at:new Date().toISOString()}).eq("id",id);
  if(error)return response(503,{error:"Không thu hồi được tài khoản."});
  await service.schema("private").from("kf_guest_sessions").delete().eq("guest_id",id);
  return response(200,{ok:true});
 }
 if(action==="admin-read"){
  const key=String(b.key||"");if(!/^published\/[a-zA-Z0-9_-]{1,100}$/.test(key))return response(400,{error:"Khóa không hợp lệ."});
  const {data,error}=await service.from("kf_content").select("content_value").eq("content_key",key).maybeSingle();
  if(error)return response(503,{error:"Không đọc được nội dung."});
  return response(200,{value:data?.content_value??null});
 }
 return response(400,{error:"Hành động không hợp lệ."});
});
