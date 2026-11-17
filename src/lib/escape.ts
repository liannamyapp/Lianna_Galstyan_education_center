/** Escapes text for safe use inside HTML strings. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const blank = (label: string) => `<span class="contract-blank">${esc(label)}</span>`;
