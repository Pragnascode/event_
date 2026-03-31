# React Native Real-Time Chat (Firebase)

This module provides a production-ready chat UI for event operations with:

- Firestore `onSnapshot` real-time updates
- Message types: `text`, `alert`, `panic`
- Role-based visibility (`visibility = "role"` + `targetRole`)
- Dark theme UI with optimized `FlatList`
- Quick actions: **Need Help** and **Crowd Alert**

## File Overview

- `src/firebase.ts` - Firebase initialization
- `src/types/chat.ts` - message schema types
- `src/types/room.ts` - room document schema types
- `src/hooks/useRoomMessages.ts` - Firestore listener + role filtering
- `src/hooks/useNotificationPrefs.ts` - sound/vibration preference toggles
- `src/components/MessageItem.tsx` - message item renderer by type
- `src/screens/RoomChatScreen.tsx` - complete chat screen
- `src/screens/SendAlertScreen.tsx` - Admin alert composer (everyone/role-based)
- `src/screens/AlertsListScreen.tsx` - alerts-only list page (real-time)
- `src/screens/RoomSettingsScreen.tsx` - room settings fetch + display

## Firestore Structure

Collection path:

`rooms/{roomId}/messages/{messageId}`

Message schema:

```json
{
  "messageId": "auto-doc-id",
  "senderId": "user_123",
  "role": "VOLUNTEER",
  "type": "text",
  "visibility": "all",
  "targetRole": null,
  "message": "Reached Gate B",
  "timestamp": "Firestore serverTimestamp"
}
```

## Usage Example

```tsx
import RoomChatScreen from "./src/screens/RoomChatScreen";
import RoomSettingsScreen from "./src/screens/RoomSettingsScreen";

export default function App() {
  return (
    <>
      <RoomChatScreen
        roomId="event_room_001"
        roomName="Main Event Ops"
        currentUserId="user_abc"
        currentUserRole="VOLUNTEER"
      />
      <RoomSettingsScreen route={{ params: { roomId: "event_room_001" } }} />
    </>
  );
}
```

## Setup Notes

1. Put your Firebase values in `src/firebase.ts`.
2. Install dependencies in your RN project:
   - `firebase`
   - `react-native`
3. Ensure Firestore security rules allow read/write for authenticated users with room access.

## Role-Based Alerts

`SendAlertScreen` writes alerts as:

```json
{
  "type": "alert",
  "visibility": "all | role",
  "targetRole": "head | volunteer | null",
  "message": "Alert text",
  "timestamp": "serverTimestamp"
}
```

- Admin can send to everyone or a specific role.
- `useRoomMessages` applies client-side role filtering.
- Alerts appear in:
  - Chat (`RoomChatScreen`)
  - Alerts page (`AlertsListScreen`)
- Alerts are visually highlighted as red cards.

### Room Settings Data Requirements

`RoomSettingsScreen` fetches `rooms/{roomId}` and displays:

- `eventName`
- `duration`
- `roleKeys.head`
- `roleKeys.volunteer`

If the document or fields are missing, it shows: **"Room data not available"** and safe fallbacks.

## Alert & Panic Notifications

- New alert: short vibration + soft sound
- New panic: long vibration pattern + loud alert sound + full-screen panic modal
- Duplicate notification prevention: last handled alert/panic IDs are tracked client-side.
- User toggles are available in `RoomSettingsScreen`:
  - Enable sound
  - Enable vibration

Recommended packages:

- `expo-haptics` (optional; current implementation uses `Vibration`)
- `expo-av` (used for sound playback)
- `@react-native-async-storage/async-storage` (for persisting notification toggles)
