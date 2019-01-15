const puppeteer = require('puppeteer');

let info = console.info;
console.info = function () {
  let args = Array.prototype.slice.call(arguments, 0);
  args[0] = (new Date).toJSON() + ' ' + args[0];
  info.apply(console, args);
};

let maxTimeout = 60 * 30;
let currentPage = null;
const port = 6000;

function _getPage() {
  return new Promise(async (resolve, reject) => {
    let browser;
    while (true) {
      try {
        browser = await puppeteer.launch()
        const page = await browser.newPage();
        // visit an fxstreet page which loads fast
        await page.goto('https://www.fxstreet.hk/info/sitemap');
        console.info('page loaded');
        const data = await page.evaluate(async () => {
          const data = await FXStreetAuth.Authorization.getInstance({
            authorizationUrl: 'https://authorization.fxstreet.com/token'
          }).getTokenPromise();
          window.FXAUTH = data.token_type + ' ' + data.access_token;
          return data;
        });
        console.info('get token', data.access_token.slice(0, 50));
        currentPage = page;
        let seconds = Math.max(10, Math.min(data.expires_in - 60, maxTimeout));
        setTimeout(async () => {
          await _getPage();
          await page.browser().close()
          console.info('browser closed');
        }, seconds * 1000);
        console.info('refresh token in', seconds, 'seconds');
        return resolve(currentPage);
      } catch (e) {
        if (browser) await browser.close();
        console.info('retrying; error:', e);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  })
}

function getPage() {
  if (currentPage) return Promise.resolve(currentPage);
  return _getPage();
}

const http = require('http');

const server = http.createServer(async (req, res) => {
  const host = req.headers['x-api-host'] || 'https://calendar.fxstreet.com';
  const url = host + req.url;
  try {
    const start = new Date();
    const page = await getPage();
    const data = await page.evaluate(async (url) => {
      const json = await new Promise((resolve, reject) => {
        fetch(url, {
          headers: {
            Authorization: window.FXAUTH
          }
        }).then((res) => {
          resolve(res.text());
        }).catch((err) => {
          reject(err.message);
        });
      });
      return json;
    }, url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
    console.info('GET', url, '-- size:', data.length, '-- duration (ms):', (new Date() - start));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
    console.info('FAIL', url);
  }
});

console.info('getting token...');
getPage().then(() => {
  server.listen(port, (err) => {
    if (err) return console.error(err);
    console.info(`server is listening on ${port}`);
  });
});
