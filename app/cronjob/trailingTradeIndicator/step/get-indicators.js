const _ = require('lodash');
const { binance } = require('../../../helpers');
const RSI = require('technicalindicators').RSI;

/**
 * Flatten candle data
 *
 * @param {*} candles
 */
const flattenCandlesData = candles => {
  const openTime = [];
  const high = [];
  const low = [];
  const close = []

  candles.forEach(candle => {
    openTime.push(+candle.openTime);
    high.push(+candle.high);
    low.push(+candle.low);
    close.push(+candle.close);
  });

  return {
    openTime,
    high,
    low,
    close
  };
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
      candles: { interval, limit }
    }
  } = data;

  // Retrieve candles
  logger.info(
    { debug: true, function: 'candles', interval, limit },
    'Retrieving candles from API'
  );
  const candles = await binance.client.candles({
    symbol,
    interval,
    limit
  });

  // Flatten candles data to get lowest price
  const candlesData = flattenCandlesData(candles);

  //check the if the last candle is green
  //and the previous candle is red
  //and previous candle RSI < 32
  //32 maybe better than 30
  const lastCandle = candles[candles.length - 2];
  const isLastCandleGreen = parseFloat(lastCandle.open) < parseFloat(lastCandle.close);
  const previousLastCandle = candles[candles.length - 3];
  const isPreviousLastCandleRed = parseFloat(previousLastCandle.open) > parseFloat(previousLastCandle.close);

  const rsiValues = RSI.calculate({
    values: candlesData.close,
    period: 14
  });

  const previousLastCandleRSI = rsiValues[rsiValues.length - 3];
  const isMeetBuyTrigger = isLastCandleGreen && isPreviousLastCandleRed && previousLastCandleRSI < 32;

  const rsi = rsiValues[rsiValues.length - 1];

  // Get lowest price
  // const lowestPrice = _.min(candlesData.low);
  const lowestPrice = isMeetBuyTrigger ? candlesData.close[candlesData.close.length - 2] : Number.MIN_SAFE_INTEGER;
  const highestPrice = _.max(candlesData.high);

  logger.info({ lowestPrice, highestPrice, rsi }, 'Retrieved lowest/highest price/rsi');

  data.indicators = {
    highestPrice,
    lowestPrice,
    rsi
  };

  return data;
};

module.exports = { execute };
