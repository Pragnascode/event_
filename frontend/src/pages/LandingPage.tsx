import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { RoleType } from "../types";
import { apiFetch } from "../api/client";
import { getOrCreateDeviceId, readAuth, writeAuth } from "../auth/storage";

type CreateRoomResponse = {
  roomId: string;
  adminJwt: string;
  volunteerCode: string;
  delegateCode: string;
  organizerCode: string;
  everyoneCode: string;
  event: { eventName: string; durationHours: number };
};

type JoinRoomResponse = {
  roomId: string;
  roleType: Exclude<RoleType, "ADMIN">;
  deviceId: string;
  jwt: string;
};

export default function LandingPage() {
  const navigate = useNavigate();

  const [modeError, setModeError] = useState<string | null>(null);
  const [eventName, setEventName] = useState("");
  const [durationHours, setDurationHours] = useState<number>(24);
  const [joinCode, setJoinCode] = useState("");

  const [created, setCreated] = useState<null | { 
    volunteerCode: string; 
    delegateCode: string; 
    organizerCode: string;
    everyoneCode: string;
    roomId: string; 
    adminJwt: string 
  }>(null);

  async function handleCreate() {
    setModeError(null);
    try {
      const res = await apiFetch<CreateRoomResponse>("/api/rooms/create", {
        method: "POST",
        body: { eventName, durationHours },
      });

      writeAuth({ jwt: res.adminJwt, roomId: res.roomId, roleType: "ADMIN" });
      setCreated({ 
        volunteerCode: res.volunteerCode, 
        delegateCode: res.delegateCode, 
        organizerCode: res.organizerCode,
        everyoneCode: res.everyoneCode,
        roomId: res.roomId, 
        adminJwt: res.adminJwt 
      });
    } catch (err) {
      setModeError(err instanceof Error ? err.message : "Failed to create room");
    }
  }

  async function handleJoin() {
    setModeError(null);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await apiFetch<JoinRoomResponse>("/api/rooms/join", {
        method: "POST",
        body: { code: joinCode.trim(), deviceId },
      });

      writeAuth({ jwt: res.jwt, roomId: res.roomId, roleType: res.roleType, deviceId: res.deviceId });
      navigate("/home", { replace: true });
    } catch (err) {
      setModeError(err instanceof Error ? err.message : "Failed to join room");
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const auth = readAuth();
  if (auth && !created) {
    return (
      <div className="page hero-gradient">
        <div className="card col" style={{ textAlign: "center", marginTop: "40px" }}>
          <div className="feature-icon" style={{ alignSelf: "center" }}>👋</div>
          <h1 className="title">Welcome Back</h1>
          <p className="subtle">You are currently active in an event room.</p>
          <button className="btn btn-primary btn-full" onClick={() => navigate("/home", { replace: true })}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page hero-gradient" style={{ gap: "32px" }}>
      {/* Header / Hero */}
      <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
        <div style={{ 
          display: "inline-block", 
          padding: "6px 12px", 
          background: "rgba(var(--accent-rgb), 0.1)", 
          borderRadius: "99px",
          color: "var(--accent)",
          fontSize: "13px",
          fontWeight: "600",
          marginBottom: "16px"
        }}>
          ✨ Secure Event Management
        </div>
        <h1 className="title" style={{ fontSize: "42px", lineHeight: "1.1", marginBottom: "16px" }}>
          Coordinate Your Event <span style={{ color: "var(--accent)" }}>Live.</span>
        </h1>
        <p className="subtle" style={{ maxWidth: "340px", margin: "0 auto", fontSize: "16px" }}>
          Real-time alerts, location tracking, and secure communication for your entire team.
        </p>
      </div>

      {/* Join Section */}
      <div className="card col">
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div className="feature-icon" style={{ margin: 0, width: "32px", height: "32px", fontSize: "16px" }}>🔑</div>
          <h2 className="title" style={{ fontSize: "18px" }}>Join an Event</h2>
        </div>
        <p className="subtle">Enter your role-specific invitation code to enter the room.</p>
        
        <div className="input-group" style={{ marginTop: "12px" }}>
          <input 
            className="input-field"
            value={joinCode} 
            onChange={(e) => setJoinCode(e.target.value)} 
            placeholder="e.g. VOL-XXXX-XXXX" 
          />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleJoin}>
          Join Now
        </button>
      </div>

      {/* Create Section */}
      <div className="card col" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div className="feature-icon" style={{ margin: 0, width: "32px", height: "32px", fontSize: "16px", background: "rgba(255,90,106,0.1)" }}>🏗️</div>
          <h2 className="title" style={{ fontSize: "18px" }}>Create Event Room</h2>
        </div>
        <p className="subtle">Organizers can spin up a new secure room in seconds.</p>

        <div className="col" style={{ marginTop: "12px", gap: "16px" }}>
          <div className="input-group">
            <label>Event Name</label>
            <input className="input-field" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Annual Tech Fest" />
          </div>
          <div className="input-group">
            <label>Duration (Hours)</label>
            <input
              className="input-field"
              type="number"
              value={durationHours}
              min={1}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            />
          </div>
          <button className="btn btn-ghost btn-full" onClick={handleCreate}>
            Initialize Room
          </button>
        </div>
      </div>

      {modeError && <div className="error">{modeError}</div>}

      {/* Results Section */}
      {created && (
        <div className="card col" style={{ border: "2px solid var(--accent)", background: "rgba(var(--accent-rgb), 0.05)" }}>
          <h2 className="title" style={{ color: "var(--accent)" }}>Success! Keys Generated</h2>
          <p className="subtle">Copy and distribute these keys to your team members.</p>
          
          <div className="list" style={{ marginTop: "16px" }}>
            {[
              { label: "Organizers", code: created.organizerCode },
              { label: "Delegates", code: created.delegateCode },
              { label: "Volunteers", code: created.volunteerCode },
              { label: "Everyone", code: created.everyoneCode }
            ].map((item) => (
              <div key={item.label} className="row" style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "12px", justifyContent: "space-between" }}>
                <div className="col" style={{ gap: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", opacity: 0.6 }}>{item.label}</span>
                  <span className="pill-code" style={{ border: 0, padding: 0, background: "transparent" }}>{item.code}</span>
                </div>
                <button className="btn btn-ghost" style={{ padding: "8px" }} onClick={() => copy(item.code)}>
                  Copy
                </button>
              </div>
            ))}
          </div>
          
          <button className="btn btn-primary btn-full" style={{ marginTop: "16px" }} onClick={() => navigate("/home", { replace: true })}>
            Enter Dashboard
          </button>
        </div>
      )}

      {/* Features Footer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", paddingBottom: "20px" }}>
        <div className="card" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>🛰️</div>
          <div style={{ fontSize: "12px", fontWeight: "600" }}>Live Tracking</div>
        </div>
        <div className="card" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: "20px", marginBottom: "4px" }}>💬</div>
          <div style={{ fontSize: "12px", fontWeight: "600" }}>Discord Chat</div>
        </div>
      </div>
    </div>
  );
}
