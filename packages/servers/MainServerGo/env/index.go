package env

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strconv"

	"github.com/rpsoftech/DigiGold/MainServerGo/validator"

	"github.com/joho/godotenv"
)

type EnvInterface struct {
	APP_ENV AppEnv `json:"APP_ENV" validate:"required,enum=AppEnv"`
	PORT    int    `json:"PORT" validate:"required,port"`
	// DB_URL                string `json:"DB_URL" validate:"required,url"`
	// DB_NAME               string `json:"DB_NAME_KEY" validate:"required,min=3"`

	ACCESS_TOKEN_KEY  string `json:"ACCESS_TOKEN_KEY" validate:"required,min=100"`
	REFRESH_TOKEN_KEY string `json:"REFRESH_TOKEN_KEY" validate:"required,min=100"`
	// FIREBASE_JSON_STRING  string `json:"FIREBASE_JSON_STRING" validate:"required"`
	// FIREBASE_DATABASE_URL string `json:"FIREBASE_DATABASE_URL" validate:"required"`
	internalData map[string]string
}

var Env *EnvInterface

var IsDev = false

func (e *EnvInterface) GetEnv(key string) string {
	if val, ok := e.internalData[key]; ok {
		return val
	}
	if val := os.Getenv(key); val != "" {
		e.internalData[key] = val
		return val
	}
	return ""
}

func ValidateEnv(env any) {
	errs := validator.Validator.Validate(env)
	if len(errs) > 0 {
		errsJson, _ := json.Marshal(errs)
		fmt.Printf("%s", errsJson)
		panic(errs[0])
	}
}

func LoadEnv(filename string) {
	godotenv.Load(filename)
	IsDev = slices.Contains(os.Args, "--dev")
	appEnv, _ := parseAppEnv(os.Getenv(app_ENV_KEY))
	PORT, err := strconv.Atoi(Env.GetEnv(PORT_KEY))
	if err != nil {
		panic("Please Pass Valid Port")
	}
	Env = &EnvInterface{
		APP_ENV: appEnv,
		internalData: map[string]string{
			"APP_ENV": os.Getenv(app_ENV_KEY),
		},
		PORT: PORT,
		// DB_NAME:               os.Getenv(db_NAME_KEY),
		// DB_URL:                os.Getenv(db_URL_KEY),
		// REDIS_DB_PORT:         redis_DB_PORT,
		// REDIS_DB_HOST:         os.Getenv(redis_DB_HOST_KEY),
		// REDIS_DB_PASSWORD:     os.Getenv(redis_DB_PASSWORD_KEY),
		// REDIS_DB_DATABASE:     redis_DB_DATABASE,
		// ACCESS_TOKEN_KEY:      os.Getenv(access_TOKEN_KEY),
		// REFRESH_TOKEN_KEY:     os.Getenv(refresh_TOKEN_KEY),
		// FIREBASE_JSON_STRING:  os.Getenv(firebase_JSON_STRING_KEY),
		// FIREBASE_DATABASE_URL: os.Getenv(firebase_DATABASE_URL_KEY),
	}
	ValidateEnv(Env)
}
