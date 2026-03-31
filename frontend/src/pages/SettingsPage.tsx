import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { readAuth } from "../auth/storage";

type DetailsResponse = { eventName: string; durationHours: number };
type CodesResponse = { 
  volunteerCode: string | null; 
  delegateCode: string | null; 
  organizerCode: string | null; 
  everyoneCode: string | null;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";
  const roleType = auth?.roleType;

  const [details, setDetails] = useState<DetailsResponse | null>(() => ({
    eventName: "Global Tech Summit 2026",
    durationHours: 72
  }));
  const [codes, setCodes] = useState<CodesResponse | null>(() => ({
    volunteerCode: "GTS26-VOL",
    delegateCode: "GTS26-DEL",
    organizerCode: "GTS26-ORG",
    everyoneCode: "GTS26-ALL"
  }));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !jwt) return;
    if (roleType !== "ADMIN") return;

    let cancelled = false;
    async function load() {
      setErr(null);
      try {
        const [d, c] = await Promise.all([
          apiFetch<DetailsResponse>(`/api/admin/rooms/${roomId}/details`, { jwt }),
          apiFetch<CodesResponse>(`/api/admin/rooms/${roomId}/codes`, { jwt }),
        ]);
        if (!cancelled) {
          setDetails(d);
          setCodes(c);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load settings");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [roomId, jwt, roleType]);

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

  if (roleType !== "ADMIN") {
    return (
      <div className="page">
        <div className="card">
          <p className="subtle">Forbidden. Admin access required.</p>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/home", { replace: true })}>
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
            Settings
          </h2>
          <button className="btn btn-ghost" onClick={() => navigate("/home", { replace: true })}>
            Back
          </button>
        </div>

        {err ? <div className="error" style={{ marginTop: 10 }}>{err}</div> : null}

        <div className="card" style={{ marginTop: 14 }}>
          <h3 className="title" style={{ fontSize: 18, marginBottom: 8 }}>
            Event details
          </h3>
          <div className="subtle">Name</div>
          <div className="pill-code">{details?.eventName ?? "—"}</div>
          <div className="subtle" style={{ marginTop: 10 }}>
            Duration (hours)
          </div>
          <div className="pill-code">{details?.durationHours ?? "—"}</div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3 className="title" style={{ fontSize: 18, marginBottom: 8 }}>
            All role codes
          </h3>

          <div className="subtle">Everyone (Public)</div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="pill-code" style={{ flex: 1 }}>{codes?.everyoneCode ?? "—"}</span>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(codes?.everyoneCode ?? "")}
              disabled={!codes?.everyoneCode}
            >
              Copy
            </button>
          </div>

          <div className="subtle" style={{ marginTop: 12 }}>
            Delegates
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="pill-code" style={{ flex: 1 }}>{codes?.delegateCode ?? "—"}</span>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(codes?.delegateCode ?? "")}
              disabled={!codes?.delegateCode}
            >
              Copy
            </button>
          </div>

          <div className="subtle" style={{ marginTop: 12 }}>
            Volunteers
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="pill-code" style={{ flex: 1 }}>{codes?.volunteerCode ?? "—"}</span>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(codes?.volunteerCode ?? "")}
              disabled={!codes?.volunteerCode}
            >
              Copy
            </button>
          </div>

          <div className="subtle" style={{ marginTop: 12 }}>
            Organizers
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="pill-code" style={{ flex: 1 }}>{codes?.organizerCode ?? "—"}</span>
            <button
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(codes?.organizerCode ?? "")}
              disabled={!codes?.organizerCode}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

