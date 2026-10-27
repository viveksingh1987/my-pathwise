import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api/client";
import type { HomeDomain } from "../types/models";
import { APP_NAME, pageTitle } from "../constants/brand";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { AppHeader } from "../components/ui/AppHeader";
import { Modal } from "../components/ui/Modal";

export function HomePage() {
  const [domains, setDomains] = useState<HomeDomain[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [lead, setLead] = useState("");
  const { toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = pageTitle();
  }, []);

  useEffect(() => {
    api.fetchHome().then(setDomains).catch(() => toast("Could not load domains"));
  }, [toast]);

  const createDomain = async () => {
    if (!title.trim()) {
      toast("Enter a title");
      return;
    }
    try {
      const plan = await api.createPlan({
        title: title.trim(),
        subtitle: subtitle.trim(),
        lead: lead.trim(),
      });
      setModalOpen(false);
      navigate(`/plan/${encodeURIComponent(plan.slug)}`);
    } catch {
      toast("Could not create domain");
    }
  };

  return (
    <div className="page-shell">
      <AppHeader>
        <button type="button" className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
          ◐
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          New domain
        </button>
      </AppHeader>
      <div className="home-shell">
      <header className="home-header">
        <div>
          <h1 className="home-title">{APP_NAME}</h1>
          <p className="sub">Domains, modules, topics, notes, and study time in one place.</p>
        </div>
      </header>
      <div className="domain-grid" aria-live="polite">
        {domains.map((d) => (
          <Link key={d.slug} to={`/plan/${encodeURIComponent(d.slug)}`} className="domain-card glass">
            <h2>{d.title}</h2>
            <p className="sub">{d.subtitle || d.lead || ""}</p>
            <div className="domain-stats">
              <span>
                <strong>{d.percent_done}%</strong>
                done
              </span>
              <span>
                <strong>
                  {d.topics_done}/{d.topics_total}
                </strong>
                topics
              </span>
              <span>
                <strong>{d.sections}</strong>
                sections
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${d.percent_done || 0}%` }} />
            </div>
          </Link>
        ))}
      </div>

      <Modal
        open={modalOpen}
        title="New learning domain"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={createDomain}>
              Create
            </button>
          </>
        }
      >
        <div className="add-form">
          <input
            type="text"
            placeholder="Title (e.g. DevOps 2027)"
            aria-label="Domain title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Subtitle (optional)"
            aria-label="Domain subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
          <textarea
            placeholder="Short description"
            rows={3}
            aria-label="Domain description"
            value={lead}
            onChange={(e) => setLead(e.target.value)}
          />
        </div>
      </Modal>
      </div>
    </div>
  );
}
