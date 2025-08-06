package router

import (
	"notesage-server/internal/config"
	"notesage-server/internal/handlers"
	"notesage-server/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func Setup(db *gorm.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	// Middleware
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, cfg)
	noteHandler := handlers.NewNoteHandler(db)
	personHandler := handlers.NewPersonHandler(db)
	todoHandler := handlers.NewTodoHandler(db)
	graphHandler := handlers.NewGraphHandler(db)

	// Public routes
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// Protected routes
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware(cfg.Auth.JWTSecret))
	{
		// User profile management
		profile := api.Group("/profile")
		{
			profile.GET("", authHandler.GetProfile)
			profile.PUT("", authHandler.UpdateProfile)
			profile.POST("/change-password", authHandler.ChangePassword)
		}

		// Admin-only user management
		users := api.Group("/users")
		users.Use(middleware.RequireAdmin())
		{
			users.GET("", authHandler.GetUsers)
			users.POST("", authHandler.CreateUser)
			users.PUT("/:id", authHandler.UpdateUser)
			users.DELETE("/:id", authHandler.DeleteUser)
		}
		// Notes
		notes := api.Group("/notes")
		{
			notes.GET("", noteHandler.GetNotes)
			notes.POST("", noteHandler.CreateNote)
			notes.GET("/search", noteHandler.SearchNotes)
			notes.GET("/archived", noteHandler.GetArchivedNotes)
			notes.GET("/category/:category", noteHandler.GetNotesByCategory)
			notes.GET("/tag/:tag", noteHandler.GetNotesByTag)
			notes.GET("/:id", noteHandler.GetNote)
			notes.PUT("/:id", noteHandler.UpdateNote)
			notes.POST("/:id/archive", noteHandler.ArchiveNote)
			notes.POST("/:id/restore", noteHandler.RestoreNote)
			notes.DELETE("/:id", noteHandler.DeleteNote)
		}

		// People
		people := api.Group("/people")
		{
			people.GET("", personHandler.GetPeople)
			people.POST("", personHandler.CreatePerson)
			people.GET("/search", personHandler.SearchPeople)
			people.GET("/:id", personHandler.GetPerson)
			people.PUT("/:id", personHandler.UpdatePerson)
			people.DELETE("/:id", personHandler.DeletePerson)
			people.GET("/:id/connections", personHandler.GetPersonConnections)
			people.POST("/:id/connections", personHandler.CreatePersonConnection)
		}

		// Todos
		todos := api.Group("/todos")
		{
			todos.GET("", todoHandler.GetTodos)
			todos.POST("", todoHandler.CreateTodo)
			todos.POST("/sync", todoHandler.SyncNoteTodos)
			todos.GET("/calendar", todoHandler.GetCalendarTodos)
			todos.GET("/note/:note_id", todoHandler.GetTodosByNote)
			todos.GET("/:id", todoHandler.GetTodo)
			todos.PUT("/:id", todoHandler.UpdateTodo)
			todos.PUT("/note/:note_id/todo/:todo_id", todoHandler.UpdateTodoByCompositeKey)
			todos.DELETE("/:id", todoHandler.DeleteTodo)
		}

		// Knowledge Graph
		graph := api.Group("/graph")
		{
			graph.GET("", graphHandler.GetGraph)
			graph.GET("/search", graphHandler.SearchGraph)
			graph.GET("/stats", graphHandler.GetGraphStats)
			graph.GET("/types", graphHandler.GetConnectionTypes)
			graph.GET("/export", graphHandler.ExportGraph)
			graph.GET("/nodes/:id/connections", graphHandler.GetNodeConnections)
			graph.GET("/nodes/:id/subgraph", graphHandler.GetSubgraph)
			graph.POST("/notes/:note_id/detect", graphHandler.DetectConnections)
			graph.POST("/notes/:note_id/update", graphHandler.UpdateConnections)
		}
	}

	return r
}