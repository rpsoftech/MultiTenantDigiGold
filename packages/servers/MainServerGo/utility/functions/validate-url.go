package utility_functions

import "net/url"

func ValidateUrl(urlString string) bool {
	_, err := url.ParseRequestURI(urlString)
	return err == nil
}
