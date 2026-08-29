// codeauthor chetas karnam
interface MetricCardProps {
  title: string;
  value: string;
  detail: string;
}

export function MetricCard({ title, value, detail }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
