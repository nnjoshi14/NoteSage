package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

// JSONB type for PostgreSQL JSONB support
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface for JSONB
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSONB
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, j)
}

// UserRole represents user roles in the system
type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

// User represents a user in the system
type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	Username  string    `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Email     string    `gorm:"uniqueIndex;not null;size:255" json:"email"`
	Password  string    `gorm:"not null;size:255" json:"-"`
	Role      UserRole  `gorm:"type:varchar(20);default:'user';not null" json:"role"`
	IsActive  bool      `gorm:"default:true;not null" json:"is_active"`
	LastLogin *time.Time `json:"last_login"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	
	// Relationships
	Notes       []Note       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"notes,omitempty"`
	People      []Person     `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"people,omitempty"`
	Connections []Connection `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"connections,omitempty"`
}

// Note represents a note with rich content
type Note struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	UserID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Title         string         `gorm:"not null;size:500" json:"title"`
	Content       JSONB          `gorm:"type:text" json:"content"`
	Category      string         `gorm:"default:'Note';size:100;index" json:"category"`
	Tags          pq.StringArray `gorm:"type:text[]" json:"tags"`
	FolderPath    string         `gorm:"default:'/';size:1000;index" json:"folder_path"`
	ScheduledDate *time.Time     `gorm:"index" json:"scheduled_date"`
	IsArchived    bool           `gorm:"default:false;index" json:"is_archived"`
	IsPinned      bool           `gorm:"default:false;index" json:"is_pinned"`
	IsFavorite    bool           `gorm:"default:false;index" json:"is_favorite"`
	CreatedAt     time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt     time.Time      `gorm:"index" json:"updated_at"`
	Version       int            `gorm:"default:1" json:"version"`
	
	// Relationships
	User  User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Todos []Todo `gorm:"foreignKey:NoteID;constraint:OnDelete:CASCADE" json:"todos,omitempty"`
}

// Person represents a person in the knowledge base
type Person struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string    `gorm:"not null;size:255;index" json:"name"`
	Email       string    `gorm:"size:255;index" json:"email"`
	Phone       string    `gorm:"size:50" json:"phone"`
	Company     string    `gorm:"size:255;index" json:"company"`
	Title       string    `gorm:"size:255" json:"title"`
	LinkedinURL string    `gorm:"size:500" json:"linkedin_url"`
	AvatarURL   string    `gorm:"size:500" json:"avatar_url"`
	Notes       string    `gorm:"type:text" json:"notes"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	
	// Relationships
	User          User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	AssignedTodos []Todo `gorm:"foreignKey:AssignedPersonID" json:"assigned_todos,omitempty"`
}

// Todo represents a todo item with unique ID per note
type Todo struct {
	ID               uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	NoteID           uuid.UUID  `gorm:"type:uuid;not null;index" json:"note_id"`
	TodoID           string     `gorm:"not null;size:50" json:"todo_id"`
	Text             string     `gorm:"not null;type:text" json:"text"`
	IsCompleted      bool       `gorm:"default:false;index" json:"is_completed"`
	AssignedPersonID *uuid.UUID `gorm:"type:uuid;index" json:"assigned_person_id"`
	DueDate          *time.Time `gorm:"index" json:"due_date"`
	CreatedAt        time.Time  `gorm:"index" json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	
	// Relationships
	Note           Note    `gorm:"foreignKey:NoteID;constraint:OnDelete:CASCADE" json:"note,omitempty"`
	AssignedPerson *Person `gorm:"foreignKey:AssignedPersonID" json:"assigned_person,omitempty"`
}

// Connection represents relationships between notes and people
type Connection struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	SourceID   uuid.UUID `gorm:"type:uuid;not null;index" json:"source_id"`
	SourceType string    `gorm:"not null;size:20;index" json:"source_type"` // "note", "person"
	TargetID   uuid.UUID `gorm:"type:uuid;not null;index" json:"target_id"`
	TargetType string    `gorm:"not null;size:20;index" json:"target_type"` // "note", "person"
	Strength   int       `gorm:"default:1" json:"strength"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	
	// Relationships
	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

// Migration represents database migration version
type Migration struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Version   string    `gorm:"uniqueIndex;not null;size:50" json:"version"`
	Name      string    `gorm:"not null;size:255" json:"name"`
	AppliedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"applied_at"`
}

// TableName methods for explicit table naming
func (User) TableName() string {
	return "users"
}

func (Note) TableName() string {
	return "notes"
}

func (Person) TableName() string {
	return "people"
}

func (Todo) TableName() string {
	return "todos"
}

func (Connection) TableName() string {
	return "connections"
}

func (Migration) TableName() string {
	return "migrations"
}

// BeforeCreate hooks for UUID generation and validation
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (n *Note) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	// Set default content if empty
	if n.Content == nil {
		n.Content = JSONB{"type": "doc", "content": []interface{}{}}
	}
	return nil
}

func (p *Person) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

func (t *Todo) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

func (c *Connection) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (m *Migration) BeforeCreate(tx *gorm.DB) error {
	if m.AppliedAt.IsZero() {
		m.AppliedAt = time.Now()
	}
	return nil
}

// Validation methods
func (u *User) Validate() error {
	if u.Username == "" {
		return errors.New("username is required")
	}
	if u.Email == "" {
		return errors.New("email is required")
	}
	if u.Password == "" {
		return errors.New("password is required")
	}
	return nil
}

func (n *Note) Validate() error {
	if n.UserID == uuid.Nil {
		return errors.New("user_id is required")
	}
	if n.Title == "" {
		return errors.New("title is required")
	}
	return nil
}

func (p *Person) Validate() error {
	if p.UserID == uuid.Nil {
		return errors.New("user_id is required")
	}
	if p.Name == "" {
		return errors.New("name is required")
	}
	return nil
}

func (t *Todo) Validate() error {
	if t.NoteID == uuid.Nil {
		return errors.New("note_id is required")
	}
	if t.TodoID == "" {
		return errors.New("todo_id is required")
	}
	if t.Text == "" {
		return errors.New("text is required")
	}
	return nil
}