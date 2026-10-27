import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_ICON_SVG, APP_NAME } from "../../constants/brand";
import { IconArrowLeft } from "./icons";

type AppHeaderProps = {
  children?: ReactNode;
  /** When set, shows a back link to a parent route (e.g. all domains from a plan page). */
  backTo?: string;
  backLabel?: string;
};

/** Site-wide brand bar shown on every page. */
export function AppHeader({ children, backTo, backLabel = "All domains" }: AppHeaderProps) {
  return (
    <header className="app-brand-bar glass">
      <div className="app-brand-bar-start">
        <Link to="/" className="app-brand" aria-label={`${APP_NAME} home`}>
          <img src={APP_ICON_SVG} alt="" className="app-brand-mark" width={32} height={32} />
          <span>{APP_NAME}</span>
        </Link>
        {backTo ? (
          <Link to={backTo} className="btn btn-ghost app-header-back">
            <IconArrowLeft />
            <span>{backLabel}</span>
          </Link>
        ) : null}
      </div>
      {children ? <div className="app-brand-actions">{children}</div> : null}
    </header>
  );
}
