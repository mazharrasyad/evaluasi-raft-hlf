'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class SubmitReportWorkload extends WorkloadModuleBase {
    constructor() {
        super();
    }

    async submitTransaction() {
        const reportId = `${this.workerIndex}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const args = ['SubmitReport', reportId, `reporter-${this.workerIndex}`, 'maladministrasi', 'Simulated maladministration report'];
        await this.sutAdapter.sendRequests({
            contractId: this.roundArguments.chaincodeId,
            contractVersion: '1.0',
            channel: this.roundArguments.channel,
            readOnly: false,
            method: 'SubmitReport',
            args,
        });
    }
}

function createWorkloadModule() {
    return new SubmitReportWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
