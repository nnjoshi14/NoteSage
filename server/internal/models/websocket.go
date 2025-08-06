package models

import (
	"time"

	"github.com/google/uuid"
)

// WebSocket message types
const (
	MessageTypeJoinRoom      = "join_room"
	MessageTypeLeaveRoom     = "leave_room"
	MessageTypeNoteUpdate    = "note_update"
	MessageTypeCursorUpdate  = "cursor_update"
	MessageTypePresence      = "presence"
	MessageTypeConflict      = "conflict"
	MessageTypeError         = "error"
	MessageTypeAck           = "ack"
)

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type      string      `json:"type"`
	RoomID    string      `json:"room_id,omitempty"`
	UserID    uuid.UUID   `json:"user_id"`
	Username  string      `json:"username"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	MessageID string      `json:"message_id,omitempty"`
}

// JoinRoomData represents data for joining a room
type JoinRoomData struct {
	NoteID uuid.UUID `json:"note_id"`
}

// NoteUpdateData represents data for note updates
type NoteUpdateData struct {
	NoteID    uuid.UUID `json:"note_id"`
	Content   JSONB     `json:"content"`
	Version   int       `json:"version"`
	Operation string    `json:"operation"` // "insert", "delete", "format", "replace"
	Position  int       `json:"position,omitempty"`
	Length    int       `json:"length,omitempty"`
	Text      string    `json:"text,omitempty"`
}

// CursorUpdateData represents cursor position updates
type CursorUpdateData struct {
	NoteID    uuid.UUID `json:"note_id"`
	Position  int       `json:"position"`
	Selection *struct {
		Start int `json:"start"`
		End   int `json:"end"`
	} `json:"selection,omitempty"`
}

// PresenceData represents user presence information
type PresenceData struct {
	NoteID     uuid.UUID `json:"note_id"`
	Status     string    `json:"status"` // "active", "idle", "away"
	LastActive time.Time `json:"last_active"`
}

// ConflictData represents conflict resolution data
type ConflictData struct {
	NoteID        uuid.UUID `json:"note_id"`
	ConflictID    string    `json:"conflict_id"`
	LocalVersion  int       `json:"local_version"`
	RemoteVersion int       `json:"remote_version"`
	LocalContent  JSONB     `json:"local_content"`
	RemoteContent JSONB     `json:"remote_content"`
}

// ErrorData represents error information
type ErrorData struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// Room represents a collaboration room for a note
type Room struct {
	ID        string                 `json:"id"`
	NoteID    uuid.UUID             `json:"note_id"`
	Clients   map[uuid.UUID]*Client `json:"clients"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
}

// Client represents a connected WebSocket client
type Client struct {
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	RoomID   string    `json:"room_id"`
	Status   string    `json:"status"` // "active", "idle", "away"
	JoinedAt time.Time `json:"joined_at"`
	LastSeen time.Time `json:"last_seen"`
}

// ActiveUser represents an active user in a room
type ActiveUser struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
	Status   string    `json:"status"`
	JoinedAt time.Time `json:"joined_at"`
	LastSeen time.Time `json:"last_seen"`
	Cursor   *struct {
		Position  int `json:"position"`
		Selection *struct {
			Start int `json:"start"`
			End   int `json:"end"`
		} `json:"selection,omitempty"`
	} `json:"cursor,omitempty"`
}