package utility_functions_gzip

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGzipRoundTrip(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "bin")
	content := strings.Repeat("digigold binary ", 1000)
	if err := os.WriteFile(src, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := GzipCompressFile(src, src+".gz"); err != nil {
		t.Fatal(err)
	}
	if err := GzipDecompressFile(src+".gz", src+".out"); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(src + ".out")
	if err != nil || string(got) != content {
		t.Fatalf("round trip changed the file (err %v)", err)
	}
}

// A truncated download must fail, never leave a partial binary that the updater installs.
func TestGzipDecompressRejectsATruncatedArchive(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "bin")
	if err := os.WriteFile(src, []byte(strings.Repeat("x", 50000)), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := GzipCompressFile(src, src+".gz"); err != nil {
		t.Fatal(err)
	}
	full, _ := os.ReadFile(src + ".gz")
	if err := os.WriteFile(src+".cut.gz", full[:len(full)-8], 0o644); err != nil {
		t.Fatal(err)
	}
	if err := GzipDecompressFile(src+".cut.gz", src+".out"); err == nil {
		t.Fatal("GzipDecompressFile accepted a truncated archive")
	}
}
