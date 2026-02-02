FROM node:18-alpine

WORKDIR /chaincode

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ARG CC_SERVER_PORT=9999
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:${CC_SERVER_PORT}

EXPOSE ${CC_SERVER_PORT}

CMD ["sh", "-c", "node_modules/.bin/fabric-chaincode-node server --chaincode-address ${CHAINCODE_SERVER_ADDRESS} --chaincode-id ${CORE_CHAINCODE_ID_NAME}"]
