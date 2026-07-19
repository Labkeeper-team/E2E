FROM cr.yandex/crpjhav5dledksn6gaeo/labkeeper-e2e-base

WORKDIR /app

COPY ./playwright.config.ts /app/
COPY ./tests /app/tests

ENTRYPOINT ["npx", "playwright", "test"]
