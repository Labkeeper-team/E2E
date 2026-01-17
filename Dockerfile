FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

COPY ./tests /app/tests
COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json
COPY ./playwright.config.ts /app/playwright.config.ts

RUN npm i

ENTRYPOINT ["npx", "playwright", "test"]