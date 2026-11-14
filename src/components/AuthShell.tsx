export function AuthShell({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-x flex justify-center pt-16">
      <div className="card w-full max-w-[460px] p-8 sm:p-10">
        <h1 className="mb-6 font-serif text-[28px] font-bold text-navy-900">{title}</h1>
        {children}
        {footer && <div className="mt-6 border-t border-[#eee7d8] pt-5 text-[14.5px] text-muted">{footer}</div>}
      </div>
    </div>
  );
}
