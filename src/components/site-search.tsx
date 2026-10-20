import type { Locale } from "@/config/site";
import { buildSearchPath } from "@/domain/public-paths";

import { SearchIcon } from "./icons";

export interface SiteSearchProps {
  locale: Locale;
  /** A DOM id, so the two copies of the field never share one. */
  id: string;
  /** The form's accessible name: "site search". */
  label: string;
  placeholder: string;
  submit: string;
  /** The drawer has room for a visible label above the field; the bar does not. */
  withLabel?: boolean;
}

/**
 * The one search field, rendered twice: once in the bar for a pointer, once in
 * the mobile drawer. Both are a plain GET form, so the field works with no
 * JavaScript and the query is the URL the search page already reads.
 */
export function SiteSearch({
  locale,
  id,
  label,
  placeholder,
  submit,
  withLabel = false,
}: SiteSearchProps) {
  return (
    <form
      className="site-search"
      action={buildSearchPath({ locale })}
      method="get"
      role="search"
      aria-label={label}
    >
      {withLabel && (
        <label className="site-search-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="site-search-field">
        <input
          id={id}
          type="search"
          name="q"
          aria-label={withLabel ? undefined : label}
          placeholder={placeholder}
        />
        <button type="submit" className="site-search-submit" aria-label={submit}>
          <SearchIcon />
        </button>
      </div>
    </form>
  );
}
