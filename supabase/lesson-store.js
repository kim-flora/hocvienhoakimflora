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

  function openLesson(key, area) {
    return rpc("kf_open_lesson", { p_key: key, p_area: area });
  }

  async function saveLesson(lesson, html) {
    const revision = await rpc("kf_save_lesson_edit", {
      p_key: lesson.key, p_area: lesson.area,
      p_revision: lesson.revision, p_body: html
    });
    return { ...lesson, body: html, revision };
  }

  function listRevisions(lesson, before = null) {
    return rpc("kf_list_lesson_revisions", {
      p_key: lesson.key, p_area: lesson.area, p_before: before
    });
  }

  async function restoreRevision(lesson, savedRevision) {
    await rpc("kf_restore_lesson_revision", {
      p_key: lesson.key, p_area: lesson.area,
      p_saved_revision: savedRevision, p_current_revision: lesson.revision
    });
    return openLesson(lesson.key, lesson.area);
  }

  return { fragments, openLesson, saveLesson, listRevisions, restoreRevision,
    tabTitles: ()=>rpc('kf_tab_titles',{}),
    addTab: title=>rpc('kf_add_tab',{p_title:title}),
    labels: page=>rpc("kf_outline_labels",{p_page:page}),
    setLabel: (page,key,title,revision)=>rpc("kf_edit_outline",{p_page:page,p_key:key,p_title:title,p_revision:revision}),
    compositionTitles: () => rpc("kf_composition_titles", {}) };
}
