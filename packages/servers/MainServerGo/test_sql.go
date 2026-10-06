package main

import "fmt"

func main() {
	query := `SELECT * FROM system_events WHERE ($1 = '' OR tenant_id = $1) AND ($2 = '' OR event_name = $2) AND ($3 = '' OR occurred_at >= cast(nullif($3, '') as timestamp)) AND ($4 = '' OR occurred_at <= cast(nullif($4, '') as timestamp))`
	fmt.Println(query)
}
