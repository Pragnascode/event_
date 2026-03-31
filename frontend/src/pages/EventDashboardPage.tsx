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

export default function EventDashboardPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<{ eventName: string; durationHours: number } | null>(null);

  const roleType = auth?.roleType;
  const roomId = auth?.roomId;
  const jwt = auth?.jwt;

  useEffect(() => {
    async function loadDetails() {
      if (!roomId || !jwt || !roleType) return;
      try {
        const res = await apiFetch<{ eventName: string; durationHours: number }>(`/api/admin/rooms/${roomId}/details`, { jwt });
        setEventDetails(res);
      } catch (e) {
        // ignore
      }
    }
    loadDetails();
  }, [roomId, jwt, roleType]);

  useEffect(() => {
    if (!roleType || !roomId || !jwt) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await apiFetch<AlertsResponse>(`/api/rooms/${roomId}/alerts`, {
          method: "GET",
          jwt,
          query: { limit: 5 },
        });
        if (!cancelled) setAlerts(res.alerts);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [roleType, roomId, jwt]);

  async function updateMyLocation() {
    if (!roomId || !jwt) return;
    if (!("geolocation" in navigator)) {
      setErr("Geolocation not supported.");
      return;
    }

    setErr(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiFetch(`/api/rooms/${roomId}/location`, {
            method: "PUT",
            jwt,
            body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          });
          // Keep UI simple; admin map is manual refresh.
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Failed to update location");
        }
      },
      (geoErr) => {
        setErr(geoErr.message || "Failed to get location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function PanicButton() {
    return (
      <div className="bottom-panic">
        <button className="btn btn-danger btn-full" onClick={() => navigate("/panic", { replace: false })}>
          EMERGENCY PANIC
        </button>
      </div>
    );
  }

  if (!auth || !roleType || !roomId || !jwt) {
    return (
      <div className="page">
        <div className="card">
          <p className="subtle">Session missing. Please start again.</p>
        </div>
      </div>
    );
  }

  const isAdmin = roleType === "ADMIN" || roleType === "ORGANIZER";

  return (
    <div className="app page" style={{ paddingBottom: 80 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="col" style={{ gap: 4 }}>
            <h2 className="title" style={{ margin: 0 }}>
              {eventDetails?.eventName ?? "Event Dashboard"}
            </h2>
            <p className="subtle">
              Role: {roleType === "ADMIN"
                ? "Admin"
                : roleType === "ORGANIZER"
                ? "Organizer"
                : roleType === "DELEGATE"
                ? "Delegates"
                : roleType === "VOLUNTEER"
                ? "Volunteers"
                : "Everyone"}
            </p>
            {eventDetails && (
              <p className="subtle" style={{ fontSize: 12 }}>Time Limit: {eventDetails.durationHours} hours</p>
            )}
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              localStorage.clear();
              navigate("/", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="title">Quick Actions</h2>
        {isAdmin ? (
          <div className="list">
            <button className="btn btn-primary btn-full" onClick={() => navigate("/send-alerts")}>
              Send Alerts
            </button>
            <button className="btn btn-primary btn-full" onClick={() => navigate("/map")}>
              Map (Admin)
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => navigate("/settings")}>
              Settings
            </button>
          </div>
        ) : (
          <div className="list">
            <button className="btn btn-primary btn-full" onClick={updateMyLocation}>
              Update my location
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => navigate("/chat", { replace: true })}>
              Open Chat
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="title">Recent Alerts</h2>
        {loading ? <p className="subtle">Loading…</p> : null}
        {err ? <div className="error">{err}</div> : null}
        <div className="list" style={{ marginTop: 10 }}>
          {alerts.map((a) => (
            <div key={a.id} className="alert-item">
              <p className="alert-meta">{new Date(a.createdAt).toLocaleString()}</p>
              <p style={{ margin: 0, color: a.isPanic ? "#ffb3b3" : "var(--text-h)", fontWeight: 650 }}>
                {a.isPanic ? "PANIC: " : ""}
                {a.message}
              </p>
            </div>
          ))}
          {!loading && alerts.length === 0 ? <p className="subtle">No alerts yet.</p> : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/chat")}>
            Go to Chat
          </button>
        </div>
      </div>

      <PanicButton />
    </div>
  );
}

