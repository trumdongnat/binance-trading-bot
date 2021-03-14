/* eslint-disable prefer-destructuring */
const _ = require('lodash');
const moment = require('moment');
const { binance, cache, mongo } = require('../../../helpers');

/**
 * Flatten candle data
 *
 * @param {*} candles
 */
const flattenCandlesData = candles => {
  const openTime = [];
  const low = [];

  candles.forEach(candle => {
    openTime.push(+candle.openTime);
    low.push(+candle.low);
  });

  return {
    openTime,
    low
  };
};

/**
 * Get symbol information
 *
 * @param {*} logger
 * @param {*} symbol
 */
const getSymbolInfo = async (logger, symbol) => {
  const cachedSymbolInfo = await cache.hget(
    'trailing-trade-symbols',
    `${symbol}-symbol-info`
  );

  if (cachedSymbolInfo) {
    logger.info({ cachedSymbolInfo }, 'Retrieved symbol info from the cache.');
    return JSON.parse(cachedSymbolInfo);
  }

  logger.info({}, 'Request exchange info from Binance.');

  const exchangeInfo = await binance.client.exchangeInfo();

  logger.info({}, 'Retrieved exchange info from Binance.');
  const symbolInfo = _.filter(
    exchangeInfo.symbols,
    s => s.symbol === symbol
  )[0];

  symbolInfo.filterLotSize = _.filter(
    symbolInfo.filters,
    f => f.filterType === 'LOT_SIZE'
  )[0];
  symbolInfo.filterPrice = _.filter(
    symbolInfo.filters,
    f => f.filterType === 'PRICE_FILTER'
  )[0];
  symbolInfo.filterMinNotional = _.filter(
    symbolInfo.filters,
    f => f.filterType === 'MIN_NOTIONAL'
  )[0];

  logger.info({ symbolInfo }, 'Retrieved symbol info from Binance.');

  const finalSymbolInfo = _.pick(symbolInfo, [
    'symbol',
    'status',
    'baseAsset',
    'baseAssetPrecision',
    'quoteAsset',
    'quotePrecision',
    'filterLotSize',
    'filterPrice',
    'filterMinNotional'
  ]);

  cache.hset(
    'trailing-trade-symbols',
    `${symbol}-symbol-info`,
    JSON.stringify(finalSymbolInfo)
  );

  return finalSymbolInfo;
};

/**
 * Get last buy price from mongodb
 *
 * @param {*} logger
 * @param {*} symbol
 */
const getLastBuyPrice = async (logger, symbol) => {
  const lastBuyPriceDoc = await mongo.findOne(
    logger,
    'trailing-trade-symbols',
    {
      key: `${symbol}-last-buy-price`
    }
  );

  const cachedLastBuyPrice = _.get(lastBuyPriceDoc, 'lastBuyPrice', null);
  logger.debug({ cachedLastBuyPrice }, 'Last buy price');

  return cachedLastBuyPrice;
};

/**
 * Get symbol information, buy/sell indicators
 *
 * @param {*} logger
 * @param {*} rawData
 */
const execute = async (logger, rawData) => {
  const data = rawData;

  const {
    symbol,
    symbolConfiguration: {
      candles: { interval, limit },
      buy: {
        triggerPercentage: buyTriggerPercentage,
        limitPercentage: buyLimitPercentage
      },
      sell: {
        triggerPercentage: sellTriggerPercentage,
        limitPercentage: sellLimitPercentage
      }
    },
    accountInfo: { balances, updateTime },
    openOrders
  } = data;

  // Retrieve symbol info
  const symbolInfo = await getSymbolInfo(logger, symbol);

  const { quoteAsset, baseAsset } = symbolInfo;

  // Retrieve candles
  const candles = await binance.client.candles({
    symbol,
    interval,
    limit
  });

  // Get last candle
  const [lastCandle] = candles.slice(-1);

  logger.info({ lastCandle }, 'Retrieved candles');

  // Flatten candles data to get lowest price
  const candlesData = flattenCandlesData(candles);

  // Get lowest price
  const lowestPrice = _.min(candlesData.low);
  logger.info({ lowestPrice }, 'Retrieved lowest price');

  // Cast string to number
  const currentPrice = +lastCandle.close;
  const buyTriggerPrice = lowestPrice * buyTriggerPercentage;
  const buyDifference = (1 - currentPrice / buyTriggerPrice) * -100;
  const buyLimitPrice = currentPrice * buyLimitPercentage;

  // Get last buy price
  const lastBuyPrice = await getLastBuyPrice(logger, symbol);
  const sellTriggerPrice =
    lastBuyPrice > 0 ? lastBuyPrice * sellTriggerPercentage : null;
  const sellDifference =
    lastBuyPrice > 0 ? (1 - sellTriggerPrice / currentPrice) * 100 : null;
  const sellLimitPrice = currentPrice * sellLimitPercentage;

  // Get asset balances
  const baseAssetBalance = balances.filter(b => b.asset === baseAsset)[0] || {
    asset: baseAsset,
    free: 0,
    locked: 0
  };
  const quoteAssetBalance = balances.filter(b => b.asset === quoteAsset)[0] || {
    asset: quoteAsset,
    free: 0,
    locked: 0
  };

  const baseAssetTotalBalance =
    parseFloat(baseAssetBalance.free) + parseFloat(baseAssetBalance.locked);

  const baseAssetEstimatedValue = baseAssetTotalBalance * currentPrice;

  const sellCurrentProfit =
    lastBuyPrice > 0
      ? (currentPrice - lastBuyPrice) * baseAssetTotalBalance
      : null;

  const sellCurrentProfitPercentage =
    lastBuyPrice > 0 ? (1 - lastBuyPrice / currentPrice) * 100 : null;

  // Reorganise open orders
  const newOpenOrders = openOrders.map(order => {
    const newOrder = order;
    newOrder.currentPrice = currentPrice;
    newOrder.updatedAt = moment(order.time).utc();

    if (order.type !== 'STOP_LOSS_LIMIT') {
      return newOrder;
    }

    if (order.side.toLowerCase() === 'buy') {
      newOrder.limitPrice = buyLimitPrice;
      newOrder.limitPercentage = buyLimitPercentage;
      newOrder.difference =
        (1 - parseFloat(order.stopPrice / buyLimitPrice)) * -100;
    }

    if (order.side.toLowerCase() === 'sell') {
      newOrder.limitPrice = sellLimitPrice;
      newOrder.limitPercentage = sellLimitPercentage;
      newOrder.difference =
        (1 - parseFloat(order.stopPrice / sellLimitPrice)) * 100;

      newOrder.minimumProfit = null;
      newOrder.minimumProfitPercentage = null;
      if (lastBuyPrice > 0) {
        newOrder.minimumProfit =
          (parseFloat(order.price) - lastBuyPrice) * parseFloat(order.origQty);
        newOrder.minimumProfitPercentage =
          (1 - lastBuyPrice / parseFloat(order.price)) * 100;
      }
    }
    return newOrder;
  });

  // Populate data
  data.indicators = {
    lowestPrice,
    lastCandle
  };

  data.symbolInfo = symbolInfo;

  data.baseAssetBalance = baseAssetBalance;
  data.baseAssetBalance.total = baseAssetTotalBalance;
  data.baseAssetBalance.estimatedValue = baseAssetEstimatedValue;
  data.baseAssetBalance.updatedAt = moment(updateTime).utc();

  data.quoteAssetBalance = quoteAssetBalance;

  data.buy = {
    currentPrice,
    limitPrice: buyLimitPrice,
    lowestPrice,
    triggerPrice: buyTriggerPrice,
    difference: buyDifference,
    openOrders: newOpenOrders?.filter(o => o.side.toLowerCase() === 'buy'),
    processMesage: '',
    updatedAt: moment().utc()
  };

  data.sell = {
    currentPrice,
    limitPrice: sellLimitPrice,
    lastBuyPrice,
    triggerPrice: sellTriggerPrice,
    difference: sellDifference,
    currentProfit: sellCurrentProfit,
    currentProfitPercentage: sellCurrentProfitPercentage,
    openOrders: newOpenOrders?.filter(o => o.side.toLowerCase() === 'sell'),
    processMessage: '',
    updatedAt: moment().utc()
  };

  return data;
};

module.exports = { execute };