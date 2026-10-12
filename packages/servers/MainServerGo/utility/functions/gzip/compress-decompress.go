package utility_functions_gzip

import (
	"compress/gzip"
	"io"
	"os"
)

func GzipCompressFile(src string, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	// Closing flushes the file to disk, so its error must reach the caller.
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()

	gz := gzip.NewWriter(out)
	if _, err = io.Copy(gz, in); err != nil {
		gz.Close()
		return err
	}
	// Close writes the final block and the gzip trailer.
	return gz.Close()
}

// GzipDecompressFile writes the decompressed src to dst. The OTA updater swaps dst in as the
// running binary, so every error (including the gzip checksum, checked when the reader
// reaches the end, and the final flush on Close) must reach the caller rather than leave a
// truncated binary behind.
func GzipDecompressFile(src string, dst string) (err error) {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	gz, err := gzip.NewReader(in)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := gz.Close(); err == nil {
			err = cerr
		}
	}()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := out.Close(); err == nil {
			err = cerr
		}
	}()

	_, err = io.Copy(out, gz)
	return err
}
