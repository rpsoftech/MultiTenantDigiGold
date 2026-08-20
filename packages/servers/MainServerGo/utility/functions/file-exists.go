package utility_functions

import (
	"errors"
	"io/fs"
	"os"
)

func Exist(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, fs.ErrNotExist) {
		return false, err
	}
	return false, err
}
