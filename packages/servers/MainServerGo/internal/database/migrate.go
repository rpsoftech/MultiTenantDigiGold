// Package database runs schema migrations and database housekeeping.
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/rpsoftech/DigiGold/MainServerGo/migrations"
)

// newMigrator builds a golang-migrate instance over the embedded migrations.
// golang-migrate takes a PostgreSQL advisory lock, so the API and the worker
// can both call MigrateUp at startup safely.
func newMigrator(db *sql.DB) (*migrate.Migrate, error) {
	source, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded migrations: %w", err)
	}
	driver, err := pgxmigrate.WithInstance(db, &pgxmigrate.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open migration driver: %w", err)
	}
	return migrate.NewWithInstance("iofs", source, "pgx5", driver)
}

// MigrateUp applies every pending migration.
func MigrateUp(db *sql.DB) error {
	m, err := newMigrator(db)
	if err != nil {
		return err
	}
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up failed: %w", err)
	}
	version, dirty, _ := m.Version()
	log.Printf("✅ Database schema at version %d (dirty=%t)", version, dirty)
	return nil
}

// MigrateDown reverts the last `steps` migrations.
func MigrateDown(db *sql.DB, steps int) error {
	m, err := newMigrator(db)
	if err != nil {
		return err
	}
	if err := m.Steps(-steps); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate down failed: %w", err)
	}
	return nil
}

// MigrateVersion reports the current schema version and whether the last run failed half-way.
func MigrateVersion(db *sql.DB) (uint, bool, error) {
	m, err := newMigrator(db)
	if err != nil {
		return 0, false, err
	}
	version, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		return 0, false, nil
	}
	return version, dirty, err
}

// MigrateForce marks the schema as being at `version` without running anything.
// Use it only to recover from a failed (dirty) migration after fixing the database by hand.
func MigrateForce(db *sql.DB, version int) error {
	m, err := newMigrator(db)
	if err != nil {
		return err
	}
	return m.Force(version)
}

// EnsureEventPartitions creates system_events partitions for this month and the next three.
func EnsureEventPartitions(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, `SELECT ensure_system_events_partitions(3)`); err != nil {
		return fmt.Errorf("failed to ensure system_events partitions: %w", err)
	}
	return nil
}
