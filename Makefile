# Variables
DB_URL=postgres://postgres:postgres@localhost:5432/hackon?sslmode=disable
MIGRATIONS_DIR=./Server/migrations

.PHONY: run run-ml run-client dev up down migrate-up migrate-down create-migration

# Run the Go server
run:
	cd Server && go run main.go

# Run the Python ML Engine
run-ml:
	cd ml_engine && .\venv\Scripts\python.exe -m uvicorn main:app --reload

# Run the React Client
run-client:
	cd Client && npm run dev

# Start all 3 servers in separate terminal windows (Windows)
dev:
	start cmd /k "make run"
	start cmd /k "make run-ml"
	start cmd /k "make run-client"


# Start the docker containers in detached mode
up:
	docker-compose up -d

# Stop and remove the docker containers
down:
	docker-compose down

# Run database migrations up
migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" up

# Run database migrations down
migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DB_URL)" down

# Create a new migration file. Usage: make create-migration name=my_migration_name
create-migration:
	@if [ -z "$(name)" ]; then echo "name is required. Usage: make create-migration name=migration_name"; exit 1; fi
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)
