// Supabase Edge Function: invite-kf-guest
// The service-role key exists ONLY in Supabase Edge Function secrets, never client HTML.
import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json"
};
const json=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{status,headers});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers});
  if(req.method!=="POST")return json(405,{error:"Method not allowed"});
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const publishable=Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
    if(!token)return json(401,{error:"Cần đăng nhập."});
    const who=createClient(url,publishable,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await who.auth.getUser(token);
    if(userError||!userData?.user)return json(401,{error:"Phiên không hợp lệ."});
    const {data:isAdmin,error:adminError}=await who.rpc("kf_is_admin");
    if(adminError||isAdmin!==true)return json(403,{error:"Chỉ quản trị viên được mời khách."});
    const body=await req.json().catch(()=>({}));
    const email=String(body?.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(400,{error:"Email không hợp lệ."});
    const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await admin.auth.admin.inviteUserByEmail(email);
    if(error)return json(400,{error:error.message});
    return json(200,{ok:true,message:"Đã gửi lời mời cho khách."});
  }catch(e){return json(500,{error:"Không thể gửi lời mời."});}
});
