package architecture

import (
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestDDDDependencyDirection(t *testing.T) {
	internalRoot := filepath.Clean("..")
	err := filepath.WalkDir(internalRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		layer := layerFromPath(filepath.ToSlash(path))
		if layer == "" {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, imported := range file.Imports {
			importPath, err := strconv.Unquote(imported.Path.Value)
			if err != nil {
				return err
			}
			if violation := forbiddenDependency(layer, importPath); violation != "" {
				t.Errorf("%s: %s imports %q (%s)", path, layer, importPath, violation)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func layerFromPath(path string) string {
	for _, layer := range []string{"/domain/", "/application/", "/infrastructure/"} {
		if strings.Contains(path, layer) {
			return strings.Trim(layer, "/")
		}
	}
	return ""
}

func forbiddenDependency(layer, importPath string) string {
	if layer == "domain" && strings.Contains(strings.Split(importPath, "/")[0], ".") {
		return "domain packages may only use the standard library"
	}
	if !strings.HasPrefix(importPath, "kerjo/backend/internal/") {
		return ""
	}
	switch layer {
	case "domain":
		return "domain packages may only use the standard library"
	case "application":
		if strings.Contains(importPath, "/infrastructure/") ||
			strings.Contains(importPath, "/transport/") ||
			strings.Contains(importPath, "/platform/") {
			return "application packages may depend on domain contracts, not outer adapters"
		}
	case "infrastructure":
		if strings.Contains(importPath, "/transport/") {
			return "infrastructure packages must not depend on inbound transport adapters"
		}
	}
	return ""
}
