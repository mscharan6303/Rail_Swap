import { Train } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border animate-fade-in">
      <div className="mx-auto size-14 rounded-2xl bg-gradient-accent flex items-center justify-center mb-4 shadow-glow">
        <Train className="size-6 text-accent-foreground" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      {body && <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
