FROM node

RUN	mkdir -p /usr/src/app
WORKDIR	/usr/src/app

RUN	groupadd -r node \
	&& useradd --home /usr/src/app -r -g node node \
	&& chown -R node:node /usr/src/app

USER	node

# Install npm dependencies
COPY	package.json /usr/src/app/
RUN	npm install --ignore-scripts

# Install bower dependencies
COPY	bower.json /usr/src/app/
RUN	node node_modules/bower/bin/bower install

# Add the remaining files
COPY	. /usr/src/app

CMD [ "npm", "start" ]

EXPOSE 3000
