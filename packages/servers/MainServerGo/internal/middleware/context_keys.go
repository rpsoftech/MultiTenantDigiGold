package middleware

// 1. Define an unexported custom type.
// Because it starts with a lowercase letter, no outside library can use this type.
type contextKey string

// 2. Define your constant keys using this specific type.
const (
	TenantIDKey contextKey = "tenant_id"
	UserIDKey   contextKey = "user_id"
)
