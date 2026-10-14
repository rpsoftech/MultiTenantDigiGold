// Package migrations embeds the SQL schema, applied by golang-migrate.
//
// While no database holds data that must be kept, the whole schema is one file,
// 000001_init.up.sql: change the schema by editing it and resetting each database
// (dbtool reset). Once real data exists, add numbered files (000002_...) instead; files
// are named NNNNNN_description.up.sql / .down.sql and run in order.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
