package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"

	utility_functions_gzip "github.com/rpsoftech/DigiGold/MainServerGo/utility/functions/gzip"
)

type KVResponse struct {
	Version int    `json:"version"`
	URL     string `json:"url"`
	SHA256  string `json:"sha256"`
}

// HashFile is a great utility function for general use, but we will skip it
// during the OTA update to avoid double-reading the disk.
func HashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func GetFileKey(component string, os string, arch string) string {
	return fmt.Sprintf("digigold_%s_%s_%s", component, os, arch)
}

func CheckAndUpdate(kvBaseURL string, componentName string, currentVersion int) (bool, error) {
	osName := runtime.GOOS
	archName := runtime.GOARCH
	kvKey := GetFileKey(componentName, osName, archName)
	kvServerURL := kvBaseURL + kvKey

	log.Printf("🔍 Checking for updates at KV Key: %s", kvKey)

	// 1. Fetch latest version info from KV Server
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(kvServerURL)
	if err != nil {
		return false, fmt.Errorf("failed to reach KV server: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("KV server returned status: %d", resp.StatusCode)
	}

	var kvData KVResponse
	if err := json.NewDecoder(resp.Body).Decode(&kvData); err != nil {
		return false, fmt.Errorf("invalid KV response: %w", err)
	}

	// 2. Compare Integer Versions
	if currentVersion >= kvData.Version {
		log.Printf("✅ %s binary is up to date (Version %d).\n", componentName, currentVersion)
		return false, nil
	}

	log.Printf("⚠️ Update found for %s! Current: v%d | Latest: v%d\n", componentName, currentVersion, kvData.Version)

	exePath, err := os.Executable()
	if err != nil {
		return false, fmt.Errorf("failed to get executable path: %w", err)
	}

	gzTmpPath := exePath + ".gz.tmp"
	binTmpPath := exePath + ".tmp"

	defer os.Remove(gzTmpPath)
	defer os.Remove(binTmpPath)

	// 3. Download the GZIP archive
	log.Printf("📥 Downloading update from %s...", kvData.URL)
	downloadResp, err := client.Get(kvData.URL)
	if err != nil {
		return false, fmt.Errorf("failed to download update: %w", err)
	}
	defer downloadResp.Body.Close()

	gzFile, err := os.Create(gzTmpPath)
	if err != nil {
		return false, fmt.Errorf("failed to create temp gz file: %w", err)
	}

	// 4. THE OPTIMIZATION: Hash the file exactly as it streams from the internet
	h := sha256.New()
	multiWriter := io.MultiWriter(gzFile, h)

	if _, err := io.Copy(multiWriter, downloadResp.Body); err != nil {
		gzFile.Close()
		return false, fmt.Errorf("download interrupted: %w", err)
	}
	gzFile.Close()

	// 5. Verify the SHA256 integrity using the hash we just calculated in RAM
	downloadedHash := hex.EncodeToString(h.Sum(nil))

	if downloadedHash != kvData.SHA256 {
		return false, fmt.Errorf("SECURITY ALERT: Downloaded file hash mismatch. Expected %s, got %s", kvData.SHA256, downloadedHash)
	}
	log.Println("✅ Download integrity verified.")

	// 6. Extract the GZIP archive using your unified helper
	err = utility_functions_gzip.GzipDecompressFile(gzTmpPath, binTmpPath)
	if err != nil {
		return false, fmt.Errorf("failed to decompress update: %w", err)
	}

	// 7. Make the extracted binary executable (Ignored on Windows)
	if runtime.GOOS != "windows" {
		if err := os.Chmod(binTmpPath, 0755); err != nil {
			return false, fmt.Errorf("failed to set executable permissions: %w", err)
		}
	}

	// 8. OS-Aware Atomic Replace
	if runtime.GOOS == "windows" {
		oldPath := exePath + ".old"
		os.Remove(oldPath)
		if err := os.Rename(exePath, oldPath); err != nil {
			return false, fmt.Errorf("failed to move running Windows binary: %w", err)
		}
	}

	if err := os.Rename(binTmpPath, exePath); err != nil {
		return false, fmt.Errorf("failed to replace binary: %w", err)
	}

	log.Printf("🚀 Update successfully extracted and installed! Please restart the %s service.", componentName)
	return true, nil
}
