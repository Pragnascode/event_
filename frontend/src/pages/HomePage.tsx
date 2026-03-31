import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/client";
import { getOrCreateDeviceId, readAuth, writeAuth } from "../auth/storage";
import type { RoleType } from "../types";

function PanicButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="bottom-panic" style={{ background: "transparent", padding: "0 24px 24px" }}>
      <button className="btn btn-danger btn-full" style={{ 
        boxShadow: "0 0 20px rgba(255, 59, 59, 0.3)",
        border: "none",
        height: "56px",
        fontSize: "16px",
        letterSpacing: "0.05em"
      }} onClick={onClick}>
        🚨 EMERGENCY PANIC
      </button>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";
  const roleType = auth?.roleType as RoleType | undefined;
  const isAdmin = roleType === "ADMIN" || roleType === "ORGANIZER";

  const [err, setErr] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<{ eventName: string; durationHours: number } | null>(null);

  useEffect(() => {
    async function loadDetails() {
      if (!roomId || !jwt || !isAdmin) return;
      try {
        const res = await apiFetch<{ eventName: string; durationHours: number }>(`/api/admin/rooms/${roomId}/details`, { jwt });
        setEventDetails(res);
      } catch (e) {
        // ignore
      }
    }
    loadDetails();
  }, [roomId, jwt, isAdmin]);

  function humanRole(role: RoleType) {
    if (role === "ADMIN") return "Admin";
    if (role === "ORGANIZER") return "Organizer";
    if (role === "DELEGATE") return "Delegate";
    if (role === "VOLUNTEER") return "Volunteer";
    return "Member";
  }

  async function updateMyLocation() {
    if (!roomId || !jwt) return;
    setErr(null);
    if (!("geolocation" in navigator)) {
      setErr("Geolocation not supported.");
      return;
    }

    const deviceId = auth?.deviceId ?? getOrCreateDeviceId();
    if (!auth?.deviceId) writeAuth({ jwt, roomId, roleType: roleType ?? "VOLUNTEER", deviceId });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiFetch(`/api/rooms/${roomId}/location`, {
            method: "PUT",
            jwt,
            body: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          });
          alert("Location updated successfully!");
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Failed to update location");
        }
      },
      (geoErr) => setErr(geoErr.message || "Failed to get location"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (!auth?.jwt) navigate("/", { replace: true });
  }, [auth?.jwt, navigate]);

  if (!auth || !roleType) {
    return (
      <div className="page hero-gradient">
        <div className="card" style={{ marginTop: "100px", textAlign: "center" }}>
          <p className="subtle">Session expired or missing.</p>
          <button className="btn btn-primary btn-full" style={{ marginTop: "16px" }} onClick={() => navigate("/", { replace: true })}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app hero-gradient" style={{ minHeight: "100vh" }}>
      <div className="page" style={{ paddingBottom: "100px" }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
          <div className="col" style={{ gap: "4px" }}>
            <h1 className="title" style={{ fontSize: "28px", lineHeight: "1.2" }}>
              {eventDetails?.eventName ?? "Event Hub"}
            </h1>
            <div className="row" style={{ gap: "8px" }}>
              <span style={{ 
                background: "rgba(var(--accent-rgb), 0.15)", 
                color: "var(--accent)", 
                padding: "2px 10px", 
                borderRadius: "99px", 
                fontSize: "12px", 
                fontWeight: "700",
                textTransform: "uppercase"
              }}>
                {humanRole(roleType)}
              </span>
              {eventDetails && (
                <span className="subtle" style={{ fontSize: "12px" }}>
                  ⏱️ {eventDetails.durationHours}h
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: "8px 12px", fontSize: "13px" }}
            onClick={() => {
              localStorage.clear();
              navigate("/", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="col" style={{ gap: "20px", marginTop: "24px" }}>
          <div className="card col" style={{ padding: "20px", background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(0,0,0,0) 100%)" }}>
            <div className="row" style={{ marginBottom: "4px" }}>
              <div style={{ fontSize: "24px" }}>💬</div>
              <h2 className="title" style={{ fontSize: "18px" }}>Communication</h2>
            </div>
            <p className="subtle" style={{ marginBottom: "12px" }}>Jump into the real-time event chat.</p>
            <button className="btn btn-primary btn-full" onClick={() => navigate("/chat", { replace: true })}>
              Open #general Chat
            </button>
          </div>

          <div className="card col" style={{ padding: "20px" }}>
            <div className="row" style={{ marginBottom: "4px" }}>
              <div style={{ fontSize: "24px" }}>📍</div>
              <h2 className="title" style={{ fontSize: "18px" }}>Location Services</h2>
            </div>
            <p className="subtle" style={{ marginBottom: "12px" }}>
              {isAdmin ? "Monitor team movements live." : "Share your position with organizers."}
            </p>
            <div className="list">
              <button className="btn btn-ghost btn-full" onClick={() => navigate("/map")}>
                {isAdmin ? "View Live Team Map" : "Open Tracking Map"}
              </button>
              {!isAdmin && (
                <button className="btn btn-ghost btn-full" style={{ borderColor: "rgba(255,255,255,0.1)" }} onClick={updateMyLocation}>
                  Quick GPS Update
                </button>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="card col" style={{ padding: "20px", borderStyle: "dashed" }}>
              <div className="row" style={{ marginBottom: "4px" }}>
                <div style={{ fontSize: "24px" }}>🛡️</div>
                <h2 className="title" style={{ fontSize: "18px" }}>Admin Tools</h2>
              </div>
              <div className="list">
                <button className="btn btn-ghost btn-full" onClick={() => navigate("/send-alerts")}>
                  Send Official Alert
                </button>
                <button className="btn btn-ghost btn-full" onClick={() => navigate("/settings")}>
                  Room Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {err && <div className="error" style={{ marginTop: "20px" }}>{err}</div>}
      </div>

      <PanicButton onClick={() => navigate("/panic", { replace: false })} />
    </div>
  );
}
