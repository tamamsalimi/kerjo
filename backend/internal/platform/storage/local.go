package storage

import (
	"context"
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type Store interface {
	Put(context.Context, string, []byte, string) error
	Get(context.Context, string) ([]byte, string, error)
}

type Local struct {
	root string
}

func NewLocal(root string) *Local {
	return &Local{root: root}
}

func (s *Local) Put(_ context.Context, objectPath string, data []byte, _ string) error {
	target, err := s.path(objectPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	return os.WriteFile(target, data, 0o600)
}

func (s *Local) Get(_ context.Context, objectPath string) ([]byte, string, error) {
	target, err := s.path(objectPath)
	if err != nil {
		return nil, "", err
	}
	data, err := os.ReadFile(target)
	if err != nil {
		return nil, "", err
	}
	contentType := mime.TypeByExtension(filepath.Ext(target))
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	return data, contentType, nil
}

func (s *Local) path(objectPath string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(objectPath))
	if clean == "." || filepath.IsAbs(clean) || clean == ".." ||
		strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", errors.New("invalid object path")
	}
	return filepath.Join(s.root, clean), nil
}
