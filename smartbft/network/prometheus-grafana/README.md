# Description

This sample provides an environment to display and capture metrics from the test-network in real time. It consists of a docker-compose file that starts a Prometheus and Grafana server setup configured to collect and display metrics for the test network.

## Requirements

This sample has been tested and is recommended to be used on **linux** in order to fully benefit from its capabilities, however it can be deployed and works on MacOS-intel machine as well (some modification to the cadvisor docker image and related queries are required to show docker containers metrics).
You will need to have installed **docker-compose with version 1.29 or above** (note that this is higher than the v1.14 requirement requested for the test-network).

## How to use

1. Go to the test-network directory and run bring up the test-network **./network.sh up createChannel**
2. Bring up the Prometheus/Grafana network in the test-network/prometheus-grafana directory and run **docker-compose up -d**
3. Log in: buka "localhost:3100" di peramban Anda -> username="admin", password="admin" -> setel sandi baru
4. Browse dashboard and analyse results
   - The default dashboard "HLF Performances Review" can be found and displayed by hovering over the dashboard menu and clicking on the browse button.
   ![picture alt]("https://user-images.githubusercontent.com/86831094/149115445-5e5f6d95-ecc3-4b46-aadb-5c01148770b3.png "Title is optional")
   Once opened the dashboard, to display the collected metrics and data, adjust the timeframe on the top right to focus on the latest timespan when the network was up.
5. Deploy a chaincode (i.e. "./network.sh deployCC -ccn basic -ccp ../asset-transfer-basic/chaincode-go -ccl go"), start using the test-network and use the Grafana dashboard to analyse and assess your network performances.
Extras: add new queries, modify dashboard & add relevant changes to main repo --> extract json and add it to "Grafana/dashboards/hlf-performances.json".
Metrics can also be displayed directly from Prometheus by going to "localhost:9190".

## Docker Compose

Brings up

- a Prometheus server (port host 9190 -> container 9090) -> pulls metrics from peers, orderer, system (node exporter) and containers (cadvisor)
- Grafana server (port host 3100 -> container 3000) -> collects and displays data from Prometheus
- node exporter (port host 9200 -> container 9100) -> exposes systems metrics
- cadvisor (port host 8180 -> container 8080) -> exposes docker containers metrics

## Prometheus "configuration file"

### Prometheus.yml

Fabric metrics targets:

- `peer0.org1.smartbft:9544`
- `peer0.org2.smartbft:9545`
- `orderer.smartbft:9543`

System and docker metrics targets:

- `cadvisor-raft-variant:8080`
- `node-exporter-raft-variant:9100`

Check the state of the connections with targets on http://localhost:9090/targets.

## Sources

[Prometheus docs](https://prometheus.io/docs/introduction/overview/)
[Grafana docs](https://grafana.com/docs/)

