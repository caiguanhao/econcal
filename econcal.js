const puppeteer = require('puppeteer');

let currentPage = null;

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
        console.log('get token', data.access_token.slice(0, 50));
        currentPage = page;
        setTimeout(async () => {
          await _getPage();
          await page.browser().close()
          console.log('browser closed');
        }, (data.expires_in - 60) * 1000);
        return resolve(currentPage);
      } catch (e) {
        if (browser) await browser.close();
        console.log('retrying; error:', e);
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
  try {
    const page = await getPage();
    const data = await page.evaluate(async (url) => {
      url += url.indexOf('?') === -1 ? '?' : '&';
      url += 'authorization=' + window.FXAUTH;
      const json = await new Promise((resolve, reject) => {
        jQuery.getJSON(url).
          done((json) => {
            resolve(json);
          }).
          fail((xhr, statusText, err) => {
            reject('error');
          });
      });
      return json;
    }, 'https://calendar.fxstreet.com' + req.url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

console.log('getting token...');
getPage().then(() => {
  const port = 6000;
  server.listen(port, (err) => {
    if (err) return console.error(err);
    console.log(`server is listening on ${port}`);
  });
});
