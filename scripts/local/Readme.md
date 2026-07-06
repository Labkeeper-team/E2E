# Как запускать playwright локально

1. Создать в корне репо файл ```.env``` за основу взять файл ```.env.example``` и наполнить переменными
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