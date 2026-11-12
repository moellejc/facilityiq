import { describe, expect, it } from "vitest";

import {
  chartCsvFilename,
  chartTableToCsv,
  csvNumber,
  csvText,
  escapeCsvField,
  namedValueChartTable,
  projectChartTable,
  timeSeriesChartTable,
  toCsv,
  type ChartTable,
} from "@/lib/charts/csv";

describe("escapeCsvField", () => {
  it("leaves a plain field unquoted", () => {
    expect(escapeCsvField("Orders per hour")).toBe("Orders per hour");
  });

  it("quotes a field that contains a comma", () => {
    expect(escapeCsvField("Packing, north")).toBe('"Packing, north"');
  });

  it("doubles quotes inside a quoted field", () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it("quotes a field that contains a newline or carriage return", () => {
    expect(escapeCsvField("line\r\nnext")).toBe('"line\r\nnext"');
  });
});

describe("csvText", () => {
  it("prefixes a spreadsheet formula so the cell stays text", () => {
    expect(csvText("=cmd|'/c calc'!A0")).toBe("'=cmd|'/c calc'!A0");
    expect(csvText("+1+1")).toBe("'+1+1");
    expect(csvText("-hidden")).toBe("'-hidden");
    expect(csvText("@sum")).toBe("'@sum");
    expect(csvText("\t=1")).toBe("'\t=1");
  });

  it("drops null bytes and leaves an ordinary name unchanged", () => {
    expect(csvText("Aisle\u000004")).toBe("Aisle04");
  });
});

describe("csvNumber", () => {
  it("keeps a negative measure as a number and normalizes negative zero", () => {
    expect(csvNumber(-2.5)).toBe("-2.5");
    expect(csvNumber(-0)).toBe("0");
  });
});

describe("toCsv", () => {
  it("writes a UTF-8 BOM, RFC 4180 quoting, and CRLF rows", () => {
    expect(toCsv(["Name, role", "Note"], [['He said "hi"\nnext', null]])).toBe(
      '\uFEFF"Name, role",Note\r\n"He said ""hi""\nnext",\r\n',
    );
  });

  it("writes an empty field for null and does not substitute zero", () => {
    expect(toCsv(["Date", "Orders per hour"], [["2026-10-02", null]])).toBe(
      "\uFEFFDate,Orders per hour\r\n2026-10-02,\r\n",
    );
  });
});

describe("timeSeriesChartTable", () => {
  it("keeps a measured zero and writes an unavailable sample as an empty field", () => {
    const table = timeSeriesChartTable({
      points: [
        { date: "2026-10-01", value: 0 },
        { date: "2026-10-02", value: null },
      ],
      label: "Orders per hour",
      unit: "orders/hour",
      sensitivity: "none",
      includeFinance: false,
    });

    expect(table.columns.map((column) => column.header)).toEqual([
      "Date",
      "Orders per hour",
      "Status",
    ]);
    expect(table.rows[0]?.[1]).toEqual({ raw: "0", display: "0.0 orders/hour" });
    expect(table.rows[1]?.[1]).toEqual({ raw: null, display: "Unavailable" });
    expect(table.rows[1]?.[2]).toEqual({ raw: "Unavailable", display: "Unavailable" });
    expect(chartTableToCsv(table)).toBe(
      "\uFEFFDate,Orders per hour,Status\r\n2026-10-01,0,Observed\r\n2026-10-02,,Unavailable\r\n",
    );
  });

  it("omits finance columns when the caller does not include finance", () => {
    const table = timeSeriesChartTable({
      points: [{ date: "2026-10-01", value: 98765.43 }],
      label: "Operating cost",
      unit: "USD",
      sensitivity: "finance",
      includeFinance: false,
    });

    expect(table.columns.map((column) => column.header)).toEqual(["Date"]);
    expect(JSON.stringify(table)).not.toContain("98765.43");
    expect(chartTableToCsv(table)).toBe("\uFEFFDate\r\n2026-10-01\r\n");
  });

  it("keeps the observed cost column when finance is included", () => {
    const table = timeSeriesChartTable({
      points: [{ date: "2026-10-01", value: 180.4 }],
      label: "Operating cost",
      unit: "USD",
      sensitivity: "finance",
      includeFinance: true,
    });

    expect(table.columns.map((column) => column.header)).toEqual([
      "Date",
      "Operating cost (USD)",
      "Status",
    ]);
    expect(table.rows[0]?.[1]).toEqual({ raw: "180.4", display: "$180" });
    expect(chartTableToCsv(table)).toBe(
      "\uFEFFDate,Operating cost (USD),Status\r\n2026-10-01,180.4,Observed\r\n",
    );
  });
});

describe("namedValueChartTable", () => {
  it("quotes a name that contains a comma and a quote", () => {
    const table = namedValueChartTable({
      rows: [{ id: "area-1", name: 'Packing, "A"', value: 91.2, unit: "percent" }],
      label: "Utilization",
      unit: "%",
      sensitivity: "none",
      includeFinance: false,
    });

    expect(table.columns.map((column) => column.header)).toEqual([
      "Name",
      "Utilization (%)",
      "Status",
    ]);
    expect(table.rows[0]?.[1]?.display).toBe("91.2 %");
    expect(chartTableToCsv(table)).toBe(
      '\uFEFFName,Utilization (%),Status\r\n"Packing, ""A""",91.2,Observed\r\n',
    );
  });

  it("prefixes a formula-like name and quotes an embedded newline", () => {
    const table = namedValueChartTable({
      rows: [
        { id: "area-2", name: '=HYPERLINK("http://evil")\nclick', value: 10, unit: "percent" },
      ],
      label: "Utilization",
      unit: "%",
      sensitivity: "none",
      includeFinance: true,
    });

    expect(table.rows[0]?.[0]?.raw?.startsWith("'=HYPERLINK")).toBe(true);
    expect(chartTableToCsv(table)).toContain('"\'=HYPERLINK(""http://evil"")\nclick"');
  });

  it("drops the cost amount when finance columns are filtered out", () => {
    const table = namedValueChartTable({
      rows: [{ id: "labor", name: "Labor", value: 98765.43, unit: "USD" }],
      label: "Amount",
      unit: "USD",
      sensitivity: "finance",
      includeFinance: false,
    });

    expect(table.columns.map((column) => column.header)).toEqual(["Name"]);
    expect(table.rows).toEqual([[{ raw: "Labor", display: "Labor" }]]);
    expect(chartTableToCsv(table)).toBe("\uFEFFName\r\nLabor\r\n");
  });
});

describe("projectChartTable", () => {
  it("removes a finance column without shifting the public cells beside it", () => {
    const source: ChartTable = {
      columns: [
        { header: "Name", sensitivity: "none" },
        { header: "Operating cost (USD)", sensitivity: "finance" },
        { header: "Note", sensitivity: "none" },
      ],
      rows: [
        [
          { raw: "Labor", display: "Labor" },
          { raw: "98765.43", display: "$98,765" },
          { raw: "facility", display: "facility" },
        ],
      ],
    };

    const projected = projectChartTable(source, { includeFinance: false });

    expect(projected.columns.map((column) => column.header)).toEqual(["Name", "Note"]);
    expect(projected.rows).toEqual([
      [
        { raw: "Labor", display: "Labor" },
        { raw: "facility", display: "facility" },
      ],
    ]);
  });
});

describe("chartCsvFilename", () => {
  it("slugs the title and appends a validated day range", () => {
    expect(chartCsvFilename("Throughput over time", { from: "2026-10-03", to: "2026-11-01" })).toBe(
      "throughput-over-time-2026-10-03-to-2026-11-01.csv",
    );
  });

  it("strips path characters and ignores a range that is not a day", () => {
    expect(chartCsvFilename("../etc/passwd", { from: "2026/01/01", to: "2026-11-01" })).toBe(
      "etc-passwd.csv",
    );
    expect(chartCsvFilename("   ")).toBe("chart.csv");
  });
});
