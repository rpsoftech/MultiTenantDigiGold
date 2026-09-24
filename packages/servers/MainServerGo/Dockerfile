# Build Stage
# Go version must match the go directive in go.mod
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Install dependencies needed for CGO (if any) or basic alpine tools
RUN apk add --no-cache git

# Copy go.mod and go.sum first to leverage Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Go application
# CGO_ENABLED=0 ensures a static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o digigold-server ./cmd/api

# Final Stage
FROM alpine:latest

WORKDIR /root/

# Install CA certificates for HTTPS/Webhooks
RUN apk --no-cache add ca-certificates tzdata

# Copy the pre-built binary from the builder stage
COPY --from=builder /app/digigold-server .

# Expose the API port
EXPOSE 8080

# Command to run the executable
CMD ["./digigold-server"]
