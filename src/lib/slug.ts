export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** "Seven Nation Army!" -> "seven-nation-army" */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
