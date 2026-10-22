import { pgTable, serial, text, timestamp, integer, jsonb, doublePrecision } from "drizzle-orm/pg-core";

export const simulationReports = pgTable("simulation_reports", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  title: text("title").notNull(),
  chemistry: text("chemistry").notNull(),
  seriesCount: integer("series_count").notNull(),
  parallelCount: integer("parallel_count").notNull(),
  simulationMode: text("simulation_mode").notNull(),
  loadProfile: text("load_profile").notNull(),
  elapsedMs: doublePrecision("elapsed_ms").notNull(),
  tickCount: integer("tick_count").notNull(),
  packVoltage: doublePrecision("pack_voltage"),
  packCurrent: doublePrecision("pack_current"),
  packPower: doublePrecision("pack_power"),
  packSoC: doublePrecision("pack_soc"),
  packSoH: doublePrecision("pack_soh"),
  reportData: jsonb("report_data").notNull(),
});
