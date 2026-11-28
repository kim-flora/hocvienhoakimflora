export const editorFontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

export function applyEditorFontSize(editor, range, size) {
  if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return false;

  const doc = editor.ownerDocument;
  const walker = doc.createTreeWalker(range.commonAncestorContainer, 4);
  const portions = [];
  const add = node => {
    if (!range.intersectsNode(node) || node.parentElement.closest('[contenteditable="false"]')) return;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    if (end > start) portions.push({ node, start, end });
  };
  if (walker.root.nodeType === 3) add(walker.root);
  while (walker.nextNode()) add(walker.currentNode);

  const wrappers = portions.map(({ node, start, end }) => {
    if (end < node.length) node.splitText(end);
    if (start > 0) node = node.splitText(start);
    const span = doc.createElement("span");
    span.style.setProperty("font-size", size + "px", "important");
    node.before(span);
    span.append(node);
    return span;
  });
  if (!wrappers.length) return false;

  const updatedRange = doc.createRange();
  updatedRange.setStartBefore(wrappers[0]);
  updatedRange.setEndAfter(wrappers.at(-1));
  const selection = doc.getSelection();
  selection.removeAllRanges();
  selection.addRange(updatedRange);
  return true;
}
