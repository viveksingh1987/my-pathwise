import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_NAME } from "../../constants/brand";

type AppHeaderProps = {
  children?: ReactNode;
};

/** Site-wide brand bar shown on every page. */
export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="app-brand-bar glass">
      <Link to="/" className="app-brand" aria-label={`${APP_NAME} home`}>
        {APP_NAME}
      </Link>
      {children ? <div className="app-brand-actions">{children}</div> : null}
    </header>
  );
}
