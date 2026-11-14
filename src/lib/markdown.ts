import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderMarkdown(md: string): string {
  const html = marked.parse(md || "", { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3"]),
    allowedAttributes: { a: ["href", "title", "target", "rel"], img: ["src", "alt", "width", "height", "loading"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
    },
  });
}
