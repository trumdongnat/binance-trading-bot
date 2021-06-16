/* eslint-disable no-unused-vars */
/* eslint-disable react/jsx-no-undef */
/* eslint-disable no-undef */
class CoinWrapperBuySignal extends React.Component {
  render() {
    const {
      symbolInfo: {
        symbolInfo: {
          filterPrice: { tickSize }
        },
        symbolConfiguration,
        buy
      }
    } = this.props;

    const precision = parseFloat(tickSize) === 1 ? 0 : tickSize.indexOf(1) - 1;

    return (
      <div className='coin-info-sub-wrapper'>
        <div className='coin-info-column coin-info-column-title'>
          <div className='coin-info-label'>
            Buy Signal ({symbolConfiguration.candles.interval}/
            {symbolConfiguration.candles.limit}){' '}
            <span className='coin-info-value'>
              {symbolConfiguration.buy.enabled ? (
                <i className='fa fa-toggle-on'></i>
              ) : (
                <i className='fa fa-toggle-off'></i>
              )}
            </span>{' '}
          </div>
          {symbolConfiguration.buy.enabled === false ? (
            <HightlightChange className='coin-info-message text-muted'>
              Trading is disabled.
            </HightlightChange>
          ) : (
            ''
          )}
        </div>
        {buy.highestPrice ? (
          <div className='coin-info-column coin-info-column-price'>
            <span className='coin-info-label'>Highest price:</span>
            <HightlightChange className='coin-info-value'>
              {parseFloat(buy.highestPrice).toFixed(precision)}
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        {buy.currentPrice ? (
          <div className='coin-info-column coin-info-column-price'>
            <span className='coin-info-label'>Current price:</span>
            <HightlightChange className='coin-info-value'>
              {parseFloat(buy.currentPrice).toFixed(precision)}
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        {buy.lowestPrice ? (
          <div className='coin-info-column coin-info-column-lowest-price'>
            <span className='coin-info-label'>Target price:</span>
            <HightlightChange className='coin-info-value'>
              {buy.lowestPrice > 0 ? parseFloat(buy.lowestPrice).toFixed(precision) : "N/A"}
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        {buy.rsi ? (
          <div className='coin-info-column coin-info-column-lowest-price'>
            <span className='coin-info-label'>RSI:</span>
            <HightlightChange className='coin-info-value'>
              {parseFloat(buy.rsi).toFixed(2)}
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        <div className='coin-info-column coin-info-column-price divider'></div>
        {buy.triggerPrice ? (
          <div className='coin-info-column coin-info-column-price'>
            <span className='coin-info-label'>
              Trigger price (
              {(
                parseFloat(symbolConfiguration.buy.triggerPercentage - 1) * 100
              ).toFixed(2)}
              %):
            </span>
            <HightlightChange className='coin-info-value'>
              {buy.triggerPrice > 0 ? parseFloat(buy.triggerPrice).toFixed(precision) : "N/A"}
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        {buy.difference ? (
          <div className='coin-info-column coin-info-column-price'>
            <span className='coin-info-label'>Difference to buy:</span>
            <HightlightChange className='coin-info-value' id='buy-difference'>
              {parseFloat(buy.difference).toFixed(2)}%
            </HightlightChange>
          </div>
        ) : (
          ''
        )}
        {buy.processMessage ? (
          <div className='d-flex flex-column w-100'>
            <div className='coin-info-column coin-info-column-price divider'></div>
            <div className='coin-info-column coin-info-column-message'>
              <HightlightChange className='coin-info-message'>
                {buy.processMessage}
              </HightlightChange>
            </div>
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}
