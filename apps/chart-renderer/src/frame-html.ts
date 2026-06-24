const STYLE_MAP: Record<string, string> = {
  candles: "1",
  line: "2",
  area: "3",
  bars: "0",
};

/** Self-contained TradingView capture page — no Next.js dependency */
export function buildChartFrameHtml(params: {
  symbol: string;
  interval: string;
  studies: string[];
  theme: string;
  style: string;
}): string {
  const studiesJson = JSON.stringify(params.studies);
  const styleCode = STYLE_MAP[params.style] ?? "1";
  const theme = params.theme === "light" ? "light" : "dark";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=1280, height=800" />
  <title>Chart capture</title>
  <style>
    html, body { margin: 0; padding: 0; width: 1280px; height: 800px; overflow: hidden; background: #0b0d19; }
    #chart-root { width: 1280px; height: 800px; }
    #tv-chart-container-inner { width: 100%; height: 100%; }
  </style>
  <script src="https://s3.tradingview.com/tv.js"></script>
</head>
<body>
  <div id="chart-root">
    <div id="tv-chart-container-inner"></div>
  </div>
  <script>
    window.__chartReady = false;
    window.__chartError = null;

    const symbol = ${JSON.stringify(params.symbol)};
    const interval = ${JSON.stringify(params.interval)};
    const studies = ${studiesJson};
    const theme = ${JSON.stringify(theme)};
    const style = ${JSON.stringify(styleCode)};

    function markReady() {
      window.__chartReady = true;
    }

    function init() {
      if (!window.TradingView || !window.TradingView.widget) {
        setTimeout(init, 200);
        return;
      }
      try {
        new window.TradingView.widget({
          autosize: false,
          width: 1280,
          height: 800,
          symbol,
          interval,
          timezone: "Etc/UTC",
          theme,
          style,
          locale: "en",
          enable_publishing: false,
          hide_top_toolbar: true,
          hide_legend: false,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          studies,
          container_id: "tv-chart-container-inner",
          withdateranges: false,
          details: false,
          hotlist: false,
          calendar: false,
        });

        let attempts = 0;
        const poll = setInterval(function () {
          attempts += 1;
          var inner = document.getElementById("tv-chart-container-inner");
          var iframe = inner && inner.querySelector("iframe");
          if (iframe) {
            clearInterval(poll);
            setTimeout(markReady, 3000);
          } else if (attempts > 80) {
            clearInterval(poll);
            window.__chartError = "TradingView iframe did not load";
            markReady();
          }
        }, 500);
      } catch (e) {
        window.__chartError = String(e);
        markReady();
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      setTimeout(init, 300);
    }
  </script>
</body>
</html>`;
}
