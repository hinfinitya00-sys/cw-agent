// CrowdWorks スクレイピングと其田さん専用システム統合
// ユーザー要求の案件分析条件を完全組み込み版

import CrowdWorksRealScraper from './crowdworks-real-scraper.js';
import SonodaProposalSystem from './sonoda-proposal-system.js';

class CrowdWorksIntegration {
    constructor() {
        this.scraper = new CrowdWorksRealScraper();
        this.proposalSystem = new SonodaProposalSystem();

        // ユーザー指定の案件分析条件を定義
        this.analysisCriteria = {
            // 1. 契約形態: 成果物納品型 ↔ 時間拘束型（SES的）❌
            contractType: {
                required: "成果物納品型",
                prohibited: ["時間拘束型", "SES的"],
                deliverableKeywords: [
                    "納品物", "成果物", "システム開発", "ツール作成", "アプリ開発",
                    "API開発", "Webサイト制作", "プログラム作成", "スクリプト開発",
                    "完成品", "最終成果", "納品"
                ],
                prohibitedKeywords: [
                    "SES", "派遣", "常駐", "出社必須", "勤務時間", "平日〇時〜〇時",
                    "週〇日", "月〇時間", "時給", "日給", "時間単価", "常駐開発",
                    "オンサイト", "オフィス勤務", "定時", "シフト", "勤務地",
                    "チーム参加", "長期契約", "継続勤務", "駐在"
                ]
            },

            // 2. 作業形態: 単発完了型 ↔ 継続監視・常駐型❌
            workType: {
                required: "単発完了型",
                prohibited: ["継続監視型", "常駐型"],
                singleProjectKeywords: [
                    "納品後完了", "プロジェクト完了", "開発完了", "1回限り",
                    "単発", "短期", "期限付き", "完成まで", "修正〇回まで"
                ],
                prohibitedWorkTypes: [
                    "運用サポート", "保守", "メンテナンス", "監視", "管理業務",
                    "継続サポート", "長期運用", "24時間対応", "常時監視",
                    "定期作業", "ルーチンワーク", "継続的", "恒常的"
                ]
            },

            // 3. 技術実現性: Claude/Gemini APIで実際に作れるか
            technicalFeasibility: {
                claudeAPIStrengths: [
                    "テキスト生成", "コンテンツ作成", "文書作成", "翻訳", "要約",
                    "チャットボット", "API連携", "自動応答", "記事生成", "分析",
                    "プログラム生成", "コード作成", "レポート作成", "データ処理"
                ],
                geminiAPIStrengths: [
                    "画像認識", "多言語処理", "データ分析", "推論", "複合AI",
                    "マルチモーダル", "画像解析", "音声処理", "パターン認識"
                ],
                impossibleTasks: [
                    "物理作業", "対面営業", "電話対応", "ハードウェア操作",
                    "現地調査", "人間関係構築", "接客", "販売", "配達",
                    "製造", "建設", "修理", "実地作業"
                ]
            },

            // 4. 仕様明確度: 明確な成果物 ↔ 曖昧な業務委託❌
            specificationClarity: {
                required: "明確な成果物定義",
                prohibited: ["曖昧な業務委託"],
                clearSpecKeywords: [
                    "仕様書", "要件定義", "明確な", "具体的な", "詳細な",
                    "機能一覧", "画面設計", "API仕様", "データ構造",
                    "納品物リスト", "完成条件", "受入条件"
                ],
                vagueSpecWarnings: [
                    "詳細は相談", "後で決める", "おまかせ", "適当に",
                    "よろしく", "なんとなく", "イメージで", "感覚的に",
                    "相談しながら", "進めながら決める", "曖昧", "未定"
                ]
            },

            // 5. 総合評価基準
            overallCriteria: {
                minimumScore: 80, // 80点以上で推奨
                autoRejectConditions: [
                    "SES・派遣要素あり",
                    "時間拘束・常駐要素あり",
                    "技術的に実現不可能",
                    "仕様が完全に不明確"
                ]
            }
        };
    }

    async executeFullPipeline(searchKeywords = ['AI', 'ChatGPT', 'Claude', 'システム開発']) {
        try {
            await this.scraper.initialize();

            const allJobs = [];
            for (const keyword of searchKeywords) {
                console.log(`🔍 検索キーワード: ${keyword}`);
                const jobs = await this.scraper.scrapeJobListings({ keyword });
                allJobs.push(...jobs);
            }

            const uniqueJobs = this.removeDuplicates(allJobs);
            console.log(`📊 重複除去後: ${uniqueJobs.length}件`);

            // ユーザー要求の4条件による詳細フィルタリング
            const filteredJobs = this.filterJobsWithCriteria(uniqueJobs);
            console.log(`🎯 条件適合フィルタリング後: ${filteredJobs.length}件`);

            const top5Jobs = filteredJobs.slice(0, 5);
            const proposalsWithJobs = top5Jobs.map(job => ({
                ...job,
                sonodaProposal: this.proposalSystem.generateSonodaProposal(job),
                analysisResult: job.analysisResult
            }));

            const today = new Date().toISOString().split('T')[0];
            await this.scraper.saveJobsToFile(uniqueJobs, `all_jobs_${today}.json`);
            await this.scraper.saveJobsToFile(proposalsWithJobs, `daily_proposals_with_analysis_${today}.json`);

            console.log('✅ ユーザー条件対応完全パイプライン実行完了');

            return {
                totalJobs: uniqueJobs.length,
                filteredJobs: filteredJobs.length,
                proposalsGenerated: proposalsWithJobs.length,
                dailyProposals: proposalsWithJobs,
                criteriaUsed: Object.keys(this.analysisCriteria)
            };
        } finally {
            await this.scraper.close();
        }
    }

    removeDuplicates(jobs) {
        const seen = new Set();
        return jobs.filter(job => {
            const key = job.title + job.url;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // ユーザー要求の4つの条件を完全実装したフィルタリング
    filterJobsWithCriteria(jobs) {
        return jobs
            .map(job => {
                const analysisResult = this.analyzeJobWithUserCriteria(job);
                return { ...job, analysisResult };
            })
            .filter(job => job.analysisResult.recommendation === 'RECOMMENDED')
            .sort((a, b) => {
                if (a.analysisResult.totalScore !== b.analysisResult.totalScore) {
                    return b.analysisResult.totalScore - a.analysisResult.totalScore;
                }
                return (b.maxPrice || 0) - (a.maxPrice || 0);
            });
    }

    // ユーザー指定の4条件による案件分析
    analyzeJobWithUserCriteria(job) {
        const jobText = ((job.description || '') + ' ' + (job.title || '') + ' ' + (job.requirements || '')).toLowerCase();
        const criteria = this.analysisCriteria;

        let scores = { contractType: 0, workType: 0, techFeasibility: 0, specClarity: 0 };
        let flags = [];
        let autoReject = false;

        // 1. 契約形態分析
        const prohibitedContractFound = criteria.contractType.prohibitedKeywords
            .filter(word => jobText.includes(word.toLowerCase()));

        if (prohibitedContractFound.length > 0) {
            scores.contractType = 0;
            autoReject = true;
            flags.push(`❌ SES・時間拘束: ${prohibitedContractFound.slice(0, 3).join(", ")}`);
        } else {
            const deliverableFound = criteria.contractType.deliverableKeywords
                .filter(word => jobText.includes(word.toLowerCase()));
            scores.contractType = Math.min(100, deliverableFound.length * 20);
            if (deliverableFound.length > 0) {
                flags.push(`✅ 納品型: ${deliverableFound.slice(0, 2).join(", ")}`);
            }
        }

        // 2. 作業形態分析
        const prohibitedWorkFound = criteria.workType.prohibitedWorkTypes
            .filter(word => jobText.includes(word.toLowerCase()));

        if (prohibitedWorkFound.length > 0) {
            scores.workType = 0;
            autoReject = true;
            flags.push(`❌ 継続・監視型: ${prohibitedWorkFound.slice(0, 2).join(", ")}`);
        } else {
            const singleProjectFound = criteria.workType.singleProjectKeywords
                .filter(word => jobText.includes(word.toLowerCase()));
            scores.workType = Math.min(100, singleProjectFound.length * 25 + 50);
            if (singleProjectFound.length > 0) {
                flags.push(`✅ 単発型: ${singleProjectFound.slice(0, 2).join(", ")}`);
            }
        }

        // 3. 技術実現性分析
        const claudeStrengths = criteria.technicalFeasibility.claudeAPIStrengths
            .filter(skill => jobText.includes(skill.toLowerCase()));
        const geminiStrengths = criteria.technicalFeasibility.geminiAPIStrengths
            .filter(skill => jobText.includes(skill.toLowerCase()));
        const impossibleTasks = criteria.technicalFeasibility.impossibleTasks
            .filter(task => jobText.includes(task.toLowerCase()));

        if (impossibleTasks.length > 0) {
            scores.techFeasibility = 0;
            autoReject = true;
            flags.push(`❌ API実現不可: ${impossibleTasks.slice(0, 2).join(", ")}`);
        } else {
            scores.techFeasibility = Math.min(100, (claudeStrengths.length * 30) + (geminiStrengths.length * 20));
            if (claudeStrengths.length > 0) flags.push(`✅ Claude適合: ${claudeStrengths.slice(0, 2).join(", ")}`);
            if (geminiStrengths.length > 0) flags.push(`✅ Gemini適合: ${geminiStrengths.slice(0, 2).join(", ")}`);
        }

        // 4. 仕様明確度分析
        const clearSpecs = criteria.specificationClarity.clearSpecKeywords
            .filter(word => jobText.includes(word.toLowerCase()));
        const vagueSpecs = criteria.specificationClarity.vagueSpecWarnings
            .filter(word => jobText.includes(word.toLowerCase()));

        scores.specClarity = Math.max(0, clearSpecs.length * 25 - vagueSpecs.length * 15);
        if (clearSpecs.length > 0) flags.push(`✅ 仕様明確: ${clearSpecs.slice(0, 2).join(", ")}`);
        if (vagueSpecs.length > 0) flags.push(`⚠️ 曖昧要素: ${vagueSpecs.slice(0, 2).join(", ")}`);

        // 5. 総合評価
        const totalScore = Math.round(
            (scores.contractType * 0.30) +
            (scores.workType * 0.25) +
            (scores.techFeasibility * 0.25) +
            (scores.specClarity * 0.20)
        );

        const recommendation = (autoReject || totalScore < criteria.overallCriteria.minimumScore)
            ? 'REJECTED'
            : 'RECOMMENDED';

        return { scores, totalScore, recommendation, flags, autoReject, criteriaUsed: "ユーザー指定4条件" };
    }
}

export default CrowdWorksIntegration;
