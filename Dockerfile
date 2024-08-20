FROM node:18

COPY . /usr/src/app

WORKDIR /usr/src/app

RUN yarn install --non-interactive --frozen-lockfile

COPY $PWD/sh/docker/init.sh /usr/local/bin

ENTRYPOINT ["/bin/sh", "/usr/local/bin/init.sh"]