/* Kim Flora Supabase client (staged module, not yet loaded by index.html).
 * Public publishable key only. Never place sb_secret_ or service_role keys here.
 * Requires Supabase JS v2, passed as createClient from a trusted script import.
 */
export const KIM_FLORA_SUPABASE_URL = "https://kqoyujqlkanwpdedqljr.supabase.co";
export const KIM_FLORA_PUBLISHABLE_KEY = "sb_publishable_jgSqB-1vyxcnojsbKJ3Tmg_8PsoZrvX";

export function createKimFloraClient(createClient) {
  if (typeof createClient !== "function") throw new TypeError("Missing Supabase createClient");
  return createClient(KIM_FLORA_SUPABASE_URL, KIM_FLORA_PUBLISHABLE_KEY);
}

export async function signInAdmin(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: allowed, error: permissionError } = await client.rpc("kf_is_admin");
  if (permissionError || allowed !== true) {
    await client.auth.signOut();
    throw new Error("Tài khoản này không có quyền quản trị.");
  }
  return data;
}

export async function changeAdminPassword(client, newPassword) {
  const { data: allowed, error: permissionError } = await client.rpc("kf_is_admin");
  if (permissionError || allowed !== true) throw new Error("Chỉ quản trị viên được đổi mật khẩu.");
  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function isCurrentAdmin(client) {
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return false;
  const { data, error } = await client.rpc("kf_is_admin");
  return !error && data === true;
}

export async function getPublicContent(client, key) {
  const { data, error } = await client.from("kf_content").select("content_value").eq("content_key", key).maybeSingle();
  if (error) throw error;
  return data?.content_value ?? null;
}

export async function saveAdminContent(client, key, value) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user?.id) throw new Error("Cần đăng nhập.");
  const { error } = await client.from("kf_content").upsert({
    content_key: key, content_value: value, updated_by: userData.user.id, updated_at: new Date().toISOString()
  }, { onConflict: "content_key" });
  if (error) throw error; // RLS rejects non-admin writes
}

export async function deleteAdminContent(client, key) {
  const { error } = await client.from("kf_content").delete().eq("content_key", key);
  if (error) throw error;
}
