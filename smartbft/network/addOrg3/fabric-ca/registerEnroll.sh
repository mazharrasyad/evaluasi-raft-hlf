#!/usr/bin/env bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

function createOrg3 {
	infoln "Enrolling the CA admin"
	mkdir -p ../organizations-variant/peerOrganizations/org3.smartbft/

	export FABRIC_CA_CLIENT_HOME=${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/

  set -x
  fabric-ca-client enroll -u https://admin:adminpw@localhost:11154 --caname ca-org3 --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  echo 'NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-11154-ca-org3.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-11154-ca-org3.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-11154-ca-org3.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-11154-ca-org3.pem
    OrganizationalUnitIdentifier: orderer' > "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/config.yaml"

	infoln "Registering peer0"
  set -x
	fabric-ca-client register --caname ca-org3 --id.name peer0 --id.secret peer0pw --id.type peer --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Registering user"
  set -x
  fabric-ca-client register --caname ca-org3 --id.name user1 --id.secret user1pw --id.type client --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Registering the org admin"
  set -x
  fabric-ca-client register --caname ca-org3 --id.name org3admin --id.secret org3adminpw --id.type admin --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  infoln "Generating the peer0 msp"
  set -x
	fabric-ca-client enroll -u https://peer0:peer0pw@localhost:11154 --caname ca-org3 -M "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/msp" --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/config.yaml" "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/msp/config.yaml"

  infoln "Generating the peer0-tls certificates, use --csr.hosts to specify Subject Alternative Names"
  set -x
  fabric-ca-client enroll -u https://peer0:peer0pw@localhost:11154 --caname ca-org3 -M "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls" --enrollment.profile tls --csr.hosts peer0.org3.smartbft --csr.hosts localhost --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null


  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/tlscacerts/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/ca.crt"
  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/signcerts/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/server.crt"
  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/keystore/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/server.key"

  mkdir "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/tlscacerts"
  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/tlscacerts/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/tlscacerts/ca.crt"

  mkdir "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/tlsca"
  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/tls/tlscacerts/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/tlsca/tlsca.org3.smartbft-cert.pem"

  mkdir "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/ca"
  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/peers/peer0.org3.smartbft/msp/cacerts/"* "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/ca/ca.org3.smartbft-cert.pem"

  infoln "Generating the user msp"
  set -x
	fabric-ca-client enroll -u https://user1:user1pw@localhost:11154 --caname ca-org3 -M "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/users/User1@org3.smartbft/msp" --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/config.yaml" "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/users/User1@org3.smartbft/msp/config.yaml"

  infoln "Generating the org admin msp"
  set -x
	fabric-ca-client enroll -u https://org3admin:org3adminpw@localhost:11154 --caname ca-org3 -M "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/users/Admin@org3.smartbft/msp" --tls.certfiles "${PWD}/fabric-ca/org3/tls-cert.pem"
  { set +x; } 2>/dev/null

  cp "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/msp/config.yaml" "${PWD}/../organizations-variant/peerOrganizations/org3.smartbft/users/Admin@org3.smartbft/msp/config.yaml"
}

