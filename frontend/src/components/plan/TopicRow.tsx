import { useState } from "react";
import type { ProgressState, UiTopic } from "../../types/models";
import { formatMinutes, iso } from "../../lib/dates";
import { topicStatus } from "../../lib/progress";

type TopicRowProps = {
  topic: UiTopic;
  progress: ProgressState;
  selected: boolean;
  onSelect: () => void;
  onCycleStatus: () => void;
  onPatch: (patch: Partial<ProgressState["items"][string]>) => void;
  onLog: (mins: number) => void;
  onRemove: () => void;
};

export function TopicRow({
  topic,
  progress,
  selected,
  onSelect,
  onCycleStatus,
  onPatch,
  onLog,
  onRemove,
}: TopicRowProps) {
  const s = progress.items[topic.id] || {};
  const v = topicStatus(s);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const today = iso(new Date());
  const overdue = v !== "done" && s.date && s.date < today;

  return (
    <li
      className={`topic${selected ? " selected" : ""}`}
      data-s={v}
      data-id={topic.id}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,input,a,label")) return;
        onSelect();
      }}
    >
      <button
        type="button"
        className="status-btn"
        data-s={v}
        aria-label={`${topic.t}: ${v}. Click to change.`}
        onClick={onCycleStatus}
      >
        {v === "done" ? "✓" : v === "doing" ? "◐" : ""}
      </button>
      <div className="topic-body">
        <div className="topic-top">
          <button
            type="button"
            className={`star-btn${s.star ? " on" : ""}`}
            aria-label={s.star ? "Unstar" : "Star priority"}
            onClick={() => onPatch({ star: s.star ? 0 : 1 })}
          >
            ★
          </button>
          {topic.u ? (
            <a className="topic-title" href={topic.u} target="_blank" rel="noopener noreferrer">
              {topic.t}
            </a>
          ) : (
            <span className="topic-title">{topic.t}</span>
          )}
          <span className="tag">{topic.k}</span>
        </div>
        {topic.note ? <span className="topic-note">{topic.note}</span> : null}
        <div className="topic-actions">
          <label>Planned</label>
          <input
            type="date"
            value={s.date || ""}
            aria-label="Planned date"
            onChange={(e) => onPatch({ date: e.target.value })}
          />
          {overdue ? <span className="badge-overdue">Overdue</span> : null}
          <label>Hours</label>
          <input
            type="number"
            className="hours-input"
            min={0}
            step={0.5}
            placeholder="0"
            aria-label="Study hours"
            value={
              s.mins != null && s.mins > 0
                ? String((+s.mins / 60).toFixed(1)).replace(/\.0$/, "")
                : ""
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onPatch({ mins: val > 0 ? Math.round(val * 60) : 0 });
            }}
          />
          {[15, 30, 60].map((m) => (
            <button
              key={m}
              type="button"
              className="btn btn-sm"
              aria-label={`Log ${m} minutes for ${topic.t}`}
              onClick={() => onLog(m)}
            >
              {m === 60 ? "+1h" : `+${m}m`}
            </button>
          ))}
          <span className="time-logged">
            {s.mins ? `${formatMinutes(s.mins)} on this topic` : "No time logged"}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost topic-open-notes"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Notes
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmRemove) {
                setConfirmRemove(false);
                onRemove();
              } else {
                setConfirmRemove(true);
              }
            }}
          >
            {confirmRemove ? "Confirm remove" : "Remove"}
          </button>
        </div>
      </div>
    </li>
  );
}
