import React, { useMemo } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useRoomMessages } from "../hooks/useRoomMessages";

type Props = {
  roomId: string;
  currentUserId: string;
  currentUserRole: string;
};

export default function AlertsListScreen({ roomId, currentUserId, currentUserRole }: Props) {
  const { messages, loading, error } = useRoomMessages(roomId, currentUserRole, currentUserId);

  const alerts = useMemo(
    () => messages.filter((m) => m.type === "alert").sort((a, b) => b.timestamp - a.timestamp),
    [messages],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Alerts</Text>

        {loading && <Text style={styles.meta}>Loading alerts...</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {!loading && alerts.length === 0 ? (
          <Text style={styles.meta}>No alerts available.</Text>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.messageId}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.alertCard}>
                <View style={styles.row}>
                  <Text style={styles.role}>{item.role}</Text>
                  <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                </View>
                <Text style={styles.message}>{item.message}</Text>
                {item.visibility === "role" && item.targetRole ? (
                  <Text style={styles.target}>Target: {item.targetRole}</Text>
                ) : (
                  <Text style={styles.target}>Target: everyone</Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#121212" },
  container: { flex: 1, padding: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  meta: { color: "#bdbdbd" },
  error: { color: "#ff8d8d", marginBottom: 10 },
  listContent: { gap: 10, paddingBottom: 20 },
  alertCard: {
    backgroundColor: "#521616",
    borderColor: "#D13B3B",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  role: { color: "#FFD0D0", fontWeight: "800", textTransform: "uppercase", fontSize: 12 },
  time: { color: "#FFCACA", fontSize: 11 },
  message: { color: "#fff", fontSize: 15, marginBottom: 8 },
  target: { color: "#FFD0D0", fontSize: 12, fontWeight: "600" },
});
