#!/usr/bin/env bash


channel_name=$1

export PATH=${ROOTDIR}/../bin:${PWD}/../bin:$PATH
export ORDERER_ADMIN_TLS_SIGN_CERT=${PWD}/organizations/ordererOrganizations/fabric3.variant/orderers/orderer.fabric3.variant/tls/server.crt
export ORDERER_ADMIN_TLS_PRIVATE_KEY=${PWD}/organizations/ordererOrganizations/fabric3.variant/orderers/orderer.fabric3.variant/tls/server.key

osnadmin channel join --channelID ${channel_name} --config-block ./channel-artifacts/${channel_name}.block -o localhost:8253 --ca-file "$ORDERER_CA" --client-cert "$ORDERER_ADMIN_TLS_SIGN_CERT" --client-key "$ORDERER_ADMIN_TLS_PRIVATE_KEY" >> log.txt 2>&1
