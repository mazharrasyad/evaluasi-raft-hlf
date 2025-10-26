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

    const txTimestamp = ctx.stub.getTxTimestamp();
    const millis = (txTimestamp.seconds.low * 1000) + Math.floor(txTimestamp.nanos / 1000000);
    const timestamp = new Date(millis).toISOString();

    const storedCatatan = {
      ...data,
      id,
      createdAt: data.createdAt || timestamp,
      createdAtDisplay: data.createdAtDisplay || timestamp,
    };

    await ctx.stub.putState(id, Buffer.from(JSON.stringify(storedCatatan)));
    console.log(`✅ Catatan ${id} berhasil disimpan`);
    return JSON.stringify({ status: 'success', id });
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
