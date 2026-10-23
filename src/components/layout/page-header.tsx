export function PageHeader({ title, description, actions }: { title: React.ReactNode; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">{title}</h1>
        <span aria-hidden className="my-1 block h-px w-12 bg-primary/70" />
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border-2 border-dashed border-border bg-card/40 p-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <p className="max-w-md text-sm text-muted-foreground">{children}</p> : null}
      {action}
    </div>
  );
}
