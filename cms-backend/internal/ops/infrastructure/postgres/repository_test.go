package postgres

import (
	"strings"
	"testing"

	"kerjo/cms-backend/internal/ops/domain"
)

func TestListSQLWhitelistsResourcesAndOmitsSensitiveContent(t *testing.T) {
	query, count, args, err := listSQL("messages", map[string]string{"kind": "schedule"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(query, "m.text") || strings.Contains(query, "note") {
		t.Fatalf("message query exposes content: %s", query)
	}
	if !strings.Contains(count, "COUNT(*)") || len(args) != 1 {
		t.Fatalf("unexpected count or args: %s %#v", count, args)
	}
	if _, _, _, err := listSQL("arbitrary_table", nil); err != domain.ErrInvalidInput {
		t.Fatalf("unknown resource error = %v", err)
	}
}

func TestListSQLMatchesFiltersActiveJobsAndSearchesNames(t *testing.T) {
	query, _, args, err := listSQL("matches", map[string]string{"status": "active", "q": "Prayoga"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(query, "m.job_done = FALSE") || !strings.Contains(query, "wu.name") {
		t.Fatalf("matches query missing status or name search: %s", query)
	}
	if len(args) != 8 || args[0] != "%Prayoga%" {
		t.Fatalf("matches search args = %#v", args)
	}
}

func TestListSQLUsesParametersForFilters(t *testing.T) {
	query, _, args, err := listSQL("users", map[string]string{"q": "x%' OR true --", "status": "active"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(query, "OR true") || len(args) != 2 || args[0] != "%x%' OR true --%" {
		t.Fatalf("unsafe query or args: %s %#v", query, args)
	}
}
