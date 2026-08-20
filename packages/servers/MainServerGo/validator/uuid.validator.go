package validator

import (
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

func validateUUID(fl validator.FieldLevel) bool {
	u := fl.Field().String()
	_, err := uuid.Parse(u)
	return err == nil
}
