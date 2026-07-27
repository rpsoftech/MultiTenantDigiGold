package env

import "strconv"

var port = 0

func GetServerPort(key string) string {
	if port == 0 {
		PORT, err := strconv.Atoi(Env.GetEnv(key))
		if err != nil {
			panic("Please Pass Valid Port")
		}
		port = PORT
	}
	return strconv.Itoa(port) //port
}
