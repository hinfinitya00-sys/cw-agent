// CrowdWorks実案件自動スクレイピングシステム
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

class CrowdWorksRealScraper {
    constructor(options = {}) {
        this.options = {
            headless: options.headless !== false,
            waitTimeout: options.waitTimeout || 30000,
            pageLoadDelay: options.pageLoadDelay || 3000,
            ...options
        };
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🚀 CrowdWorks スクレイピング開始...');

        this.browser = await puppeteer.launch({
            headless: this.options.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        this.page = await this.browser.newPage();
        await this.page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await this.page.setViewport({ width: 1440, height: 900 });
        console.log('✅ ブラウザ初期化完了');
    }

    async scrapeJobListings(searchParams = {}) {
        try {
            const baseUrl = 'https://crowdworks.jp/public/jobs';
            let url = baseUrl;

            if (searchParams.keyword) {
                url += `?search%5Bkeywords%5D=${encodeURIComponent(searchParams.keyword)}`;
            }

            console.log(`📊 アクセス中: ${url}`);

            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.options.waitTimeout
            });

            await new Promise(resolve => setTimeout(resolve, this.options.pageLoadDelay));
            await this.page.waitForSelector('body', { timeout: 10000 });

            const jobs = await this.page.evaluate(() => {
                const selectors = [
                    '[data-job-id]',
                    '.search-job-item',
                    '.job-item',
                    '.list-item',
                    'article[itemtype*="JobPosting"]',
                    'div[class*="job"]'
                ];

                let foundElements = null;

                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0 && elements.length <= 100) {
                        foundElements = Array.from(elements);
                        break;
                    }
                }

                if (!foundElements) {
                    const allDivs = document.querySelectorAll('div, li, article');
                    foundElements = Array.from(allDivs).filter(el => {
                        const text = el.textContent || '';
                        return text.includes('円') &&
                               text.includes('日') &&
                               el.offsetHeight > 80 &&
                               el.offsetWidth > 300;
                    }).slice(0, 50);
                }

                return foundElements.map((element, index) => {
                    const job = {
                        id: `cw_${Date.now()}_${index}`,
                        source: 'crowdworks',
                        scrapedAt: new Date().toISOString()
                    };

                    const titleSelectors = ['h3', 'h2', 'h4', 'strong', 'a[href*="/public/jobs/"]'];
                    for (const sel of titleSelectors) {
                        const titleEl = element.querySelector(sel);
                        if (titleEl && titleEl.textContent.trim().length > 5) {
                            job.title = titleEl.textContent.trim();
                            const link = titleEl.tagName === 'A' ? titleEl : titleEl.closest('a');
                            if (link && link.href) job.url = link.href;
                            break;
                        }
                    }

                    const fullText = element.textContent || '';
                    const priceMatches = fullText.match(/(\d{1,3}(?:,\d{3})*)\s*円/g);
                    if (priceMatches) {
                        job.price = priceMatches.join(' - ');
                        const numbers = priceMatches.map(p => parseInt(p.replace(/[,円]/g, '')));
                        job.minPrice = Math.min(...numbers);
                        job.maxPrice = Math.max(...numbers);
                    }

                    const applicantMatch = fullText.match(/応募数?\s*(\d+)\s*人|(\d+)\s*人/);
                    if (applicantMatch) job.applicants = parseInt(applicantMatch[1] || applicantMatch[2]);

                    const deadlineMatch = fullText.match(/あと\s*(\d+)\s*日|(\d{1,2})月(\d{1,2})日/);
                    if (deadlineMatch) {
                        job.deadline = deadlineMatch[0];
                        if (deadlineMatch[1]) job.daysLeft = parseInt(deadlineMatch[1]);
                    }

                    const contentLower = fullText.toLowerCase();
                    job.isAI = contentLower.includes('ai') || contentLower.includes('chatgpt') || contentLower.includes('claude');
                    job.isDevelopment = contentLower.includes('開発') || contentLower.includes('アプリ') || contentLower.includes('システム');

                    return job;
                }).filter(job => job && job.title);
            });

            console.log(`✅ 案件抽出完了: ${jobs.length}件`);
            return jobs;

        } catch (error) {
            console.error('❌ スクレイピングエラー:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('✅ ブラウザ終了');
        }
    }

    async saveJobsToFile(jobs, filename = 'crowdworks_jobs.json') {
        const outputPath = path.join(__dirname, '../data', filename);
        const outputDir = path.dirname(outputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(jobs, null, 2));
        console.log(`✅ 案件データ保存: ${outputPath} (${jobs.length}件)`);
        return outputPath;
    }
}

export default CrowdWorksRealScraper;
