package env

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strconv"
	"sync"

	"github.com/joho/godotenv"
	"github.com/rpsoftech/DigiGold/MainServerGo/validator" // Ensure this path matches your project
)

const ENV_FILE_NAME = "digiGold.env"

type EnvInterface struct {
	APP_ENV           AppEnv `json:"APP_ENV" validate:"required"` // Assumes your validator supports enum or oneof
	PORT              int    `json:"PORT" validate:"required"`
	ACCESS_TOKEN_KEY  string `json:"ACCESS_TOKEN_KEY" validate:"required,min=100"`
	REFRESH_TOKEN_KEY string `json:"REFRESH_TOKEN_KEY" validate:"required,min=100"`

	internalData map[string]string
	mu           sync.RWMutex // CRITICAL: Mutex for thread-safe map access
}

var (
	Env     *EnvInterface
	IsDev   = false
	envOnce sync.Once
)

// GetEnv fetches variables safely using a Read/Write Mutex
func (e *EnvInterface) GetEnv(key string) string {
	// 1. Safe Read Lock
	e.mu.RLock()
	val, ok := e.internalData[key]
	e.mu.RUnlock()

	if ok {
		return val
	}

	// 2. Fetch from the OS in-memory registry
	val = os.Getenv(key)
	if val != "" {
		// 3. Safe Write Lock
		e.mu.Lock()
		e.internalData[key] = val
		e.mu.Unlock()
	}

	return val
}

func ValidateEnv(env any) {
	errs := validator.Validator.Validate(env)
	if len(errs) > 0 {
		// Beautifully format the JSON error so developers can immediately spot the missing variable
		errsJson, _ := json.MarshalIndent(errs, "", "  ")
		panic(fmt.Sprintf("FATAL: Environment Validation Failed:\n%s", string(errsJson)))
	}
}

// LoadEnv guarantees the environment is parsed exactly once
func LoadEnv(filename string) {
	envOnce.Do(func() {
		appEnvStr := os.Getenv(app_ENV_KEY)
		IsDev = slices.Contains(os.Args, "--dev") || appEnvStr == string(APP_ENV_DEVELOP)
		// 1. Graceful Loading: Do not crash if the .env file is missing (e.g., in Docker)
		if err := godotenv.Load(filename); err != nil {
			if IsDev {
				fmt.Printf("⚠️  Warning: %s not found. Falling back to system environment variables.\n", filename)
			}
		}
		// Extract raw strings
		portStr := os.Getenv(PORT_KEY)
		appEnvStr = os.Getenv(app_ENV_KEY)
		IsDev = slices.Contains(os.Args, "--dev") || appEnvStr == string(APP_ENV_DEVELOP)
		// Parse the Port
		port, err := strconv.Atoi(portStr)
		if err != nil {
			panic(fmt.Sprintf("FATAL: Invalid PORT provided: '%s'", portStr))
		}

		// 2. Hydrate the struct
		Env = &EnvInterface{
			APP_ENV:           AppEnv(appEnvStr),
			PORT:              port,
			ACCESS_TOKEN_KEY:  os.Getenv(ACCESS_TOKEN_KEY),
			REFRESH_TOKEN_KEY: os.Getenv(REFRESH_TOKEN_KEY),
			internalData:      make(map[string]string),
		}

		// 3. Pre-cache known keys
		Env.internalData["APP_ENV"] = appEnvStr
		Env.internalData["PORT"] = portStr

		// 4. Validate all strictly typed constraints
		ValidateEnv(Env)
		fmt.Println("✅ Environment Variables successfully loaded and validated.")
	})
}
