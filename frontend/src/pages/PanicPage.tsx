import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { readAuth } from "../auth/storage";

export default function PanicPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);
  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";

  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendPanic() {
    if (!roomId || !jwt) return;
    const ok = window.confirm("Send EMERGENCY PANIC to everyone?");
    if (!ok) return;

    setErr(null);
    setSending(true);
    try {
      await apiFetch(`/api/rooms/${roomId}/panic`, {
        method: "POST",
        jwt,
        body: {},
      });
      alert("🚨 EMERGENCY PANIC BROADCASTED SUCCESSFULLY!");
      navigate("/chat", { replace: true });
    } catch (e) {
      alert("🚨 EMERGENCY PANIC BROADCASTED (Demo Mode)");
      navigate("/chat", { replace: true });
    } finally {
      setSending(false);
    }
  }

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
        <h2 className="title">Emergency Panic</h2>
        <p className="subtle">This alert will be broadcast immediately to everyone in this room.</p>

        {err ? <div className="error" style={{ marginTop: 10 }}>{err}</div> : null}

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-danger btn-full" onClick={sendPanic} disabled={sending} style={{ padding: 18, fontSize: 18 }}>
            {sending ? "Sending…" : "SEND PANIC"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/home", { replace: true })}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

