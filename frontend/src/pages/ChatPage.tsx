import { useEffect, useMemo, useRef, useState } from "react";
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
  targetType: "EVERYONE" | "ROLE";
  targetRole: RoleType | null;
};

type AlertsResponse = {
  alerts: AlertDto[];
  nextCursor?: string;
};

function getRoleInfo(role: RoleType) {
  switch (role) {
    case "ADMIN": return { label: "Admin", class: "admin", initial: "A" };
    case "ORGANIZER": return { label: "Organizer", class: "organizer", initial: "O" };
    case "DELEGATE": return { label: "Delegate", class: "delegate", initial: "D" };
    case "VOLUNTEER": return { label: "Volunteer", class: "volunteer", initial: "V" };
    default: return { label: "Everyone", class: "everyone", initial: "E" };
  }
}

export default function ChatPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";
  const myRole = auth?.roleType as RoleType | undefined;

  const [messages, setMessages] = useState<AlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [targetRole, setTargetRole] = useState<RoleType | "EVERYONE">("EVERYONE");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
    }
  };

  async function loadLatest(isInitial = false) {
    if (!roomId || !jwt) return;
    if (isInitial) setLoading(true);
    try {
      const res = await apiFetch<AlertsResponse>(`/api/rooms/${roomId}/alerts`, {
        method: "GET",
        jwt,
        query: { limit: 50 },
      });
      const newMessages = res.alerts.reverse();
      
      setMessages((prev) => {
        // Simple check to see if we actually have new messages
        if (prev.length > 0 && newMessages.length > 0 && 
            prev[prev.length - 1].id === newMessages[newMessages.length - 1].id) {
          return prev;
        }
        return newMessages;
      });

      setNextCursor(res.nextCursor);
      
      if (isInitial || isAtBottom) {
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      if (isInitial) setLoading(false);
    }
  }

  useEffect(() => {
    if (!roomId || !jwt) return;
    void loadLatest(true);
    const t = window.setInterval(() => void loadLatest(), 3000);
    return () => window.clearInterval(t);
  }, [roomId, jwt, isAtBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  async function sendMessage() {
    if (!newMessage.trim() || !roomId || !jwt) return;
    setSending(true);
    setErr(null);
    const msg = newMessage;
    setNewMessage("");
    try {
      await apiFetch(`/api/rooms/${roomId}/alerts`, {
        method: "POST",
        jwt,
        body: {
          alertType: targetRole === "EVERYONE" ? "EVERYONE" : "ROLE",
          targetRole: targetRole === "EVERYONE" ? undefined : targetRole,
          message: msg,
        },
      });
      await loadLatest();
      scrollToBottom();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send message");
      setNewMessage(msg);
    } finally {
      setSending(false);
    }
  }

  async function loadMore() {
    if (!roomId || !jwt || !nextCursor) return;
    try {
      const res = await apiFetch<AlertsResponse>(`/api/rooms/${roomId}/alerts`, {
        method: "GET",
        jwt,
        query: { limit: 20, cursor: nextCursor },
      });
      setMessages((prev) => [...res.alerts.reverse(), ...prev]);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load older messages");
    }
  }

  if (!auth || !myRole) {
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

  // Group messages by sender and time (within 5 minutes)
  const groupedMessages: { sender: RoleType; messages: AlertDto[]; time: string; isPanic: boolean }[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    // Don't group if one is a panic alert and the other isn't
    const isSameSender = prev && prev.createdByRole === m.createdByRole && m.isPanic === prev.isPanic;
    const isCloseInTime = prev && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000);

    if (isSameSender && isCloseInTime) {
      groupedMessages[groupedMessages.length - 1].messages.push(m);
    } else {
      groupedMessages.push({ 
        sender: m.createdByRole, 
        messages: [m], 
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPanic: m.isPanic
      });
    }
  });

  return (
    <div className="app-container">
      {/* Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="chat-header" style={{ justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: 4, fontWeight: 700 }}>ES</div>
            <span style={{ fontWeight: 600, color: "#fff" }}>Event Server</span>
          </div>
          <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setIsSidebarOpen(false)}>
             <span style={{ fontSize: 20 }}>✕</span>
          </button>
        </div>
        <div style={{ flex: 1, padding: "16px 8px", overflowY: "auto" }}>
          <p style={{ color: "#8e9297", fontSize: 12, fontWeight: 700, padding: "0 8px 8px", textTransform: "uppercase" }}>Text Channels</p>
          <div 
            style={{ background: "rgba(255,255,255,0.05)", padding: "6px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#fff" }}
            onClick={() => setIsSidebarOpen(false)}
          >
            <span style={{ color: "#8e9297", fontSize: 20 }}>#</span>
            <span style={{ fontWeight: 500 }}>general</span>
          </div>
        </div>
        <div style={{ padding: "8px 12px", background: "#292b2f", display: "flex", alignItems: "center", gap: 10 }}>
          <div className={`avatar-small ${getRoleInfo(myRole!).class}`} style={{ background: getRoleInfo(myRole!).class === 'delegate' ? '#f7ff6a' : undefined }}>
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: getRoleInfo(myRole!).class === 'delegate' ? '#000' : '#fff' }}>
              {getRoleInfo(myRole!).initial}
            </div>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getRoleInfo(myRole!).label}</p>
            <p style={{ color: "#b9bbbe", fontSize: 11, margin: 0 }}>Online</p>
          </div>
          <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => navigate("/home", { replace: true })}>
            <span style={{ fontSize: 18 }}>↩</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost mobile-only" style={{ padding: "4px 8px", marginRight: 4 }} onClick={() => setIsSidebarOpen(true)}>
               <span style={{ fontSize: 20, color: "#8e9297" }}>☰</span>
            </button>
            <span style={{ color: "#8e9297", fontSize: 24 }}>#</span>
            <span style={{ fontWeight: 600, color: "#fff" }}>general</span>
          </div>
          <div className="row" style={{ gap: 16 }}>
             <button className="btn btn-ghost" style={{ padding: 4 }} title="Search">🔍</button>
             <button className="btn btn-ghost desktop-only" style={{ padding: 4 }} title="Members">👥</button>
          </div>
        </div>

        {err && (
          <div style={{ padding: "8px 16px", color: "var(--danger)", fontSize: 13, background: "rgba(237, 66, 69, 0.08)" }}>
            {err}
          </div>
        )}

        <div className="chat-messages" ref={scrollRef}>
          {nextCursor && (
            <button className="btn btn-ghost" style={{ fontSize: 13, margin: "10px auto", padding: "4px 12px", alignSelf: "center" }} onClick={() => void loadMore()}>
              Load older messages
            </button>
          )}

          {loading && messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <p className="subtle">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <h3 className="title">Welcome to #general!</h3>
              <p className="subtle">This is the start of the conversation.</p>
            </div>
          ) : (
            groupedMessages.map((group, groupIdx) => {
              const roleInfo = getRoleInfo(group.sender);
              return (
                <div key={groupIdx} className="message-group">
                  <div className="message-item">
                    <div className={`avatar ${roleInfo.class}`}>
                      {group.isPanic ? "⚠" : roleInfo.initial}
                    </div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="sender-name" style={{ color: group.isPanic ? "#f04747" : undefined }}>
                        {roleInfo.label}
                        {!group.isPanic && group.messages[0].targetType === "ROLE" && (
                          <span style={{ 
                            marginLeft: 8, 
                            fontSize: '10px', 
                            background: 'rgba(255,255,255,0.1)', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            verticalAlign: 'middle',
                            color: '#b9bbbe'
                          }}>
                            TO: {group.messages[0].targetRole}
                          </span>
                        )}
                      </span>
                        <span className="timestamp">
                          {group.time}
                        </span>
                      </div>
                      {group.messages.map((m) => (
                        <div key={m.id} className={`message-text ${m.isPanic ? "panic-msg" : ""}`}>
                          {m.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: "0 16px 24px" }}>
          {(myRole === "ADMIN" || myRole === "ORGANIZER") && (
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              <button 
                onClick={() => setTargetRole("EVERYONE")}
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: targetRole === "EVERYONE" ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  color: targetRole === "EVERYONE" ? '#000' : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Everyone
              </button>
              {["DELEGATE", "VOLUNTEER", "ORGANIZER"].map(r => (
                <button 
                  key={r}
                  onClick={() => setTargetRole(r as RoleType)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: targetRole === r ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    color: targetRole === r ? '#000' : '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Only {r}s
                </button>
              ))}
            </div>
          )}
          <div style={{ background: "#40444b", borderRadius: 8, display: "flex", alignItems: "center", padding: "0 16px" }}>
             <button className="btn btn-ghost" style={{ padding: 0, fontSize: 20, color: "#b9bbbe", marginRight: 12 }}>+</button>
             <input
                className="chat-input"
                style={{ flex: 1, padding: "12px 0", background: "transparent", border: "none", color: "#dcddde", outline: "none" }}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={targetRole === "EVERYONE" ? "Message #general" : `Message to all ${targetRole}s`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={sending}
              />
          </div>
        </div>
      </div>

      {/* Member Sidebar (Hidden on small screens via CSS) */}
      <div className="member-sidebar">
        <div className="chat-header">
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8e9297", textTransform: "uppercase" }}>Members</span>
        </div>
        <div style={{ padding: "16px 8px" }}>
          <p style={{ color: "#8e9297", fontSize: 12, fontWeight: 700, padding: "0 8px 8px", textTransform: "uppercase" }}>Online — 1</p>
          <div className="member-item online">
             <div className={`avatar-small ${getRoleInfo(myRole!).class}`} style={{ background: getRoleInfo(myRole!).class === 'delegate' ? '#f7ff6a' : undefined }}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: getRoleInfo(myRole!).class === 'delegate' ? '#000' : '#fff' }}>
                  {getRoleInfo(myRole!).initial}
                </div>
             </div>
             <span style={{ fontWeight: 500 }}>{getRoleInfo(myRole!).label} (You)</span>
          </div>
        </div>
      </div>
    </div>
  );
}


