import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderMarkdown } from "@/lib/markdown";
import { PageHead } from "@/components/admin/fields";

/** CRM handbook: algorithms, daily routine, 90-day growth plan, KPIs, setup (source: docs/CRM.md). */
export default async function Guide() {
  const md = await readFile(path.join(process.cwd(), "docs", "CRM.md"), "utf8").catch(() => "# docs/CRM.md not found");
  const html = renderMarkdown(md.replace(/^# .*\n/, ""));
  return (
    <>
      <PageHead title="CRM և աճի պլան" />
      <article
        className="card prose-lg p-6 sm:p-10 [&_pre]:whitespace-pre [&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-ivory [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_hr]:my-8 [&_hr]:border-line"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
