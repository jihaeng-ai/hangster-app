// 변화 설명 (서버가 문장 틀로 만든 최대 3문장을 그대로 보여준다)
export function ChangeSummary({ sentences }: { sentences: string[] }) {
  if (sentences.length === 0) return null;
  return (
    <section aria-label="변화 설명" className="rounded-lg bg-zinc-50 p-4 text-sm leading-6 dark:bg-zinc-900">
      <h2 className="mb-1 font-semibold">변화 설명</h2>
      {sentences.map((s) => (
        <p key={s}>{s}</p>
      ))}
    </section>
  );
}
