import Link from "next/link";

const tabs: [string, string][] = [
  ["/admin/crm", "Վահանակ"],
  ["/admin/crm/leads", "Լիդեր"],
  ["/admin/crm/board", "Վաճառքի խողովակ"],
  ["/admin/crm/tasks", "Առաջադրանքներ"],
  ["/admin/crm/campaigns", "Զանգվածային ուղարկում"],
  ["/admin/crm/templates", "Ձևանմուշներ"],
  ["/admin/crm/settings", "Ավտոմատացում և ալիքներ"],
  ["/admin/crm/guide", "Աճի պլան"],
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="CRM" className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className="chip min-h-10 flex-none bg-white px-4 whitespace-nowrap text-navy-800 no-underline hover:bg-navy-800 hover:text-white">{label}</Link>
        ))}
      </nav>
      {children}
    </>
  );
}
