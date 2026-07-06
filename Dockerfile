FROM cr.yandex/crpjhav5dledksn6gaeo/labkeeper-e2e-base

COPY ./tests /app/tests

ENTRYPOINT ["npx", "playwright", "test"]