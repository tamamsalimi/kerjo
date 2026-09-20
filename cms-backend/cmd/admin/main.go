package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"kerjo/cms-backend/internal/config"
	opsapp "kerjo/cms-backend/internal/ops/application"
	opspostgres "kerjo/cms-backend/internal/ops/infrastructure/postgres"
	"kerjo/cms-backend/internal/platform/database"
)

func main() {
	_ = godotenv.Load()
	cfg, err := config.Load()
	if err != nil {
		fatal(err)
	}
	db, sqlDB, err := database.Open(context.Background(), database.Options{
		URL: cfg.DatabaseURL, MaxOpenConns: 2, MaxIdleConns: 1, ConnMaxLifetime: 5 * time.Minute,
	})
	if err != nil {
		fatal(err)
	}
	defer sqlDB.Close()
	service := opsapp.New(opspostgres.New(db), cfg.SessionTTL)
	reader := bufio.NewReader(os.Stdin)
	for {
		fmt.Println("\nCMS admin: [1] create [2] list [3] disable [4] enable [5] reset-password [q] quit")
		switch option := prompt(reader, "> "); option {
		case "1":
			email := prompt(reader, "Email: ")
			role := prompt(reader, "Role (superadmin/moderator/reviewer): ")
			password := passwordPrompt(reader, "Password (minimum 12 characters): ")
			admin, err := service.CreateAdmin(context.Background(), email, password, role)
			if err != nil {
				fmt.Println("Error:", err)
			} else {
				fmt.Printf("Created admin %d (%s)\n", admin.ID, admin.Email)
			}
		case "2":
			admins, err := service.ListAdmins(context.Background())
			if err != nil {
				fmt.Println("Error:", err)
				continue
			}
			for _, admin := range admins {
				state := "active"
				if admin.DisabledAt != nil {
					state = "disabled"
				}
				fmt.Printf("%d\t%s\t%s\t%s\n", admin.ID, admin.Email, admin.Role, state)
			}
		case "3", "4":
			id, err := strconv.ParseInt(prompt(reader, "Admin ID: "), 10, 64)
			if err != nil {
				fmt.Println("Invalid ID")
				continue
			}
			if err := service.DisableAdmin(context.Background(), id, option == "3"); err != nil {
				fmt.Println("Error:", err)
			} else {
				fmt.Println("Updated.")
			}
		case "5":
			id, err := strconv.ParseInt(prompt(reader, "Admin ID: "), 10, 64)
			if err != nil {
				fmt.Println("Invalid ID")
				continue
			}
			password := passwordPrompt(reader, "New password (minimum 12 characters): ")
			if err := service.ResetPassword(context.Background(), id, password); err != nil {
				fmt.Println("Error:", err)
			} else {
				fmt.Println("Password reset; existing sessions revoked.")
			}
		case "q", "quit", "exit":
			return
		default:
			fmt.Println("Unknown option.")
		}
	}
}

func prompt(reader *bufio.Reader, label string) string {
	fmt.Print(label)
	value, _ := reader.ReadString('\n')
	return strings.TrimSpace(value)
}

func passwordPrompt(reader *bufio.Reader, label string) string {
	fmt.Print(label)
	hide := exec.Command("stty", "-echo")
	hide.Stdin = os.Stdin
	if hide.Run() == nil {
		defer func() {
			show := exec.Command("stty", "echo")
			show.Stdin = os.Stdin
			_ = show.Run()
			fmt.Println()
		}()
	}
	value, _ := reader.ReadString('\n')
	return strings.TrimSpace(value)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "Error:", err)
	os.Exit(1)
}
