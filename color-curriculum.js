function formatColorCurriculum() {
  document.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("colorKnowledgeList");
    if (!list) return;

    const tens = ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"];
    const ones = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

    function formatHeadingNumbers() {
      for (const heading of list.querySelectorAll(":scope > h2.kf-curriculum-part")) {
        const text = heading.firstChild;
        if (heading.isContentEditable || text?.nodeType !== Node.TEXT_NODE) continue;

        const prefix = text.data.match(/^\s*(\d)(\d)\.\s+/u);
        if (!prefix || prefix[1] + prefix[2] === "00") continue;

        const roman = tens[Number(prefix[1])] + ones[Number(prefix[2])];
        text.replaceData(0, prefix[0].length, roman + ". ");
      }
    }

    formatHeadingNumbers();
    for (const heading of list.querySelectorAll(":scope > h2.kf-curriculum-part")) {
      const introduction = heading.nextElementSibling;
      const match = heading.textContent.match(/^([IVXLCDM]+)\.\s+(.+)$/u);
      if (!match || !introduction?.matches("div.knowledge-content")) continue;

      const [, numeral, originalTitle] = match;
      const key = "kf_color_curriculum_group_v1:" + numeral;
      let revision;
      try {
        revision = JSON.parse(localStorage.getItem(key));
      } catch {}
      const title = document.createElement("span");
      title.textContent = numeral + ". " + (revision?.title || originalTitle);
      heading.replaceChildren(title);
      if (typeof revision?.intro === "string") introduction.innerHTML = revision.intro;
      if (window.__kfReadOnly !== false) continue;

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "kf-color-group-edit";
      edit.textContent = "Chỉnh sửa";
      edit.setAttribute("aria-label", "Chỉnh sửa mục " + numeral);
      heading.append(edit);

      const form = document.createElement("form");
      form.className = "kf-color-group-form";
      form.hidden = true;
      const label = document.createElement("label");
      label.textContent = "Tiêu đề mục " + numeral;
      const input = document.createElement("input");
      input.required = true;
      input.maxLength = 200;
      label.append(input);
      const save = document.createElement("button");
      save.type = "submit";
      save.textContent = "Lưu thay đổi";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Hủy";
      form.append(label, save, cancel);
      heading.after(form);

      let originalIntro;
      function close() {
        introduction.removeAttribute("contenteditable");
        form.hidden = true;
        edit.hidden = false;
        edit.focus();
      }
      edit.onclick = () => {
        originalIntro = introduction.innerHTML;
        input.value = title.textContent.slice(numeral.length + 2);
        form.hidden = false;
        edit.hidden = true;
        introduction.contentEditable = "true";
        input.focus();
        input.select();
      };
      cancel.onclick = () => {
        introduction.innerHTML = originalIntro;
        close();
      };
      form.onsubmit = event => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) { input.focus(); return; }
        localStorage.setItem(key, JSON.stringify({ title: value, intro: introduction.innerHTML }));
        title.textContent = numeral + ". " + value;
        close();
      };
    }

    new MutationObserver(formatHeadingNumbers).observe(list, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }, { once: true });
}

export const colorCurriculumScript = `<style>
#colorKnowledgeList .kf-color-group-edit,
#colorKnowledgeList .kf-color-group-form button {
  margin: .25rem .4rem; padding: .35rem .65rem; border: 1px solid #cfdaeb;
  border-radius: .5rem; background: #f8fafc; color: #17243c; font-size: .8rem; cursor: pointer;
}
#colorKnowledgeList .kf-color-group-form:not([hidden]) {
  display: flex; flex-wrap: wrap; align-items: end; gap: .4rem; padding: .625rem;
}
#colorKnowledgeList .kf-color-group-form label { display: grid; gap: .25rem; flex: 1 1 18rem; }
#colorKnowledgeList .kf-color-group-form input { width: 100%; padding: .4rem; font: inherit; }
#colorKnowledgeList > .knowledge-content[contenteditable="true"] { outline: 2px solid #4f46e5; }
</style><script>(${formatColorCurriculum.toString()})();</script>`;
