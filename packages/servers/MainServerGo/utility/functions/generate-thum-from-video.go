package utility_functions

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

func GenerateVideoThumbnail(fileBytes []byte, fileName string) ([]byte, error) {

	tempDir, err := os.MkdirTemp("", "thumbnail*")
	if err != nil {
		return []byte{}, err
	}
	videoFile, err := os.Create(filepath.Join(tempDir, fileName))
	if err != nil {
		return []byte{}, err
	}
	if _, err := videoFile.Write(fileBytes); err != nil {
		videoFile.Close()
		return []byte{}, err
		// panic(err)
	}
	if err := videoFile.Sync(); err != nil {
		videoFile.Close()
		return []byte{}, err
	}
	videoFile.Close()
	outputFilePath := tempDir + "/thumbnail.jpeg"

	cmd := `ffmpeg -i "%s" -an -q 0 -vf scale="'if(gt(iw,ih),-1,200):if(gt(iw,ih),200,-1)', crop=200:200:exact=1" -vframes 1 "%s"`
	// ffmpeg cmd ref : https://gist.github.com/TimothyRHuertas/b22e1a252447ab97aa0f8de7c65f96b8

	cmdSubstituted := fmt.Sprintf(cmd, filepath.Join(tempDir, fileName), outputFilePath)

	// shellName := "ash" // for docker (using alpine image)
	// if os.Getenv("ENV") != "" && os.Getenv("ENV") == "LOCAL" {
	shellName := "bash"
	// }
	ffCmd := exec.Command(shellName, "-c", cmdSubstituted)

	// getting real error msg : https://stackoverflow.com/questions/18159704/how-to-debug-exit-status-1-error-when-running-exec-command-in-golang
	output, err := ffCmd.CombinedOutput()
	if err != nil {
		log.Println(fmt.Sprint(err) + ": " + string(output))
		return []byte{}, err
	}
	bytes, err := os.ReadFile(outputFilePath)
	os.RemoveAll(tempDir)
	return bytes, err
}
