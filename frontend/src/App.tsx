import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import LandingPage from "./pages/LandingPage";
import EventDashboardPage from "./pages/EventDashboardPage";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import SendAlertsPage from "./pages/SendAlertsPage";
import AllAlertsPage from "./pages/AllAlertsPage";
import PanicPage from "./pages/PanicPage";
import MapPage from "./pages/MapPage";
import SettingsPage from "./pages/SettingsPage";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function RequireAuth({ children }: { children: ReactNode }) {
  const jwt = localStorage.getItem("auth.jwt");
  if (!jwt) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/home"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/chat"
            element={
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            }
          />
          <Route
            path="/event"
            element={
              <RequireAuth>
                <EventDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/send-alerts"
            element={
              <RequireAuth>
                <SendAlertsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/all-alerts"
            element={
              <RequireAuth>
                <AllAlertsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/panic"
            element={
              <RequireAuth>
                <PanicPage />
              </RequireAuth>
            }
          />
          <Route
            path="/map"
            element={
              <RequireAuth>
                <MapPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </APIProvider>
  );
}
