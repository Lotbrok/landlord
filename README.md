# 🏙 LANDLORD — Полная инструкция по деплою

## Архитектура на сервере

```
Internet
   │
   ▼
Nginx (хост) ── cyphorium.com         → твой текущий сайт (не трогаем)
             └─ landlord.cyphorium.com → 127.0.0.1:3000
                                               │
                                     ┌─────────▼──────────┐
                                     │   Docker Compose    │
                                     │  ┌──────────────┐  │
                                     │  │ landlord_app │  │  Node.js :3000
                                     │  └──────┬───────┘  │
                                     │         │           │
                                     │  ┌──────▼───────┐  │
                                     │  │ landlord_db  │  │  PostgreSQL (внутри)
                                     │  └──────────────┘  │
                                     └────────────────────┘
```

Текущий сайт на cyphorium.com **не затрагивается** — игра живёт в отдельных
Docker-контейнерах и отвечает только на поддомен.

---

## 1. Установить Docker на сервер

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Git-репозиторий

Создать репо на GitHub/GitLab, затем:

```bash
# На локальной машине — первый push
git init
git remote add origin https://github.com/ВАШ_ЮЗЕР/landlord.git
git add .
git commit -m "Initial commit"
git push -u origin main

# На сервере — клонировать
cd /srv
git clone https://github.com/ВАШ_ЮЗЕР/landlord.git
cd landlord
```

---

## 3. Переменные окружения

```bash
cp .env.example .env
nano .env
```

```env
DB_HOST=db
DB_PORT=5432
DB_NAME=landlord
DB_USER=landlord_user
DB_PASSWORD=придумай_длинный_пароль

JWT_SECRET=минимум_32_символа   # openssl rand -hex 32
JWT_EXPIRES_IN=7d

PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://landlord.cyphorium.com

INCOME_TICK_SECONDS=10
STARTING_BALANCE=10000
```

---

## 4. Первый запуск

```bash
cd /srv/landlord
docker compose up -d --build
```

Это автоматически: поднимет PostgreSQL → запустит миграции → загрузит объекты → стартует сервер.

```bash
docker compose logs -f app   # проверить
```

---

## 5. DNS + Nginx + SSL

**DNS** — добавить A-запись:
```
landlord  →  186.246.22.56
```

**Nginx:**
```bash
sudo cp /srv/landlord/nginx.conf /etc/nginx/sites-available/landlord
sudo ln -s /etc/nginx/sites-available/landlord /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**SSL:**
```bash
sudo certbot --nginx -d landlord.cyphorium.com
```

Готово: **https://landlord.cyphorium.com** 🎉

---

## 6. Деплой обновлений

```bash
# Локально
git add . && git commit -m "правки" && git push

# На сервере
cd /srv/landlord && ./deploy.sh
```

---

## 7. Полезные команды

```bash
docker compose ps                        # статус
docker compose logs -f app               # логи
docker compose restart app               # перезапустить
docker compose exec db psql -U landlord_user -d landlord  # войти в БД
docker compose down                      # остановить (данные сохранятся)
```

**Бэкап БД:**
```bash
docker compose exec db pg_dump -U landlord_user landlord > backup_$(date +%Y%m%d).sql
```
