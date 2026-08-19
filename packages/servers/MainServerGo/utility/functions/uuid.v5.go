package utility_functions

import "github.com/google/uuid"

func UUIDv5(nameSpace uuid.UUID, data string) string {
	return uuid.NewSHA1(nameSpace, []byte(data)).String()
}
