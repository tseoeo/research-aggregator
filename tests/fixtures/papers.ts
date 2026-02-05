/**
 * Paper Test Fixtures
 *
 * Sample paper data for testing.
 */

export function createPaperFixture(overrides: Partial<{
  id: string;
  externalId: string;
  title: string;
  abstract: string;
  categories: string[];
  primaryCategory: string;
  publishedAt: Date;
  pdfUrl: string;
  summaryBullets: string[] | null;
  summaryEli5: string | null;
}> = {}) {
  const baseDate = new Date('2026-01-15');
  const randomNum = Math.floor(Math.random() * 100000);

  return {
    id: overrides.id || `test-paper-${randomNum}`,
    externalId: overrides.externalId || `2601.${String(randomNum).padStart(5, '0')}`,
    title: overrides.title || 'Attention Is All You Need: A Novel Transformer Architecture',
    abstract: overrides.abstract || 'We propose a new architecture based entirely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
    categories: overrides.categories || ['cs.AI', 'cs.LG'],
    primaryCategory: overrides.primaryCategory || 'cs.AI',
    publishedAt: overrides.publishedAt || baseDate,
    pdfUrl: overrides.pdfUrl || `https://arxiv.org/pdf/2601.${String(randomNum).padStart(5, '0')}.pdf`,
    summaryBullets: overrides.summaryBullets !== undefined ? overrides.summaryBullets : [
      'Introduces a novel attention-based architecture that eliminates the need for recurrence and convolutions.',
      'Achieves state-of-the-art results on machine translation benchmarks.',
      'Significantly reduces training time compared to recurrent models.',
    ],
    summaryEli5: overrides.summaryEli5 !== undefined ? overrides.summaryEli5 : 'This paper introduces a new way for computers to understand language by paying attention to all words at once, instead of reading them one by one like humans do.',
  };
}

export function createPapersFixture(count: number, overrides: Partial<ReturnType<typeof createPaperFixture>> = {}) {
  return Array.from({ length: count }, (_, i) =>
    createPaperFixture({
      ...overrides,
      id: `test-paper-${i}`,
      externalId: `2601.${String(10000 + i).padStart(5, '0')}`,
      title: `Test Paper ${i + 1}: ${overrides.title || 'Research on AI'}`,
    })
  );
}

/**
 * Sample arXiv XML response for mocking
 */
export const mockArxivXmlSinglePaper = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <opensearch:totalResults>1</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>1</opensearch:itemsPerPage>
  <entry>
    <id>http://arxiv.org/abs/2601.12345v1</id>
    <title>Attention Is All You Need: A Transformer Architecture</title>
    <summary>We propose a new architecture based entirely on attention mechanisms.</summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
    <arxiv:primary_category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <published>2026-01-15T00:00:00Z</published>
    <updated>2026-01-16T00:00:00Z</updated>
    <link href="http://arxiv.org/pdf/2601.12345v1" title="pdf" type="application/pdf"/>
  </entry>
</feed>`;

export const mockArxivXmlEmpty = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>0</opensearch:totalResults>
</feed>`;

export function createArxivXmlMultiplePapers(count: number): string {
  const entries = Array.from({ length: count }, (_, i) => `
    <entry>
      <id>http://arxiv.org/abs/2601.${String(10000 + i).padStart(5, '0')}v1</id>
      <title>Test Paper ${i + 1}</title>
      <summary>Abstract for paper ${i + 1}</summary>
      <author><name>Author ${i + 1}</name></author>
      <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
      <arxiv:primary_category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
      <published>2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z</published>
      <updated>2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z</updated>
    </entry>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <opensearch:totalResults>${count}</opensearch:totalResults>
  <opensearch:startIndex>0</opensearch:startIndex>
  <opensearch:itemsPerPage>${count}</opensearch:itemsPerPage>
  ${entries}
</feed>`;
}
