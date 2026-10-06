package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/rpsoftech/DigiGold/MainServerGo/env"
	utility_functions_gzip "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions/gzip"
	"github.com/rpsoftech/DigiGold/MainServerGo/utility/updater"
)

const (
	FileServerBase = "https://files.rpso.in"
	FileServerURL  = FileServerBase + "/upload/"
	KeyValueURL    = updater.KVBaseURL
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
		{"linux", "amd64"}, // Standard Linux Servers
		// {"linux", "arm64"},   // AWS Graviton
		// {"darwin", "amd64"},  // Older Intel Macs
		// {"darwin", "arm64"},  // Apple Silicon (M1/M2/M3) Macs
		// {"windows", "amd64"}, // Standard Windows 64-bit
	}

	components = map[string]string{
		"api":    "./packages/servers/MainServerGo/cmd/api",
		"worker": "./packages/servers/MainServerGo/cmd/worker",
	}
)

// artifact is one built, compressed and hashed binary waiting to be published.
type artifact struct {
	kvKey      string
	gzName     string
	gzPath     string
	uploadPath string
	info       updater.KVResponse
}

// getCurrentVersion returns the version published under targetKey, or 0 if nothing is published yet.
func getCurrentVersion(targetKey string) int {
	client := &http.Client{Timeout: 10 * time.Second}
	current, err := updater.FetchKV(client, KeyValueURL, targetKey)
	// Only a missing key means a first deploy. Any other failure must stop the deploy:
	// guessing could publish a version below the one servers run, and they would skip it.
	if errors.Is(err, updater.ErrKVNotFound) {
		log.Printf("⚠️ No version found for %s.", targetKey)
		return 0
	}
	if err != nil {
		log.Fatalf("Could not fetch current version from KV store: %v", err)
	}

	return current.Version
}

// nextVersion picks one version for every artifact in this run. It is above every published
// version, so no server skips it, and in CI it is never below the workflow run number, so a
// release can be traced back to the run that built it.
func nextVersion(kvKeys []string) int {
	next := 1
	for _, key := range kvKeys {
		next = max(next, getCurrentVersion(key)+1)
	}
	if runNumber, err := strconv.Atoi(os.Getenv("GITHUB_RUN_NUMBER")); err == nil {
		next = max(next, runNumber)
	}
	return next
}

func main() {
	// Usage: go run deploy.go [-dry-run] [version]
	dryRun := flag.Bool("dry-run", false, "build, compress and hash every artifact without uploading or touching the KV store")
	flag.Parse()

	if !*dryRun && (fileServerToken == "" || kvToken == "") {
		log.Fatal("FATAL: FILE_SERVER_TOKEN and KV_TOKEN environment variables are required.")
	}
	// Servers only poll keys for their exact APP_ENV, so reject anything they would never read.
	deployEnv := strings.ToUpper(os.Getenv("DEPLOY_ENV"))
	if deployEnv == "" {
		deployEnv = string(env.APP_ENV_STAGING) // Fail-safe default
		log.Printf("⚠️ DEPLOY_ENV not set. Defaulting to '%s'.", deployEnv)
	}
	if deployEnv != string(env.APP_ENV_STAGING) && deployEnv != string(env.APP_ENV_PRODUCTION) {
		log.Fatalf("FATAL: DEPLOY_ENV must be %s or %s, got %q.", env.APP_ENV_STAGING, env.APP_ENV_PRODUCTION, deployEnv)
	}

	// Outputs exactly like: STAGING_digigold_api_linux_amd64
	var kvKeys []string
	for _, target := range targets {
		for compName := range components {
			kvKeys = append(kvKeys, updater.GetFileKey(deployEnv, compName, target.OS, target.Arch))
		}
	}

	// One version for every artifact, so api and worker from the same run always match.
	var versionInt int
	switch {
	case flag.NArg() > 0:
		// Manual Override: `go run deploy.go <version>` forces the version for every build
		v, err := strconv.Atoi(flag.Arg(0))
		if err != nil || v < 1 {
			log.Fatalf("FATAL: Version override must be a positive integer, got %q.", flag.Arg(0))
		}
		versionInt = v
		log.Printf("⚠️ Manual Override: Forcing Version %d", versionInt)
	case *dryRun:
		// A dry run publishes nothing, so it needs no version from the KV store.
		log.Println("🧪 Dry run: building with Version 0. Nothing will be uploaded.")
	default:
		versionInt = nextVersion(kvKeys)
	}
	log.Printf("🚀 Deploying Digi Gold v%d to %s", versionInt, deployEnv)

	if err := os.MkdirAll("build", 0755); err != nil {
		log.Fatalf("Failed to create build directory: %v", err)
	}

	// PHASE 1: Build, compress and hash everything before publishing anything,
	// so a failed build can't leave one component released and the other not.
	var artifacts []artifact
	// Loop through the entire Build Matrix
	for _, target := range targets {
		// Loop through both microservices (API and Worker)
		for compName, compPath := range components {
			kvKey := updater.GetFileKey(deployEnv, compName, target.OS, target.Arch)

			log.Printf("\n========================================")
			log.Printf("🔨 Building %s v%d [%s/%s]", compName, versionInt, target.OS, target.Arch)

			// 2. DYNAMIC NAMING: Handle the Windows .exe extension
			binaryName := kvKey
			if target.OS == "windows" {
				binaryName += ".exe"
			}

			binaryPath := filepath.Join("build", binaryName)

			// 3. COMPILE: Inject the dynamic OS and ARCH tags into the environment.
			// GOENV=off and the pinned/empty variables keep the deployer's own Go settings out of the release binary.
			cmd := exec.Command("go", "build",
				"-buildvcs=false",
				"-ldflags", fmt.Sprintf("-s -w -X main.version=%d", versionInt),
				"-o", binaryPath, compPath,
			)
			cmd.Env = append(os.Environ(), "CGO_ENABLED=0", "GOOS="+target.OS, "GOARCH="+target.Arch,
				"GOAMD64=v1", "GOENV=off", "GOFLAGS=", "GOEXPERIMENT=")
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			if err := cmd.Run(); err != nil {
				log.Fatalf("Build failed for %s: %v", binaryName, err)
			}

			// 4. COMPRESS: Gzip the binary. The version is in the file name, so every
			// release gets its own URL and never overwrites the one the KV store points at.
			gzBinaryName := fmt.Sprintf("%s_v%d.gz", kvKey, versionInt)
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

			artifacts = append(artifacts, artifact{
				kvKey:      kvKey,
				gzName:     gzBinaryName,
				gzPath:     gzBinaryPath,
				uploadPath: fmt.Sprintf("digiGold/%s", compName),
				info:       updater.KVResponse{Version: versionInt, SHA256: hash},
			})
		}
	}

	if *dryRun {
		log.Printf("\n✅ Dry run: all %d builds compiled, compressed and hashed. Skipping upload and KV update.", len(artifacts))
		return
	}

	// PHASE 2 (6. UPLOAD): Push every file to the File Server. New versioned URLs only,
	// so nothing the servers download changes yet.
	for i := range artifacts {
		a := &artifacts[i]
		log.Printf("☁️ Uploading %s to File Server...", a.gzName)
		if err := UploadFile(a.gzPath, a.gzName, a.uploadPath, FileServerURL, fileServerToken); err != nil {
			log.Fatalf("Upload failed: %v", err)
		}
		a.info.URL = fmt.Sprintf("%s/static/%s/%s", FileServerBase, a.uploadPath, a.gzName)
	}

	// PHASE 3 (7. KV UPDATE): Point the KV store at the new files, only after every upload succeeded.
	for _, a := range artifacts {
		vInfoBytes, _ := json.MarshalIndent(a.info, "", "  ")

		log.Printf("📝 Updating KV Store Key: %s", a.kvKey)
		if err := updateKeyValue(a.kvKey, vInfoBytes); err != nil {
			log.Fatalf("KV Update failed: %v", err)
		}

		log.Printf("✅ %s v%d deployed successfully!", a.kvKey, a.info.Version)
	}
	log.Printf("\n🎉 All %d builds (%d OS/Arch pairs x %d Services) compressed, hashed, and deployed successfully!", len(artifacts), len(targets), len(components))
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
	if _, err := io.Copy(part, file); err != nil {
		return err
	}

	if err := writer.WriteField("path", uploadPath); err != nil {
		return err
	}

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
	updater.SetBrowserHeaders(req)
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
	updater.SetBrowserHeaders(req)

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
