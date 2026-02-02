#!/usr/bin/env bash

function one_line_pem {
    echo "`awk 'NF {sub(/\\n/, ""); printf "%s\\\\\\\n",$0;}' $1`"
}

function json_ccp {
    local PP=$(one_line_pem $4)
    local CP=$(one_line_pem $5)
    sed -e "s/\${ORG}/$1/" \
        -e "s/\${P0PORT}/$2/" \
        -e "s/\${CAPORT}/$3/" \
        -e "s#\${PEERPEM}#$PP#" \
        -e "s#\${CAPEM}#$CP#" \
        organizations-variant/ccp-template.json
}

function yaml_ccp {
    local PP=$(one_line_pem $4)
    local CP=$(one_line_pem $5)
    sed -e "s/\${ORG}/$1/" \
        -e "s/\${P0PORT}/$2/" \
        -e "s/\${CAPORT}/$3/" \
        -e "s#\${PEERPEM}#$PP#" \
        -e "s#\${CAPEM}#$CP#" \
        organizations-variant/ccp-template.yaml | sed -e $'s/\\\\n/\\\n          /g'
}

ORG=1
P0PORT=7353
CAPORT=7354
PEERPEM=organizations-variant/peerOrganizations/org1.smartbft/tlsca/tlsca.org1.smartbft-cert.pem
CAPEM=organizations-variant/peerOrganizations/org1.smartbft/ca/ca.org1.smartbft-cert.pem

echo "$(json_ccp $ORG $P0PORT $CAPORT $PEERPEM $CAPEM)" > organizations-variant/peerOrganizations/org1.smartbft/connection-org1.json
echo "$(yaml_ccp $ORG $P0PORT $CAPORT $PEERPEM $CAPEM)" > organizations-variant/peerOrganizations/org1.smartbft/connection-org1.yaml

ORG=2
P0PORT=9553
CAPORT=8354
PEERPEM=organizations-variant/peerOrganizations/org2.smartbft/tlsca/tlsca.org2.smartbft-cert.pem
CAPEM=organizations-variant/peerOrganizations/org2.smartbft/ca/ca.org2.smartbft-cert.pem

echo "$(json_ccp $ORG $P0PORT $CAPORT $PEERPEM $CAPEM)" > organizations-variant/peerOrganizations/org2.smartbft/connection-org2.json
echo "$(yaml_ccp $ORG $P0PORT $CAPORT $PEERPEM $CAPEM)" > organizations-variant/peerOrganizations/org2.smartbft/connection-org2.yaml

