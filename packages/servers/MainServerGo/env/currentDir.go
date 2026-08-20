package env

import (
	"fmt"
	"os"
	"path/filepath"
)

var currentDirectory string = ""

func FindAndReturnCurrentDir() string {
	if currentDirectory != "" {
		return currentDirectory
	}
	fmt.Println(len(os.Args), os.Args)
	if IsDev {
		current, err := os.Getwd()
		Check(err)
		currentDirectory = current
	} else {
		exePath, err := os.Executable()
		currentDirectory = filepath.Dir(exePath)
		Check(err)
	}
	return currentDirectory
}
func Check(e error) {
	if e != nil {
		panic(e)
	}
}
