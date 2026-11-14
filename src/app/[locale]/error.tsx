"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-x max-w-[620px] py-24 text-center">
      <h1 className="font-serif text-[30px] font-bold text-navy-900">Սխալ · Ошибка · Error</h1>
      <button onClick={reset} className="btn-navy mt-7">↻</button>
    </div>
  );
}
