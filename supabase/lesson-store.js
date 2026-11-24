// Uses the portal's existing authenticated Supabase client.
export function createLessonStore(client) {
  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function fragments(key) {
    return rpc("kf_read_page_fragment", { p_key: key });
  }

  async function openLesson(key, area) {
    const [parts, edit] = await Promise.all([
      fragments(key),
      rpc("kf_read_lesson_edit", { p_key: key, p_area: area })
    ]);
    return {
      key, area, original: parts, body: edit?.body ?? null,
      revision: edit?.revision ?? 0
    };
  }

  async function saveLesson(lesson, html) {
    const revision = await rpc("kf_save_lesson_edit", {
      p_key: lesson.key, p_area: lesson.area,
      p_revision: lesson.revision, p_body: html
    });
    return { ...lesson, body: html, revision };
  }

  return { fragments, openLesson, saveLesson };
}
