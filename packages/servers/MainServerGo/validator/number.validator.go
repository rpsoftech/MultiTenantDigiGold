package validator

import (
	"regexp"

	"github.com/go-playground/validator/v10"
)

var numberRegex = regexp.MustCompile(`^\d*$`)

func validateStringIsNumber(fl validator.FieldLevel) bool {
	fieldValue := fl.Field().String()
	return numberRegex.MatchString(fieldValue)
}
