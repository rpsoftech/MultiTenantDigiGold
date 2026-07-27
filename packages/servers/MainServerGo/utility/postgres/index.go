package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	// pgx is the modern, high-performance Postgres driver for Go
	"packages/servers/MainServerGo/env"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresConfig struct {
	PG_HOST     string `validate:"required"`
	PG_PORT     int    `validate:"required"`
	PG_USERNAME string `validate:"required"`
	PG_PASSWORD string `validate:"required"`
	PG_DATABASE string `validate:"required"`
}

type PostgresDBStruct struct {
	Db *sql.DB
}

var (
	postgresInstance *PostgresDBStruct
	postgresOnce     sync.Once
)

// InitPostgresDB implements thread-safe Singleton initialization
func InitPostgresDB() *PostgresDBStruct {
	postgresOnce.Do(func() {
		fmt.Println("PostgreSQL Initializing...")

		port, err := strconv.Atoi(env.Env.GetEnv(env.MYSQL_PORT_KEY)) // Assuming you update this to PG_PORT_KEY
		if err != nil {
			panic(fmt.Sprintf("FATAL: Invalid PostgreSQL Port: %v", err))
		}

		config := &PostgresConfig{
			PG_HOST:     env.Env.GetEnv(env.MYSQL_HOST_KEY),
			PG_PORT:     port,
			PG_USERNAME: env.Env.GetEnv(env.MYSQL_USERNAME_KEY),
			PG_PASSWORD: env.Env.GetEnv(env.MYSQL_PASSWORD_KEY),
			PG_DATABASE: env.Env.GetEnv(env.MYSQL_DATABASE_KEY),
		}

		// env.ValidateEnv(config) // Call your validator here

		// PostgreSQL DSN Format
		dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
			config.PG_USERNAME,
			config.PG_PASSWORD,
			config.PG_HOST,
			config.PG_PORT,
			config.PG_DATABASE,
		)

		// 1. Open the connection pool (Does NOT ping the DB)
		db, err := sql.Open("pgx", dsn)
		if err != nil {
			panic(fmt.Sprintf("FATAL: DSN parsing failed: %v", err))
		}

		// 2. High-Concurrency Connection Pool Settings
		db.SetMaxOpenConns(100)          // Allows 100 concurrent DB queries
		db.SetMaxIdleConns(20)           // Keeps 20 connections warm in the background
		db.SetConnMaxLifetime(time.Hour) // Refreshes connections every hour to prevent stale drops

		// 3. Synchronous Ping: Guarantee the DB is alive before letting the server boot
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := db.PingContext(ctx); err != nil {
			panic(fmt.Sprintf("FATAL: PostgreSQL is unreachable: %v", err))
		}

		postgresInstance = &PostgresDBStruct{
			Db: db,
		}

		fmt.Println("PostgreSQL Client Initialized Successfully")
	})

	return postgresInstance
}

func GetPostgresDB() *PostgresDBStruct {
	if postgresInstance == nil {
		return InitPostgresDB()
	}
	return postgresInstance
}

// DeferFunction gracefully closes the pool on application shutdown
func (c *PostgresDBStruct) DeferFunction() {
	if c.Db != nil {
		fmt.Println("Closing PostgreSQL connections...")
		if err := c.Db.Close(); err != nil {
			// Log the error during shutdown, NEVER panic.
			log.Printf("Error closing PostgreSQL connection: %v\n", err)
		}
	}
}
