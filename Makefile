# Makefile for ft_transcendence: build, run, logs, cleanup helpers for docker-compose services
#
# Usage:
#   make help                # show available targets
#   make up                  # build and start services (detached)
#   make down                # stop and remove containers (keep images)
#   make build               # build images (no cache)
#   make ps                  # show running containers (compose)
#   make logs                # follow docker-compose logs
#   make logs-backend        # follow backend container logs
#   make logs-frontend       # follow frontend container logs
#   make restart             # restart services (down then up)
#   make clean               # remove containers, images built by compose, and volumes
#   make prune               # dangerous: prune all docker unused objects (images, containers, volumes)
#
# Adjust variables below if your image/container names differ.

COMPOSE ?= docker-compose
BACKEND_IMAGE ?= ft_transcendence-backend
FRONTEND_IMAGE ?= ft_transcendence-frontend
BACKEND_CONTAINER ?= ft_backend
FRONTEND_CONTAINER ?= ft_frontend

.PHONY: help up down build ps logs logs-backend logs-frontend stop restart clean prune clean-containers clean-images clean-volumes kill-conflicts rebuild certs

help:
	@echo "Makefile targets:"
	@echo "  make up                Build and start services (detached)"
	@echo "  make down              Stop and remove containers (keeps images by default)"
	@echo "  make build             Build images (no cache)"
	@echo "  make ps                Show compose services"
	@echo "  make logs              Follow docker-compose logs"
	@echo "  make logs-backend      Follow backend container logs"
	@echo "  make logs-frontend     Follow frontend container logs"
	@echo "  make restart           Stop and then start services"
	@echo "  make clean             Stop, remove containers, images and volumes (compose down --rmi all -v)"
	@echo "  make prune             Docker system prune (images, containers, volumes) - USE WITH CAUTION"
	@echo "  make kill-conflicts    Force remove containers with same names (useful for name conflict errors)"
	@echo "  make rebuild           Clean then start fresh (clean + up)"

# Generate SSL certificates
certs:
	@echo "[make] Generating SSL certificates..."
	@chmod +x scripts/generate-certs.sh
	@./scripts/generate-certs.sh > /dev/null 2>&1

# Start services (generates certs first)
up: certs
	@echo "[make] Building and starting services..."
	$(COMPOSE) up -d --build
	@echo
	@echo "Site available at: https://localhost:8443"

# Stop services (keep images by default)
down:
	@echo "[make] Stopping and removing containers (keeping images)..."
	$(COMPOSE) down

build:
	@echo "[make] Building images (no cache)..."
	$(COMPOSE) build --no-cache
	@echo
	@echo "Site available at: https://localhost:8443"

ps:
	@echo "[make] Compose ps:"
	$(COMPOSE) ps

logs:
	@echo "[make] Following logs (compose)..."
	$(COMPOSE) logs -f

logs-backend:
	@echo "[make] Following backend logs (container: $(BACKEND_CONTAINER))..."
	-docker logs -f $(BACKEND_CONTAINER)

logs-frontend:
	@echo "[make] Following frontend logs (container: $(FRONTEND_CONTAINER))..."
	-docker logs -f $(FRONTEND_CONTAINER)

stop:
	@echo "[make] Stopping compose services..."
	$(COMPOSE) stop

restart: down up
	@echo "[make] Restart complete."

# Remove containers with conflicting names (forceful)
kill-conflicts:
	@echo "[make] Forcibly removing named containers if present: $(BACKEND_CONTAINER) $(FRONTEND_CONTAINER)"
	-@docker rm -f $(BACKEND_CONTAINER) $(FRONTEND_CONTAINER) 2>/dev/null || true

# Clean helpers
clean-containers:
	@echo "[make] Removing compose containers and orphans..."
	-$(COMPOSE) down --remove-orphans || true

clean-images:
	@echo "[make] Removing images: $(BACKEND_IMAGE) $(FRONTEND_IMAGE)"
	-@docker rmi -f $(BACKEND_IMAGE) $(FRONTEND_IMAGE) 2>/dev/null || true

clean-volumes:
	@echo "[make] Removing volumes created by docker-compose (use compose down -v)..."
	-$(COMPOSE) down -v || true

# Full clean: remove containers, images, volumes created by compose
clean: kill-conflicts
	@echo "[make] Full clean: compose down --rmi all -v --remove-orphans"
	-$(COMPOSE) down --rmi all -v --remove-orphans || true
	@echo "[make] Also attempting to remove named images and containers to clear conflicts..."
	-@docker rm -f $(BACKEND_CONTAINER) $(FRONTEND_CONTAINER) 2>/dev/null || true
	-@docker rmi -f $(BACKEND_IMAGE) $(FRONTEND_IMAGE) 2>/dev/null || true
	@echo "[make] Clean finished."

# Dangerous global prune
prune:
	@echo "[make] WARNING: Docker system prune - this will remove ALL unused images, containers and volumes."
	@read -p "Continue? (y/N) " ans; if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then docker system prune -af --volumes; else echo "Aborted prune."; fi

# Convenience: rebuild from scratch
rebuild: clean up
	@echo "[make] Rebuild complete."