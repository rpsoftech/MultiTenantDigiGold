package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	utility_functions_gzip "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions/gzip"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/updater"
)

const (
	FileServerURL = "https://files.rpso.in/upload/"
	KeyValueURL   = "https://keyvalue.rpso.in/public/"
)

// 1. THE BUILD MATRIX: Define every OS and Arch combination you want to support
type BuildTarget struct {
	OS   string
	Arch string
}

var (
	fileServerToken = os.Getenv("FILE_SERVER_TOKEN")
	kvToken         = os.Getenv("KV_TOKEN")

	targets = []BuildTarget{
		{"linux", "amd64"},   // Standard Linux Servers
		{"linux", "arm64"},   // AWS Graviton
		{"darwin", "amd64"},  // Older Intel Macs
		{"darwin", "arm64"},  // Apple Silicon (M1/M2/M3) Macs
		{"windows", "amd64"}, // Standard Windows 64-bit
	}

	components = map[string]string{
		"api":    "./packages/servers/MainServerGo/cmd/api/main.go",
		"worker": "./packages/servers/MainServerGo/cmd/worker/main.go",
	}
)

type VersionInfo struct {
	Version int    `json:"version"`
	URL     string `json:"url"`
	SHA256  string `json:"sha256"`
}

func getNextVersion(envName, component, os, arch string) int {
	targetKey := updater.GetFileKey(envName, component, os, arch)
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", KeyValueURL+targetKey, nil)
	if err != nil {
		log.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		log.Printf("⚠️ Could not fetch current version from KV store (Status: %d). Defaulting to Version 1.", resp.StatusCode)
		if resp != nil {
			resp.Body.Close()
		}
		return 1
	}
	defer resp.Body.Close()

	var current VersionInfo
	if err := json.NewDecoder(resp.Body).Decode(&current); err != nil {
		log.Println("⚠️ Could not parse current version JSON. Defaulting to Version 1.")
		return 1
	}

	return current.Version + 1
}

func main() {
	if fileServerToken == "" || kvToken == "" {
		log.Fatal("FATAL: FILE_SERVER_TOKEN and KV_TOKEN environment variables are required.")
	}
	deployEnv := os.Getenv("DEPLOY_ENV")
	if deployEnv == "" {
		deployEnv = string(env.APP_ENV_STAGING) // Fail-safe default
		log.Println("⚠️ DEPLOY_ENV not set. Defaulting to 'staging'.")
	}
	// Loop through both microservices (API and Worker)
	for _, target := range targets {
		// Loop through the entire Build Matrix
		for compName, compPath := range components {
			versionInt := getNextVersion(deployEnv, compName, target.OS, target.Arch)
			if len(os.Args) > 1 {
				if v, err := strconv.Atoi(os.Args[1]); err == nil {
					versionInt = v
					log.Printf("⚠️ Manual Override: Forcing Version %d", versionInt)
				}
			}

			log.Printf("🚀 Starting Multi-OS Deployment for Digi Gold v%d", versionInt)

			if err := os.MkdirAll("build", 0755); err != nil {
				log.Fatalf("Failed to create build directory: %v", err)
			}
			log.Printf("\n========================================")
			log.Printf("🔨 Building %s [%s/%s]", compName, target.OS, target.Arch)

			// 2. DYNAMIC NAMING: Handle the Windows .exe extension
			binaryName := updater.GetFileKey(deployEnv, compName, target.OS, target.Arch)
			if target.OS == "windows" {
				binaryName += ".exe"
			}

			binaryPath := filepath.Join("build", binaryName)

			// 3. COMPILE: Inject the dynamic OS and ARCH tags into the environment
			cmd := exec.Command("go", "build",
				"-ldflags", fmt.Sprintf("-s -w -X main.version=%d", versionInt),
				"-o", binaryPath, compPath,
			)
			cmd.Env = append(os.Environ(), "CGO_ENABLED=0", "GOOS="+target.OS, "GOARCH="+target.Arch)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				log.Fatalf("Build failed for %s: %v", binaryName, err)
			}

			// 4. COMPRESS: Gzip the binary
			gzBinaryName := binaryName + ".gz"
			gzBinaryPath := filepath.Join("build", gzBinaryName)
			log.Printf("📦 Compressing to %s...", gzBinaryName)
			if err := utility_functions_gzip.GzipCompressFile(binaryPath, gzBinaryPath); err != nil {
				log.Fatalf("Compression failed: %v", err)
			}

			// 5. HASH: Calculate SHA256 Hash of the .gz file
			hash, err := updater.HashFile(gzBinaryPath)
			if err != nil {
				log.Fatalf("Hashing failed: %v", err)
			}
			log.Printf("🔐 SHA256: %s", hash)

			// 6. UPLOAD: Push to File Server
			uploadPath := fmt.Sprintf("digiGold/%s", compName)
			log.Printf("☁️ Uploading to File Server...")
			if err := UploadFile(gzBinaryPath, gzBinaryName, uploadPath, FileServerURL, fileServerToken); err != nil {
				log.Fatalf("Upload failed: %v", err)
			}

			// 7. KV UPDATE: Create the dynamic Key-Value store string
			// Outputs exactly like: digigold_api_darwin_arm64 or digigold_worker_windows_amd64
			kvKey := updater.GetFileKey(deployEnv, compName, target.OS, target.Arch)
			fileURL := fmt.Sprintf("https://files.rpso.in/static/%s/%s", uploadPath, gzBinaryName)

			vInfo := VersionInfo{
				Version: versionInt,
				URL:     fileURL,
				SHA256:  hash,
			}
			vInfoBytes, _ := json.MarshalIndent(vInfo, "", "  ")

			log.Printf("📝 Updating KV Store Key: %s", kvKey)
			if err := updateKeyValue(kvKey, vInfoBytes); err != nil {
				log.Fatalf("KV Update failed: %v", err)
			}

			log.Printf("✅ %s deployed successfully!", kvKey)
		}
	}
	log.Println("\n🎉 All 10 builds (5 OS/Arch pairs x 2 Services) compressed, hashed, and deployed successfully!")
}

// ==========================================
// UTILITY FUNCTIONS (Inlined for Portability)
// ==========================================
func UploadFile(path, filename, uploadPath, fileServerURL, fileServerToken string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	payload := &bytes.Buffer{}
	writer := multipart.NewWriter(payload)

	part, err := writer.CreateFormFile(filename, filepath.Base(path))
	if err != nil {
		return err
	}
	client := &http.Client{
		Timeout: time.Second * 540,
	}
	io.Copy(part, file)

	writer.WriteField("path", uploadPath)

	err = writer.Close()
	if err != nil {
		log.Println(err)
		return err
	}

	req, err := http.NewRequest(
		"POST",
		fileServerURL+filename,
		payload,
	)

	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+fileServerToken)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("failed to upload file With Status Code: %d", resp.StatusCode)
		return fmt.Errorf("failed to upload file: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println(err)
		return err
	}
	log.Println(string(body))
	log.Println("Uploaded:", filename)

	return nil
}

func updateKeyValue(key string, data []byte) error {
	req, err := http.NewRequest("POST", KeyValueURL+key, bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+kvToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}
