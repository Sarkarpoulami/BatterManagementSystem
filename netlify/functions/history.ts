import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { simulationReports } from "../../db/schema.js";
import { desc, eq } from "drizzle-orm";

export default async (req: Request) => {
  if (req.method === "GET") {
    try {
      const reports = await db.select().from(simulationReports).orderBy(desc(simulationReports.createdAt)).limit(50);
      return Response.json(reports);
    } catch (err) {
      console.error("History GET error", err);
      return Response.json({ error: "Failed to fetch history" }, { status: 500 });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const [report] = await db
        .insert(simulationReports)
        .values({
          title: body.title || `Simulation ${new Date().toLocaleString()}`,
          chemistry: body.chemistry || "unknown",
          seriesCount: body.seriesCount || 1,
          parallelCount: body.parallelCount || 1,
          simulationMode: body.simulationMode || "idle",
          loadProfile: body.loadProfile || "custom",
          elapsedMs: body.elapsedMs || 0,
          tickCount: body.tickCount || 0,
          packVoltage: body.packVoltage ?? null,
          packCurrent: body.packCurrent ?? null,
          packPower: body.packPower ?? null,
          packSoC: body.packSoC ?? null,
          packSoH: body.packSoH ?? null,
          reportData: body.reportData || {},
        })
        .returning();
      return Response.json(report, { status: 201 });
    } catch (err) {
      console.error("History POST error", err);
      return Response.json({ error: "Failed to save report" }, { status: 500 });
    }
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });
    try {
      await db.delete(simulationReports).where(eq(simulationReports.id, Number(id)));
      return Response.json({ success: true });
    } catch (err) {
      console.error("History DELETE error", err);
      return Response.json({ error: "Failed to delete report" }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/history",
};
