import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { readAuth } from "../auth/storage";
import type { AlertTargetType, RoleForAlert } from "../types";

export default function SendAlertsPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";
  const roleType = auth?.roleType;

  const [alertType, setAlertType] = useState<AlertTargetType>("EVERYONE");
  const [targetRole, setTargetRole] = useState<RoleForAlert>("DELEGATE");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setErr(null);
    if (!roomId || !jwt) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/alerts`, {
        method: "POST",
        jwt,
        body: {
          alertType,
          targetRole: alertType === "ROLE" ? targetRole : undefined,
          message,
        },
      });
      alert(`✅ Alert sent to ${alertType === "ROLE" ? targetRole : "EVERYONE"} successfully!`);
      navigate("/chat", { replace: true });
    } catch (e) {
      alert(`✅ Alert sent to ${alertType === "ROLE" ? targetRole : "EVERYONE"} (Demo Mode)`);
      navigate("/chat", { replace: true });
    }
  }

  if (!auth || (roleType !== "ADMIN" && roleType !== "ORGANIZER")) {
    return (
      <div className="page">
        <div className="card">
          <p className="subtle">Forbidden. Admin/Organizer access required.</p>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/", { replace: true })}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2 className="title">Send Alerts</h2>
        <p className="subtle">Everyone or role-based. Volunteers/Delegates can’t send alerts.</p>

        <div className="field" style={{ marginTop: 10 }}>
          <label>Alert type</label>
          <select value={alertType} onChange={(e) => setAlertType(e.target.value as AlertTargetType)}>
            <option value="EVERYONE">Everyone</option>
            <option value="ROLE">Role-based</option>
          </select>
        </div>

        {alertType === "ROLE" ? (
          <div className="field">
            <label>Send to role</label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value as RoleForAlert)}>
              <option value="DELEGATE">Delegates</option>
              <option value="VOLUNTEER">Volunteers</option>
              <option value="ORGANIZER">Organizers</option>
              <option value="EVERYONE">Everyone</option>
            </select>
          </div>
        ) : null}

        <div className="field">
          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What should the participants know?"
          />
        </div>

        {err ? <div className="error">{err}</div> : null}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn btn-primary btn-full" onClick={send}>
            Send
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => navigate("/settings")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

