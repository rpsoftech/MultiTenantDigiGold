package utility_functions

import "github.com/google/uuid"

func GenerateNewUUID() string {
	return uuid.New().String()
}
