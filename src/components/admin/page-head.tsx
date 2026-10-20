import type { ReactNode } from "react";

export interface AdminPageHeadProps {
  title: string;
  description?: string;
  /** The page's one primary action, rendered to the right of the text block. */
  actions?: ReactNode;
}

/**
 * One head for every console page: the H1 and its description on the left, the
 * primary action on the right. The console is a workbench of six separate pages,
 * and this is what makes them read as one surface — a page that grows its own
 * heading markup drifts within a week.
 */
export function AdminPageHead({ title, description, actions }: AdminPageHeadProps) {
  return (
    <div className="admin-page-head">
      <div className="admin-page-head-text">
        <h1>{title}</h1>
        {description === undefined ? null : <p>{description}</p>}
      </div>
      {actions === undefined ? null : <div className="admin-page-actions">{actions}</div>}
    </div>
  );
}
