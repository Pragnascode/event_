import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

import { db } from "../firebase";
import type { ChatMessage, MessagePriority, MessageType, VisibilityType } from "../types/chat";

type FirestoreMessage = {
  senderId: string;
  role: string;
  type: MessageType;
  priority?: MessagePriority;
  visibility: VisibilityType;
  targetRole: string | null;
  message: string;
  timestamp?: Timestamp;
};

function canUserSeeMessage(message: FirestoreMessage, userRole: string, userId: string) {
  if (message.type === "panic") return true;
  if (message.senderId === userId) return true;
  if (message.visibility !== "role") return true;
  return !!message.targetRole && message.targetRole === userRole;
}

export function useRoomMessages(roomId: string, userRole: string, userId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    setError(null);

    const messagesRef = collection(db, "rooms", roomId, "messages");
    const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"), limit(300));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const visibleMessages: ChatMessage[] = snapshot.docs
          .map((doc) => {
            const data = doc.data() as FirestoreMessage;
            return {
              messageId: doc.id,
              senderId: data.senderId,
              role: data.role,
              type: data.type,
              priority: data.priority ?? "normal",
              visibility: data.visibility,
              targetRole: data.targetRole ?? null,
              message: data.message,
              timestamp: data.timestamp?.toMillis() ?? Date.now(),
            };
          })
          .filter((m) =>
            canUserSeeMessage(
              {
                senderId: m.senderId,
                role: m.role,
                type: m.type,
                priority: m.priority,
                visibility: m.visibility,
                targetRole: m.targetRole,
                message: m.message,
                timestamp: Timestamp.fromMillis(m.timestamp),
              },
              userRole,
              userId,
            ),
          );

        setMessages(visibleMessages);
        setLoading(false);
      },
      (e) => {
        setError(e.message || "Failed to fetch room messages.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [roomId, userRole, userId]);

  return { messages, loading, error };
}
