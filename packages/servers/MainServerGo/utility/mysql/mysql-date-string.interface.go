package mysqldb

import (
	"time"

	"github.com/fxamacker/cbor/v2"
)

type MysqlDateWithNull struct {
	*time.Time
	// Date string `json:"date" validate:"required"`
}

func (ns *MysqlDateWithNull) MarshalCBOR() ([]byte, error) {
	return cbor.Marshal(ns.String)
}
