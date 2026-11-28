function formatColorCurriculum() {
  document.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("colorKnowledgeList");
    if (!list) return;

    function hideHeadingNumbers() {
      for (const heading of list.querySelectorAll(":scope > h2.kf-curriculum-part")) {
        const text = heading.firstChild;
        if (heading.isContentEditable || text?.nodeType !== Node.TEXT_NODE) continue;

        const prefix = text.data.match(/^\s*\d{2}\.\s+/u);
        if (!prefix) continue;

        const number = document.createElement("span");
        number.hidden = true;
        number.textContent = prefix[0];
        text.deleteData(0, prefix[0].length);
        heading.prepend(number);
      }
    }

    hideHeadingNumbers();
    new MutationObserver(hideHeadingNumbers).observe(list, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }, { once: true });
}

export const colorCurriculumScript = `<script>(${formatColorCurriculum.toString()})();</script>`;
