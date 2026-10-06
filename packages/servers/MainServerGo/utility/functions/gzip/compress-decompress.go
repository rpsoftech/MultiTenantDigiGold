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
func GzipDecompressFile(src string, dst string) error {

	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	gz, err := gzip.NewReader(in)
	if err != nil {
		return err
	}
	defer gz.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, gz)

	return err
}
