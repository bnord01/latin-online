# Copyright (C) 2015 - 2016 The original authors
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

FROM node

RUN	mkdir -p /usr/src/app
WORKDIR	/usr/src/app

RUN	groupadd -r node \
	&& useradd --home /usr/src/app -r -g node node \
	&& chown -R node:node /usr/src/app

USER	node

# Install npm dependencies
COPY	package.json /usr/src/app/
RUN	npm install

# Install bower dependencies
COPY	bower.json /usr/src/app/
RUN	npm run bower -- install

# Copy the remaining files and build the application
COPY	. /usr/src/app
RUN	npm run	grunt -- dist

CMD [ "npm", "start" ]

EXPOSE 9001
