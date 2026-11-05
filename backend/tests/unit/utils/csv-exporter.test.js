const CSVExporter = require('../../../src/utils/csv-exporter');

describe('CSVExporter', () => {
  describe('exportQuarterlyReport (TECH-001)', () => {
    it('should not throw a TypeError and should correctly export quarterly report', () => {
      const reportData = {
        period: 'Q1 2026',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        summary: {
          totalRevenue: 1000,
          totalTransactions: 10
        },
        monthlyBreakdown: [],
        topOwners: []
      };

      const result = CSVExporter.exportQuarterlyReport(reportData);
      expect(result).toContain('RAPPORT TRIMESTRIEL - Q1 2026');
      expect(result).toContain('1000');
    });
  });

  describe('_escapeCSV (TECH-003)', () => {
    it('should escape CSV injection formulas', () => {
      expect(CSVExporter._escapeCSV('=SUM(A1:A2)')).toBe("'=" + 'SUM(A1:A2)');
      expect(CSVExporter._escapeCSV('+123')).toBe("'+123");
      expect(CSVExporter._escapeCSV('-123')).toBe("'-123");
      expect(CSVExporter._escapeCSV('@cmd')).toBe("'@cmd");
    });

    it('should properly handle normal strings and strings with quotes or newlines', () => {
      expect(CSVExporter._escapeCSV('Bonjour')).toBe('Bonjour');
      expect(CSVExporter._escapeCSV('Bonjour, client')).toBe('Bonjour, client');
      expect(CSVExporter._escapeCSV('Client "important"')).toBe('"Client ""important"""');
      expect(CSVExporter._escapeCSV('Ligne 1\nLigne 2')).toBe('"Ligne 1\nLigne 2"');
    });
  });
});
