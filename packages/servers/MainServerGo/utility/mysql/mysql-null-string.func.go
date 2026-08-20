package mysqldb

import (
	"database/sql"
	"encoding/json"

	"github.com/fxamacker/cbor/v2"
)

type NullString struct {
	sql.NullString
}

func (ns *NullString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return json.Marshal("")
	}
	return json.Marshal(ns.String)
}
func (ns *NullString) MarshalCBOR() ([]byte, error) {
	if !ns.Valid {
		return cbor.Marshal("")
	}
	return cbor.Marshal(ns.String)
}

func (ns *NullString) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	ns.String = s
	ns.Valid = true
	return nil
}
func (ns *NullString) UnmarshalCBOR(data []byte) error {
	var s string
	if err := cbor.Unmarshal(data, &s); err != nil {
		return err
	}
	ns.String = s
	ns.Valid = true
	return nil
}
