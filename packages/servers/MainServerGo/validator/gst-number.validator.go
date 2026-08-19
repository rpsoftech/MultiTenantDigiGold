package validator

import (
	"fmt"
	"math/rand"
	"regexp"

	"github.com/go-playground/validator/v10"
)

var gstRegex, _ = regexp.Compile(`\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}`)

func validateGstNumber(fl validator.FieldLevel) bool {
	gstNumber := fl.Field().String()
	return gstRegex.MatchString(gstNumber)
}

func GenerateRandomGstNumber() string {
	return fmt.Sprintf("%dAAAAA%dA1ZA", rand.Intn(99-10)+10, rand.Intn(9999-1000)+1000)
}
