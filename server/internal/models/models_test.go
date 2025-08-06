package models

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUser_Validate(t *testing.T) {
	tests := []struct {
		name    string
		user    User
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid user",
			user: User{
				Username: "testuser",
				Email:    "test@example.com",
				Password: "password123",
			},
			wantErr: false,
		},
		{
			name: "missing username",
			user: User{
				Email:    "test@example.com",
				Password: "password123",
			},
			wantErr: true,
			errMsg:  "username is required",
		},
		{
			name: "missing email",
			user: User{
				Username: "testuser",
				Password: "password123",
			},
			wantErr: true,
			errMsg:  "email is required",
		},
		{
			name: "missing password",
			user: User{
				Username: "testuser",
				Email:    "test@example.com",
			},
			wantErr: true,
			errMsg:  "password is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.user.Validate()
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestUser_BeforeCreate(t *testing.T) {
	user := &User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "password123",
	}

	err := user.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, user.ID)
}

func TestNote_Validate(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name    string
		note    Note
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid note",
			note: Note{
				UserID: userID,
				Title:  "Test Note",
			},
			wantErr: false,
		},
		{
			name: "missing user_id",
			note: Note{
				Title: "Test Note",
			},
			wantErr: true,
			errMsg:  "user_id is required",
		},
		{
			name: "missing title",
			note: Note{
				UserID: userID,
			},
			wantErr: true,
			errMsg:  "title is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.note.Validate()
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNote_BeforeCreate(t *testing.T) {
	note := &Note{
		UserID: uuid.New(),
		Title:  "Test Note",
	}

	err := note.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, note.ID)
	assert.NotNil(t, note.Content)
	
	// Check default content structure
	content, ok := note.Content["type"]
	assert.True(t, ok)
	assert.Equal(t, "doc", content)
	
	contentArray, ok := note.Content["content"]
	assert.True(t, ok)
	assert.IsType(t, []interface{}{}, contentArray)
}

func TestPerson_Validate(t *testing.T) {
	userID := uuid.New()

	tests := []struct {
		name    string
		person  Person
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid person",
			person: Person{
				UserID: userID,
				Name:   "John Doe",
			},
			wantErr: false,
		},
		{
			name: "missing user_id",
			person: Person{
				Name: "John Doe",
			},
			wantErr: true,
			errMsg:  "user_id is required",
		},
		{
			name: "missing name",
			person: Person{
				UserID: userID,
			},
			wantErr: true,
			errMsg:  "name is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.person.Validate()
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestTodo_Validate(t *testing.T) {
	noteID := uuid.New()

	tests := []struct {
		name    string
		todo    Todo
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid todo",
			todo: Todo{
				NoteID: noteID,
				TodoID: "t1",
				Text:   "Complete task",
			},
			wantErr: false,
		},
		{
			name: "missing note_id",
			todo: Todo{
				TodoID: "t1",
				Text:   "Complete task",
			},
			wantErr: true,
			errMsg:  "note_id is required",
		},
		{
			name: "missing todo_id",
			todo: Todo{
				NoteID: noteID,
				Text:   "Complete task",
			},
			wantErr: true,
			errMsg:  "todo_id is required",
		},
		{
			name: "missing text",
			todo: Todo{
				NoteID: noteID,
				TodoID: "t1",
			},
			wantErr: true,
			errMsg:  "text is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.todo.Validate()
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestJSONB_Value(t *testing.T) {
	tests := []struct {
		name    string
		jsonb   JSONB
		want    string
		wantErr bool
	}{
		{
			name: "valid jsonb",
			jsonb: JSONB{
				"type": "doc",
				"content": []interface{}{
					map[string]interface{}{
						"type": "paragraph",
						"content": []interface{}{
							map[string]interface{}{"type": "text", "text": "Hello"},
						},
					},
				},
			},
			want:    `{"content":[{"content":[{"text":"Hello","type":"text"}],"type":"paragraph"}],"type":"doc"}`,
			wantErr: false,
		},
		{
			name:    "nil jsonb",
			jsonb:   nil,
			want:    "",
			wantErr: false,
		},
		{
			name:    "empty jsonb",
			jsonb:   JSONB{},
			want:    "{}",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.jsonb.Value()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.jsonb == nil {
					assert.Nil(t, got)
				} else {
					assert.JSONEq(t, tt.want, string(got.([]byte)))
				}
			}
		})
	}
}

func TestJSONB_Scan(t *testing.T) {
	tests := []struct {
		name    string
		value   interface{}
		want    JSONB
		wantErr bool
	}{
		{
			name:  "valid json bytes",
			value: []byte(`{"type":"doc","content":[]}`),
			want: JSONB{
				"type":    "doc",
				"content": []interface{}{},
			},
			wantErr: false,
		},
		{
			name:    "nil value",
			value:   nil,
			want:    nil,
			wantErr: false,
		},
		{
			name:    "invalid type",
			value:   "not bytes",
			want:    nil,
			wantErr: true,
		},
		{
			name:    "invalid json",
			value:   []byte(`{invalid json}`),
			want:    nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var jsonb JSONB
			err := jsonb.Scan(tt.value)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				if tt.want == nil {
					assert.Nil(t, jsonb)
				} else {
					assert.Equal(t, tt.want, jsonb)
				}
			}
		})
	}
}

func TestTableNames(t *testing.T) {
	tests := []struct {
		model    interface{}
		expected string
	}{
		{User{}, "users"},
		{Note{}, "notes"},
		{Person{}, "people"},
		{Todo{}, "todos"},
		{Connection{}, "connections"},
		{Migration{}, "migrations"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			switch model := tt.model.(type) {
			case User:
				assert.Equal(t, tt.expected, model.TableName())
			case Note:
				assert.Equal(t, tt.expected, model.TableName())
			case Person:
				assert.Equal(t, tt.expected, model.TableName())
			case Todo:
				assert.Equal(t, tt.expected, model.TableName())
			case Connection:
				assert.Equal(t, tt.expected, model.TableName())
			case Migration:
				assert.Equal(t, tt.expected, model.TableName())
			}
		})
	}
}

func TestMigration_BeforeCreate(t *testing.T) {
	migration := &Migration{
		Version: "001",
		Name:    "Test migration",
	}

	err := migration.BeforeCreate(nil)
	assert.NoError(t, err)
	assert.False(t, migration.AppliedAt.IsZero())
	assert.WithinDuration(t, time.Now(), migration.AppliedAt, time.Second)
}