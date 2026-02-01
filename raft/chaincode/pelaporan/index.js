'use strict';

const { Contract } = require('fabric-contract-api');
const sampleData = require('./sample-data.json');

class CatatanDigitalContract extends Contract {
  /**
   * Inisialisasi ledger dengan data sampel agar mudah diuji
   */
  async InitLedger(ctx) {
    for (const catatan of sampleData) {
      const exists = await this.CatatanExists(ctx, catatan.id);
      if (!exists) {
        await ctx.stub.putState(catatan.id, Buffer.from(JSON.stringify(catatan)));
      }
    }

    console.log(`✅ Ledger initialized with ${sampleData.length} sample catatan`);
    return JSON.stringify({ status: 'initialized', total: sampleData.length });
  }

  /**
   * Membuat catatan baru di ledger
   * @param {Context} ctx
   * @param {String} id
   * @param {String} payload (JSON string)
   */
  async CreateCatatan(ctx, id, payload) {
    if (!id) {
      throw new Error('❌ ID catatan wajib diisi.');
    }

    const exists = await this.CatatanExists(ctx, id);
    if (exists) {
      throw new Error(`❌ Catatan dengan ID ${id} sudah ada.`);
    }

    let data;
    try {
      data = JSON.parse(payload);
    } catch (e) {
      throw new Error('Payload harus dalam format JSON string');
    }

    if (data.id && data.id !== id) {
      throw new Error('ID pada payload tidak sesuai dengan parameter ID.');
    }

    // Get blockchain transaction metadata
    const txId = ctx.stub.getTxID();
    const txTimestamp = ctx.stub.getTxTimestamp();
    const millis = (txTimestamp.seconds.low * 1000) + Math.floor(txTimestamp.nanos / 1000000);
    const blockchainTimestamp = new Date(millis).toISOString();
    const channelId = ctx.stub.getChannelID();

    console.log(`📦 Saving simulationData to blockchain block...`);
    console.log(`   Record ID: ${id}`);
    console.log(`   Channel: ${channelId}`);
    console.log(`   Transaction ID: ${txId}`);
    console.log(`   Blockchain Timestamp: ${blockchainTimestamp}`);

    // Prepare comprehensive data with blockchain metadata
    const storedCatatan = {
      ...data,
      id,
      timestamp: data.timestamp || blockchainTimestamp,
      createdAt: data.createdAt || blockchainTimestamp,
      createdAtDisplay: data.createdAtDisplay || blockchainTimestamp,
      // Blockchain metadata
      blockchainMetadata: {
        transactionId: txId,
        channelId: channelId,
        blockTimestamp: blockchainTimestamp,
        savedToBlockchain: true,
        createdInBlock: true,
      },
    };

    await ctx.stub.putState(id, Buffer.from(JSON.stringify(storedCatatan)));
    console.log(`✅ SimulationData ${id} berhasil disimpan ke blockchain block!`);
    console.log(`   Transaction ID: ${txId}`);
    console.log(`   Channel: ${channelId}`);

    // Return the complete stored data so it can be extracted from blockchain blocks
    return JSON.stringify(storedCatatan);
  }

  /**
   * Memperbarui catatan yang sudah ada di ledger
   * @param {Context} ctx
   * @param {String} id
   * @param {String} payload (JSON string)
   */
  async UpdateCatatan(ctx, id, payload) {
    if (!id) {
      throw new Error('❌ ID catatan wajib diisi.');
    }

    const exists = await this.CatatanExists(ctx, id);
    if (!exists) {
      throw new Error(`❌ Catatan dengan ID ${id} tidak ditemukan. Gunakan CreateCatatan untuk membuat catatan baru.`);
    }

    let data;
    try {
      data = JSON.parse(payload);
    } catch (e) {
      throw new Error('Payload harus dalam format JSON string');
    }

    if (data.id && data.id !== id) {
      throw new Error('ID pada payload tidak sesuai dengan parameter ID.');
    }

    // Get blockchain transaction metadata
    const txId = ctx.stub.getTxID();
    const txTimestamp = ctx.stub.getTxTimestamp();
    const millis = (txTimestamp.seconds.low * 1000) + Math.floor(txTimestamp.nanos / 1000000);
    const blockchainTimestamp = new Date(millis).toISOString();
    const channelId = ctx.stub.getChannelID();

    console.log(`🔄 Updating simulationData in blockchain block...`);
    console.log(`   Record ID: ${id}`);
    console.log(`   Channel: ${channelId}`);
    console.log(`   Transaction ID: ${txId}`);

    // Get existing record to preserve createdAt and original blockchain metadata
    const existingDataJSON = await ctx.stub.getState(id);
    const existingData = JSON.parse(existingDataJSON.toString());

    const updatedCatatan = {
      ...data,
      id,
      timestamp: data.timestamp || existingData.timestamp || blockchainTimestamp,
      createdAt: existingData.createdAt || data.createdAt || blockchainTimestamp,
      createdAtDisplay: existingData.createdAtDisplay || data.createdAtDisplay || blockchainTimestamp,
      updatedAt: blockchainTimestamp,
      updatedAtDisplay: blockchainTimestamp,
      // Preserve original blockchain metadata and add update info
      blockchainMetadata: {
        ...(existingData.blockchainMetadata || {}),
        lastUpdateTransactionId: txId,
        lastUpdateTimestamp: blockchainTimestamp,
        savedToBlockchain: true,
      },
    };

    await ctx.stub.putState(id, Buffer.from(JSON.stringify(updatedCatatan)));
    console.log(`✅ SimulationData ${id} berhasil diperbarui di blockchain block!`);
    console.log(`   Transaction ID: ${txId}`);
    console.log(`   Channel: ${channelId}`);

    // Return the complete updated data so it can be extracted from blockchain blocks
    return JSON.stringify(updatedCatatan);
  }

  /**
   * Membuat atau memperbarui catatan di ledger
   * Jika catatan sudah ada, akan diperbarui; jika belum ada, akan dibuat baru
   * @param {Context} ctx
   * @param {String} id
   * @param {String} payload (JSON string)
   */
  async CreateOrUpdateCatatan(ctx, id, payload) {
    if (!id) {
      throw new Error('❌ ID catatan wajib diisi.');
    }

    const exists = await this.CatatanExists(ctx, id);

    if (exists) {
      return await this.UpdateCatatan(ctx, id, payload);
    } else {
      return await this.CreateCatatan(ctx, id, payload);
    }
  }

  /**
   * Membaca catatan berdasarkan ID
   */
  async ReadCatatan(ctx, id) {
    const dataJSON = await ctx.stub.getState(id);
    if (!dataJSON || dataJSON.length === 0) {
      throw new Error(`❌ Catatan dengan ID ${id} tidak ditemukan.`);
    }

    const data = JSON.parse(dataJSON.toString());
    const result = {
      ...data,
      id: data.id || id,
    };

    console.log(`📖 Membaca catatan ${id}`);
    return JSON.stringify(result);
  }

  /**
   * Mengecek apakah catatan sudah ada
   */
  async CatatanExists(ctx, id) {
    const buffer = await ctx.stub.getState(id);
    return !!buffer && buffer.length > 0;
  }

  /**
   * Mengambil semua catatan dari ledger
   */
  async GetAllCatatan(ctx) {
    const iterator = await ctx.stub.getStateByRange('', '');
    const allResults = [];

    while (true) {
      const res = await iterator.next();

      if (res.value && res.value.value) {
        try {
          const recordString = res.value.value.toString('utf8');
          const record = JSON.parse(recordString);
          const catatan = {
            ...record,
            id: record.id || res.value.key,
          };
          allResults.push(catatan);
        } catch (error) {
          console.error('Gagal mengurai data ledger:', error);
        }
      }

      if (res.done) {
        await iterator.close();
        break;
      }
    }

    console.log(`📦 Mengambil ${allResults.length} catatan dari ledger`);
    return JSON.stringify(allResults);
  }
}

module.exports = CatatanDigitalContract;
module.exports.contracts = [CatatanDigitalContract];
