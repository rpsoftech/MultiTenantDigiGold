package updater

import (
	"strings"
	"testing"
)

func TestValidateRelease(t *testing.T) {
	validHash := strings.Repeat("ab", 32)
	cases := []struct {
		name    string
		kv      KVResponse
		wantErr bool
	}{
		{"valid", KVResponse{Version: 3, URL: "https://files.example.com/a.gz", SHA256: validHash}, false},
		{"missing URL", KVResponse{Version: 3, SHA256: validHash}, true},
		{"plain HTTP", KVResponse{Version: 3, URL: "http://files.example.com/a.gz", SHA256: validHash}, true},
		{"missing hash", KVResponse{Version: 3, URL: "https://files.example.com/a.gz"}, true},
		{"short hash", KVResponse{Version: 3, URL: "https://files.example.com/a.gz", SHA256: "abcd"}, true},
		{"not hex", KVResponse{Version: 3, URL: "https://files.example.com/a.gz", SHA256: strings.Repeat("zz", 32)}, true},
	}
	for _, c := range cases {
		if err := validateRelease(c.kv); (err != nil) != c.wantErr {
			t.Errorf("%s: validateRelease() = %v, want error %v", c.name, err, c.wantErr)
		}
	}
}
