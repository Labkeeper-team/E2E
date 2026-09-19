# Как запускать Playwright локально

0. Склонируйте репозиторий LabkeeperEditor и запустите в нем dev-сервер на `localhost:3000`.
1. Создайте в корне E2E-репозитория файл `.env` на основе `.env.example`.
2. Для локального фронтенда укажите `E2E_HOST=http://nginx:80`.
3. Оставьте `ENABLE_LANDING_TESTS` пустой: лендинг отдается только production, а локальный nginx отдает на `/` фронтенд редактора. С выставленной переменной лендинговые сценарии здесь всегда падают по таймауту.
4. Установите Docker.
5. Из корня E2E-репозитория выполните:

```bash
docker compose -f scripts/local/docker-compose.yml up --build
```

6. По адресу `http://localhost:9237` будет доступен Playwright UI.
7. Тесты также можно запустить командой:

```bash
docker compose -f scripts/local/docker-compose.yml exec playwright npx playwright test
```

# Как запускать Playwright на production

Используйте те же команды, но установите `E2E_HOST=https://labkeeper.io` и `ENABLE_LANDING_TESTS=1`.
