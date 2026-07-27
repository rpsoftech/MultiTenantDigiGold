package interfaces

import (
	"fmt"
	"packages/servers/MainServerGo/validator"
)

const (
	REQ_LOCAL_ERROR_KEY = "Error"
	REQ_LOCAL_UserID    = "UserId"
)

type RequestError struct {
	StatusCode    int    `json:"-"`
	Code          int    `json:"code"`
	Message       string `json:"message"`
	Name          string `json:"name"`
	Extra         any    `json:"extra,omitempty"`
	LogTheDetails bool   `json:"-"`
}

func (r *RequestError) Error() string {
	return fmt.Sprintf("status %d: err %v", r.StatusCode, r.Message)
}
func (r *RequestError) AppendValidationErrors(errs []validator.ErrorResponse) *RequestError {
	// return fmt.Sprintf("status %d: err %v", r.StatusCode, r.Message)
	for index, element := range errs {
		if index != 0 {
			r.Message += "\n"
		}
		r.Message += fmt.Sprintf("FieldName:- %s,Passed Value:- %s,Failed Tag:- %s", element.FailedField, element.Value, element.Tag)
	}
	return r
}
