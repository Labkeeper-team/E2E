FROM cr.yandex/crpjhav5dledksn6gaeo/labkeeper-e2e-base:alpha

WORKDIR /app

COPY ./tests /app/tests

ENTRYPOINT ["npx", "playwright", "test"]
