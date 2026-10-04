import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await readFile('src/provider/provider.ts', 'utf8')
const { code } = await transform(`
const CHAIN_CONF = { AVAX: { rpcUrls: ['first', 'second'] } };
export const WEB3_PROVIDERS = { AVAX: [{ eth: {} }, { eth: {} }] };
export const ETH_CALL_PROVIDERS = { AVAX: [{}, {}] };
${source.slice(source.indexOf('const lastProviderIndex:'))}
`, { loader: 'ts', format: 'esm' })
const { ETH_CALL_PROVIDERS: providers, WEB3_PROVIDERS: web3, callWithTimeout, web3EthCall } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
let attempts = 0
const from = '0x' + '1'.repeat(40)
providers.AVAX[0].all = async () => { attempts++; throw new Error('Unavailable') }
providers.AVAX[1].all = async (_, options) => {
  attempts++
  assert.equal(options.from, from)
  assert.equal(options.blockTag, 123)
  return [42]
}
assert.deepEqual(await callWithTimeout('AVAX', [], 123, 5, from), [42])
assert.equal(attempts, 2)
attempts = 0
for (const provider of providers.AVAX) provider.all = () => { attempts++; return new Promise(() => {}) }
await assert.rejects(callWithTimeout('AVAX', [], 123, 5, from), /AVAX eth_call failed after 4 attempts/)
assert.equal(attempts, 4)
for (const provider of web3.AVAX) provider.eth.getBlock = () => new Promise(() => {})
await assert.rejects(web3EthCall('AVAX', 'getBlock', ['latest'], 5), /Web3 eth call failed/)
console.log('RPC retry checks: failover, bounded timeouts and preserved block/from: OK')
