import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "../types/chat";

type Props = {
  item: ChatMessage;
  currentUserId: string;
  isAdminMessage: boolean;
};

function MessageItemBase({ item, currentUserId, isAdminMessage }: Props) {
  const mine = item.senderId === currentUserId;
  const isAlert = item.type === "alert";
  const isPanic = item.type === "panic";

  if (isPanic) {
    return (
      <View style={styles.panicBanner}>
        <Text style={styles.panicTitle}>PANIC ALERT</Text>
        <Text style={styles.panicText}>{item.message}</Text>
      </View>
    );
  }

  if (isAlert) {
    return (
      <View style={styles.alertCard}>
        <Text style={styles.alertRole}>{item.role}</Text>
        <Text style={styles.alertText}>{item.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, isAdminMessage && styles.adminBubble]}>
        <Text style={styles.roleLabel}>{item.role}</Text>
        <Text style={styles.messageText}>{item.message}</Text>
      </View>
    </View>
  );
}

export const MessageItem = memo(MessageItemBase);

const styles = StyleSheet.create({
  row: {
    width: "100%",
    marginBottom: 10,
  },
  rowLeft: {
    alignItems: "flex-start",
  },
  rowRight: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: "#2C2C2C",
  },
  bubbleOther: {
    backgroundColor: "#1B1B1B",
    borderWidth: 1,
    borderColor: "#333",
  },
  adminBubble: {
    backgroundColor: "#F7D84B",
  },
  roleLabel: {
    color: "#9A9A9A",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  messageText: {
    color: "#FFF",
    fontSize: 15,
    lineHeight: 20,
  },
  alertCard: {
    width: "100%",
    backgroundColor: "#521616",
    borderColor: "#D13B3B",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  alertRole: {
    color: "#FFB0B0",
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    fontSize: 12,
  },
  alertText: {
    color: "#FFDADA",
    fontSize: 15,
  },
  panicBanner: {
    width: "100%",
    backgroundColor: "#D10000",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  panicTitle: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  panicText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
