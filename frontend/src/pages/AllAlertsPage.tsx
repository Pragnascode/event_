import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { readAuth } from "../auth/storage";
import type { RoleType } from "../types";

type AlertDto = {
  id: string;
  createdAt: string;
  message: string;
  isPanic: boolean;
  createdByRole: RoleType;
};

type AlertsResponse = {
  alerts: AlertDto[];
  nextCursor?: string;
};

export default function AllAlertsPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";

  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadMore(cursor?: string) {
    if (!roomId || !jwt) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<AlertsResponse>(`/api/rooms/${roomId}/alerts`, {
        method: "GET",
        jwt,
        query: { limit: 20, cursor },
      });
      setAlerts((prev) => [...prev, ...res.alerts]);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roomId || !jwt) return;
    setAlerts([]);
    setNextCursor(undefined);
    loadMore(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!auth || !roomId || !jwt) {
    return (
      <div className="page">
        <div className="card">
          <p className="subtle">Session missing.</p>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/", { replace: true })}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app page" style={{ paddingBottom: 24 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="title" style={{ margin: 0 }}>
            All Alerts
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate("/home", { replace: true })}>
            Back
          </button>
        </div>
        {err ? <div className="error" style={{ marginTop: 10 }}>{err}</div> : null}

        <div className="list" style={{ marginTop: 12 }}>
          {alerts.map((a) => (
            <div key={a.id} className="alert-item">
              <p className="alert-meta">{new Date(a.createdAt).toLocaleString()}</p>
              <p style={{ margin: 0, color: a.isPanic ? "#ffb3b3" : "var(--text-h)", fontWeight: 650 }}>
                {a.isPanic ? "PANIC: " : ""}
                {a.message}
              </p>
            </div>
          ))}
          {loading && alerts.length === 0 ? <p className="subtle">Loading…</p> : null}
          {!loading && alerts.length === 0 ? <p className="subtle">No alerts.</p> : null}
        </div>

        <div style={{ marginTop: 12 }}>
          {nextCursor ? (
            <button className="btn btn-primary btn-full" onClick={() => loadMore(nextCursor)} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </button>
          ) : (
            <button className="btn btn-ghost btn-full" disabled>
              No more alerts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

