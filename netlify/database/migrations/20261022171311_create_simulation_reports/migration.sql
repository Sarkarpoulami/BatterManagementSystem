CREATE TABLE "simulation_reports" (
	"id" serial PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"chemistry" text NOT NULL,
	"series_count" integer NOT NULL,
	"parallel_count" integer NOT NULL,
	"simulation_mode" text NOT NULL,
	"load_profile" text NOT NULL,
	"elapsed_ms" double precision NOT NULL,
	"tick_count" integer NOT NULL,
	"pack_voltage" double precision,
	"pack_current" double precision,
	"pack_power" double precision,
	"pack_soc" double precision,
	"pack_soh" double precision,
	"report_data" jsonb NOT NULL
);
