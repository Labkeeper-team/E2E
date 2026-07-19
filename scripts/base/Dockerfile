FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

COPY package.json package-lock.json playwright.config.ts /app/

RUN npm ci \
    && npx playwright install msedge chrome
