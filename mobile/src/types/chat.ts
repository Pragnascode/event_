export type MessageType = "text" | "alert" | "panic";
export type VisibilityType = "all" | "role";
export type MessagePriority = "normal" | "critical";

export type ChatMessage = {
  messageId: string;
  senderId: string;
  role: string;
  type: MessageType;
  priority: MessagePriority;
  visibility: VisibilityType;
  targetRole: string | null;
  message: string;
  timestamp: number;
};

export type NewChatMessage = Omit<ChatMessage, "messageId" | "timestamp">;
