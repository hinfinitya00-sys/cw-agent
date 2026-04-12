// 毎日の案件取得・応募文生成スクリプト
import CrowdWorksIntegration from '../js/crowdworks-scraper-integration-with-criteria.js';

async function dailyScrape() {
    console.log('🌅 其田さん専用日次案件取得開始...');

    const integration = new CrowdWorksIntegration();

    try {
        const result = await integration.executeFullPipeline([
            'AI ChatGPT',
            'Claude API',
            'システム開発',
            'Webアプリケーション',
            '自動化'
        ]);

        console.log('📊 実行結果:');
        console.log(`- 総案件数: ${result.totalJobs}件`);
        console.log(`- フィルタ後: ${result.filteredJobs}件`);
        console.log(`- 応募文生成: ${result.proposalsGenerated}件`);

        console.log('🎯 生成された応募文:');
        result.dailyProposals.forEach((job, index) => {
            console.log(`\n【案件${index + 1}】${job.title}`);
            console.log(`価格: ${job.price || '不明'}`);
            console.log(`応募文: ${job.sonodaProposal?.proposal?.slice(0, 50)}...`);
        });

    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
}

dailyScrape();
