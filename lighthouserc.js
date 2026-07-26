// Lighthouse CI config. Runs against the built static export (apps/web/out),
// which @lhci/cli serves itself. Budgets are enforced on every PR by
// .github/workflows/lighthouse.yml.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './apps/web/out',
      // Explicit files (the site uses trailingSlash, so pages are */index.html).
      url: ['http://localhost/index.html', 'http://localhost/stats/index.html'],
      numberOfRuns: 3,
      settings: {
        // Desktop-class run for a portfolio; avoids noisy mobile-throttling flakiness.
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      // Keep the report inside the workflow run (uploaded as an artifact) — no
      // external upload service.
      target: 'filesystem',
      outputDir: './lhci-report',
      reportFilenamePattern: '%%PATHNAME%%-report.%%EXTENSION%%',
    },
  },
}
