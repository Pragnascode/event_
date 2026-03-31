import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase";

type VisibilityMode = "all" | "role";
type RoleTarget = "head" | "volunteer";

type Props = {
  roomId: string;
  currentUserId: string;
  currentUserRole: string;
};

export default function SendAlertScreen({ roomId, currentUserId, currentUserRole }: Props) {
  const [visibility, setVisibility] = useState<VisibilityMode>("all");
  const [targetRole, setTargetRole] = useState<RoleTarget>("head");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = currentUserRole.toUpperCase() === "ADMIN";

  const submitAlert = useCallback(async () => {
    const clean = message.trim();
    if (!canSend) {
      Alert.alert("Access denied", "Only admin can send official alerts.");
      return;
    }
    if (!clean) {
      Alert.alert("Message required", "Please enter an alert message.");
      return;
    }
    if (!roomId) {
      Alert.alert("Missing room", "Room ID is required.");
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        senderId: currentUserId,
        role: currentUserRole,
        type: "alert",
        priority: "normal",
        visibility,
        targetRole: visibility === "role" ? targetRole : null,
        message: clean,
        timestamp: serverTimestamp(),
      });
      setMessage("");
      Alert.alert("Sent", "Alert has been broadcast.");
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Unable to send alert.");
    } finally {
      setSending(false);
    }
  }, [canSend, currentUserId, currentUserRole, message, roomId, targetRole, visibility]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Send Official Alert</Text>

        <Text style={styles.label}>Alert Type</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, visibility === "all" && styles.segmentBtnActive]}
            onPress={() => setVisibility("all")}
          >
            <Text style={[styles.segmentText, visibility === "all" && styles.segmentTextActive]}>
              Everyone
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, visibility === "role" && styles.segmentBtnActive]}
            onPress={() => setVisibility("role")}
          >
            <Text style={[styles.segmentText, visibility === "role" && styles.segmentTextActive]}>
              Role-based
            </Text>
          </Pressable>
        </View>

        {visibility === "role" && (
          <>
            <Text style={styles.label}>Target Role</Text>
            <View style={styles.segmentRow}>
              <Pressable
                style={[styles.segmentBtn, targetRole === "head" && styles.segmentBtnActive]}
                onPress={() => setTargetRole("head")}
              >
                <Text style={[styles.segmentText, targetRole === "head" && styles.segmentTextActive]}>
                  Head
                </Text>
              </Pressable>
              <Pressable
                style={[styles.segmentBtn, targetRole === "volunteer" && styles.segmentBtnActive]}
                onPress={() => setTargetRole("volunteer")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    targetRole === "volunteer" && styles.segmentTextActive,
                  ]}
                >
                  Volunteer
                </Text>
              </Pressable>
            </View>
          </>
        )}

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type official alert..."
          placeholderTextColor="#888"
          multiline
        />

        <Pressable
          style={[styles.sendBtn, (!canSend || sending) && styles.sendBtnDisabled]}
          onPress={() => void submitAlert()}
          disabled={!canSend || sending}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send Alert</Text>}
        </Pressable>

        {!canSend && <Text style={styles.warn}>Only Admin can send official alerts.</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#121212" },
  container: { flex: 1, padding: 16 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 14 },
  label: { color: "#c9c9c9", fontSize: 13, marginBottom: 8, marginTop: 6 },
  segmentRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  segmentBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#383838",
    backgroundColor: "#1f1f1f",
    alignItems: "center",
    paddingVertical: 10,
  },
  segmentBtnActive: { backgroundColor: "#F7D84B", borderColor: "#F7D84B" },
  segmentText: { color: "#fff", fontWeight: "700" },
  segmentTextActive: { color: "#000" },
  input: {
    minHeight: 120,
    maxHeight: 180,
    borderRadius: 12,
    backgroundColor: "#1d1d1d",
    color: "#fff",
    padding: 12,
    textAlignVertical: "top",
  },
  sendBtn: {
    marginTop: 14,
    backgroundColor: "#D10000",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  warn: { color: "#ff9a9a", marginTop: 10, fontSize: 12 },
});
