import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";

import { db } from "../firebase";
import { useNotificationPrefs } from "../hooks/useNotificationPrefs";
import type { RoomDoc } from "../types/room";

type RouteLike = {
  params?: {
    roomId?: string;
  };
};

type Props = {
  route?: RouteLike;
};

function toDisplay(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

export default function RoomSettingsScreen({ route }: Props) {
  const roomId = route?.params?.roomId?.trim() ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomDoc | null>(null);
  const {
    soundEnabled,
    vibrationEnabled,
    setSoundEnabled,
    setVibrationEnabled,
    loadingPrefs,
  } = useNotificationPrefs();

  const fetchRoomData = useCallback(async () => {
    if (!roomId) {
      setError("Room ID missing from navigation params.");
      setRoomData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const roomRef = doc(db, "rooms", roomId); // rooms/{roomId}
      const snap = await getDoc(roomRef);

      if (!snap.exists()) {
        setRoomData(null);
        setError("Room data not available");
        console.log("[RoomSettings] No document at rooms/" + roomId);
        return;
      }

      const data = snap.data() as RoomDoc;
      setRoomData(data);
      console.log("[RoomSettings] fetched rooms/" + roomId, data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch room settings.";
      setError(msg);
      setRoomData(null);
      console.log("[RoomSettings] fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void fetchRoomData();
  }, [fetchRoomData]);

  const viewModel = useMemo(() => {
    const eventName = toDisplay(roomData?.eventName);
    const duration = toDisplay(roomData?.duration);
    const head = toDisplay(roomData?.roleKeys?.head);
    const volunteer = toDisplay(roomData?.roleKeys?.volunteer);
    return { eventName, duration, head, volunteer };
  }, [roomData]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Room Settings</Text>
          <Pressable style={styles.refreshBtn} onPress={() => void fetchRoomData()}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <Text style={styles.roomIdLabel}>roomId: {roomId || "missing"}</Text>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#F7D84B" />
            <Text style={styles.loadingText}>Loading room details...</Text>
          </View>
        )}

        {!loading && (error || !roomData) && (
          <View style={styles.fallbackCard}>
            <Text style={styles.fallbackTitle}>Room data not available</Text>
            <Text style={styles.fallbackSubtle}>
              {error ??
                "Check Firestore rules allow reads for this user, and verify collection name is `rooms`."}
            </Text>
          </View>
        )}

        {!loading && roomData && (
          <View style={styles.card}>
            <Field label="Event Name" value={viewModel.eventName} />
            <Field label="Duration" value={viewModel.duration} />
            <Field label="Role Key (Head)" value={viewModel.head} />
            <Field label="Role Key (Volunteer)" value={viewModel.volunteer} />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {loadingPrefs ? (
            <Text style={styles.loadingText}>Loading preferences...</Text>
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Enable sound</Text>
                <Switch value={soundEnabled} onValueChange={(v) => void setSoundEnabled(v)} />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Enable vibration</Text>
                <Switch value={vibrationEnabled} onValueChange={(v) => void setVibrationEnabled(v)} />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
  refreshBtn: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshText: {
    color: "#FFF",
    fontWeight: "700",
  },
  roomIdLabel: {
    color: "#8B8B8B",
    fontSize: 12,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    color: "#D0D0D0",
  },
  fallbackCard: {
    backgroundColor: "#1D1D1D",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#333",
  },
  fallbackTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  fallbackSubtle: {
    color: "#B9B9B9",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#1B1B1B",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#2D2D2D",
  },
  field: {
    backgroundColor: "#232323",
    borderRadius: 10,
    padding: 10,
  },
  fieldLabel: {
    color: "#ABABAB",
    fontSize: 12,
    marginBottom: 4,
  },
  fieldValue: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  toggleLabel: {
    color: "#E5E5E5",
    fontSize: 14,
  },
});
