// Move a node to <body> so it escapes ancestor clipping (the accordion's
// overflow:hidden, the table's overflow-x). Used by the status + send popovers.
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}
