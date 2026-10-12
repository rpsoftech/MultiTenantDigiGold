package admin

import "testing"

func TestParseEventTime(t *testing.T) {
	cases := []struct {
		raw, want string
		ok        bool
	}{
		{"", "", true},
		// A plain date or date-time is Indian time.
		{"2026-10-09", "2026-10-09T00:00:00+05:30", true},
		{"2026-10-09T23:59:59", "2026-10-09T23:59:59+05:30", true},
		// An explicit offset is kept.
		{"2026-10-09T23:59:59.999+05:30", "2026-10-09T23:59:59.999+05:30", true},
		{"2026-10-09T18:30:00Z", "2026-10-09T18:30:00Z", true},
		// Used to reach Postgres and come back as a 500 with the SQL error text.
		{"yesterday", "", false},
		{"2026-13-40", "", false},
	}
	for _, tc := range cases {
		got, ok := parseEventTime(tc.raw)
		if ok != tc.ok || got != tc.want {
			t.Errorf("parseEventTime(%q) = %q, %v; want %q, %v", tc.raw, got, ok, tc.want, tc.ok)
		}
	}
}
