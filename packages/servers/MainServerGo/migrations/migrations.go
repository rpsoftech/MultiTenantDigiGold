// Package migrations embeds the versioned SQL schema migrations.
//
// Files are named NNNNNN_description.up.sql / .down.sql and run in order by
// golang-migrate. Never edit a file that has already run anywhere; add the
// next number instead.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
