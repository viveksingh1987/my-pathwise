import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as api from "../api/client";
import type { HomeDomain } from "../types/models";
import { APP_NAME, pageTitle } from "../constants/brand";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../hooks/useToast";
import { AppFooter } from "../components/ui/AppFooter";
import { AppHeader } from "../components/ui/AppHeader";
import { IconPlus, IconTrash } from "../components/ui/icons";
import { Modal } from "../components/ui/Modal";

export function HomePage() {
  const [domains, setDomains] = useState<HomeDomain[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [lead, setLead] = useState("");
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState<string | null>(null);
  const { toggleTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = pageTitle();
  }, []);

  useEffect(() => {
    api.fetchHome().then(setDomains).catch(() => toast("Could not load domains"));
  }, [toast]);

  const openCreateModal = () => {
    setTitle("");
    setSubtitle("");
    setLead("");
    setModalOpen(true);
  };

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

  const deleteDomain = async (domain: HomeDomain) => {
    if (deleteConfirmSlug !== domain.slug) {
      setDeleteConfirmSlug(domain.slug);
      return;
    }
    try {
      await api.deletePlan(domain.slug);
      setDeleteConfirmSlug(null);
      setDomains((prev) => prev.filter((d) => d.slug !== domain.slug));
      toast(`Deleted “${domain.title}”`);
    } catch {
      toast("Could not delete domain");
    }
  };

  return (
    <div className="page-shell">
      <AppHeader>
        <button type="button" className="icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
          ◐
        </button>
      </AppHeader>
      <div className="home-shell">
        <header className="home-header">
          <div>
            <h1 className="home-title">{APP_NAME}</h1>
            <p className="sub">Domains, modules, topics, notes, and study time in one place.</p>
          </div>
          <button
            type="button"
            className="icon-btn icon-btn-accent"
            aria-label="Add new domain"
            title="New domain"
            onClick={openCreateModal}
          >
            <IconPlus />
          </button>
        </header>
        <div className="domain-grid" aria-live="polite">
          {domains.map((d) => {
            const confirmingDelete = deleteConfirmSlug === d.slug;
            return (
              <article key={d.slug} className="domain-card glass">
                <div className="domain-card-head">
                  <Link to={`/plan/${encodeURIComponent(d.slug)}`} className="domain-card-link">
                    <h2>{d.title}</h2>
                  </Link>
                  <button
                    type="button"
                    className={`icon-btn icon-btn-sm${confirmingDelete ? " icon-btn-danger" : ""}`}
                    aria-label={
                      confirmingDelete ? `Confirm delete ${d.title}` : `Delete domain ${d.title}`
                    }
                    title={confirmingDelete ? "Click again to confirm" : "Delete domain"}
                    onClick={() => void deleteDomain(d)}
                    onBlur={() => {
                      if (confirmingDelete) setDeleteConfirmSlug(null);
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
                <Link to={`/plan/${encodeURIComponent(d.slug)}`} className="domain-card-link domain-card-body">
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
              </article>
            );
          })}
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
      <AppFooter />
    </div>
  );
}
