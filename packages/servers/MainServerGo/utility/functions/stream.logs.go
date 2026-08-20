package utility_functions

import (
	"bufio"
	"io"
	"log"
)

func StreamLogs(pipe io.ReadCloser, prefix string) {

	scanner := bufio.NewScanner(pipe)

	for scanner.Scan() {

		line := scanner.Text()

		log.Printf("[%s] %s\n", prefix, line)
	}
}
