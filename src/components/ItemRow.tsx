import { lookups } from '~/content/links'
import type { Item } from '~/content/types'

export function ItemRow({
  item,
  done,
  canToggle,
  onToggle,
}: {
  item: Item
  done: boolean
  canToggle: boolean
  onToggle: (done: boolean) => void
}) {
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={!canToggle}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Mark "${item.title}" complete`}
          className="mt-1 size-4 accent-[var(--color-accent)]"
        />
        <div className="min-w-0 flex-1">
          <p className={done ? 'font-medium text-muted line-through' : 'font-medium'}>
            {item.title}{' '}
            <span className="rounded-full border border-line px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-muted">
              {item.kind}
            </span>
          </p>
          <p className="text-sm text-muted">{item.detail}</p>
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            {lookups(item).map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                title={l.hint}
                className="rounded-md border border-line px-2 py-0.5 hover:border-accent hover:text-accent"
              >
                {l.label} ↗
              </a>
            ))}
          </p>
        </div>
      </div>
    </li>
  )
}
