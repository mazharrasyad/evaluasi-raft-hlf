#!/usr/bin/env bash
#
# SPDX-License-Identifier: Apache-2.0

# default ke Org1
ORG=${1:-Org1}

# Exit on first error
set -e
set -o pipefail

# Path project saat ini
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# --- UPDATE: semua path mengarah ke network/organizations ---
ORDERER_CA=${DIR}/network/organizations-variant/ordererOrganizations/smartbft/tlsca/tlsca.smartbft-cert.pem
PEER0_ORG1_CA=${DIR}/network/organizations-variant/peerOrganizations/org1.smartbft/tlsca/tlsca.org1.smartbft-cert.pem
PEER0_ORG2_CA=${DIR}/network/organizations-variant/peerOrganizations/org2.smartbft/tlsca/tlsca.org2.smartbft-cert.pem
PEER0_ORG3_CA=${DIR}/network/organizations-variant/peerOrganizations/org3.smartbft/tlsca/tlsca.org3.smartbft-cert.pem

if [[ ${ORG,,} == "org1" || ${ORG,,} == "digibank" ]]; then
   CORE_PEER_LOCALMSPID=Org1MSP
   CORE_PEER_MSPCONFIGPATH=${DIR}/network/organizations-variant/peerOrganizations/org1.smartbft/users/Admin@org1.smartbft/msp
   CORE_PEER_ADDRESS=localhost:7353
   CORE_PEER_TLS_ROOTCERT_FILE=${DIR}/network/organizations-variant/peerOrganizations/org1.smartbft/tlsca/tlsca.org1.smartbft-cert.pem

elif [[ ${ORG,,} == "org2" || ${ORG,,} == "magnetocorp" ]]; then
   CORE_PEER_LOCALMSPID=Org2MSP
   CORE_PEER_MSPCONFIGPATH=${DIR}/network/organizations-variant/peerOrganizations/org2.smartbft/users/Admin@org2.smartbft/msp
   CORE_PEER_ADDRESS=localhost:9553
   CORE_PEER_TLS_ROOTCERT_FILE=${DIR}/network/organizations-variant/peerOrganizations/org2.smartbft/tlsca/tlsca.org2.smartbft-cert.pem

else
   echo "Unknown \"$ORG\", please choose Org1/Digibank or Org2/Magnetocorp"
   echo "Contoh:  ./setOrgEnv.sh Org2"
   echo
   echo "Atau otomatis: export \$(./setOrgEnv.sh Org2 | xargs)"
   exit 1
fi

# Output environment
echo "CORE_PEER_TLS_ENABLED=true"
echo "ORDERER_CA=${ORDERER_CA}"
echo "PEER0_ORG1_CA=${PEER0_ORG1_CA}"
echo "PEER0_ORG2_CA=${PEER0_ORG2_CA}"
echo "PEER0_ORG3_CA=${PEER0_ORG3_CA}"
echo "CORE_PEER_MSPCONFIGPATH=${CORE_PEER_MSPCONFIGPATH}"
echo "CORE_PEER_ADDRESS=${CORE_PEER_ADDRESS}"
echo "CORE_PEER_TLS_ROOTCERT_FILE=${CORE_PEER_TLS_ROOTCERT_FILE}"
echo "CORE_PEER_LOCALMSPID=${CORE_PEER_LOCALMSPID}"

