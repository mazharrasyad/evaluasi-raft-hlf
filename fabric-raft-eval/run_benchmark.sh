#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
NETWORK_DIR="$ROOT_DIR/network"
COMPOSE_FILE="$NETWORK_DIR/docker/docker-compose.yaml"
CALIPER_WORKSPACE="$ROOT_DIR/caliper-workspace"
CALIPER_BENCHMARK="$ROOT_DIR/caliper-benchmarks/benchmark.yaml"
RESULTS_DIR="$ROOT_DIR/results"
SCENARIOS=("raft_standard" "raft_variant")

mkdir -p "$RESULTS_DIR"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

require_tools() {
    local missing=()
    for tool in docker npx jq; do
        if ! command_exists "$tool"; then
            missing+=("$tool")
        fi
    done
    if ! docker compose version >/dev/null 2>&1; then
        missing+=("docker compose")
    fi
    if ((${#missing[@]} > 0)); then
        echo "Missing required tools: ${missing[*]}" >&2
        echo "Please install the required tools before running the benchmark." >&2
        exit 1
    fi
}

prepare_crypto_material() {
    if [ -d "$NETWORK_DIR/crypto/ordererOrganizations" ]; then
        echo "Crypto material already present, skipping generation."
        return
    fi
    echo "[WARN] Crypto material generation is not automated in this script." >&2
    echo "Please populate $NETWORK_DIR/crypto using Fabric CA or cryptogen before executing benchmarks." >&2
}

apply_raft_profile() {
    local scenario="$1"
    case "$scenario" in
        raft_standard)
            cp "$NETWORK_DIR/config/raft_standard_orderer.yaml" "$NETWORK_DIR/config/current_orderer.yaml"
            ;;
        raft_variant)
            cp "$NETWORK_DIR/config/raft_variant_orderer.yaml" "$NETWORK_DIR/config/current_orderer.yaml"
            ;;
        *)
            echo "Unknown scenario: $scenario" >&2
            exit 1
            ;;
    esac
}

start_network() {
    docker compose -f "$COMPOSE_FILE" up -d
}

stop_network() {
    docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
}

package_chaincode() {
    docker exec cli peer lifecycle chaincode package report.tar.gz \
        --path /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode \
        --lang golang --label report_1.0 || true
}

deploy_chaincode_placeholder() {
    cat <<'MSG'
[INFO] Chaincode deployment must be completed manually.
       Use the Fabric CLI container to install, approve, and commit the chaincode before running Caliper.
MSG
}

run_caliper() {
    local scenario="$1"
    local scenario_dir="$RESULTS_DIR/$scenario"
    mkdir -p "$scenario_dir"

    npx caliper launch manager \
        --caliper-bind-sut fabric:3.0 \
        --caliper-workspace "$ROOT_DIR" \
        --caliper-networkconfig "$CALIPER_WORKSPACE/config.yaml" \
        --caliper-benchconfig "$CALIPER_BENCHMARK" \
        --caliper-flow-only-test

    if [ -f "$ROOT_DIR/report.json" ]; then
        mv "$ROOT_DIR/report.json" "$scenario_dir/caliper-report.json"
    fi

    if [ -f "$scenario_dir/caliper-report.json" ]; then
        jq -r '.summary.succ | to_entries | map([.key, .value.tps, .value.latency.average]) | (["Round","Throughput","Latency"]) + (.|map(@csv)) | @text' \
            "$scenario_dir/caliper-report.json" > "$scenario_dir/throughput_latency.csv" || true
        jq '.resource|{cpu:.cpu, memory:.memory}' "$scenario_dir/caliper-report.json" > "$scenario_dir/resource_usage.json" || true

        local csv_file="$RESULTS_DIR/throughput_latency.csv"
        if [ ! -f "$csv_file" ]; then
            echo "Scenario,Round,Throughput,Latency" > "$csv_file"
        fi
        jq -r --arg scenario "$scenario" '.summary.succ | to_entries | map([$scenario, .key, (.value.tps|tostring), (.value.latency.average|tostring)]) | .[] | @csv' \
            "$scenario_dir/caliper-report.json" >> "$csv_file" || true

        local resource_json="$RESULTS_DIR/resource_usage.json"
        local cpu
        local memory
        cpu=$(jq -r '.resource.cpu // empty' "$scenario_dir/caliper-report.json" 2>/dev/null || true)
        memory=$(jq -r '.resource.memory // empty' "$scenario_dir/caliper-report.json" 2>/dev/null || true)
        if [ ! -s "$resource_json" ]; then
            echo "[]" > "$resource_json"
        fi
        if [ -n "$cpu" ] || [ -n "$memory" ]; then
            jq --arg scenario "$scenario" --arg cpu "$cpu" --arg memory "$memory" '
                . + [{
                    scenario: $scenario,
                    cpu: (if ($cpu | length) > 0 then (try ($cpu | tonumber) catch $cpu) else null end),
                    memory: (if ($memory | length) > 0 then (try ($memory | tonumber) catch $memory) else null end)
                }]
            ' "$resource_json" > "$resource_json.tmp"
        else
            jq --arg scenario "$scenario" '. + [{scenario: $scenario, cpu: null, memory: null}]' "$resource_json" > "$resource_json.tmp"
        fi
        mv "$resource_json.tmp" "$resource_json"
    fi
}

append_summary_row() {
    local scenario="$1"
    local human_name="$2"
    local summary_file="$RESULTS_DIR/summary.md"

    if [ ! -f "$summary_file" ]; then
        cat <<'HEADER' > "$summary_file"
| Skenario | Throughput | Latency | CPU | Memory |
|-----------|-------------|---------|-----|---------|
HEADER
    fi

    local throughput="N/A"
    local latency="N/A"
    local cpu="N/A"
    local memory="N/A"
    local report_file="$RESULTS_DIR/$scenario/caliper-report.json"

    if [ -f "$report_file" ]; then
        throughput=$(jq -r '.summary.succ | to_entries | map(.value.tps) | add / length' "$report_file" 2>/dev/null || echo "N/A")
        latency=$(jq -r '.summary.succ | to_entries | map(.value.latency.average) | add / length' "$report_file" 2>/dev/null || echo "N/A")
        cpu=$(jq -r '.resource.cpu // "N/A"' "$report_file" 2>/dev/null || echo "N/A")
        memory=$(jq -r '.resource.memory // "N/A"' "$report_file" 2>/dev/null || echo "N/A")
    fi

    printf "| %s | %s | %s | %s | %s |\n" "$human_name" "$throughput" "$latency" "$cpu" "$memory" >> "$summary_file"
}

main() {
    require_tools
    prepare_crypto_material

    echo "Scenario,Round,Throughput,Latency" > "$RESULTS_DIR/throughput_latency.csv"
    echo "[]" > "$RESULTS_DIR/resource_usage.json"
    rm -f "$RESULTS_DIR/summary.md"

    for scenario in "${SCENARIOS[@]}"; do
        echo "=============================="
        echo "Running scenario: $scenario"
        echo "=============================="

        rm -rf "$RESULTS_DIR/$scenario"

        apply_raft_profile "$scenario"
        stop_network || true
        start_network
        package_chaincode
        deploy_chaincode_placeholder
        run_caliper "$scenario"
        local human_name
        human_name=$(echo "$scenario" | sed -e 's/_/ /g' -e 's/\<raft\>/RAFT/Ig')
        append_summary_row "$scenario" "$human_name"
        stop_network
    done

    echo "Benchmark results stored in $RESULTS_DIR"
}

main "$@"
