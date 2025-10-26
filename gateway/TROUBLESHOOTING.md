# Catatan Digital Gateway Troubleshooting Guide

## Common Errors and Solutions

### "ProposalResponsePayloads do not match" Error

This error occurs when different peers produce different results for the same transaction proposal during the endorsement phase.

#### Causes:

1. **Non-deterministic code in chaincode**: Using functions like `new Date()` or `Math.random()` in chaincode
2. **Inconsistent state across peers**: Peers have different world states
3. **Network configuration issues**: Endorsement policy requirements not met
4. **Timing issues**: Race conditions in chaincode execution

#### Solutions:

1. **Use deterministic timestamps**:
   - Replace `new Date()` with transaction timestamps from the context:
   ```javascript
   const txTimestamp = ctx.stub.getTxTimestamp();
   const txTime = new Date(txTimestamp.seconds.low * 1000);
   const isoTimestamp = txTime.toISOString();
   ```

2. **Check network health**:
   - Run `npm run check-network` to verify the network is healthy
   - Ensure all required peers are up and running

3. **Restart the network**:
   ```bash
   cd ../network   # gunakan ../network-standard jika memakai jaringan contoh
   ./network.sh down
   ./network.sh up createChannel -c mychannel -ca
   ./network.sh deployCC -ccn catatan-digital -ccp ../chaincode/catatan-digital -ccl javascript
   ```

4. **Adjust endorsement policy**:
   - If using multiple organizations, ensure the endorsement policy is appropriate
   - Consider using a more lenient policy during development (e.g., ANY instead of ALL)

5. **Implement retry mechanism**:
   - The application includes a retry mechanism for failed transactions
   - Adjust retry parameters in `submitWithRetry()` function if needed

## Network Verification

To verify the network is functioning correctly:

1. Check network health:
   ```bash
   npm run check-network
   ```

2. Test a simple query:
   ```bash
   curl http://localhost:31914/api/health
   ```

3. Check blockchain info:
   ```bash
   curl http://localhost:31914/api/blockchain/info
   ```

## Debugging Tips

1. **Enable detailed logging**:
   - Set environment variable: `export FABRIC_LOGGING_SPEC=DEBUG`
   - Restart the application

2. **Check peer logs**:
   ```bash
   docker logs peer0.org1.example.com
   ```

3. **Verify chaincode installation**:
   ```bash
   docker exec peer0.org1.example.com peer lifecycle chaincode queryinstalled
   ```

4. **Check endorsement policy**:
   ```bash
   docker exec peer0.org1.example.com peer lifecycle chaincode querycommitted -C mychannel -n catatan-digital
   ```

## Contact Support

If you continue to experience issues after trying these solutions, please contact the development team for further assistance.