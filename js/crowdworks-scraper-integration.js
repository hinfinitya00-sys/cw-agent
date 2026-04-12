// CrowdWorks スクレイピングと其田さん専用システム統合
import CrowdWorksRealScraper from './crowdworks-real-scraper.js';
import SonodaProposalSystem from './sonoda-proposal-system.js';

class CrowdWorksIntegration {
    constructor() {
        this.scraper = new CrowdWorksRealScraper();
        this.proposalSystem = new SonodaProposalSystem();
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

            const filteredJobs = this.filterJobs(uniqueJobs);
            console.log(`🎯 フィルタリング後: ${filteredJobs.length}件`);

            const top5Jobs = filteredJobs.slice(0, 5);
            const proposalsWithJobs = top5Jobs.map(job => ({
                ...job,
                sonodaProposal: this.proposalSystem.generateSonodaProposal(job)
            }));

            const today = new Date().toISOString().split('T')[0];
            await this.scraper.saveJobsToFile(uniqueJobs, `all_jobs_${today}.json`);
            await this.scraper.saveJobsToFile(proposalsWithJobs, `daily_proposals_${today}.json`);

            console.log('✅ 完全パイプライン実行完了');

            return {
                totalJobs: uniqueJobs.length,
                filteredJobs: filteredJobs.length,
                proposalsGenerated: proposalsWithJobs.length,
                dailyProposals: proposalsWithJobs
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

    filterJobs(jobs) {
        return jobs
            .filter(job => {
                if (!job.title || job.title.length < 5) return false;
                if (job.minPrice && job.minPrice < 10000) return false;
                const priority = (job.isAI ? 3 : 0) + (job.isDevelopment ? 2 : 0);
                job.priority = priority;
                return true;
            })
            .sort((a, b) => {
                if (a.priority !== b.priority) return b.priority - a.priority;
                if (a.maxPrice !== b.maxPrice) return (b.maxPrice || 0) - (a.maxPrice || 0);
                return (a.applicants || 999) - (b.applicants || 999);
            });
    }
}

export default CrowdWorksIntegration;
