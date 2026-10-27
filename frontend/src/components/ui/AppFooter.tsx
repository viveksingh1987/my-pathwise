import { Link } from "react-router-dom";
import { APP_ICON_SVG, APP_NAME, APP_VERSION } from "../../constants/brand";

/** Compact site footer with copyright and version. */
export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer" aria-label="Site footer">
      <div className="app-footer-inner">
        <Link to="/" className="app-footer-logo" aria-label={`${APP_NAME} home`}>
          <img src={APP_ICON_SVG} alt="" width={24} height={24} />
          <span>{APP_NAME}</span>
        </Link>
        <p className="app-footer-copy">
          © {year} {APP_NAME}. All rights reserved.
        </p>
        <span className="app-footer-meta">v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
