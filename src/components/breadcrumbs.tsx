import Link from "next/link";

export interface BreadcrumbItem {
  href: string;
  label: string;
}

/** The Category path as a real navigation list; the last crumb is the current page. */
export function Breadcrumbs({ label, items }: { label: string; items: readonly BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label={label}>
      <ol>
        {items.map((item, index) => (
          <li key={item.href}>
            {index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link href={item.href}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
