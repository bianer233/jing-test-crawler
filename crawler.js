const fs = require('fs');
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');

const chromeLauncher = require('chrome-launcher');
// const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const reportGenerator = require('lighthouse/report/generator/report-generator');
const request = require('request');
const util = require('util');

const options = {
    logLevel: 'info',
    //   disableDeviceEmulation: true,
    chromeFlags: ['--headless', '--preset=desktop']
};


function writeToReport(lhr, needHtml) {
    //   console.log("!!!!!!!!!", lhr);
    const metricKeys = ["first-contentful-paint", "interactive", "speed-index", "total-blocking-time", "largest-contentful-paint", "cumulative-layout-shift"]
    metricKeys.map((metricKey) => {
        let { displayValue, numericValue, score } = lhr.audits[metricKey];
        return {
            [metricKey]: {
                displayValue, numericValue, score
            }
        }
    })
    const metrics = metricKeys.map((metricKey) => {
        let { displayValue, numericValue, score, id } = lhr.audits[metricKey];
        return { displayValue, numericValue, score, id }
    })

    //   console.log(`Lighthouse scores: ${Object.values(lhr.categories.performance.audits).map(c => c.score).join(', ')}`);
    if (needHtml) {
        let url = lhr.requestedUrl;
        try {
            let tempUrl = new URL(url)
            let resultName = encodeURIComponent(tempUrl.pathname) + ".html"
            const html = reportGenerator.generateReport(lhr, 'html');
            fs.writeFile(resultName, html, function (err) {
                if (err) throw err;
            });
        } catch (e) {
            console.log("Writing Report Error", url, e)
        }

    }
    return metrics;
}

async function lighthouseFromPuppeteer(url, options, config = null) {
    // Launch chrome using chrome-launcher
    const chrome = await chromeLauncher.launch(options);
    options.port = chrome.port;

    // Connect chrome-launcher to puppeteer
    const resp = await util.promisify(request)(`http://localhost:${options.port}/json/version`);
    const { webSocketDebuggerUrl } = JSON.parse(resp.body);
    const browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });

    // Run Lighthouse
    const { lhr } = await lighthouse(url, options, config);
    const result = writeToReport(lhr, true);
    console.log(result)
    await browser.disconnect();
    await chrome.kill();
}



let result = lighthouseFromPuppeteer("https://developer.cisco.com/learningcenter/", options, {
    extends: 'lighthouse:default',
    settings: {
        formFactor: 'desktop',
        screenEmulation: { width: 1240, height: 1000, mobile: false }
    },
});
