CREATE TABLE "post_view" (
	"post_id" text NOT NULL,
	"day" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_view_post_id_day_visitor_hash_pk" PRIMARY KEY("post_id","day","visitor_hash")
);
--> statement-breakpoint
ALTER TABLE "site_settings" ALTER COLUMN "landing_text" SET DEFAULT 'Un espace pour écrire et partager des textes.';--> statement-breakpoint
ALTER TABLE "post_view" ADD CONSTRAINT "post_view_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_view_post_id_idx" ON "post_view" USING btree ("post_id");