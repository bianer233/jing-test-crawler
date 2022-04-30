const fs = require('fs');
const lighthouse = require('lighthouse');
const puppeteer = require('puppeteer');
const constants = require('./constants.js');

const chromeLauncher = require('chrome-launcher');
// const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const reportGenerator = require('lighthouse/report/generator/report-generator');
const request = require('request');
const util = require('util');

const options = {
    logLevel: 'info',
    //   disableDeviceEmulation: true,
    chromeFlags: ['--headless', '--preset=desktop', '--no-sandbox', '--throttlingMethod=provided']
};

const TIMESTAMP = (new Date()).getTime();

const logger = {
    writeFile: (str, suffix, division) => {
        const fileName = TIMESTAMP + suffix;
        fs.appendFile(fileName, str + (division || '') + '\n', function (err) {
            if (err) return console.log(err);
            console.log(str + ' > ' + fileName);
        });
    },
    error: function (str) {
        this.writeFile(str, "_error.txt");
    },
    result: function (str) {
        this.writeFile(str, "_result.txt", ",");
    },
    log: function (str) {
        this.writeFile(str, "_log.txt");
    },
    write: function (str, fileName) {
        if (!fileName) {
            console.error("!!! fileName is required !!!")
            return
        }
        this.writeFile(str, "_log.txt");
    },
};

function writeToReport(lhr, needHtml) {
    const url = lhr.requestedUrl;
    const metricKeys = ["first-contentful-paint", "interactive", "speed-index", "total-blocking-time", "largest-contentful-paint", "cumulative-layout-shift"]
    metricKeys.map((metricKey) => {
        let { displayValue, numericValue, score, id } = lhr.audits[metricKey];
        return { displayValue, numericValue, score, id }
    })
    const metrics = metricKeys.map((metricKey) => {
        let { displayValue, numericValue, score, id } = lhr.audits[metricKey];
        return { displayValue, numericValue, score, id }
    })
    logger.result(JSON.stringify({
        [url]: metrics
    }))
    if (needHtml) {
        try {
            let tempUrl = new URL(url)
            let resultName = encodeURIComponent(tempUrl.pathname) + ".html"
            const html = reportGenerator.generateReport(lhr, 'html');
            fs.writeFile(resultName, html, function (err) {
                if (err) throw err;
            });
        } catch (e) {
            console.log("Writing HTML Report Error", url, e)
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
    const result = writeToReport(lhr, false);
    await browser.disconnect();
    await chrome.kill();
}


const skipDomain = [
    "https://developer.cisco.com/learning/labs/tags/",
    "https://developer.cisco.com/learning/labs/page/",
    "https://developer.cisco.com/fileMedia/download/",
    "https://pubhub.devnetcloud.com/media/",
    "https://communities.cisco.com"
]
const filterFn = (link) => {
    let flag = true;
    skipDomain.forEach((domain) => {
        if (link.startsWith(domain)) {
            flag = false
        }
    })
    return flag;
}

const source_group = {
    serverside: require("./sources/server_rendering.json").map(item => item.loc),
    new_ll: require("./sources/new_learning.json").map(item => item.loc),
    all_urls: require("./sources/all_urls_array.json").filter(filterFn)
}

const input_array = source_group.new_ll;

let index_start = 0;
// let index_end = 1;
let index_end = input_array. length;
console.log("TOTAL", index_start, index_end);

async function processArray() {
    let array = input_array.slice(index_start, index_end);
    for (let i = 0; i < array.length; i++) {
        console.log("crawling", i, array[i]);
        try {
            await lighthouseFromPuppeteer(array[i], options, {
                extends: 'lighthouse:default',
                settings: {
                    formFactor: 'desktop',
                    screenEmulation: { width: 1240, height: 1000, mobile: false },
                    // onlyCategories: ['performance'],
                    // onlyAudits: [
                    //     'interactive',
                    // ],
                    throttling: constants.throttling.fastDestopTest,
                },
            });
        } catch (e) {
            console.log("Error", e, array[i])
            logger.error(array[i]);
        }
    }
    const timeDiff = (new Date().getTime()) - TIMESTAMP;
    const hours = Math.floor(timeDiff / 1000 / 60 / 60);
    console.log('Done!', hours + " hours", Math.floor((timeDiff - hours*60*1000) / 1000 / 60) + " minutes");
}

processArray();