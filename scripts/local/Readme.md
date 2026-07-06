# Как запускать playwright локально

0. Склонируйте репозиторий LabkeeperEditor и запустите в нем dev-сервер на localhost:3000
1. Создать в корне репо файл ```.env``` за основу взять файл ```.env.example``` и наполнить переменными. Самое главное - указать ```E2E_HOST=http://nginx:80```
2. Установить Docker
3. В папке ```scipts/local``` выполнить команду

```bash
docker compose up
```

4. Теперь по адресу http://localhost:9237 доступен playwright ui - там можно запустить тесты
5. Кроме того, можно запускать тесты командой

```bash
docker compose exec playwright npx playwright test
```

# Как запускать playwright на продовый стенд

Все то же самое, как выше, но только переменная окружения ```E2E_HOST=https://labkeeper.io```