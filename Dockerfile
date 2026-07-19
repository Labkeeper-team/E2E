FROM cr.yandex/crpjhav5dledksn6gaeo/labkeeper-e2e-base

WORKDIR /app

COPY ./package.json ./package-lock.json ./playwright.config.ts /app/
RUN npm ci

COPY ./tests /app/tests

ENTRYPOINT ["npx", "playwright", "test"]
