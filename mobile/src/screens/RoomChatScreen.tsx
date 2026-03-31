import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "../firebase";
import { useNotificationPrefs } from "../hooks/useNotificationPrefs";
import { MessageItem } from "../components/MessageItem";
import { useRoomMessages } from "../hooks/useRoomMessages";
import type { MessageType, VisibilityType } from "../types/chat";

type Props = {
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserRole: string;
};

export default function RoomChatScreen({
  roomId,
  roomName,
  currentUserId,
  currentUserRole,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingPanic, setSendingPanic] = useState(false);
  const [panicConfirmOpen, setPanicConfirmOpen] = useState(false);
  const [activePanicId, setActivePanicId] = useState<string | null>(null);
  const [panicCooldownUntil, setPanicCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());
  const listRef = useRef<FlatList>(null);
  const panicScale = useRef(new Animated.Value(1)).current;
  const handledPanicIdRef = useRef<string | null>(null);
  const handledAlertIdRef = useRef<string | null>(null);
  const notificationsReadyRef = useRef(false);

  const { messages, loading, error } = useRoomMessages(roomId, currentUserRole, currentUserId);
  const { soundEnabled, vibrationEnabled } = useNotificationPrefs();

  const playNotificationSound = useCallback(async (kind: "alert" | "panic") => {
    if (!soundEnabled) return;
    try {
      const expoAv = await import("expo-av");
      const source =
        kind === "panic"
          ? { uri: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" }
          : { uri: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg" };
      const { sound } = await expoAv.Audio.Sound.createAsync(
        source,
        { shouldPlay: true, volume: kind === "panic" ? 1.0 : 0.45 },
      );
      setTimeout(() => {
        void sound.unloadAsync();
      }, 4000);
    } catch {
      // Keep flow reliable even if audio library/asset is missing.
      console.log("[Panic] alert sound unavailable in this build.");
    }
  }, [soundEnabled]);

  const sendMessage = useCallback(
    async (
      message: string,
      type: MessageType = "text",
      visibility: VisibilityType = "all",
      targetRole: string | null = null,
    ) => {
      const clean = message.trim();
      if (!clean || sending) return;

      setSending(true);
      try {
        await addDoc(collection(db, "rooms", roomId, "messages"), {
          senderId: currentUserId,
          role: currentUserRole,
          type,
          priority: type === "panic" ? "critical" : "normal",
          visibility,
          targetRole,
          message: clean,
          timestamp: serverTimestamp(),
        });
        setDraft("");
      } finally {
        setSending(false);
      }
    },
    [currentUserId, currentUserRole, roomId, sending],
  );

  const onNeedHelp = useCallback(() => {
    void sendMessage("Need help at my current position.", "alert");
  }, [sendMessage]);

  const onCrowdAlert = useCallback(() => {
    void sendMessage("Crowd alert: area is becoming congested.", "alert");
  }, [sendMessage]);

  const panicCooldownMs = 10_000;
  const panicOnCooldown = cooldownNow < panicCooldownUntil;
  const panicRemaining = Math.max(0, Math.ceil((panicCooldownUntil - cooldownNow) / 1000));

  useEffect(() => {
    if (notificationsReadyRef.current) return;
    if (messages.length === 0) return;
    const latestPanic = [...messages].reverse().find((m) => m.type === "panic");
    const latestAlert = [...messages].reverse().find((m) => m.type === "alert");
    handledPanicIdRef.current = latestPanic?.messageId ?? null;
    handledAlertIdRef.current = latestAlert?.messageId ?? null;
    notificationsReadyRef.current = true;
  }, [messages]);

  useEffect(() => {
    if (!panicOnCooldown) return;
    const t = setInterval(() => setCooldownNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [panicOnCooldown]);

  const triggerPanic = useCallback(async () => {
    if (sendingPanic || panicOnCooldown) return;
    setSendingPanic(true);
    try {
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        senderId: currentUserId,
        role: currentUserRole,
        type: "panic",
        priority: "critical",
        visibility: "all",
        targetRole: null,
        message: "Emergency panic triggered. Immediate assistance required.",
        timestamp: serverTimestamp(),
      });
      const next = Date.now() + panicCooldownMs;
      setPanicCooldownUntil(next);
      setCooldownNow(Date.now());
    } finally {
      setSendingPanic(false);
      setPanicConfirmOpen(false);
    }
  }, [currentUserId, currentUserRole, panicOnCooldown, roomId, sendingPanic]);

  useEffect(() => {
    if (!notificationsReadyRef.current) return;
    const latestPanic = [...messages].reverse().find((m) => m.type === "panic");
    if (!latestPanic) return;
    if (handledPanicIdRef.current === latestPanic.messageId) return;
    if (latestPanic.senderId === currentUserId) return;
    handledPanicIdRef.current = latestPanic.messageId;
    setActivePanicId(latestPanic.messageId);
    if (vibrationEnabled) {
      Vibration.vibrate([0, 900, 250, 900, 250, 900]);
    }
    void playNotificationSound("panic");
  }, [messages, playNotificationSound, vibrationEnabled, currentUserId]);

  useEffect(() => {
    if (!notificationsReadyRef.current) return;
    const latestAlert = [...messages].reverse().find((m) => m.type === "alert");
    if (!latestAlert) return;
    if (handledAlertIdRef.current === latestAlert.messageId) return;
    if (latestAlert.senderId === currentUserId) return;
    handledAlertIdRef.current = latestAlert.messageId;
    if (vibrationEnabled) Vibration.vibrate(180);
    void playNotificationSound("alert");
  }, [messages, playNotificationSound, vibrationEnabled, currentUserId]);

  const data = useMemo(() => messages, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof data)[number] }) => (
      <MessageItem
        item={item}
        currentUserId={currentUserId}
        isAdminMessage={item.role.toUpperCase() === "ADMIN"}
      />
    ),
    [currentUserId],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>{roomName}</Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable style={styles.quickBtn} onPress={onNeedHelp}>
            <Text style={styles.quickBtnText}>Need Help</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={onCrowdAlert}>
            <Text style={styles.quickBtnText}>Crowd Alert</Text>
          </Pressable>
          <Animated.View style={{ transform: [{ scale: panicScale }] }}>
            <Pressable
              onPressIn={() => {
                Animated.spring(panicScale, { toValue: 0.92, useNativeDriver: true }).start();
              }}
              onPressOut={() => {
                Animated.spring(panicScale, { toValue: 1, useNativeDriver: true }).start();
              }}
              onPress={() => setPanicConfirmOpen(true)}
              disabled={sendingPanic || panicOnCooldown}
              style={[
                styles.panicCircle,
                (sendingPanic || panicOnCooldown) && styles.panicCircleDisabled,
              ]}
            >
              <Text style={styles.panicCircleText}>
                {sendingPanic ? "..." : panicOnCooldown ? `${panicRemaining}s` : "PANIC"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
        <Text style={styles.quickHelp}>
          Official alerts can be sent from Admin alert form as everyone or role-based (head/volunteer).
        </Text>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator color="#F7D84B" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.messageId}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
            removeClippedSubviews
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline
          />
          <Pressable
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            disabled={sending}
            onPress={() => void sendMessage(draft)}
          >
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>

        <Modal visible={panicConfirmOpen} transparent animationType="fade" onRequestClose={() => setPanicConfirmOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Trigger Emergency Panic?</Text>
              <Text style={styles.modalText}>This broadcasts a critical alert to everyone in the room.</Text>
              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={() => setPanicConfirmOpen(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalConfirm} disabled={sendingPanic} onPress={() => void triggerPanic()}>
                  <Text style={styles.modalConfirmText}>{sendingPanic ? "Sending..." : "Confirm Panic"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!activePanicId} transparent animationType="fade">
          <View style={styles.panicOverlay}>
            <Text style={styles.panicOverlayTitle}>EMERGENCY PANIC</Text>
            <Text style={styles.panicOverlayText}>Critical alert received in this room.</Text>
            <Pressable
              style={styles.panicOverlayBtn}
              onPress={() => {
                Vibration.cancel();
                setActivePanicId(null);
              }}
            >
              <Text style={styles.panicOverlayBtnText}>Acknowledge</Text>
            </Pressable>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#242424",
  },
  topTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  quickBtn: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 13,
  },
  quickHelp: {
    color: "#9f9f9f",
    fontSize: 11,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  panicCircle: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D10000",
    borderWidth: 3,
    borderColor: "#FF4B4B",
  },
  panicCircleDisabled: {
    opacity: 0.55,
  },
  panicCircleText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: "#FF7878",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#242424",
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#1D1D1D",
    color: "#FFF",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  sendBtn: {
    borderRadius: 12,
    backgroundColor: "#F7D84B",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    color: "#000",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#1D1D1D",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  modalText: {
    color: "#D2D2D2",
    fontSize: 14,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    backgroundColor: "#303030",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: "#FFF",
    fontWeight: "700",
  },
  modalConfirm: {
    backgroundColor: "#D10000",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalConfirmText: {
    color: "#FFF",
    fontWeight: "800",
  },
  panicOverlay: {
    flex: 1,
    backgroundColor: "rgba(209,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  panicOverlayTitle: {
    color: "#FFF",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: "center",
  },
  panicOverlayText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 22,
  },
  panicOverlayBtn: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  panicOverlayBtnText: {
    color: "#D10000",
    fontWeight: "900",
    fontSize: 15,
  },
});
