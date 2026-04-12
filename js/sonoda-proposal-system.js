// 其田さん専用応募文生成システム
class SonodaProposalSystem {
    generateSonodaProposal(job) {
        const content = `${job.title} ${job.description || ''}`.toLowerCase();
        const techNeeded = content.includes('chatgpt') ? 'ChatGPT API' :
                          content.includes('claude') ? 'Claude API' :
                          content.includes('ai') ? 'AI技術' : 'Web技術';

        const priceMatch = job.price ? job.price.match(/(\d+,?\d*)/g) : null;
        const maxPrice = priceMatch ? parseInt(priceMatch[priceMatch.length - 1].replace(',', '')) : 100000;
        const estimatedDays = Math.ceil(maxPrice / 12000);

        const sonodaProposal = `初めまして、其田（そのだ）と申します。

${job.title}の件でご連絡いたします。

拝見させていただきました。${techNeeded}での開発について対応可能です。

${estimatedDays}日程度での納品を考えております。

詳細について、お聞かせいただけますでしょうか。

よろしくお願いいたします。`;

        return {
            proposal: sonodaProposal,
            summary: {
                応募者: '其田（そのだ）',
                案件: job.title,
                技術: techNeeded,
                納期: `${estimatedDays}日`,
                収益: `¥${maxPrice.toLocaleString()}`,
                文字数: sonodaProposal.length
            }
        };
    }

    generateDaily5(jobs) {
        return jobs.slice(0, 5).map((job, index) => {
            const result = this.generateSonodaProposal(job);
            return {
                案件番号: index + 1,
                案件名: job.title,
                応募文: result.proposal,
                サマリー: result.summary,
                コピー用: `=== 案件${index + 1}: ${job.title} ===

${result.proposal}

=== ここまでコピー ===`
            };
        });
    }
}

export default SonodaProposalSystem;
