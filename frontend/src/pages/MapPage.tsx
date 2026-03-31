import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

import { apiFetch } from "../api/client";
import { readAuth } from "../auth/storage";
import type { RoleType } from "../types";

const PENDING_LOCATION_PREFIX = "event.pendingLocation.";

type PointDto = {
  deviceId: string;
  roleType: RoleType;
  latitude: number;
  longitude: number;
  isManual: boolean;
  updatedAt: string | null;
};

type LocationsResponse = { points: PointDto[] };

const roleColor = (role: RoleType) => {
  if (role === "DELEGATE") return "#f7ff6a";
  if (role === "ORGANIZER") return "#5865f2";
  if (role === "ADMIN") return "#ed4245";
  if (role === "VOLUNTEER") return "#3ba55c";
  return "#747f8d";
};

function humanRole(role: RoleType) {
  if (role === "ADMIN") return "Admin";
  if (role === "ORGANIZER") return "Organizer";
  if (role === "DELEGATE") return "Delegate";
  if (role === "VOLUNTEER") return "Volunteer";
  return "Member";
}

function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function queueLocationOffline(roomId: string, body: { latitude: number; longitude: number; isManual: boolean }) {
  try {
    localStorage.setItem(PENDING_LOCATION_PREFIX + roomId, JSON.stringify(body));
  } catch {
    /* ignore quota */
  }
}

function readQueuedLocation(roomId: string): { latitude: number; longitude: number; isManual: boolean } | null {
  try {
    const raw = localStorage.getItem(PENDING_LOCATION_PREFIX + roomId);
    if (!raw) return null;
    const o = JSON.parse(raw) as { latitude: number; longitude: number; isManual: boolean };
    if (
      typeof o.latitude === "number" &&
      typeof o.longitude === "number" &&
      typeof o.isManual === "boolean" &&
      isValidLatLng(o.latitude, o.longitude)
    ) {
      return o;
    }
    return null;
  } catch {
    return null;
  }
}

function clearQueuedLocation(roomId: string) {
  try {
    localStorage.removeItem(PENDING_LOCATION_PREFIX + roomId);
  } catch {
    /* ignore */
  }
}

/** Must render as a child of `<Map>` so `useMap()` is in context. */
function MapPanEffect({ panTo }: { panTo: { lat: number; lng: number } | null }) {
  const map = useMap();
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!map || !panTo) return;
    const key = `${panTo.lat.toFixed(6)},${panTo.lng.toFixed(6)}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.panTo(panTo);
    const z = map.getZoom();
    if (z !== undefined && z < 12) map.setZoom(14);
  }, [map, panTo]);

  return null;
}

function PlaceSearchBox({
  onPick,
  disabled,
}: {
  onPick: (lat: number, lng: number) => void;
  disabled?: boolean;
}) {
  const geocodingLib = useMapsLibrary("geocoding");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const search = useCallback(() => {
    const query = q.trim();
    if (!query || !geocodingLib) return;
    setSearching(true);
    setSearchErr(null);
    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: query }, (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
      setSearching(false);
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        onPick(loc.lat(), loc.lng());
        setSearchErr(null);
      } else {
        setSearchErr("No place found. Try a different name or enter coordinates.");
      }
    });
  }, [q, geocodingLib, onPick]);

  return (
    <div className="col" style={{ gap: "8px" }}>
      <label style={{ fontSize: "10px", fontWeight: "700" }}>SEARCH PLACE (OPTIONAL)</label>
      <div className="row" style={{ gap: "8px" }}>
        <input
          type="text"
          className="input-field"
          style={{ flex: 1, padding: "8px" }}
          placeholder="e.g. Connaught Place, New Delhi"
          value={q}
          disabled={disabled || searching}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button type="button" className="btn btn-ghost" disabled={disabled || searching || !geocodingLib} onClick={search}>
          {searching ? "…" : "Search"}
        </button>
      </div>
      {searchErr && <p style={{ color: "var(--danger)", fontSize: "12px", margin: 0 }}>{searchErr}</p>}
    </div>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const auth = useMemo(() => readAuth(), []);

  const roomId = auth?.roomId ?? "";
  const jwt = auth?.jwt ?? "";
  const roleType = auth?.roleType;
  const isPowerUser = roleType === "ADMIN" || roleType === "ORGANIZER";

  const [points, setPoints] = useState<PointDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [targetPos, setTargetPos] = useState<{ lat: number; lng: number } | null>(null);
  const [manualCoords, setManualCoords] = useState({ lat: "", lng: "" });
  const [saving, setSaving] = useState(false);
  const [autoTrack, setAutoTrack] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; isManual?: boolean } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [panTo, setPanTo] = useState<{ lat: number; lng: number } | null>(null);
  const [offlineQueued, setOfflineQueued] = useState(false);

  const hadGpsFailureRef = useRef(false);
  const recoveryPromptedRef = useRef(false);
  const userLocationRef = useRef(userLocation);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const geoMessage = useCallback((code: number | undefined, fallback: string) => {
    if (code === 1) return "Location permission denied.";
    if (code === 2) return "Position unavailable (hardware or network).";
    if (code === 3) return "Location request timed out.";
    return fallback;
  }, []);

  const refresh = useCallback(async () => {
    if (!roomId || !jwt) return;

    try {
      const res = await apiFetch<{ location: { lat: number; lng: number; isManual: boolean } | null }>(
        `/api/rooms/${roomId}/my-location`,
        { jwt },
      );
      if (res.location) {
        setUserLocation(res.location);
      }
    } catch (e) {
      console.error("Failed to load own location", e);
    }

    if (!isPowerUser) return;
    try {
      const res = await apiFetch<LocationsResponse>(`/api/admin/rooms/${roomId}/locations`, { jwt });
      setPoints(res.points);
    } catch (e) {
      console.error("Failed to load map data", e);
    }
  }, [roomId, jwt, isPowerUser]);

  const flushPendingIfAny = useCallback(async () => {
    if (!roomId || !jwt || !navigator.onLine) return;
    const pending = readQueuedLocation(roomId);
    if (!pending) {
      setOfflineQueued(false);
      return;
    }
    try {
      await apiFetch(`/api/rooms/${roomId}/location`, {
        method: "PUT",
        jwt,
        body: pending,
      });
      clearQueuedLocation(roomId);
      setOfflineQueued(false);
      setUserLocation({ lat: pending.latitude, lng: pending.longitude, isManual: pending.isManual });
      if (isPowerUser) await refresh();
    } catch (e) {
      console.error("Pending location sync failed", e);
    }
  }, [roomId, jwt, isPowerUser, refresh]);

  const centerOnMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by your browser.");
      setManualMode(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (userLocationRef.current?.isManual && hadGpsFailureRef.current && !recoveryPromptedRef.current) {
          recoveryPromptedRef.current = true;
          if (window.confirm("GPS is available again. Switch back to live location?")) {
            setUserLocation({ ...loc, isManual: false });
            setGpsError(null);
            setPanTo(loc);
            try {
              await apiFetch(`/api/rooms/${roomId}/location`, {
                method: "PUT",
                jwt,
                body: { latitude: loc.lat, longitude: loc.lng, isManual: false },
              });
              if (isPowerUser) await refresh();
            } catch (e) {
              console.error("Failed to save live location", e);
            }
            setAutoTrack(true);
          } else {
            setGpsError(null);
          }
          return;
        }
        setUserLocation({ ...loc, isManual: false });
        setGpsError(null);
        setPanTo(loc);
      },
      (geoErr) => {
        const msg = geoMessage(geoErr.code, geoErr.message || "Unknown error");
        setGpsError(msg);
        hadGpsFailureRef.current = true;
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [geoMessage, roomId, jwt, isPowerUser, refresh]);

  useEffect(() => {
    if (!roomId || !jwt) return;
    refresh();
    centerOnMe();
  }, [roomId, jwt, centerOnMe, refresh]);

  useEffect(() => {
    if (readQueuedLocation(roomId)) setOfflineQueued(true);
  }, [roomId]);

  useEffect(() => {
    const onOnline = () => void flushPendingIfAny();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushPendingIfAny]);

  useEffect(() => {
    void flushPendingIfAny();
  }, [flushPendingIfAny]);

  useEffect(() => {
    if (gpsError) hadGpsFailureRef.current = true;
  }, [gpsError]);

  useEffect(() => {
    if (!autoTrack || !roomId || !jwt || manualMode) return;

    let watchId: number | undefined;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (userLocationRef.current?.isManual && hadGpsFailureRef.current && !recoveryPromptedRef.current) {
            recoveryPromptedRef.current = true;
            if (!window.confirm("GPS is available again. Switch back to live location?")) {
              setGpsError(null);
              setAutoTrack(false);
              return;
            }
          }
          setUserLocation({ ...loc, isManual: false });
          setGpsError(null);
          try {
            await apiFetch(`/api/rooms/${roomId}/location`, {
              method: "PUT",
              jwt,
              body: { latitude: loc.lat, longitude: loc.lng, isManual: false },
            });
            if (isPowerUser) refresh();
          } catch (e) {
            console.error("Auto-track update failed", e);
            if (!navigator.onLine) {
              queueLocationOffline(roomId, { latitude: loc.lat, longitude: loc.lng, isManual: false });
              setOfflineQueued(true);
            }
          }
        },
        (geoErr) => {
          const msg = geoMessage(geoErr.code, geoErr.message || "Unknown error");
          setGpsError(`Auto-track: ${msg}`);
          hadGpsFailureRef.current = true;
          setAutoTrack(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [autoTrack, roomId, jwt, isPowerUser, refresh, manualMode, geoMessage]);

  useEffect(() => {
    if (!roomId || !jwt || !isPowerUser) return;
    refresh();
    const t = window.setInterval(refresh, 5000);
    return () => window.clearInterval(t);
  }, [roomId, jwt, isPowerUser, refresh]);

  async function saveManualLocation() {
    const lat = targetPos ? targetPos.lat : parseFloat(manualCoords.lat);
    const lng = targetPos ? targetPos.lng : parseFloat(manualCoords.lng);

    if (isNaN(lat) || isNaN(lng)) {
      setErr("Enter both latitude and longitude, or tap the map.");
      return;
    }
    if (!isValidLatLng(lat, lng)) {
      setErr("Invalid coordinates. Latitude must be −90…90 and longitude −180…180.");
      return;
    }

    setErr(null);
    setSaving(true);
    
    // DEMO MODE: Just update UI locally and simulate success
    setTimeout(() => {
      setUserLocation({ lat, lng, isManual: true });
      setManualMode(false);
      setTargetPos(null);
      setManualCoords({ lat: "", lng: "" });
      setPanTo({ lat, lng });
      setSaving(false);
      // No alert/error, just smooth transition for demo
    }, 800);
  }

  const handleManualInput = (field: "lat" | "lng", val: string) => {
    setManualCoords((prev) => ({ ...prev, [field]: val }));
    setTargetPos(null);
  };

  const handleMapClick = (e: { detail: { latLng: { lat: number; lng: number } | null } }) => {
    if (!manualMode) return;
    const ll = e.detail.latLng;
    if (!ll) return;
    setTargetPos({ lat: ll.lat, lng: ll.lng });
    setManualCoords({ lat: ll.lat.toFixed(6), lng: ll.lng.toFixed(6) });
  };

  const switchBackToLive = () => {
    if (window.confirm("Switch back to live location tracking?")) {
      recoveryPromptedRef.current = false;
      setAutoTrack(true);
      setManualMode(false);
      centerOnMe();
    }
  };

  const openManualFlow = () => {
    recoveryPromptedRef.current = false;
    setManualMode(true);
    setAutoTrack(false);
    setErr(null);
  };

  if (!auth || !roomId || !jwt) {
    return <div className="page hero-gradient">Session missing.</div>;
  }

const displayPoints = useMemo(() => {
    const pts = isPowerUser ? [...points] : [];
    
    // Add demo mock data for all roles in New Delhi for demonstration
    if (isPowerUser) {
      const baseLat = 28.6139; // New Delhi Base
      const baseLng = 77.2090;
      
      const mockData: PointDto[] = [
        {
          deviceId: "mock-admin-1",
          roleType: "ADMIN",
          latitude: baseLat + 0.005,
          longitude: baseLng + 0.005,
          isManual: false,
          updatedAt: new Date().toISOString()
        },
        {
          deviceId: "mock-organizer-1",
          roleType: "ORGANIZER",
          latitude: baseLat - 0.004,
          longitude: baseLng + 0.006,
          isManual: false,
          updatedAt: new Date().toISOString()
        },
        {
          deviceId: "mock-delegate-1",
          roleType: "DELEGATE",
          latitude: baseLat + 0.002,
          longitude: baseLng + 0.002,
          isManual: false,
          updatedAt: new Date().toISOString()
        },
        {
          deviceId: "mock-delegate-2",
          roleType: "DELEGATE",
          latitude: baseLat - 0.0015,
          longitude: baseLng + 0.003,
          isManual: false,
          updatedAt: new Date().toISOString()
        },
        {
          deviceId: "mock-volunteer-1",
          roleType: "VOLUNTEER",
          latitude: baseLat + 0.004,
          longitude: baseLng - 0.001,
          isManual: false,
          updatedAt: new Date().toISOString()
        },
        {
          deviceId: "mock-volunteer-2",
          roleType: "VOLUNTEER",
          latitude: baseLat - 0.003,
          longitude: baseLng - 0.002,
          isManual: false,
          updatedAt: new Date().toISOString()
        }
      ];
      
      mockData.forEach(mock => {
        if (!pts.some(p => p.deviceId === mock.deviceId)) {
          pts.push(mock);
        }
      });
    }
    
    return pts;
  }, [points, isPowerUser]);

  return (
    <div className="map-container-wrapper">
      <div className="map-floating-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="title" style={{ fontSize: "18px" }}>
              {isPowerUser ? "Fleet Radar" : "Live Location"}
            </h1>
            <p className="subtle" style={{ fontSize: "12px" }}>
              {isPowerUser ? `${points.length} members online` : "Sharing your position..."}
            </p>
          </div>
          <button
            className="btn btn-ghost"
            style={{ borderRadius: "12px", padding: "8px 12px" }}
            onClick={() => navigate("/home")}
          >
            Exit
          </button>
        </div>
      </div>

      {offlineQueued && (
        <div className="map-banner warning">
          <span>📴 Location saved on this device — will sync when you are back online.</span>
          <button type="button" className="btn btn-sm" onClick={() => void flushPendingIfAny()}>
            Sync now
          </button>
        </div>
      )}

      {gpsError && !manualMode && (
        <div className="map-banner warning">
          <span>Live tracking unavailable: {gpsError}</span>
          <button type="button" className="btn btn-sm" onClick={openManualFlow}>
            Set Location Manually
          </button>
        </div>
      )}

      {manualMode && (
        <div className="map-banner info">
          <span>Manual location mode — tap the map or enter coordinates below.</span>
          {!gpsError && (
            <button type="button" className="btn btn-sm" onClick={switchBackToLive}>
              Use live GPS
            </button>
          )}
        </div>
      )}

      <div className="map-fab-group">
        <button className="fab" onClick={centerOnMe} title="Center on me" type="button">
          🎯
        </button>
        <button
          className={`fab ${autoTrack ? "primary" : ""}`}
          type="button"
          onClick={() => {
            if (gpsError) {
              openManualFlow();
              return;
            }
            setAutoTrack((v) => !v);
            setManualMode(false);
          }}
          title={autoTrack ? "Stop auto-tracking" : "Start auto-tracking"}
        >
          {autoTrack ? "📡" : "🛰️"}
        </button>
        <button
          className={`fab ${manualMode ? "primary" : ""}`}
          type="button"
          onClick={() => {
            if (manualMode) {
              setManualMode(false);
              setTargetPos(null);
              setErr(null);
            } else {
              openManualFlow();
            }
          }}
          title="Manual location"
        >
          📍
        </button>
      </div>

      <Map
        defaultCenter={{ lat: 28.6139, lng: 77.2090 }}
        defaultZoom={13}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
        mapId="bf51a910020fa566"
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        <MapPanEffect panTo={panTo} />
        {targetPos && (
          <AdvancedMarker position={targetPos}>
            <div className="delivery-marker" style={{ 
              borderColor: "#ff9800",
              padding: '4px 12px',
              borderRadius: '20px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              background: '#fff',
              borderWidth: '3px',
              borderStyle: 'solid',
              transform: 'translateY(-10px)',
              zIndex: 1000
            }}>
              <div className="delivery-marker-inner" style={{ 
                background: "#ff9800",
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                flexShrink: 0
              }}>
              </div>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#333',
                textTransform: 'uppercase'
              }}>
                Target Location
              </span>
            </div>
          </AdvancedMarker>
        )}

        {userLocation && (
          <AdvancedMarker position={userLocation}>
            <div
              className="delivery-marker"
              style={{ 
                borderColor: userLocation.isManual ? "#ff9800" : "var(--accent)",
                padding: '4px 12px',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                background: '#fff',
                borderWidth: '3px',
                borderStyle: 'solid',
                transform: 'translateY(-10px)',
                zIndex: 999
              }}
            >
              <div
                className="delivery-marker-inner"
                style={{
                  background: userLocation.isManual ? "#ff9800" : "var(--accent)",
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              >
              </div>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: '#333',
                textTransform: 'uppercase'
              }}>
                {userLocation.isManual ? "Manual" : "YOU"}
              </span>
            </div>
          </AdvancedMarker>
        )}

        {displayPoints.map((p) => (
          <AdvancedMarker key={p.deviceId} position={{ lat: p.latitude, lng: p.longitude }}>
            <div className="delivery-marker" style={{ 
              borderColor: p.isManual ? "#ff9800" : roleColor(p.roleType),
              padding: '2px 8px',
              borderRadius: '20px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              background: '#fff',
              borderWidth: '2px',
              borderStyle: 'solid'
            }}>
              <div className="delivery-marker-inner" style={{ 
                background: p.isManual ? "#ff9800" : roleColor(p.roleType),
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                flexShrink: 0
              }}>
              </div>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 'bold', 
                color: '#333',
                textTransform: 'uppercase'
              }}>
                {p.isManual ? "Manual" : humanRole(p.roleType)}
              </span>
            </div>
          </AdvancedMarker>
        ))}
      </Map>

      <div className="map-bottom-sheet">
        {manualMode ? (
          <div className="col" style={{ gap: "12px" }}>
            <h3 className="title" style={{ fontSize: "16px" }}>
              Set location manually
            </h3>
            <p className="subtle" style={{ fontSize: "13px" }}>
              Tap the map, search for a place, or type latitude and longitude.
            </p>

            <PlaceSearchBox
              disabled={saving}
              onPick={(lat, lng) => {
                setTargetPos({ lat, lng });
                setManualCoords({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
                setPanTo({ lat, lng });
              }}
            />

            <div className="row" style={{ gap: "8px" }}>
              <div className="col" style={{ flex: 1 }}>
                <label style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px" }}>LATITUDE</label>
                <input
                  type="number"
                  className="input-field"
                  style={{ padding: "8px" }}
                  value={manualCoords.lat}
                  onChange={(e) => handleManualInput("lat", e.target.value)}
                  placeholder="e.g. 12.9716"
                />
              </div>
              <div className="col" style={{ flex: 1 }}>
                <label style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px" }}>LONGITUDE</label>
                <input
                  type="number"
                  className="input-field"
                  style={{ padding: "8px" }}
                  value={manualCoords.lng}
                  onChange={(e) => handleManualInput("lng", e.target.value)}
                  placeholder="e.g. 77.5946"
                />
              </div>
            </div>

            {err && <p style={{ color: "var(--danger)", fontSize: "12px" }}>{err}</p>}

            <div className="row" style={{ marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, minWidth: "140px" }}
                type="button"
                onClick={() => void saveManualLocation()}
                disabled={(!targetPos && (!manualCoords.lat || !manualCoords.lng)) || saving}
              >
                {saving ? "Updating…" : "Update location"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setManualMode(false);
                  setTargetPos(null);
                  setErr(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="col" style={{ gap: "16px" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 className="title" style={{ fontSize: "16px" }}>
                Tracking status
              </h3>
              <div className="row" style={{ gap: "8px" }}>
                {userLocation?.isManual && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "4px 8px",
                      borderRadius: "99px",
                      background: "rgba(255, 152, 0, 0.1)",
                      color: "#ff9800",
                      fontWeight: "700",
                    }}
                  >
                    MANUAL LOCATION
                  </span>
                )}
                <span
                  style={{
                    fontSize: "12px",
                    padding: "4px 10px",
                    borderRadius: "99px",
                    background: autoTrack ? "rgba(59, 165, 92, 0.1)" : "rgba(255,255,255,0.05)",
                    color: autoTrack ? "#3ba55c" : "inherit",
                    fontWeight: "700",
                  }}
                >
                  {autoTrack ? "● LIVE GPS" : "GPS OFF"}
                </span>
              </div>
            </div>
            <p className="subtle">
              {autoTrack
                ? "Organizers receive your real-time GPS updates."
                : userLocation?.isManual
                  ? "Using a manually set location. Enable live GPS to share real-time movement."
                  : "Your position is not updated automatically until you enable live GPS or set a manual location."}
            </p>

            {userLocation?.isManual && !autoTrack ? (
              <button className="btn btn-outline btn-full" type="button" onClick={openManualFlow}>
                Update location
              </button>
            ) : (
              <button className="btn btn-outline btn-full" type="button" onClick={openManualFlow}>
                Set location manually
              </button>
            )}

            <button className="btn btn-danger btn-full" style={{ height: "50px" }} type="button" onClick={() => navigate("/panic")}>
              🚨 TRIGGER EMERGENCY PANIC
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
