interface ProjectCardProps {
  title: string
  description: string
  tech: string[]
  repo?: string
  demo?: string
}

export function ProjectCard({ title, description, tech, repo, demo }: ProjectCardProps) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] p-5 flex flex-col gap-3 hover:border-[hsl(var(--accent))] transition-colors">
      <h3 className="font-semibold text-base">{title}</h3>
      <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">{description}</p>
      <div className="flex flex-wrap gap-1.5">
        {tech.map((t) => (
          <span
            key={t}
            className="rounded-full bg-[hsl(var(--muted))] px-2.5 py-0.5 text-xs font-mono"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex gap-3 text-sm">
        {repo && (
          <a
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--accent))] hover:underline"
          >
            GitHub →
          </a>
        )}
        {demo && (
          <a
            href={demo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--accent))] hover:underline"
          >
            Live Demo →
          </a>
        )}
      </div>
    </div>
  )
}
