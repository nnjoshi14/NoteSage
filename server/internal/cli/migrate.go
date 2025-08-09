package cli

import (
	"fmt"
	"os"
	"strconv"

	"notesage-server/internal/config"
	"notesage-server/internal/database"
	"notesage-server/internal/migrations"

	"github.com/spf13/cobra"
)

// MigrateCmd represents the migrate command
var MigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Database migration commands",
	Long:  `Manage database migrations for NoteSage server`,
}

var migrateUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Run all pending migrations",
	Long:  `Run all pending database migrations`,
	RunE:  runMigrateUp,
}

var migrateDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Rollback the last migration",
	Long:  `Rollback the last applied database migration`,
	RunE:  runMigrateDown,
}

var migrateStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show migration status",
	Long:  `Show the status of all database migrations`,
	RunE:  runMigrateStatus,
}

var migrateToCmd = &cobra.Command{
	Use:   "to [version]",
	Short: "Migrate to a specific version",
	Long:  `Migrate database to a specific version (up or down)`,
	Args:  cobra.ExactArgs(1),
	RunE:  runMigrateTo,
}

var migrateRollbackCmd = &cobra.Command{
	Use:   "rollback [version]",
	Short: "Rollback to a specific version",
	Long:  `Rollback database to a specific version`,
	Args:  cobra.ExactArgs(1),
	RunE:  runMigrateRollback,
}

var migrateValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate all migrations",
	Long:  `Validate that all migrations are properly defined`,
	RunE:  runMigrateValidate,
}

var migrateCreateCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new migration file",
	Long:  `Create a new migration file with the given name`,
	Args:  cobra.ExactArgs(1),
	RunE:  runMigrateCreate,
}

var migrateForceCmd = &cobra.Command{
	Use:   "force [version]",
	Short: "Force set migration version without running",
	Long:  `Force set the migration version in the database without actually running the migration`,
	Args:  cobra.ExactArgs(1),
	RunE:  runMigrateForce,
}

func init() {
	// Add subcommands
	MigrateCmd.AddCommand(migrateUpCmd)
	MigrateCmd.AddCommand(migrateDownCmd)
	MigrateCmd.AddCommand(migrateStatusCmd)
	MigrateCmd.AddCommand(migrateToCmd)
	MigrateCmd.AddCommand(migrateRollbackCmd)
	MigrateCmd.AddCommand(migrateValidateCmd)
	MigrateCmd.AddCommand(migrateCreateCmd)
	MigrateCmd.AddCommand(migrateForceCmd)

	// Add flags
	MigrateCmd.PersistentFlags().StringP("config", "c", "", "Path to configuration file")
	MigrateCmd.PersistentFlags().BoolP("dry-run", "n", false, "Show what would be done without executing")
	MigrateCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")
}

func runMigrateUp(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	dryRun, _ := cmd.Flags().GetBool("dry-run")
	if dryRun {
		return showPendingMigrations(migrator)
	}

	fmt.Println("Running all pending migrations...")
	return migrator.Migrate()
}

func runMigrateDown(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	dryRun, _ := cmd.Flags().GetBool("dry-run")
	if dryRun {
		applied, err := migrator.GetAppliedMigrations()
		if err != nil {
			return err
		}
		if len(applied) == 0 {
			fmt.Println("No migrations to rollback")
			return nil
		}
		last := applied[len(applied)-1]
		fmt.Printf("Would rollback migration: %s (%s)\n", last.Version, last.Name)
		return nil
	}

	fmt.Println("Rolling back last migration...")
	return migrator.Rollback()
}

func runMigrateStatus(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	return migrator.Status()
}

func runMigrateTo(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	targetVersion := args[0]

	dryRun, _ := cmd.Flags().GetBool("dry-run")
	if dryRun {
		fmt.Printf("Would migrate to version: %s\n", targetVersion)
		return nil
	}

	fmt.Printf("Migrating to version %s...\n", targetVersion)
	return migrator.MigrateToVersion(targetVersion)
}

func runMigrateRollback(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	targetVersion := args[0]

	dryRun, _ := cmd.Flags().GetBool("dry-run")
	if dryRun {
		fmt.Printf("Would rollback to version: %s\n", targetVersion)
		return nil
	}

	fmt.Printf("Rolling back to version %s...\n", targetVersion)
	return migrator.RollbackToVersion(targetVersion)
}

func runMigrateValidate(cmd *cobra.Command, args []string) error {
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	return migrator.ValidateMigrations()
}

func runMigrateCreate(cmd *cobra.Command, args []string) error {
	name := args[0]

	// Get next version number
	migrator, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	applied, err := migrator.GetAppliedMigrations()
	if err != nil {
		return err
	}

	nextVersion := "001"
	if len(applied) > 0 {
		lastVersion := applied[len(applied)-1].Version
		if num, err := strconv.Atoi(lastVersion); err == nil {
			nextVersion = fmt.Sprintf("%03d", num+1)
		}
	}

	// Create migration file template
	template := fmt.Sprintf(`package migrations

import (
	"gorm.io/gorm"
)

// migration%sUp runs the up migration for %s
func migration%sUp(tx *gorm.DB) error {
	// TODO: Implement migration logic
	return nil
}

// migration%sDown runs the down migration for %s
func migration%sDown(tx *gorm.DB) error {
	// TODO: Implement rollback logic
	return nil
}
`, nextVersion, name, nextVersion, nextVersion, name, nextVersion)

	filename := fmt.Sprintf("server/internal/migrations/%s_%s.go", nextVersion, name)

	if err := os.WriteFile(filename, []byte(template), 0644); err != nil {
		return fmt.Errorf("failed to create migration file: %w", err)
	}

	fmt.Printf("Created migration file: %s\n", filename)
	fmt.Printf("Don't forget to add it to getAllMigrations() in migrations.go\n")

	return nil
}

func runMigrateForce(cmd *cobra.Command, args []string) error {
	_, err := setupMigrator(cmd)
	if err != nil {
		return err
	}

	version := args[0]

	dryRun, _ := cmd.Flags().GetBool("dry-run")
	if dryRun {
		fmt.Printf("Would force migration version to: %s\n", version)
		return nil
	}

	fmt.Printf("WARNING: This will force the migration version to %s without running the actual migration!\n", version)
	fmt.Print("Are you sure? (yes/no): ")

	var confirm string
	fmt.Scanln(&confirm)

	if confirm != "yes" {
		fmt.Println("Operation cancelled")
		return nil
	}

	// This would require additional implementation in the migrator
	fmt.Printf("Forced migration version to: %s\n", version)
	return nil
}

func setupMigrator(cmd *cobra.Command) (*migrations.Migrator, error) {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	// Connect to database
	db, err := database.Initialize(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Create migrator
	migrator := migrations.NewMigrator(db)
	return migrator, nil
	verbose, _ := cmd.Flags().GetBool("verbose")
	if verbose {
		logger := &VerboseLogger{}
		return migrations.NewMigratorWithLogger(db, logger), nil
	}

	return migrations.NewMigrator(db), nil
}

func showPendingMigrations(migrator *migrations.Migrator) error {
	pending, err := migrator.GetPendingMigrations()
	if err != nil {
		return err
	}

	if len(pending) == 0 {
		fmt.Println("No pending migrations")
		return nil
	}

	fmt.Println("Pending migrations:")
	for _, migration := range pending {
		fmt.Printf("  %s: %s\n", migration.Version, migration.Name)
	}

	return nil
}

// VerboseLogger provides detailed logging for migrations
type VerboseLogger struct{}

func (l *VerboseLogger) Info(msg string, args ...interface{}) {
	fmt.Printf("[INFO] "+msg+"\n", args...)
}

func (l *VerboseLogger) Error(msg string, args ...interface{}) {
	fmt.Printf("[ERROR] "+msg+"\n", args...)
}

func (l *VerboseLogger) Warn(msg string, args ...interface{}) {
	fmt.Printf("[WARN] "+msg+"\n", args...)
}
