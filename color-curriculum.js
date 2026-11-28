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
    new MutationObserver(formatHeadingNumbers).observe(list, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }, { once: true });
}

export const colorCurriculumScript = `<script>(${formatColorCurriculum.toString()})();</script>`;
