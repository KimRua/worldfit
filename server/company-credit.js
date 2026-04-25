import { randomUUID } from 'node:crypto';
import { TokenDecimals, Tokens } from '@worldcoin/minikit-js/commands';
import {
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
  parseAbiItem,
  parseUnits,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { worldchain } from 'viem/chains';
import { pool } from './db.js';

const WORLD_DEVELOPER_API_BASE_URL = 'https://developer.worldcoin.org';
const WORLD_MINI_APP_ID = process.env.WORLD_MINI_APP_ID?.trim() ?? '';
const WORLD_MINI_APP_API_KEY = process.env.WORLD_MINI_APP_API_KEY?.trim() ?? '';
const WORLD_MINI_APP_RECEIVER_ADDRESS = process.env.WORLD_MINI_APP_RECEIVER_ADDRESS?.trim() ?? '';
const WORLD_CHAIN_RPC_URL =
  process.env.WORLD_CHAIN_RPC_URL?.trim() ?? 'https://worldchain-mainnet.g.alchemy.com/public';
const COMPANY_CREDIT_WLD_RATE = Number(process.env.COMPANY_CREDIT_WLD_RATE ?? 0.147);
const COMPANY_CREDIT_MIN_USD = Number(process.env.COMPANY_CREDIT_MIN_USD ?? 50);
const COMPANY_CREDIT_MAX_USD = Number(process.env.COMPANY_CREDIT_MAX_USD ?? 10000);
const COMPANY_CREDIT_REQUEST_TTL_MINUTES = Number(process.env.COMPANY_CREDIT_REQUEST_TTL_MINUTES ?? 20);
const COMPANY_CREDIT_MINI_APP_SUPPORTED_TOKENS =
  process.env.COMPANY_CREDIT_MINI_APP_SUPPORTED_TOKENS?.trim() ?? 'WLD,USDC';
const COMPANY_CREDIT_WEB_SUPPORTED_TOKENS =
  process.env.COMPANY_CREDIT_WEB_SUPPORTED_TOKENS?.trim() ?? 'WLD,USDC';
const COMPANY_CREDIT_HD_MNEMONIC = process.env.COMPANY_CREDIT_HD_MNEMONIC?.trim() ?? '';
const COMPANY_CREDIT_HD_BASE_PATH =
  process.env.COMPANY_CREDIT_HD_BASE_PATH?.trim() ?? "m/44'/60'/0'/0";
const COMPANY_CREDIT_WEB_CONFIRMATIONS = Number(process.env.COMPANY_CREDIT_WEB_CONFIRMATIONS ?? 2);
const COMPANY_CREDIT_WEB_MONITOR_INTERVAL_MS = Number(
  process.env.COMPANY_CREDIT_WEB_MONITOR_INTERVAL_MS ?? 15000,
);
const WEB_CREDIT_USDT_TOKEN_ADDRESS = process.env.WEB_CREDIT_USDT_TOKEN_ADDRESS?.trim() ?? '';
const WEB_CREDIT_USDT_DECIMALS = Number(process.env.WEB_CREDIT_USDT_DECIMALS ?? 6);
const WEB_CREDIT_USDT_ORACLE_ADDRESS = process.env.WEB_CREDIT_USDT_ORACLE_ADDRESS?.trim() ?? '';
const WEB_CREDIT_USDT_ORACLE_DECIMALS = Number(process.env.WEB_CREDIT_USDT_ORACLE_DECIMALS ?? 8);

const WLD_TOKEN_ADDRESS = '0x2cfc85d8e48f8eab294be644d9e25c3030863003';
const USDC_TOKEN_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';
const WLD_USD_ORACLE_ADDRESS = '0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0';
const USDC_USD_ORACLE_ADDRESS = '0xF4301686AfF4eE36d70c718a9e62309b53862BE8';

const chainlinkAggregatorAbi = parseAbi([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
]);
const erc20TransferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

const defaultVerificationForm = {
  country: 'KR',
  verificationType: 'company',
  companyBusinessCertificateFileName: '',
  companyCorporateSealCertificateFileName: '',
  companyOfficialLetterFileName: '',
  organizerBusinessCertificateFileName: '',
  organizerUsageSealCertificateFileName: '',
  organizerOfficialLetterFileName: '',
};

const paymentOptionCatalog = {
  WLD: {
    key: 'WLD',
    label: 'WLD',
    worldTokenSymbol: Tokens.WLD,
    contractAddress: WLD_TOKEN_ADDRESS,
    decimals: 18,
    expectedTokenPerUsd: COMPANY_CREDIT_WLD_RATE,
    oracleType: 'chainlink',
    oracleAddress: WLD_USD_ORACLE_ADDRESS,
  },
  USDC: {
    key: 'USDC',
    label: 'USDC',
    worldTokenSymbol: Tokens.USDC,
    contractAddress: USDC_TOKEN_ADDRESS,
    decimals: 6,
    expectedTokenPerUsd: 1,
    oracleType: 'chainlink',
    oracleAddress: USDC_USD_ORACLE_ADDRESS,
  },
  USDT: WEB_CREDIT_USDT_TOKEN_ADDRESS
    ? {
        key: 'USDT',
        label: 'USDT',
        worldTokenSymbol: null,
        contractAddress: WEB_CREDIT_USDT_TOKEN_ADDRESS,
        decimals: WEB_CREDIT_USDT_DECIMALS,
        expectedTokenPerUsd: 1,
        oracleType: WEB_CREDIT_USDT_ORACLE_ADDRESS ? 'chainlink' : 'stable_usd',
        oracleAddress: WEB_CREDIT_USDT_ORACLE_ADDRESS || null,
        oracleDecimals: WEB_CREDIT_USDT_ORACLE_DECIMALS,
      }
    : null,
};

let worldChainPublicClient = null;
let companyCreditMonitorStarted = false;

function getWorldChainPublicClient() {
  if (!worldChainPublicClient) {
    worldChainPublicClient = createPublicClient({
      chain: worldchain,
      transport: http(WORLD_CHAIN_RPC_URL),
    });
  }

  return worldChainPublicClient;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isDuplicateKeyError(error, keyName) {
  return (
    Boolean(error) &&
    typeof error === 'object' &&
    error.code === 'ER_DUP_ENTRY' &&
    String(error.message ?? '').includes(keyName)
  );
}

function formatUsdLabel(value) {
  return `+$${value.toLocaleString('en-US')}`;
}

function formatDecimalString(value, maxFractionDigits = 8) {
  const rounded = value.toFixed(maxFractionDigits);
  return rounded.replace(/\.?0+$/, '');
}

function formatTokenAmountFromAtomic(amountAtomic, decimals) {
  return formatDecimalString(Number(formatUnits(BigInt(amountAtomic), decimals)));
}

function getSupportedKeys(input) {
  return input
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function getMiniAppSupportedPaymentOptions() {
  return getSupportedKeys(COMPANY_CREDIT_MINI_APP_SUPPORTED_TOKENS)
    .map((key) => paymentOptionCatalog[key])
    .filter((option) => option && option.worldTokenSymbol && option.expectedTokenPerUsd > 0);
}

function getWebSupportedPaymentOptions() {
  return getSupportedKeys(COMPANY_CREDIT_WEB_SUPPORTED_TOKENS)
    .map((key) => paymentOptionCatalog[key])
    .filter((option) => option && option.contractAddress && option.decimals >= 0);
}

function getPaymentOption(key, paymentChannel) {
  const options =
    paymentChannel === 'web_deposit'
      ? getWebSupportedPaymentOptions()
      : getMiniAppSupportedPaymentOptions();

  return options.find((option) => option.key === key) ?? null;
}

function getPaymentOptionByStoredRow(row) {
  return (
    paymentOptionCatalog[String(row.payment_token_key ?? '').trim().toUpperCase()] ??
    null
  );
}

function areMiniAppCreditPaymentsConfigured() {
  return Boolean(
    WORLD_MINI_APP_ID &&
      WORLD_MINI_APP_API_KEY &&
      WORLD_MINI_APP_RECEIVER_ADDRESS &&
      getMiniAppSupportedPaymentOptions().length > 0,
  );
}

function areWebCreditDepositsConfigured() {
  return Boolean(
    COMPANY_CREDIT_HD_MNEMONIC && WORLD_CHAIN_RPC_URL && getWebSupportedPaymentOptions().length > 0,
  );
}

function buildTokenAmount(creditUsd, paymentOption) {
  const displayAmount = formatDecimalString(creditUsd * paymentOption.expectedTokenPerUsd, 6);
  const decimals =
    paymentOption.worldTokenSymbol != null
      ? TokenDecimals[paymentOption.worldTokenSymbol] ?? paymentOption.decimals
      : paymentOption.decimals;
  const atomicAmount = parseUnits(displayAmount, decimals).toString();
  return {
    displayAmount,
    atomicAmount,
  };
}

async function buildTokenQuote(creditUsd, paymentOption) {
  const tokenPriceUsd = await fetchCurrentTokenPriceUsd(paymentOption);

  if (!(tokenPriceUsd > 0)) {
    throw new Error(`${paymentOption.key} 실시간 시세를 조회하지 못했습니다.`);
  }

  const tokenPerUsd = 1 / tokenPriceUsd;
  const displayAmount = formatDecimalString(creditUsd * tokenPerUsd, 6);
  const decimals =
    paymentOption.worldTokenSymbol != null
      ? TokenDecimals[paymentOption.worldTokenSymbol] ?? paymentOption.decimals
      : paymentOption.decimals;
  const atomicAmount = parseUnits(displayAmount, decimals).toString();

  return {
    displayAmount,
    atomicAmount,
    tokenPriceUsd,
    tokenPerUsd,
  };
}

function getChargeStatusMessage(status, paymentChannel) {
  if (status === 'confirmed') {
    return '크레딧 충전이 완료되었습니다.';
  }

  if (status === 'pending') {
    return paymentChannel === 'web_deposit'
      ? '입금이 확인되어 블록 확정을 기다리고 있습니다.'
      : '결제가 접수되었고 블록 확정을 기다리고 있습니다.';
  }

  if (status === 'failed') {
    return paymentChannel === 'web_deposit'
      ? '입금 확인에 실패했습니다. 운영팀에 문의해주세요.'
      : '결제가 실패했습니다. 다시 시도해주세요.';
  }

  if (status === 'expired') {
    return paymentChannel === 'web_deposit'
      ? '입금 주소가 만료되었습니다. 새 주소를 생성해주세요.'
      : '결제 요청이 만료되었습니다. 새 요청을 생성해주세요.';
  }

  return paymentChannel === 'web_deposit'
    ? '1회용 입금 주소가 준비되었습니다.'
    : '결제 요청이 준비되었습니다.';
}

function buildChargePayload(row) {
  const paymentOption = getPaymentOptionByStoredRow(row);

  return {
    id: row.id,
    paymentChannel: row.payment_channel,
    reference: row.reference,
    status: row.status,
    creditUsd: toNumber(row.requested_credit_usd, 0),
    receiverAddress: row.receiver_address,
    paymentToken: {
      key: row.payment_token_key,
      label: paymentOption?.label ?? row.payment_token_key,
      worldTokenSymbol: paymentOption?.worldTokenSymbol ?? null,
      contractAddress: row.payment_token_contract_address ?? paymentOption?.contractAddress ?? null,
      amountDisplay: row.payment_token_amount_display,
      amountAtomic: row.payment_token_amount_atomic,
      decimals: toNumber(row.payment_token_decimals, paymentOption?.decimals ?? 18),
    },
    transactionId: row.world_transaction_id ?? null,
    transactionHash: row.payment_channel === 'web_deposit'
      ? row.detected_transaction_hash ?? null
      : row.world_transaction_hash ?? null,
    payerWalletAddress: row.payer_wallet_address ?? null,
    failureReason: row.failure_reason ?? null,
    depositAddress: row.payment_channel === 'web_deposit' ? row.receiver_address : null,
    receivedTokenAmountDisplay: row.detected_token_amount_display ?? null,
    quotedTokenPriceUsd: toNullableNumber(row.quoted_token_price_usd),
    quotedAmountUsd: toNullableNumber(row.quoted_amount_usd),
    creditedUsd: toNullableNumber(row.credited_amount_usd),
    detectedAt: toIsoString(row.detected_at),
    createdAt: toIsoString(row.created_at),
    expiresAt: toIsoString(row.expires_at),
    confirmedAt: toIsoString(row.confirmed_at),
  };
}

async function ensureCompanyPortalProfile(companyUserId) {
  await pool.execute(
    `
      INSERT INTO company_portal_profiles (
        company_user_id,
        contact,
        language,
        verification_payload,
        credit_balance_usd,
        credit_monthly_usage_usd,
        wallet_address,
        credit_exchange_rate,
        usage_series
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        company_user_id = company_user_id
    `,
    [
      companyUserId,
      '',
      '',
      JSON.stringify(defaultVerificationForm),
      0,
      0,
      WORLD_MINI_APP_RECEIVER_ADDRESS,
      COMPANY_CREDIT_WLD_RATE > 0 ? COMPANY_CREDIT_WLD_RATE : 0,
      JSON.stringify([]),
    ],
  );

  if (WORLD_MINI_APP_RECEIVER_ADDRESS) {
    await pool.execute(
      `
        UPDATE company_portal_profiles
        SET wallet_address = ?,
            credit_exchange_rate = ?
        WHERE company_user_id = ?
      `,
      [WORLD_MINI_APP_RECEIVER_ADDRESS, COMPANY_CREDIT_WLD_RATE > 0 ? COMPANY_CREDIT_WLD_RATE : 0, companyUserId],
    );
  }
}

async function getChargeRow(companyUserId, chargeId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT id, company_user_id, reference, payment_channel, status, requested_credit_usd,
             payment_token_key, payment_token_symbol, payment_token_contract_address,
             payment_token_decimals, payment_token_amount_atomic, payment_token_amount_display,
             receiver_address, web_derived_index, world_transaction_id, world_transaction_hash,
             payer_wallet_address, failure_reason, raw_transaction_payload, last_checked_block,
             detected_token_amount_atomic, detected_token_amount_display, detected_transaction_hash,
             detected_block_number, detected_at, quoted_token_price_usd, quoted_amount_usd,
             credited_amount_usd, expires_at, confirmed_at, created_at, updated_at
      FROM company_credit_charge_requests
      WHERE company_user_id = ?
        AND id = ?
      LIMIT 1
    `,
    [companyUserId, chargeId],
  );

  return rows[0] ?? null;
}

async function getChargeRowForUpdate(connection, companyUserId, chargeId) {
  const [rows] = await connection.execute(
    `
      SELECT id, company_user_id, reference, payment_channel, status, requested_credit_usd,
             payment_token_key, payment_token_symbol, payment_token_contract_address,
             payment_token_decimals, payment_token_amount_atomic, payment_token_amount_display,
             receiver_address, web_derived_index, world_transaction_id, world_transaction_hash,
             payer_wallet_address, failure_reason, raw_transaction_payload, last_checked_block,
             detected_token_amount_atomic, detected_token_amount_display, detected_transaction_hash,
             detected_block_number, detected_at, quoted_token_price_usd, quoted_amount_usd,
             credited_amount_usd, expires_at, confirmed_at, created_at, updated_at
      FROM company_credit_charge_requests
      WHERE company_user_id = ?
        AND id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [companyUserId, chargeId],
  );

  return rows[0] ?? null;
}

async function fetchWorldTransaction(transactionId) {
  const response = await fetch(
    `${WORLD_DEVELOPER_API_BASE_URL}/api/v2/minikit/transaction/${encodeURIComponent(transactionId)}?app_id=${encodeURIComponent(WORLD_MINI_APP_ID)}&type=payment`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${WORLD_MINI_APP_API_KEY}`,
        'User-Agent': 'verifit-credit-topup/1.0',
      },
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.message === 'string'
        ? payload.message
        : 'World 결제 상태를 조회하는 중 오류가 발생했습니다.',
    );
  }

  return payload;
}

function validateMiniAppTransactionAgainstCharge(charge, transaction) {
  if (!transaction || typeof transaction !== 'object') {
    throw new Error('결제 검증 응답이 올바르지 않습니다.');
  }

  if (transaction.reference !== charge.reference) {
    throw new Error('결제 reference가 서버 요청과 일치하지 않습니다.');
  }

  if ((transaction.app_id ?? '') !== WORLD_MINI_APP_ID) {
    throw new Error('결제 app_id가 서버 설정과 일치하지 않습니다.');
  }

  if ((transaction.token ?? '') !== charge.payment_token_symbol) {
    throw new Error('결제 토큰이 서버 요청과 일치하지 않습니다.');
  }

  const exactAmount = String(charge.payment_token_amount_atomic ?? '');
  const sixDecimalAmount = parseUnits(String(charge.payment_token_amount_display ?? '0'), 6).toString();

  if (
    String(transaction.token_amount ?? '') !== exactAmount &&
    String(transaction.token_amount ?? '') !== sixDecimalAmount
  ) {
    throw new Error('결제 수량이 서버 요청과 일치하지 않습니다.');
  }

  if (
    String(transaction.to ?? '').trim().toLowerCase() !==
    String(charge.receiver_address ?? '').trim().toLowerCase()
  ) {
    throw new Error('결제 수신 주소가 서버 설정과 일치하지 않습니다.');
  }
}

function isChargeExpired(charge) {
  if (!charge?.expires_at) {
    return false;
  }

  const expirationTime = new Date(charge.expires_at).getTime();

  if (Number.isNaN(expirationTime)) {
    return false;
  }

  return expirationTime < Date.now();
}

async function expireChargeIfNeeded(connection, charge) {
  if (!isChargeExpired(charge) || charge.status === 'confirmed') {
    return charge;
  }

  if (
    charge.payment_channel === 'mini_app' &&
    (charge.world_transaction_id || charge.world_transaction_hash)
  ) {
    return charge;
  }

  if (
    charge.payment_channel === 'web_deposit' &&
    (charge.detected_transaction_hash || charge.detected_token_amount_atomic)
  ) {
    return charge;
  }

  await connection.execute(
    `
      UPDATE company_credit_charge_requests
      SET status = 'expired',
          failure_reason = ?
      WHERE id = ?
    `,
    [
      charge.payment_channel === 'web_deposit'
        ? '입금 주소 유효 시간이 만료되었습니다.'
        : '결제 요청 유효 시간이 만료되었습니다.',
      charge.id,
    ],
  );

  return {
    ...charge,
    status: 'expired',
    failure_reason:
      charge.payment_channel === 'web_deposit'
        ? '입금 주소 유효 시간이 만료되었습니다.'
        : '결제 요청 유효 시간이 만료되었습니다.',
  };
}

async function applyConfirmedCredit(connection, charge, details) {
  const creditedAmountUsd = Math.max(0, details.creditedAmountUsd);

  await connection.execute(
    `
      UPDATE company_portal_profiles
      SET credit_balance_usd = credit_balance_usd + ?
      WHERE company_user_id = ?
    `,
    [creditedAmountUsd, charge.company_user_id],
  );

  await connection.execute(
    `
      INSERT INTO company_credit_transactions (
        company_user_id,
        occurred_at,
        amount_label,
        transaction_type,
        amount_usd,
        payment_token_key,
        payment_token_symbol,
        payment_token_amount_atomic,
        payment_token_amount_display,
        reference,
        external_transaction_id,
        external_transaction_hash
      )
      VALUES (?, CURRENT_TIMESTAMP, ?, 'charge', ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        amount_label = VALUES(amount_label),
        amount_usd = VALUES(amount_usd),
        payment_token_amount_atomic = VALUES(payment_token_amount_atomic),
        payment_token_amount_display = VALUES(payment_token_amount_display),
        external_transaction_hash = VALUES(external_transaction_hash)
    `,
    [
      charge.company_user_id,
      formatUsdLabel(creditedAmountUsd),
      creditedAmountUsd,
      charge.payment_token_key,
      charge.payment_token_symbol,
      details.tokenAmountAtomic,
      details.tokenAmountDisplay,
      charge.reference,
      details.externalTransactionId ?? null,
      details.externalTransactionHash ?? null,
    ],
  );
}

async function applyMiniAppTransactionResult(connection, charge, transactionId, transaction) {
  const nextStatus =
    transaction.transaction_status === 'mined'
      ? 'confirmed'
      : transaction.transaction_status === 'failed'
        ? 'failed'
        : 'pending';

  const failureReason = nextStatus === 'failed' ? 'World App에서 결제가 실패했습니다.' : null;

  await connection.execute(
    `
      UPDATE company_credit_charge_requests
      SET status = ?,
          world_transaction_id = ?,
          world_transaction_hash = ?,
          payer_wallet_address = ?,
          failure_reason = ?,
          raw_transaction_payload = ?,
          credited_amount_usd = CASE WHEN ? = 'confirmed' THEN ? ELSE credited_amount_usd END,
          confirmed_at = CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE confirmed_at END
      WHERE id = ?
    `,
    [
      nextStatus,
      transactionId,
      transaction.transaction_hash ?? null,
      transaction.from ?? null,
      failureReason,
      JSON.stringify(transaction),
      nextStatus,
      charge.requested_credit_usd,
      nextStatus,
      charge.id,
    ],
  );

  if (nextStatus !== 'confirmed') {
    return;
  }

  await applyConfirmedCredit(connection, charge, {
    creditedAmountUsd: toNumber(charge.requested_credit_usd, 0),
    tokenAmountAtomic: charge.payment_token_amount_atomic,
    tokenAmountDisplay: charge.payment_token_amount_display,
    externalTransactionId: transactionId,
    externalTransactionHash: transaction.transaction_hash ?? null,
  });
}

async function fetchChainlinkPriceUsd(paymentOption) {
  if (!paymentOption.oracleAddress) {
    throw new Error(`${paymentOption.key} 가격 오라클 주소가 설정되지 않았습니다.`);
  }

  const publicClient = getWorldChainPublicClient();
  const [decimals, latestRoundData] = await Promise.all([
    paymentOption.oracleDecimals != null
      ? Promise.resolve(paymentOption.oracleDecimals)
      : publicClient.readContract({
          address: paymentOption.oracleAddress,
          abi: chainlinkAggregatorAbi,
          functionName: 'decimals',
        }),
    publicClient.readContract({
      address: paymentOption.oracleAddress,
      abi: chainlinkAggregatorAbi,
      functionName: 'latestRoundData',
    }),
  ]);

  const [, answer] = latestRoundData;

  if (answer <= 0n) {
    throw new Error(`${paymentOption.key} 가격 오라클 응답이 올바르지 않습니다.`);
  }

  return Number(formatUnits(answer, Number(decimals)));
}

async function fetchCurrentTokenPriceUsd(paymentOption) {
  if (paymentOption.oracleType === 'stable_usd') {
    return 1;
  }

  return fetchChainlinkPriceUsd(paymentOption);
}

function deriveWebDepositAccount(index) {
  return mnemonicToAccount(COMPANY_CREDIT_HD_MNEMONIC, {
    path: `${COMPANY_CREDIT_HD_BASE_PATH}/${index}`,
  });
}

async function getNextWebDerivationIndex(connection) {
  const [rows] = await connection.execute(
    `
      SELECT COALESCE(MAX(web_derived_index), -1) + 1 AS next_index
      FROM company_credit_charge_requests
      FOR UPDATE
    `,
  );

  return toNumber(rows[0]?.next_index, 0);
}

async function refreshWebDepositChargeStatus(connection, charge) {
  const paymentOption = getPaymentOptionByStoredRow(charge);

  if (!paymentOption?.contractAddress) {
    throw new Error('웹 입금 토큰 설정이 올바르지 않습니다.');
  }

  charge = await expireChargeIfNeeded(connection, charge);

  if (charge.status === 'expired' || charge.status === 'confirmed' || charge.status === 'failed') {
    return charge;
  }

  const publicClient = getWorldChainPublicClient();
  const latestBlock = await publicClient.getBlockNumber();
  const nextFromBlock = BigInt(toNumber(charge.last_checked_block, Number(latestBlock))) + 1n;

  if (nextFromBlock > latestBlock) {
    return charge;
  }

  const logs = await publicClient.getLogs({
    address: paymentOption.contractAddress,
    event: erc20TransferEvent,
    args: {
      to: charge.receiver_address,
    },
    fromBlock: nextFromBlock,
    toBlock: latestBlock,
  });

  let cumulativeAmount = BigInt(charge.detected_token_amount_atomic ?? '0');
  let latestDetectedHash = charge.detected_transaction_hash ?? null;
  let latestDetectedBlock = charge.detected_block_number == null ? null : BigInt(charge.detected_block_number);
  let detectedAt = charge.detected_at ?? null;

  for (const log of logs) {
    cumulativeAmount += BigInt(log.args.value?.toString() ?? '0');
    latestDetectedHash = log.transactionHash ?? latestDetectedHash;
    latestDetectedBlock = log.blockNumber ?? latestDetectedBlock;
    detectedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  const nextStatus =
    cumulativeAmount > 0n
      ? latestDetectedBlock != null &&
        latestBlock >= latestDetectedBlock + BigInt(Math.max(1, COMPANY_CREDIT_WEB_CONFIRMATIONS) - 1)
        ? 'confirmed'
        : 'pending'
      : charge.status;

  const detectedTokenAmountDisplay =
    cumulativeAmount > 0n ? formatTokenAmountFromAtomic(cumulativeAmount.toString(), paymentOption.decimals) : null;
  const quotedTokenPriceUsd = cumulativeAmount > 0n ? await fetchCurrentTokenPriceUsd(paymentOption) : null;
  const quotedAmountUsd =
    cumulativeAmount > 0n && detectedTokenAmountDisplay
      ? Number(detectedTokenAmountDisplay) * quotedTokenPriceUsd
      : null;
  const creditedAmountUsd =
    nextStatus === 'confirmed' && quotedAmountUsd != null ? Math.max(0, Math.floor(quotedAmountUsd)) : null;

  await connection.execute(
    `
      UPDATE company_credit_charge_requests
      SET status = ?,
          last_checked_block = ?,
          detected_token_amount_atomic = ?,
          detected_token_amount_display = ?,
          detected_transaction_hash = ?,
          detected_block_number = ?,
          detected_at = CASE WHEN ? IS NULL THEN detected_at ELSE ? END,
          quoted_token_price_usd = ?,
          quoted_amount_usd = ?,
          credited_amount_usd = ?,
          failure_reason = CASE
            WHEN ? = 'failed' THEN '입금 확인에 실패했습니다.'
            ELSE failure_reason
          END,
          confirmed_at = CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE confirmed_at END
      WHERE id = ?
    `,
    [
      nextStatus,
      latestBlock.toString(),
      cumulativeAmount > 0n ? cumulativeAmount.toString() : charge.detected_token_amount_atomic,
      detectedTokenAmountDisplay,
      latestDetectedHash,
      latestDetectedBlock != null ? latestDetectedBlock.toString() : null,
      detectedAt,
      detectedAt,
      quotedTokenPriceUsd,
      quotedAmountUsd,
      creditedAmountUsd,
      nextStatus,
      nextStatus,
      charge.id,
    ],
  );

  if (nextStatus === 'confirmed' && charge.status !== 'confirmed') {
    await applyConfirmedCredit(connection, charge, {
      creditedAmountUsd: creditedAmountUsd ?? 0,
      tokenAmountAtomic: cumulativeAmount.toString(),
      tokenAmountDisplay: detectedTokenAmountDisplay ?? '0',
      externalTransactionId: null,
      externalTransactionHash: latestDetectedHash,
    });
  }

  return getChargeRowForUpdate(connection, charge.company_user_id, charge.id);
}

async function refreshChargeStatus(companyUserId, chargeId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let charge = await getChargeRowForUpdate(connection, companyUserId, chargeId);

    if (!charge) {
      throw new Error('결제 요청을 찾을 수 없습니다.');
    }

    if (charge.payment_channel === 'web_deposit') {
      charge = await refreshWebDepositChargeStatus(connection, charge);
      await connection.commit();
      return buildChargePayload(charge);
    }

    if (!areMiniAppCreditPaymentsConfigured()) {
      throw new Error('World 결제 설정이 완료되지 않았습니다.');
    }

    charge = await expireChargeIfNeeded(connection, charge);

    if (charge.status === 'confirmed' || charge.status === 'failed' || charge.status === 'expired') {
      await connection.commit();
      return buildChargePayload(charge);
    }

    if (!charge.world_transaction_id) {
      await connection.commit();
      return buildChargePayload(charge);
    }

    const transaction = await fetchWorldTransaction(charge.world_transaction_id);
    validateMiniAppTransactionAgainstCharge(charge, transaction);
    await applyMiniAppTransactionResult(connection, charge, charge.world_transaction_id, transaction);

    charge = await getChargeRowForUpdate(connection, companyUserId, chargeId);
    await connection.commit();

    return buildChargePayload(charge);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function getCompanyCreditProfileDefaults() {
  return {
    walletAddress: WORLD_MINI_APP_RECEIVER_ADDRESS,
    exchangeRate: COMPANY_CREDIT_WLD_RATE > 0 ? COMPANY_CREDIT_WLD_RATE : 0,
  };
}

export function getCompanyCreditBootstrapConfig() {
  return {
    miniAppPaymentsEnabled: areMiniAppCreditPaymentsConfigured(),
    webDepositEnabled: areWebCreditDepositsConfigured(),
    minRechargeUsd: COMPANY_CREDIT_MIN_USD,
    maxRechargeUsd: COMPANY_CREDIT_MAX_USD,
    miniAppPaymentOptions: getMiniAppSupportedPaymentOptions().map((option) => ({
      key: option.key,
      label: option.label,
      worldTokenSymbol: option.worldTokenSymbol,
      tokenPerUsd: option.expectedTokenPerUsd,
    })),
    webDepositOptions: getWebSupportedPaymentOptions().map((option) => ({
      key: option.key,
      label: option.label,
      worldTokenSymbol: option.worldTokenSymbol ?? null,
      tokenPerUsd: option.expectedTokenPerUsd,
    })),
  };
}

export async function getCompanyCreditQuote(companyUser, input) {
  const companyUserId = toNumber(companyUser?.id, 0);
  const paymentChannel =
    String(input.paymentChannel ?? 'mini_app').trim() === 'web_deposit' ? 'web_deposit' : 'mini_app';
  const requestedCreditUsd = Number.parseInt(String(input.creditUsd ?? ''), 10);
  const paymentTokenKey = String(input.paymentTokenKey ?? '').trim().toUpperCase();
  const paymentOption = getPaymentOption(paymentTokenKey, paymentChannel);

  if (!companyUserId) {
    throw new Error('기업 로그인 세션이 필요합니다.');
  }

  if (!paymentOption) {
    throw new Error('지원하지 않는 결제 토큰입니다.');
  }

  if (!Number.isInteger(requestedCreditUsd) || requestedCreditUsd <= 0) {
    throw new Error('충전할 크레딧 금액이 올바르지 않습니다.');
  }

  const quote = await buildTokenQuote(requestedCreditUsd, paymentOption);

  return {
    quote: {
      paymentChannel,
      paymentTokenKey: paymentOption.key,
      creditUsd: requestedCreditUsd,
      tokenAmountDisplay: quote.displayAmount,
      tokenAmountAtomic: quote.atomicAmount,
      tokenPriceUsd: quote.tokenPriceUsd,
      tokenPerUsd: quote.tokenPerUsd,
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function createCompanyCreditCharge(companyUser, input) {
  const paymentChannel =
    String(input.paymentChannel ?? 'mini_app').trim() === 'web_deposit' ? 'web_deposit' : 'mini_app';
  const companyUserId = toNumber(companyUser?.id, 0);
  const requestedCreditUsd = Number.parseInt(String(input.creditUsd ?? ''), 10);
  const paymentTokenKey = String(input.paymentTokenKey ?? '').trim().toUpperCase();
  const paymentOption = getPaymentOption(paymentTokenKey, paymentChannel);

  if (!companyUserId) {
    throw new Error('기업 로그인 세션이 필요합니다.');
  }

  if (!paymentOption) {
    throw new Error('지원하지 않는 결제 토큰입니다.');
  }

  if (!Number.isInteger(requestedCreditUsd) || requestedCreditUsd < COMPANY_CREDIT_MIN_USD) {
    throw new Error(`최소 충전 금액은 $${COMPANY_CREDIT_MIN_USD.toLocaleString('en-US')} 입니다.`);
  }

  if (requestedCreditUsd > COMPANY_CREDIT_MAX_USD) {
    throw new Error(`최대 충전 금액은 $${COMPANY_CREDIT_MAX_USD.toLocaleString('en-US')} 입니다.`);
  }

  if (paymentChannel === 'mini_app' && !areMiniAppCreditPaymentsConfigured()) {
    throw new Error('World 결제 설정이 아직 완료되지 않았습니다.');
  }

  if (paymentChannel === 'web_deposit' && !areWebCreditDepositsConfigured()) {
    throw new Error('웹 입금 주소 설정이 아직 완료되지 않았습니다.');
  }

  await ensureCompanyPortalProfile(companyUserId);

  const { displayAmount, atomicAmount } = await buildTokenQuote(requestedCreditUsd, paymentOption);
  const chargeId = randomUUID();
  const reference = `credit_${randomUUID().replace(/-/g, '')}`;
  const expiresAt = new Date(Date.now() + COMPANY_CREDIT_REQUEST_TTL_MINUTES * 60 * 1000);

  if (paymentChannel === 'web_deposit') {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const derivationIndex = await getNextWebDerivationIndex(connection);
        const depositAccount = deriveWebDepositAccount(derivationIndex);
        const currentBlock = await getWorldChainPublicClient().getBlockNumber();

        await connection.execute(
          `
            INSERT INTO company_credit_charge_requests (
              id,
              company_user_id,
              reference,
              payment_channel,
              status,
              requested_credit_usd,
              payment_token_key,
              payment_token_symbol,
              payment_token_contract_address,
              payment_token_decimals,
              payment_token_amount_atomic,
              payment_token_amount_display,
              receiver_address,
              web_derived_index,
              last_checked_block,
              expires_at
            )
            VALUES (?, ?, ?, 'web_deposit', 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            chargeId,
            companyUserId,
            reference,
            requestedCreditUsd,
            paymentOption.key,
            paymentOption.key,
            paymentOption.contractAddress,
            paymentOption.decimals,
            atomicAmount,
            displayAmount,
            depositAccount.address,
            derivationIndex,
            currentBlock.toString(),
            expiresAt,
          ],
        );

        const charge = await getChargeRowForUpdate(connection, companyUserId, chargeId);
        await connection.commit();

        return {
          message: getChargeStatusMessage('ready', 'web_deposit'),
          charge: buildChargePayload(charge),
        };
      } catch (error) {
        await connection.rollback();

        if (
          attempt < 2 &&
          isDuplicateKeyError(error, 'uq_company_credit_charge_requests_web_derived_index')
        ) {
          continue;
        }

        throw error;
      } finally {
        connection.release();
      }
    }

    throw new Error('1회용 입금 주소를 생성하는 중 오류가 발생했습니다.');
  }

  await pool.execute(
    `
      INSERT INTO company_credit_charge_requests (
        id,
        company_user_id,
        reference,
        payment_channel,
        status,
        requested_credit_usd,
        payment_token_key,
        payment_token_symbol,
        payment_token_contract_address,
        payment_token_decimals,
        payment_token_amount_atomic,
        payment_token_amount_display,
        receiver_address,
        expires_at
      )
      VALUES (?, ?, ?, 'mini_app', 'ready', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      chargeId,
      companyUserId,
      reference,
      requestedCreditUsd,
      paymentOption.key,
      paymentOption.worldTokenSymbol,
      paymentOption.contractAddress,
      paymentOption.decimals,
      atomicAmount,
      displayAmount,
      WORLD_MINI_APP_RECEIVER_ADDRESS,
      expiresAt,
    ],
  );

  const charge = await getChargeRow(companyUserId, chargeId);

  return {
    message: getChargeStatusMessage('ready', 'mini_app'),
    charge: buildChargePayload(charge),
  };
}

export async function confirmCompanyCreditCharge(companyUser, chargeId, input) {
  if (!areMiniAppCreditPaymentsConfigured()) {
    throw new Error('World 결제 설정이 아직 완료되지 않았습니다.');
  }

  const companyUserId = toNumber(companyUser?.id, 0);
  const transactionId = String(input.transactionId ?? '').trim();

  if (!companyUserId) {
    throw new Error('기업 로그인 세션이 필요합니다.');
  }

  if (!chargeId) {
    throw new Error('결제 요청 ID가 필요합니다.');
  }

  if (!transactionId) {
    throw new Error('결제 transaction id가 필요합니다.');
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let charge = await getChargeRowForUpdate(connection, companyUserId, chargeId);

    if (!charge) {
      throw new Error('결제 요청을 찾을 수 없습니다.');
    }

    if (charge.payment_channel !== 'mini_app') {
      throw new Error('웹 입금 충전은 별도 확인 엔드포인트를 사용하지 않습니다.');
    }

    charge = await expireChargeIfNeeded(connection, charge);

    if (charge.status === 'expired') {
      await connection.commit();
      return {
        message: getChargeStatusMessage(charge.status, charge.payment_channel),
        charge: buildChargePayload(charge),
      };
    }

    if (
      charge.world_transaction_id &&
      charge.world_transaction_id !== transactionId &&
      charge.status !== 'failed'
    ) {
      throw new Error('이미 다른 transaction id로 처리 중인 결제 요청입니다.');
    }

    if (charge.status !== 'confirmed') {
      const transaction = await fetchWorldTransaction(transactionId);
      validateMiniAppTransactionAgainstCharge(charge, transaction);
      await applyMiniAppTransactionResult(connection, charge, transactionId, transaction);
      charge = await getChargeRowForUpdate(connection, companyUserId, chargeId);
    }

    await connection.commit();

    return {
      message: getChargeStatusMessage(charge.status, charge.payment_channel),
      charge: buildChargePayload(charge),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCompanyCreditCharge(companyUser, chargeId) {
  const companyUserId = toNumber(companyUser?.id, 0);

  if (!companyUserId) {
    throw new Error('기업 로그인 세션이 필요합니다.');
  }

  if (!chargeId) {
    throw new Error('결제 요청 ID가 필요합니다.');
  }

  const charge = await refreshChargeStatus(companyUserId, chargeId);

  return {
    message: getChargeStatusMessage(charge.status, charge.paymentChannel),
    charge,
  };
}

async function fetchPendingWebDepositRows(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, toNumber(limit, 100)));
  const [rows] = await pool.query(
    `
      SELECT id, company_user_id
      FROM company_credit_charge_requests
      WHERE payment_channel = 'web_deposit'
        AND status IN ('ready', 'pending')
      ORDER BY created_at ASC
      LIMIT ${safeLimit}
    `,
  );

  return rows;
}

export function startCompanyCreditMonitor() {
  if (companyCreditMonitorStarted || !areWebCreditDepositsConfigured()) {
    return;
  }

  companyCreditMonitorStarted = true;

  const tick = async () => {
    try {
      const rows = await fetchPendingWebDepositRows();

      for (const row of rows) {
        try {
          await refreshChargeStatus(toNumber(row.company_user_id, 0), row.id);
        } catch (error) {
          console.error(`Company web credit monitor failed for ${row.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Company web credit monitor tick failed:', error);
    }
  };

  tick();
  setInterval(tick, Math.max(5000, COMPANY_CREDIT_WEB_MONITOR_INTERVAL_MS));
}
