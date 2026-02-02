#!/usr/bin/env bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

# import utils
# test network home var targets to test network folder
# the reason we use a var here is considering with org3 specific folder
# when invoking this for org3 as test-network/scripts/org3-scripts
# the value is changed from default as $PWD(test-network)
# to .. as relative path to make the import works
TEST_NETWORK_HOME=${TEST_NETWORK_HOME:-${PWD}}
. ${TEST_NETWORK_HOME}/scripts/envVar.sh

# fetchChannelConfig <org> <channel_id> <output_json>
# Writes the current channel config for a given channel to a JSON file
# NOTE: this requires jq and configtxlator for execution.
fetchChannelConfig() {
  ORG=$1
  CHANNEL=$2
  OUTPUT=$3

  setGlobals $ORG

  infoln "Fetching the most recent configuration block for the channel"
  mkdir -p ${TEST_NETWORK_HOME}/channel-artifacts
  local rc=1
  local counter=1
  local max_retry=${MAX_RETRY:-5}
  local delay=${FETCH_CHANNEL_DELAY:-3}

  while [ $rc -ne 0 ] && [ $counter -le $max_retry ]; do
    set -x
    peer channel fetch config ${TEST_NETWORK_HOME}/channel-artifacts/config_block.pb -o localhost:8055 --ordererTLSHostnameOverride orderer.raft -c $CHANNEL --tls --cafile "$ORDERER_CA"
    rc=$?
    { set +x; } 2>/dev/null

    if [ $rc -ne 0 ] && [ $counter -lt $max_retry ]; then
      warnln "Channel configuration block not yet available (attempt ${counter}/${max_retry}). Retrying in ${delay}s ..."
      sleep $delay
    fi

    counter=$((counter + 1))
  done

  verifyResult $rc "Failed to fetch channel configuration block, ensure the channel exists and the peer CLI is configured correctly"

  infoln "Decoding config block to JSON and isolating config to ${OUTPUT}"
  set -x
  configtxlator proto_decode --input ${TEST_NETWORK_HOME}/channel-artifacts/config_block.pb --type common.Block --output ${TEST_NETWORK_HOME}/channel-artifacts/config_block.json
  jq .data.data[0].payload.data.config ${TEST_NETWORK_HOME}/channel-artifacts/config_block.json >"${OUTPUT}"
  res=$?
  { set +x; } 2>/dev/null
  verifyResult $res "Failed to parse channel configuration, make sure you have jq installed"
}

# createConfigUpdate <channel_id> <original_config.json> <modified_config.json> <output.pb>
# Takes an original and modified config, and produces the config update tx
# which transitions between the two
# NOTE: this requires jq and configtxlator for execution.
createConfigUpdate() {
  CHANNEL=$1
  ORIGINAL=$2
  MODIFIED=$3
  OUTPUT=$4

  set -x
  configtxlator proto_encode --input "${ORIGINAL}" --type common.Config --output ${TEST_NETWORK_HOME}/channel-artifacts/original_config.pb
  configtxlator proto_encode --input "${MODIFIED}" --type common.Config --output ${TEST_NETWORK_HOME}/channel-artifacts/modified_config.pb
  configtxlator compute_update --channel_id "${CHANNEL}" --original ${TEST_NETWORK_HOME}/channel-artifacts/original_config.pb --updated ${TEST_NETWORK_HOME}/channel-artifacts/modified_config.pb --output ${TEST_NETWORK_HOME}/channel-artifacts/config_update.pb
  configtxlator proto_decode --input ${TEST_NETWORK_HOME}/channel-artifacts/config_update.pb --type common.ConfigUpdate --output ${TEST_NETWORK_HOME}/channel-artifacts/config_update.json
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL'", "type":2}},"data":{"config_update":'$(cat ${TEST_NETWORK_HOME}/channel-artifacts/config_update.json)'}}}' | jq . > ${TEST_NETWORK_HOME}/channel-artifacts/config_update_in_envelope.json
  configtxlator proto_encode --input ${TEST_NETWORK_HOME}/channel-artifacts/config_update_in_envelope.json --type common.Envelope --output "${OUTPUT}"
  { set +x; } 2>/dev/null
}

# signConfigtxAsPeerOrg <org> <configtx.pb>
# Set the peerOrg admin of an org and sign the config update
signConfigtxAsPeerOrg() {
  ORG=$1
  CONFIGTXFILE=$2
  setGlobals $ORG
  set -x
  peer channel signconfigtx -f "${CONFIGTXFILE}"
  { set +x; } 2>/dev/null
}

