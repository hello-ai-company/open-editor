/**
 * Phase 4F-4C — shared date-axis model for Timeline / Gantt views.
 */
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildDateAxisFromDateKeys,
  classifyGanttRange,
  classifyTimelineDate,
  compareCanonicalDateKeys,
  dateKeyToOffsetDays,
  dateKeyToPercent,
  daysBetweenCanonicalDates,
  maxCanonicalDateKey,
  minCanonicalDateKey,
  rangeToBarStyle,
  shiftInclusiveRange
} from "../src/workspace/databaseDateAxisModel.js";

describe("compareCanonicalDateKeys", () => {
  it("orders valid keys chronologically", () => {
    expect(compareCanonicalDateKeys("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareCanonicalDateKeys("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareCanonicalDateKeys("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("treats invalid keys as sorting after valid keys", () => {
    expect(compareCanonicalDateKeys("2026-01-01", "not-a-date")).toBe(-1);
    expect(compareCanonicalDateKeys("bad", "2026-01-01")).toBe(1);
    expect(compareCanonicalDateKeys("bad", "worse")).toBe(0);
  });
});

describe("daysBetweenCanonicalDates", () => {
  it("returns 0 for the same day", () => {
    expect(daysBetweenCanonicalDates("2026-09-10", "2026-09-10")).toBe(0);
  });

  it("returns signed day offset (end - start)", () => {
    expect(daysBetweenCanonicalDates("2026-09-10", "2026-09-14")).toBe(4);
    expect(daysBetweenCanonicalDates("2026-09-14", "2026-09-10")).toBe(-4);
  });

  it("handles year boundary 2026-12-31 + 1 day", () => {
    expect(daysBetweenCanonicalDates("2026-12-31", "2027-01-01")).toBe(1);
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap year 2028-02-28 + 1 day", () => {
    expect(daysBetweenCanonicalDates("2028-02-28", "2028-02-29")).toBe(1);
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("returns null for invalid keys", () => {
    expect(daysBetweenCanonicalDates("2026-13-01", "2026-09-10")).toBeNull();
    expect(daysBetweenCanonicalDates("2026-09-10", "nope")).toBeNull();
  });
});

describe("minCanonicalDateKey / maxCanonicalDateKey", () => {
  it("ignores invalid keys", () => {
    expect(minCanonicalDateKey("2026-09-14", "bad", "2026-09-10")).toBe(
      "2026-09-10"
    );
    expect(maxCanonicalDateKey("2026-09-10", "2026-09-14", "invalid")).toBe(
      "2026-09-14"
    );
  });

  it("returns null when all keys invalid", () => {
    expect(minCanonicalDateKey("bad", "")).toBeNull();
    expect(maxCanonicalDateKey("bad")).toBeNull();
  });
});

describe("dateKeyToOffsetDays", () => {
  it("measures offset from axis start", () => {
    expect(dateKeyToOffsetDays("2026-09-10", "2026-09-10")).toBe(0);
    expect(dateKeyToOffsetDays("2026-09-10", "2026-09-14")).toBe(4);
  });
});

describe("dateKeyToPercent", () => {
  it("centers on 50 for a single-day axis", () => {
    expect(dateKeyToPercent("2026-09-10", "2026-09-10", "2026-09-10")).toBe(
      50
    );
  });

  it("maps start/end to 0/100 on multi-day axis", () => {
    expect(dateKeyToPercent("2026-09-10", "2026-09-14", "2026-09-10")).toBe(0);
    expect(dateKeyToPercent("2026-09-10", "2026-09-14", "2026-09-14")).toBe(
      100
    );
  });

  it("clamps out-of-range keys to 0-100", () => {
    expect(dateKeyToPercent("2026-09-10", "2026-09-14", "2026-09-01")).toBe(0);
    expect(dateKeyToPercent("2026-09-10", "2026-09-14", "2026-12-31")).toBe(
      100
    );
  });
});

describe("rangeToBarStyle", () => {
  it("computes inclusive width across the axis", () => {
    const bar = rangeToBarStyle(
      "2026-09-10",
      "2026-09-19",
      "2026-09-10",
      "2026-09-14"
    );
    expect(bar).not.toBeNull();
    expect(bar!.leftPercent).toBe(0);
    expect(bar!.widthPercent).toBe(50);
  });

  it("enforces minimum width for one-day bars", () => {
    const bar = rangeToBarStyle(
      "2026-09-10",
      "2026-09-19",
      "2026-09-12",
      "2026-09-12"
    );
    expect(bar).not.toBeNull();
    expect(bar!.widthPercent).toBeGreaterThanOrEqual(2);
  });

  it("returns null for reversed ranges", () => {
    expect(
      rangeToBarStyle("2026-09-10", "2026-09-19", "2026-09-14", "2026-09-10")
    ).toBeNull();
  });
});

describe("buildDateAxisFromDateKeys", () => {
  it("applies padding around data bounds", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["2026-09-10", "2026-09-14"],
      paddingDays: 2,
      todayKey: "2026-09-01"
    });
    expect(axis.startDateKey).toBe("2026-09-08");
    expect(axis.endDateKey).toBe("2026-09-16");
    expect(axis.spanDays).toBe(9);
  });

  it("uses today ± 7 when no valid date keys", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["", "not-a-date"],
      todayKey: "2026-09-10"
    });
    expect(axis.startDateKey).toBe("2026-09-03");
    expect(axis.endDateKey).toBe("2026-09-17");
    expect(axis.spanDays).toBe(15);
  });

  it("marks today when inside the axis", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["2026-09-10"],
      todayKey: "2026-09-10",
      paddingDays: 0
    });
    expect(axis.todayOffsetDays).toBe(0);
    expect(axis.todayPercent).toBe(50);
  });

  it("leaves today null when outside the axis", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["2026-09-10"],
      todayKey: "2026-12-31",
      paddingDays: 0
    });
    expect(axis.todayOffsetDays).toBeNull();
    expect(axis.todayPercent).toBeNull();
  });

  it("bounds ticks to maxTicks for long ranges (1900-2100)", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["1900-01-01", "2100-12-31"],
      paddingDays: 0,
      maxTicks: 48,
      todayKey: "2000-01-01"
    });
    expect(axis.ticks.length).toBeLessThanOrEqual(48);
    expect(axis.ticks.length).toBeGreaterThan(1);
    expect(axis.startDateKey).toBe("1900-01-01");
    expect(axis.endDateKey).toBe("2100-12-31");
  });

  it("labels year boundaries with full YYYY-MM-DD", () => {
    const axis = buildDateAxisFromDateKeys({
      dateKeys: ["2025-12-15", "2026-01-15"],
      paddingDays: 0,
      maxTicks: 10,
      todayKey: "2025-12-20"
    });
    const janFirst = axis.ticks.find((t) => t.dateKey === "2026-01-01");
    expect(janFirst?.label).toBe("2026-01-01");
  });
});

describe("shiftInclusiveRange", () => {
  it("preserves inclusive duration Sep10-14 → Sep20-24", () => {
    const shifted = shiftInclusiveRange(
      "2026-09-10",
      "2026-09-14",
      "2026-09-20"
    );
    expect(shifted).toEqual({
      start: "2026-09-20",
      end: "2026-09-24"
    });
  });

  it("handles Dec30 → Jan2 span across year boundary", () => {
    const shifted = shiftInclusiveRange(
      "2025-12-30",
      "2026-01-02",
      "2026-12-30"
    );
    expect(shifted).toEqual({
      start: "2026-12-30",
      end: "2027-01-02"
    });
    expect(daysBetweenCanonicalDates(shifted!.start, shifted!.end)).toBe(3);
  });

  it("returns null for invalid inputs", () => {
    expect(
      shiftInclusiveRange("bad", "2026-09-14", "2026-09-20")
    ).toBeNull();
  });
});

describe("classifyTimelineDate", () => {
  it("classifies missing values", () => {
    expect(classifyTimelineDate(null)).toBe("missing");
    expect(classifyTimelineDate(undefined)).toBe("missing");
    expect(classifyTimelineDate("")).toBe("missing");
  });

  it("classifies valid canonical dates", () => {
    expect(classifyTimelineDate("2026-09-10")).toBe("valid");
  });

  it("classifies invalid non-empty strings", () => {
    expect(classifyTimelineDate("Sep 10")).toBe("invalid");
    expect(classifyTimelineDate("2026-13-40")).toBe("invalid");
  });
});

describe("classifyGanttRange", () => {
  it("returns incomplete when an endpoint is missing", () => {
    expect(
      classifyGanttRange({
        startValue: "2026-09-10",
        endValue: "",
        sameProperty: false
      })
    ).toEqual({ kind: "incomplete" });
    expect(
      classifyGanttRange({
        startValue: null,
        endValue: "2026-09-14",
        sameProperty: false
      })
    ).toEqual({ kind: "incomplete" });
  });

  it("returns invalid for reversed ranges without swapping", () => {
    expect(
      classifyGanttRange({
        startValue: "2026-09-14",
        endValue: "2026-09-10",
        sameProperty: false
      })
    ).toEqual({ kind: "invalid" });
  });

  it("returns invalid for non-canonical strings", () => {
    expect(
      classifyGanttRange({
        startValue: "soon",
        endValue: "2026-09-14",
        sameProperty: false
      })
    ).toEqual({ kind: "invalid" });
  });

  it("returns valid range when both endpoints are ordered", () => {
    expect(
      classifyGanttRange({
        startValue: "2026-09-10",
        endValue: "2026-09-14",
        sameProperty: false
      })
    ).toEqual({
      kind: "valid",
      startKey: "2026-09-10",
      endKey: "2026-09-14",
      milestone: false
    });
  });

  it("treats same-day distinct properties as milestone", () => {
    expect(
      classifyGanttRange({
        startValue: "2026-09-10",
        endValue: "2026-09-10",
        sameProperty: false
      })
    ).toEqual({
      kind: "valid",
      startKey: "2026-09-10",
      endKey: "2026-09-10",
      milestone: true
    });
  });

  it("treats same-property single date as milestone", () => {
    expect(
      classifyGanttRange({
        startValue: "2026-09-10",
        endValue: "2026-09-10",
        sameProperty: true
      })
    ).toEqual({
      kind: "valid",
      startKey: "2026-09-10",
      endKey: "2026-09-10",
      milestone: true
    });

    expect(
      classifyGanttRange({
        startValue: "2026-09-10",
        endValue: "",
        sameProperty: true
      })
    ).toEqual({
      kind: "valid",
      startKey: "2026-09-10",
      endKey: "2026-09-10",
      milestone: true
    });
  });

  it("returns incomplete for same-property with no date", () => {
    expect(
      classifyGanttRange({
        startValue: "",
        endValue: "",
        sameProperty: true
      })
    ).toEqual({ kind: "incomplete" });
  });
});
