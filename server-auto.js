const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3456;

// ミドルウェア設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// CORS設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// ===============================================
// CrowdWorks案件取得システム
// ===============================================

class CrowdWorksAutomation {
    constructor() {
        this.browser = null;
        this.page = null;
        this.config = {
            headless: true,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1440, height: 900 }
        };
        this.results = [];
    }

    async initialize() {
        try {
            console.log('🤖 Puppeteer初期化中...');
            this.browser = await puppeteer.launch({
                headless: this.config.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            
            this.page = await this.browser.newPage();
            await this.page.setUserAgent(this.config.userAgent);
            await this.page.setViewport(this.config.viewport);
            
            console.log('✅ Puppeteer初期化完了');
            return true;
        } catch (error) {
            console.error('❌ Puppeteer初期化失敗:', error);
            return false;
        }
    }

    async searchAIJobs(keywords = ['AI', 'ChatGPT', 'Claude', '機械学習', '自動化', 'Python', 'API']) {
        const jobs = [];
        
        try {
            for (const keyword of keywords) {
                console.log(`🔍 "${keyword}"で案件検索中...`);
                
                const searchUrl = `https://crowdworks.jp/public/jobs/search?q=${encodeURIComponent(keyword)}&order=update&category=7&type=fixed`;
                
                await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
                await this.page.waitForTimeout(2000);

                // 案件リスト取得
                const pageJobs = await this.page.evaluate(() => {
                    const jobElements = document.querySelectorAll('.job_list_item');
                    return Array.from(jobElements).map(element => {
                        const titleElement = element.querySelector('.job_title a');
                        const priceElement = element.querySelector('.price');
                        const descriptionElement = element.querySelector('.job_summary');
                        const categoryElement = element.querySelector('.job_category');
                        const clientElement = element.querySelector('.client_name');
                        const deadlineElement = element.querySelector('.deadline');

                        return {
                            title: titleElement?.textContent?.trim() || '',
                            url: titleElement?.href || '',
                            price: priceElement?.textContent?.trim() || '',
                            description: descriptionElement?.textContent?.trim() || '',
                            category: categoryElement?.textContent?.trim() || '',
                            client: clientElement?.textContent?.trim() || '',
                            deadline: deadlineElement?.textContent?.trim() || '',
                            scrapedAt: new Date().toISOString(),
                            keyword: keyword
                        };
                    });
                });

                // AI関連度スコア計算
                const scoredJobs = pageJobs
                    .filter(job => job.title && job.url)
                    .map(job => ({
                        ...job,
                        aiScore: this.calculateAIScore(job, keyword),
                        estimatedHours: this.estimateRequiredHours(job),
                        deliverabilityScore: this.assessDeliverability(job)
                    }))
                    .filter(job => job.aiScore > 60); // AI関連度60%以上のみ

                jobs.push(...scoredJobs);
                console.log(`✅ "${keyword}": ${scoredJobs.length}件の有望案件を発見`);
                
                await this.page.waitForTimeout(1000); // レート制限対策
            }

            // 重複除去とソート
            const uniqueJobs = this.removeDuplicates(jobs);
            const sortedJobs = uniqueJobs.sort((a, b) => b.aiScore - a.aiScore);
            
            console.log(`🎯 総計: ${sortedJobs.length}件のAI案件を取得`);
            this.results = sortedJobs;
            
            return sortedJobs;

        } catch (error) {
            console.error('❌ 案件検索エラー:', error);
            throw error;
        }
    }

    calculateAIScore(job, keyword) {
        const { title, description, price } = job;
        const content = `${title} ${description}`.toLowerCase();
        
        let score = 0;

        // キーワードマッチングスコア
        const aiKeywords = {
            'ai': 15, 'chatgpt': 20, 'claude': 20, 'gemini': 15,
            '機械学習': 15, '自然言語処理': 15, 'ディープラーニング': 15,
            'python': 10, 'api': 10, '自動化': 12, 'ボット': 10,
            'openai': 15, 'langchain': 15, 'rag': 15, 'llm': 15
        };

        for (const [word, points] of Object.entries(aiKeywords)) {
            if (content.includes(word)) {
                score += points;
            }
        }

        // 価格レンジボーナス
        const priceMatch = price.match(/(\d+,?\d*)/);
        if (priceMatch) {
            const amount = parseInt(priceMatch[1].replace(',', ''));
            if (amount >= 50000) score += 15;
            else if (amount >= 20000) score += 10;
            else if (amount >= 10000) score += 5;
        }

        // 緊急案件検出
        if (content.includes('急募') || content.includes('至急')) {
            score += 5;
        }

        return Math.min(100, score);
    }

    estimateRequiredHours(job) {
        const { description, price } = job;
        const content = description.toLowerCase();
        
        let hours = 10; // デフォルト

        // 複雑度推定
        if (content.includes('複雑') || content.includes('大規模')) hours += 20;
        if (content.includes('簡単') || content.includes('シンプル')) hours -= 5;
        if (content.includes('api') || content.includes('統合')) hours += 10;
        if (content.includes('ui') || content.includes('フロントエンド')) hours += 15;

        return Math.max(5, hours);
    }

    assessDeliverability(job) {
        const { title, description } = job;
        const content = `${title} ${description}`.toLowerCase();
        
        let score = 80; // ベース納品可能性

        // 技術要件チェック
        const requiredSkills = ['python', 'api', 'javascript', 'web開発', 'データ処理'];
        const matchedSkills = requiredSkills.filter(skill => content.includes(skill));
        score += matchedSkills.length * 5;

        // 不明確な要件は減点
        if (content.includes('相談') || content.includes('未定')) score -= 15;
        
        // 過度に複雑な要件は減点
        if (content.includes('ai開発') && content.includes('研究')) score -= 20;

        return Math.max(0, Math.min(100, score));
    }

    removeDuplicates(jobs) {
        const seen = new Set();
        return jobs.filter(job => {
            const key = job.url || job.title;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async getJobDetails(jobUrl) {
        try {
            await this.page.goto(jobUrl, { waitUntil: 'networkidle2' });
            
            const details = await this.page.evaluate(() => {
                const getTextContent = (selector) => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent.trim() : '';
                };

                return {
                    fullDescription: getTextContent('.job_description'),
                    requirements: getTextContent('.job_requirements'),
                    deliverables: getTextContent('.job_deliverables'),
                    budget: getTextContent('.budget_amount'),
                    deadline: getTextContent('.job_deadline'),
                    clientRating: getTextContent('.client_rating'),
                    clientJobsCount: getTextContent('.client_jobs_count')
                };
            });

            return details;
        } catch (error) {
            console.error('案件詳細取得エラー:', error);
            return null;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('🧹 Puppeteerクリーンアップ完了');
        }
    }
}

// ===============================================
// Claude AI評価システム
// ===============================================

class ClaudeJobEvaluator {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.anthropic.com/v1/messages';
    }

    async evaluateJob(job) {
        try {
            const prompt = this.createEvaluationPrompt(job);
            
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const result = await response.json();
            return this.parseEvaluationResult(result.content[0].text);
            
        } catch (error) {
            console.error('Claude評価エラー:', error);
            return this.getDefaultEvaluation();
        }
    }

    createEvaluationPrompt(job) {
        return `CrowdWorks案件を評価してください。

案件情報：
タイトル: ${job.title}
説明: ${job.description}
価格: ${job.price}
カテゴリ: ${job.category}
期限: ${job.deadline}

以下の観点で100点満点で評価し、JSON形式で回答してください：

{
  "aiRelevance": 85,
  "technicalFeasibility": 90,
  "profitability": 75,
  "timeEfficiency": 80,
  "competitiveAdvantage": 70,
  "overallScore": 80,
  "reasoning": "AIライティング案件で技術的実現可能性が高く、収益性も良好。競合は多いが差別化可能。",
  "estimatedHours": 25,
  "recommendedBid": 180000,
  "keyStrategies": ["Claude API活用でスピード重視", "サンプル提供で差別化", "段階納品で信頼構築"]
}`;
    }

    parseEvaluationResult(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.error('Claude評価結果パースエラー:', error);
        }
        
        return this.getDefaultEvaluation();
    }

    getDefaultEvaluation() {
        return {
            aiRelevance: 70,
            technicalFeasibility: 75,
            profitability: 65,
            timeEfficiency: 70,
            competitiveAdvantage: 60,
            overallScore: 68,
            reasoning: "Claude APIが利用できないため標準評価を適用",
            estimatedHours: 20,
            recommendedBid: 100000,
            keyStrategies: ["技術力をアピール", "迅速な対応", "丁寧なコミュニケーション"]
        };
    }

    async generateProposal(job, evaluation) {
        try {
            const prompt = `CrowdWorks応募文を作成してください。

案件：${job.title}
評価結果：${JSON.stringify(evaluation, null, 2)}

以下の要素を含む、魅力的で差別化された応募文を作成してください：
- 案件理解の表明
- 技術的アプローチの提案
- AI活用による付加価値
- 具体的な納期・価格提案
- 実績・経験のアピール

500文字程度の応募文をMarkdown形式で出力してください。`;

            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1500,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const result = await response.json();
            return result.content[0].text;

        } catch (error) {
            console.error('応募文生成エラー:', error);
            return this.getDefaultProposal(job, evaluation);
        }
    }

    getDefaultProposal(job, evaluation) {
        return `${job.title}の件でご連絡いたします。

AI技術を活用したソリューション提供を得意としており、本案件に最適なアプローチをご提案いたします。

**提案内容：**
- ${evaluation.keyStrategies[0] || '最新AI技術の活用'}
- ${evaluation.keyStrategies[1] || '高品質な成果物の提供'}
- ${evaluation.keyStrategies[2] || '迅速な納品'}

**納期・価格：**
- 納期：${Math.ceil(evaluation.estimatedHours / 8)}日程度
- 価格：¥${evaluation.recommendedBid.toLocaleString()}

過去の類似案件での実績を活かし、期待を上回る成果をお届けいたします。
詳細はお気軽にご相談ください。`;
    }
}

// ===============================================
// 自動応募システム
// ===============================================

class AutoApplicator {
    constructor(crowdWorksSession) {
        this.session = crowdWorksSession;
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: false, // 応募は目視確認のため
                devtools: true
            });
            
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1440, height: 900 });
            
            // CrowdWorksにログイン（セッション復元）
            if (this.session) {
                await this.restoreSession();
            }
            
            return true;
        } catch (error) {
            console.error('自動応募システム初期化エラー:', error);
            return false;
        }
    }

    async restoreSession() {
        // セッションCookie復元
        await this.page.setCookie(...this.session.cookies);
        await this.page.goto('https://crowdworks.jp/dashboard');
        await this.page.waitForTimeout(2000);
    }

    async submitApplication(job, proposal, bidAmount) {
        try {
            console.log(`📤 応募実行中: ${job.title}`);
            
            // 案件ページに移動
            await this.page.goto(job.url);
            await this.page.waitForSelector('.apply-button', { timeout: 10000 });
            
            // 応募ボタンクリック
            await this.page.click('.apply-button');
            await this.page.waitForTimeout(2000);
            
            // 応募フォーム入力
            await this.page.waitForSelector('#proposal_message');
            
            // 提案内容入力
            await this.page.evaluate((text) => {
                document.querySelector('#proposal_message').value = text;
            }, proposal);
            
            // 金額入力（固定金額の場合）
            const priceInput = await this.page.$('#proposed_price');
            if (priceInput && bidAmount) {
                await this.page.evaluate((amount) => {
                    const input = document.querySelector('#proposed_price');
                    if (input) input.value = amount;
                }, bidAmount);
            }
            
            // 確認画面への移動（実際の送信は手動確認）
            console.log('⚠️ 応募内容を確認してください。自動送信は安全のため無効化されています。');
            
            // 5秒間確認時間を設ける
            await this.page.waitForTimeout(5000);
            
            return {
                success: true,
                jobId: job.url,
                status: 'prepared',
                message: '応募フォーム準備完了（手動確認推奨）'
            };
            
        } catch (error) {
            console.error('応募エラー:', error);
            return {
                success: false,
                jobId: job.url,
                error: error.message
            };
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// ===============================================
// 毎日自動実行スケジューラー
// ===============================================

class DailyJobScheduler {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.results = [];
    }

    start(scheduleTime = '9 0 * * *') { // 毎日9時実行
        console.log(`📅 毎日自動スケジューラー開始: ${scheduleTime}`);
        
        cron.schedule(scheduleTime, async () => {
            if (this.isRunning) {
                console.log('⚠️ 前回の実行がまだ完了していません');
                return;
            }
            
            await this.executeDaily();
        });
    }

    async executeDaily() {
        this.isRunning = true;
        this.lastRun = new Date();
        
        console.log('🚀 毎日の自動案件処理を開始します');
        
        try {
            // 1. 案件取得
            const scraper = new CrowdWorksAutomation();
            await scraper.initialize();
            const jobs = await scraper.searchAIJobs();
            
            // 2. AI評価
            const evaluator = new ClaudeJobEvaluator(process.env.CLAUDE_API_KEY);
            const evaluatedJobs = [];
            
            for (const job of jobs.slice(0, 10)) { // 上位10件のみ処理
                const evaluation = await evaluator.evaluateJob(job);
                
                if (evaluation.overallScore > 70) {
                    const proposal = await evaluator.generateProposal(job, evaluation);
                    
                    evaluatedJobs.push({
                        ...job,
                        evaluation,
                        proposal
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000)); // API制限対策
            }
            
            // 3. 結果保存
            await this.saveResults(evaluatedJobs);
            
            // 4. ダッシュボード更新
            await this.updateDashboard(evaluatedJobs);
            
            console.log(`✅ 自動処理完了: ${evaluatedJobs.length}件の有望案件を特定`);
            
            await scraper.cleanup();
            
        } catch (error) {
            console.error('❌ 毎日自動処理エラー:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async saveResults(jobs) {
        const fileName = `results-${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(__dirname, 'data', fileName);
        
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(jobs, null, 2));
            console.log(`💾 結果保存: ${filePath}`);
        } catch (error) {
            console.error('結果保存エラー:', error);
        }
    }

    async updateDashboard(jobs) {
        // ダッシュボード用データ更新
        const summary = {
            date: new Date().toISOString(),
            totalJobs: jobs.length,
            avgScore: jobs.reduce((sum, job) => sum + job.evaluation.overallScore, 0) / jobs.length,
            totalEstimatedRevenue: jobs.reduce((sum, job) => sum + job.evaluation.recommendedBid, 0),
            topJobs: jobs.slice(0, 5).map(job => ({
                title: job.title,
                score: job.evaluation.overallScore,
                estimatedValue: job.evaluation.recommendedBid
            }))
        };

        this.results.push(summary);
        
        // 最新結果をファイルに保存
        try {
            await fs.writeFile(
                path.join(__dirname, 'latest-summary.json'), 
                JSON.stringify(summary, null, 2)
            );
        } catch (error) {
            console.error('サマリー保存エラー:', error);
        }
    }
}

// ===============================================
// API Routes
// ===============================================

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'CW-Agent Auto System',
        timestamp: new Date().toISOString()
    });
});

// 手動案件検索
app.post('/api/search-jobs', async (req, res) => {
    try {
        const { keywords } = req.body;
        
        const scraper = new CrowdWorksAutomation();
        await scraper.initialize();
        const jobs = await scraper.searchAIJobs(keywords);
        await scraper.cleanup();
        
        res.json({
            success: true,
            count: jobs.length,
            jobs: jobs.slice(0, 20) // 最大20件返却
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// AI評価実行
app.post('/api/evaluate-job', async (req, res) => {
    try {
        const { job, apiKey } = req.body;
        
        const evaluator = new ClaudeJobEvaluator(apiKey);
        const evaluation = await evaluator.evaluateJob(job);
        const proposal = await evaluator.generateProposal(job, evaluation);
        
        res.json({
            success: true,
            evaluation,
            proposal
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 自動スケジューラー開始
let scheduler = null;

app.post('/api/start-scheduler', (req, res) => {
    try {
        if (scheduler) {
            return res.json({ 
                success: false, 
                error: 'スケジューラーは既に実行中です' 
            });
        }
        
        scheduler = new DailyJobScheduler();
        scheduler.start();
        
        res.json({ 
            success: true, 
            message: '毎日自動スケジューラーを開始しました' 
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 最新結果取得
app.get('/api/latest-results', async (req, res) => {
    try {
        const summaryPath = path.join(__dirname, 'latest-summary.json');
        const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
        res.json(summary);
        
    } catch (error) {
        res.json({
            date: new Date().toISOString(),
            totalJobs: 0,
            message: 'まだ結果がありません'
        });
    }
});

// ルートパス
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'cw-agent-dashboard.html'));
});

// 404エラーハンドラー
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// グローバルエラーハンドラー
app.use((error, req, res, next) => {
    console.error('サーバーエラー:', error);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message 
    });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`
🚀 CW-Agent完全自動化システム起動完了

📍 ダッシュボード: http://localhost:${PORT}
🤖 自動化機能: 準備完了
📊 API監視: /api/health

================================================
毎日の自動処理フロー:
1. 📊 AI案件自動リサーチ
2. 🤖 Claude評価・応募文生成  
3. 📤 応募準備（手動確認推奨）
4. 📈 結果ダッシュボード更新
================================================
`);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
    console.log('\n🛑 システム終了中...');
    process.exit(0);
});

module.exports = app;
